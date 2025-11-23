import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '../../generated/prisma/client.js';
import { z } from 'zod';
import { initializePostMetrics, updatePostMetrics } from '../lib/metrics.js';
import { calculateFeedScore, getDefaultPreferences, type FeedPreferences } from '../lib/feedScoring.js';
import { syncPostToMeili } from '../lib/searchSync.js';
import { logModAction } from '../lib/moderation.js';

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
        content: z.string().min(1).max(6000),
        nodeId: z.string().uuid().optional(), // Optional node/community
        title: z.string().max(500).optional(),
        linkUrl: z.string().url().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, nodeId, title, linkUrl } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

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

      const post = await fastify.prisma.post.create({
        data: {
          content,
          nodeId: nodeId ?? null,
          title: title ?? null,
          authorId: userId,
          linkUrl: linkUrl ?? null,
          linkMetaId: linkMetaId ?? null,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true, // In real app, use username/avatar
            },
          },
          linkMeta: true,
        },
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
      } catch (error) {
        // If userFeedPreference table doesn't exist or Prisma not ready, use defaults
        fastify.log.warn({ err: error }, 'Failed to load feed preferences, using defaults');
        preferences = getDefaultPreferences();
      }

      const where: Prisma.PostWhereInput = {
        deletedAt: null, // Exclude deleted posts
      };

      if (nodeId) where.nodeId = nodeId;
      if (authorId) where.authorId = authorId;

      // Phase 4.2 - Post Type Filtering
      if (postTypeFilter && postTypeFilter.length > 0) {
        where.postType = { in: postTypeFilter };
      }

      // Fetch posts with metrics for scoring
      const postInclude = {
        author: {
          select: {
            id: true,
            email: true,
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
        metrics: true,
        _count: {
          select: { comments: true },
        },
        reactions: {
          where: { userId },
          select: { intensities: true },
          take: 1,
        },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, email: true } }
          }
        },
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

      // Calculate feed scores and sort
      const postsWithScores = posts.map((post) => {
        const metrics = post.metrics;
        const score = calculateFeedScore(
          {
            id: post.id,
            createdAt: post.createdAt,
            engagementScore: metrics?.engagementScore ?? 0,
            qualityScore: metrics?.qualityScore ?? 50.0,
            personalizationScore: 50.0, // Default: no personalization yet (future: following, vibe alignment)
          },
          preferences
        );
        return { post, score };
      });

      // Sort by score (descending)
      postsWithScores.sort((a, b) => b.score - a.score);

      // Apply pagination after sorting
      const paginatedPosts = postsWithScores.slice(0, limit);
      const nextCursor = postsWithScores.length > limit ? paginatedPosts[paginatedPosts.length - 1].post.id : undefined;

      // Format response
      const formattedPosts = paginatedPosts.map(({ post }) => ({
        ...post,
        commentCount: post._count?.comments ?? 0,
        metrics: undefined, // Don't expose metrics in response (or expose selectively)
        _count: undefined,
        myReaction: post.reactions[0]?.intensities || null,
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
};

export default postRoutes;

