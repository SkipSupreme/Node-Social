import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { initializePostMetrics, updatePostMetrics } from '../lib/metrics.js';
import {
  calculateFeedScore,
  calculateScoreBreakdown,
  getDefaultPreferences,
  calculatePersonalizationScore,
  buildVibeProfileFromReactions,
  buildTrustNetwork,
  type FeedPreferences,
  type PersonalizationContext
} from '../lib/feedScoring.js';
import { syncPostToMeili } from '../lib/searchSync.js';
import { logModAction } from '../lib/moderation.js';
import { ExpertService, type ExpertRule } from '../services/expertService.js';

const postRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new post
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        content: z.string().min(1).max(6000).optional(), // Optional when poll is present
        nodeId: z.string().uuid().optional(), // Optional node/community
        title: z.string().min(1).max(300),
        linkUrl: z.string().url().optional(),
        expertGateCred: z.number().int().min(0).max(10000).optional(), // Min cred to comment
        poll: z.object({
          question: z.string().min(1).max(300),
          options: z.array(z.string().min(1).max(100)).min(2).max(4),
          duration: z.number().min(1).max(7).default(3), // Days
        }).optional(),
      }).refine(
        (data) => data.content || data.poll || data.linkUrl,
        { message: 'Post must have content, a poll, or a link' }
      );

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, nodeId: providedNodeId, title, linkUrl, poll, expertGateCred } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Default to global node if no nodeId provided
      let nodeId = providedNodeId;
      if (!nodeId) {
        const globalNode = await fastify.prisma.node.findUnique({ where: { slug: 'global' } });
        if (globalNode) {
          nodeId = globalNode.id;
        }
      }

      // Check if node exists if nodeId is provided
      if (nodeId) {
        const node = await fastify.prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) {
          return reply.status(404).send({ error: 'Node not found' });
        }
      }

      let linkMetaId: string | undefined;
      if (linkUrl) {
        const meta = await fastify.prisma.linkMetadata.findUnique({ where: { url: linkUrl } });
        if (meta) {
          linkMetaId = meta.id;
        }
      }

      // Determine post type based on content
      let postType = 'text';
      if (poll && !content) {
        postType = 'poll';
      } else if (linkUrl && !content) {
        postType = 'link';
      }

      const postData: Prisma.PostCreateInput = {
        content: content ?? null,
        title: title ?? null,
        postType,
        author: { connect: { id: userId } },
        linkUrl: linkUrl ?? null,
        expertGateCred: expertGateCred ?? null,
        ...(nodeId ? { node: { connect: { id: nodeId } } } : {}),
        ...(linkMetaId ? { linkMeta: { connect: { id: linkMetaId } } } : {}),
      };

      if (poll) {
        postData.poll = {
          create: {
            question: poll.question,
            endsAt: new Date(Date.now() + poll.duration * 24 * 60 * 60 * 1000),
            options: {
              create: poll.options.map((opt, index) => ({
                text: opt,
                order: index,
              })),
            },
          },
        };
      }

      const post = await fastify.prisma.post.create({
        data: postData,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              era: true,
              cred: true,
            },
          },
          linkMeta: true,
          poll: {
            include: {
              options: true,
            }
          }
        },
      });

      // Award Cred for posting
      await fastify.prisma.user.update({
        where: { id: userId },
        data: { cred: { increment: 1 } }
      });

      await fastify.prisma.credTransaction.create({
        data: {
          userId,
          amount: 1,
          reason: 'created_post'
        }
      });

      // Initialize PostMetric (fire-and-forget, don't block response)
      initializePostMetrics(fastify, post.id).catch((err) => {
        fastify.log.error({ err, postId: post.id }, 'Failed to initialize metrics');
      });

      // Sync to MeiliSearch (fire-and-forget)
      syncPostToMeili(fastify, post.id).catch((err) => {
        fastify.log.error({ err, postId: post.id }, 'Failed to sync to MeiliSearch');
      });

      return reply.status(201).send(post);
    }
  );

  // Get feed (all posts or filtered by node)
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate], // Require auth for feed for now
    },
    async (request, reply) => {
      const schema = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        nodeId: z.string().uuid().optional(),
        authorId: z.string().uuid().optional(),
        postType: z.string().optional(), // Single post type: "text", "image", "video", "link"
        postTypes: z.string().optional(), // Multiple post types: "text,image,video" (comma-separated)
        qualityWeight: z.coerce.number().min(0).max(100).optional(),
        recencyWeight: z.coerce.number().min(0).max(100).optional(),
        engagementWeight: z.coerce.number().min(0).max(100).optional(),
        personalizationWeight: z.coerce.number().min(0).max(100).optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { cursor, limit, nodeId, authorId, postType, postTypes } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Phase 4.2 - Post Type Filtering
      // Support filtering by post type (text, image, video, link)
      // Allows users to create Twitter/Bluesky (text-only), TikTok (video-only), etc. experiences
      let postTypeFilter: string[] | undefined;
      if (postTypes) {
        // Multiple types: comma-separated
        postTypeFilter = postTypes.split(',').map((t) => t.trim());
      } else if (postType) {
        // Single type
        postTypeFilter = [postType.trim()];
      }

      // Load user feed preferences or use defaults
      let preferences: FeedPreferences;

      // Ensure Prisma is available
      if (!fastify.prisma) {
        fastify.log.error('Prisma client not available - server may need restart after schema changes');
        return reply.status(500).send({ error: 'Database connection not available. Please restart the server.' });
      }

      try {
        const userPrefs = await fastify.prisma.userFeedPreference.findUnique({
          where: { userId },
        });

        if (userPrefs) {
          preferences = {
            qualityWeight: parsed.data.qualityWeight ?? userPrefs.qualityWeight,
            recencyWeight: parsed.data.recencyWeight ?? userPrefs.recencyWeight,
            engagementWeight: parsed.data.engagementWeight ?? userPrefs.engagementWeight,
            personalizationWeight: parsed.data.personalizationWeight ?? userPrefs.personalizationWeight,
            recencyHalfLife: userPrefs.recencyHalfLife,
            followingOnly: userPrefs.followingOnly,
          };
        } else {
          const defaults = getDefaultPreferences();
          preferences = {
            qualityWeight: parsed.data.qualityWeight ?? defaults.qualityWeight,
            recencyWeight: parsed.data.recencyWeight ?? defaults.recencyWeight,
            engagementWeight: parsed.data.engagementWeight ?? defaults.engagementWeight,
            personalizationWeight: parsed.data.personalizationWeight ?? defaults.personalizationWeight,
            recencyHalfLife: defaults.recencyHalfLife,
            followingOnly: defaults.followingOnly,
          };
        }
      } catch (error) {
        // If userFeedPreference table doesn't exist or Prisma not ready, use defaults
        fastify.log.warn({ err: error }, 'Failed to load feed preferences, using defaults');
        preferences = getDefaultPreferences();
      }

      // Phase 4: Expert Config Override & Rules
      let expertRules: ExpertRule[] = [];
      if (nodeId) {
        const nodeConfig = await fastify.prisma.nodeVectorConfig.findUnique({
          where: { nodeId },
        });

        if (nodeConfig) {
          // Override preferences if expert config exists
          const expertConfig = (nodeConfig as any).expertConfig;
          if (expertConfig && Object.keys(expertConfig).length > 0) {
            preferences = {
              ...preferences,
              ...expertConfig
            };
          }

          // Load rules
          const suppression = (nodeConfig as any).suppressionRules as any[] || [];
          const boost = (nodeConfig as any).boostRules as any[] || [];
          // Validate and combine
          try {
            expertRules = [
              ...ExpertService.validateRules(suppression.map(r => ({ ...r, action: { type: 'suppress' } }))),
              ...ExpertService.validateRules(boost.map(r => ({ ...r, action: { type: 'boost', multiplier: r.action?.multiplier } })))
            ];
          } catch (e) {
            fastify.log.warn({ err: e }, 'Failed to validate expert rules');
          }
        }
      }

      const where: Prisma.PostWhereInput = {
        deletedAt: null, // Exclude deleted posts
        visibility: { not: 'removed' }, // Exclude mod-removed posts
      };

      if (nodeId) where.nodeId = nodeId;
      if (authorId) where.authorId = authorId;

      // Phase 4.2 - Post Type Filtering
      if (postTypeFilter && postTypeFilter.length > 0) {
        where.postType = { in: postTypeFilter };
      }

      // Following-Only Feed Filter
      if (preferences.followingOnly) {
        const following = await fastify.prisma.userFollow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        const followingIds = following.map((f) => f.followingId);
        // Include user's own posts too
        followingIds.push(userId);
        where.authorId = { in: followingIds };
      }

      // Block/Mute Enforcement - Hide posts from blocked/muted users
      const [blocks, mutes, mutedNodes] = await Promise.all([
        fastify.prisma.userBlock.findMany({
          where: { blockerId: userId },
          select: { blockedId: true },
        }),
        fastify.prisma.userMute.findMany({
          where: { muterId: userId },
          select: { mutedId: true },
        }),
        // Get muted nodes to filter from feed
        fastify.prisma.nodeMute.findMany({
          where: { userId },
          select: { nodeId: true },
        }),
      ]);

      const excludedUserIds = [
        ...blocks.map((b) => b.blockedId),
        ...mutes.map((m) => m.mutedId),
      ];

      if (excludedUserIds.length > 0) {
        if (where.authorId && typeof where.authorId === 'object') {
          // Combine with existing filter (e.g., followingOnly `in` filter)
          where.authorId = { ...where.authorId, notIn: excludedUserIds };
        } else if (where.authorId && typeof where.authorId === 'string') {
          // Single author filter - don't modify (they're viewing a specific user's posts)
          // Only filter if that user isn't blocked/muted
          if (excludedUserIds.includes(where.authorId)) {
            // Return empty result - user is trying to view blocked/muted user's posts
            return reply.send({ posts: [], nextCursor: undefined, hasMore: false });
          }
        } else {
          where.authorId = { notIn: excludedUserIds };
        }
      }

      // Node Mute Enforcement - Hide posts from muted nodes (unless viewing that specific node)
      const mutedNodeIds = mutedNodes.map((m) => m.nodeId);
      if (mutedNodeIds.length > 0 && !nodeId) {
        // Only filter muted nodes when viewing the global feed, not when viewing a specific node
        where.nodeId = { notIn: mutedNodeIds };
      }

      // Fetch posts with metrics for scoring
      const postInclude = {
        author: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            era: true,
            cred: true,
          },
        },
        node: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
          },
        },
        linkMeta: true,
        metrics: true,
        _count: {
          select: { comments: true },
        },
        vibeAggregate: true,
        reactions: {
          where: { userId },
          select: { intensities: true },
          take: 1,
        },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                era: true,
                cred: true,
              },
            },
          }
        },
        poll: {
          include: {
            options: {
              include: {
                _count: { select: { votes: true } }
              },
              orderBy: { order: 'asc' }
            },
            votes: {
              where: { userId },
              select: { optionId: true }
            }
          }
        }
      } as const;

      // For MVP: Fetch more posts than needed, score them, sort, then paginate
      // This is less efficient but ensures correct ordering
      // TODO: Optimize with database-level scoring in future
      const fetchLimit = Math.min(limit * 3, 100); // Fetch 3x to account for scoring variance

      const queryArgs: Prisma.PostFindManyArgs = {
        take: fetchLimit,
        where,
        orderBy: { createdAt: 'desc' },
        include: postInclude,
        ...(cursor ? { cursor: { id: cursor } } : {}),
      };

      type PostWithCounts = Prisma.PostGetPayload<{
        include: typeof postInclude;
      }>;

      let posts = (await fastify.prisma.post.findMany(
        queryArgs
      )) as PostWithCounts[];

      // Phase 4: Apply Expert Rules (Suppression & Boost)
      if (expertRules.length > 0) {
        posts = ExpertService.applyRules(posts, expertRules);
      }

      // Build personalization context for the user
      // This includes following list, node cred scores, vibe profile, and trust network
      const [user, userReactions, vouches] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            nodeCredScores: true,
            following: { select: { followingId: true } },
          },
        }),
        // Get user's last 100 reactions to build vibe profile
        fastify.prisma.vibeReaction.findMany({
          where: { userId },
          select: { intensities: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        // Get all active vouches for trust network
        fastify.prisma.vouch.findMany({
          where: { active: true },
          select: { voucherId: true, voucheeId: true, active: true },
        }),
      ]);

      const personalizationContext: PersonalizationContext = {
        followingIds: new Set(user?.following.map(f => f.followingId) || []),
        userNodeCredScores: (user?.nodeCredScores as Record<string, number>) || {},
        userVibeProfile: buildVibeProfileFromReactions(
          userReactions.map(r => ({ intensities: r.intensities as Record<string, number> }))
        ),
        vouchNetwork: buildTrustNetwork(vouches, userId, 3),
      };

      // Calculate feed scores and sort
      const postsWithScores = posts.map((post) => {
        const metrics = post.metrics;

        // Calculate real personalization score based on user context
        const personalizationScore = calculatePersonalizationScore(
          {
            authorId: post.authorId,
            nodeId: post.nodeId,
            vibeAggregate: post.vibeAggregate,
          },
          personalizationContext
        );

        const score = calculateFeedScore(
          {
            id: post.id,
            createdAt: post.createdAt,
            engagementScore: metrics?.engagementScore ?? 0,
            qualityScore: metrics?.qualityScore ?? 50.0,
            personalizationScore,
          },
          preferences,
          (post as any).boostMultiplier || 1.0 // Apply boost from rules
        );
        return { post, score };
      });

      // Sort by score (descending)
      postsWithScores.sort((a, b) => b.score - a.score);

      // Phase 4: Apply Diversity Controls (Author Cooldown)
      // We re-order the top posts to ensure diversity
      // Only apply if expert config is present (or we could apply default diversity)
      if (nodeId) {
        const nodeConfig = await fastify.prisma.nodeVectorConfig.findUnique({ where: { nodeId } });
        if (nodeConfig) {
          const expertConfig = (nodeConfig as any).expertConfig;
          if (expertConfig) {
            // Re-order postsWithScores
            const reordered = ExpertService.applyDiversity(
              postsWithScores,
              expertConfig,
              (item) => item.post.authorId || item.post.author?.id
            );
            // Replace postsWithScores with reordered version
            // Note: applyDiversity returns a new array
            postsWithScores.splice(0, postsWithScores.length, ...reordered);
          }
        }
      }

      // Apply pagination after sorting
      const paginatedPosts = postsWithScores.slice(0, limit);
      const lastPaginated = paginatedPosts[paginatedPosts.length - 1];
      const nextCursor =
        postsWithScores.length > limit && lastPaginated ? lastPaginated.post.id : undefined;

      // Format response
      const formattedPosts = paginatedPosts.map(({ post }) => ({
        ...post,
        commentCount: post._count?.comments ?? 0,
        metrics: undefined, // Don't expose metrics in response (or expose selectively)
        _count: undefined,
        myReaction: post.reactions[0]?.intensities || null,
        vibeAggregate: post.vibeAggregate,
        reactions: undefined,
      }));

      return reply.send({
        posts: formattedPosts,
        nextCursor,
        hasMore: !!nextCursor,
      });
    }
  );

  // Get single post
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              era: true,
              cred: true,
            },
          },
          node: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: { comments: true },
          },
          vibeAggregate: true,
        },
      });

      if (!post || post.deletedAt) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      return reply.send({
        ...post,
        commentCount: post._count.comments,
        _count: undefined,
      });
    }
  );

  // Soft delete post
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = (request.user as { sub: string }).sub;

      const post = await fastify.prisma.post.findUnique({ where: { id } });

      if (!post) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Check authorization (only author can delete for now)
      if (post.authorId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Soft delete
      await fastify.prisma.post.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Update metrics after deletion (comments are now excluded from counts)
      updatePostMetrics(fastify, id).catch((err) => {
        fastify.log.error({ err, postId: id }, 'Failed to update metrics after delete');
      });

      // Remove from MeiliSearch (fire-and-forget)
      syncPostToMeili(fastify, id).catch((err) => {
        fastify.log.error({ err, postId: id }, 'Failed to remove from MeiliSearch');
      });

      // Log moderation action (self-delete by author)
      logModAction(fastify, 'delete', 'post', id, {
        moderatorId: null, // null = self-delete
        reason: 'Author deleted own post',
      }).catch((err) => {
        fastify.log.error({ err, postId: id }, 'Failed to log moderation action');
      });

      return reply.send({ message: 'Post deleted successfully' });
    }
  );

  // Edit post
  fastify.patch(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = (request.user as { sub: string }).sub;

      const schema = z.object({
        content: z.string().min(1).max(6000).optional(),
        title: z.string().min(1).max(300).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, title } = parsed.data;

      const post = await fastify.prisma.post.findUnique({ where: { id } });

      if (!post) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Check authorization (only author can edit)
      if (post.authorId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Check if post is deleted
      if (post.deletedAt) {
        return reply.status(410).send({ error: 'Post has been deleted' });
      }

      const updateData: { content?: string; title?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (content !== undefined) updateData.content = content;
      if (title !== undefined) updateData.title = title;

      const updatedPost = await fastify.prisma.post.update({
        where: { id },
        data: { ...updateData, editedAt: new Date() },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              era: true,
              cred: true,
            },
          },
          node: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      });

      // Sync updated content to MeiliSearch (fire-and-forget)
      syncPostToMeili(fastify, id).catch((err) => {
        fastify.log.error({ err, postId: id }, 'Failed to sync update to MeiliSearch');
      });

      return reply.send(updatedPost);
    }
  );

  // Vote on a poll
  fastify.post(
    '/:id/vote',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const schema = z.object({
        optionId: z.string().min(1),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { optionId } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: { poll: true },
      });

      if (!post || !post.poll) {
        return reply.status(404).send({ error: 'Poll not found' });
      }

      // Check if already voted
      const existingVote = await fastify.prisma.pollVote.findUnique({
        where: {
          pollId_userId: {
            pollId: post.poll.id,
            userId,
          },
        },
      });

      if (existingVote) {
        return reply.status(400).send({ error: 'Already voted' });
      }

      // Record vote
      await fastify.prisma.pollVote.create({
        data: {
          pollId: post.poll.id,
          optionId,
          userId,
        },
      });

      return reply.send({ message: 'Vote recorded' });
    }
  );
  // Toggle Save Post
  fastify.post('/:id/save', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const existing = await fastify.prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId: id } }
    });

    if (existing) {
      await fastify.prisma.savedPost.delete({
        where: { userId_postId: { userId, postId: id } }
      });
      return { saved: false };
    } else {
      await fastify.prisma.savedPost.create({
        data: { userId, postId: id }
      });
      return { saved: true };
    }
  });

  // Get Saved Posts
  fastify.get('/saved', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const savedPosts = await fastify.prisma.savedPost.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            author: true,
            node: true,
            metrics: true,
            poll: {
              include: {
                options: {
                  include: {
                    _count: { select: { votes: true } }
                  }
                },
                votes: { where: { userId } }
              }
            },
            _count: { select: { comments: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { posts: savedPosts.map(sp => sp.post) };
  });

  // Feed Explain Endpoint (Phase 5)
  fastify.get('/:id/explain', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const post = await fastify.prisma.post.findUnique({
      where: { id },
      include: { metrics: true, author: true }
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    // 1. Get Preferences (Logic duplicated from feed endpoint - ideally refactor)
    let preferences: FeedPreferences;
    try {
      const userPrefs = await fastify.prisma.userFeedPreference.findUnique({ where: { userId } });
      if (userPrefs) {
        preferences = {
          qualityWeight: userPrefs.qualityWeight,
          recencyWeight: userPrefs.recencyWeight,
          engagementWeight: userPrefs.engagementWeight,
          personalizationWeight: userPrefs.personalizationWeight,
          recencyHalfLife: userPrefs.recencyHalfLife,
          followingOnly: userPrefs.followingOnly,
        };
      } else {
        preferences = getDefaultPreferences();
      }
    } catch (e) {
      preferences = getDefaultPreferences();
    }

    // 2. Check Expert Config Override
    let boostMultiplier = 1.0;
    if (post.nodeId) {
      const nodeConfig = await fastify.prisma.nodeVectorConfig.findUnique({ where: { nodeId: post.nodeId } });
      if (nodeConfig) {
        const expertConfig = (nodeConfig as any).expertConfig;
        if (expertConfig && Object.keys(expertConfig).length > 0) {
          preferences = { ...preferences, ...expertConfig };
        }

        // Apply Rules (Simplified for explain - just checking boost)
        const boostRules = (nodeConfig as any).boostRules as any[] || [];
        const rules = ExpertService.validateRules(boostRules.map(r => ({ ...r, action: { type: 'boost', multiplier: r.action?.multiplier } })));

        // Evaluate rules against post
        // We need to construct a post object compatible with evaluateRule
        // For now, let's just use the post object we fetched
        for (const rule of rules) {
          if (ExpertService.evaluateRule(post, rule)) {
            boostMultiplier *= (rule.action.multiplier || 1.0);
          }
        }
      }
    }

    // 3. Build personalization context
    const [user, userReactions, vouches, vibeAggregate] = await Promise.all([
      fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          nodeCredScores: true,
          following: { select: { followingId: true } },
        },
      }),
      fastify.prisma.vibeReaction.findMany({
        where: { userId },
        select: { intensities: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      fastify.prisma.vouch.findMany({
        where: { active: true },
        select: { voucherId: true, voucheeId: true, active: true },
      }),
      fastify.prisma.postVibeAggregate.findUnique({
        where: { postId: post.id },
      }),
    ]);

    const personalizationContext: PersonalizationContext = {
      followingIds: new Set(user?.following.map(f => f.followingId) || []),
      userNodeCredScores: (user?.nodeCredScores as Record<string, number>) || {},
      userVibeProfile: buildVibeProfileFromReactions(
        userReactions.map(r => ({ intensities: r.intensities as Record<string, number> }))
      ),
      vouchNetwork: buildTrustNetwork(vouches, userId, 3),
    };

    const personalizationScore = calculatePersonalizationScore(
      {
        authorId: post.authorId,
        nodeId: post.nodeId,
        vibeAggregate,
      },
      personalizationContext
    );

    // 4. Calculate Breakdown
    const metrics = post.metrics;
    const breakdown = calculateScoreBreakdown(
      {
        id: post.id,
        createdAt: post.createdAt,
        engagementScore: metrics?.engagementScore ?? 0,
        qualityScore: metrics?.qualityScore ?? 50.0,
        personalizationScore,
      },
      preferences,
      boostMultiplier
    );

    return { breakdown };
  });
};

export default postRoutes;
