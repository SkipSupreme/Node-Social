import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { initializePostMetrics, updatePostMetrics } from '../lib/metrics.js';
import {
  calculateFeedScore,
  calculateScoreBreakdown,
  getDefaultPreferences,
  calculatePersonalizationScore,
  calculateQualityScore,
  calculateRecencyScore,
  calculateEngagementScore,
  applyDiversityControls,
  applyMoodPreset,
  buildVibeProfileFromReactions,
  buildTrustNetwork,
  type FeedPreferences,
  type PersonalizationContext,
  type QualityPreferences,
  type RecencyPreferences,
  type EngagementPreferences,
  type PersonalizationPreferences,
  type DiversityPreferences,
  type VectorMultipliers,
  type MoodType,
  type ScoredPost,
} from '../lib/feedScoring.js';
import { syncPostToMeili } from '../lib/searchSync.js';
import { logModAction } from '../lib/moderation.js';
import { ExpertService, type ExpertRule } from '../services/expertService.js';
import { analyzePost } from '../lib/contentIntelligence.js';
import { ssrfSafeFetch } from '../lib/ssrf.js';

// Helper to extract plain text from TipTap JSON for search indexing and content intelligence
interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
}

function extractTextFromTipTap(doc: { type: string; content?: TipTapNode[] }): string {
  const extractFromNode = (node: TipTapNode): string => {
    if (node.text) {
      return node.text;
    }
    if (node.content) {
      return node.content.map(extractFromNode).join('');
    }
    // Add newlines after block elements
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      return '\n';
    }
    return '';
  };

  if (!doc.content) return '';
  return doc.content.map(extractFromNode).join('').trim();
}

const postRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new post
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireVerified],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      // TipTap JSON schema for rich text content
      const tipTapNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
        type: z.string(),
        attrs: z.record(z.any()).optional(),
        content: z.array(tipTapNodeSchema).optional(),
        marks: z.array(z.object({
          type: z.string(),
          attrs: z.record(z.any()).optional(),
        })).optional(),
        text: z.string().optional(),
      }));

      const tipTapDocSchema = z.object({
        type: z.literal('doc'),
        content: z.array(tipTapNodeSchema),
      });

      const schema = z.object({
        content: z.string().min(1).max(6000).optional(), // Legacy markdown content
        contentJson: tipTapDocSchema.optional(), // TipTap JSON content
        nodeId: z.string().uuid().optional(), // Optional node/community
        title: z.string().min(1).max(300),
        linkUrl: z.string().url().optional(),
        // Pre-populated link metadata (for external reposts where OG scraping may not work)
        linkMetaData: z.object({
          title: z.string().max(500).optional(),
          description: z.string().max(1000).optional(),
          image: z.string().max(1000).optional(),
        }).optional(),
        expertGateCred: z.number().int().min(0).max(10000).optional(), // Min cred to comment
        poll: z.object({
          question: z.string().min(1).max(300),
          options: z.array(z.string().min(1).max(100)).min(2).max(4),
          duration: z.number().min(1).max(7).default(3), // Days
        }).optional(),
      }).refine(
        (data) => data.content || data.contentJson || data.poll || data.linkUrl,
        { message: 'Post must have content, a poll, or a link' }
      );

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, contentJson, nodeId: providedNodeId, title, linkUrl, linkMetaData, poll, expertGateCred } = parsed.data;
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
        const domain = new URL(linkUrl).hostname;

        // If frontend provided metadata (external reposts), upsert it — always wins over stale scraped data
        if (linkMetaData && (linkMetaData.title || linkMetaData.description || linkMetaData.image)) {
          const meta = await fastify.prisma.linkMetadata.upsert({
            where: { url: linkUrl },
            update: {
              title: linkMetaData.title || '',
              description: linkMetaData.description || '',
              image: linkMetaData.image || '',
              domain,
            },
            create: {
              url: linkUrl,
              title: linkMetaData.title || '',
              description: linkMetaData.description || '',
              image: linkMetaData.image || '',
              domain,
            },
          });
          linkMetaId = meta.id;
        } else {
          // No pre-populated data — look up cached or scrape
          let meta = await fastify.prisma.linkMetadata.findUnique({ where: { url: linkUrl } });
          if (!meta) {
            try {
              // SSRF-safe fetch with DNS pinning (prevents rebinding attacks)
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              const res = await ssrfSafeFetch(linkUrl, {
                headers: { 'User-Agent': 'NodeSocialBot/1.0 (+https://node-social.com)' },
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (res.ok) {
                const html = await res.text();
                const $ = cheerio.load(html);
                const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
                const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
                const ogImage = $('meta[property="og:image"]').attr('content') || '';
                meta = await fastify.prisma.linkMetadata.create({
                  data: {
                    url: linkUrl,
                    title: ogTitle.substring(0, 500),
                    description: ogDesc.substring(0, 1000),
                    image: ogImage.substring(0, 1000),
                    domain,
                  },
                });
              }
            } catch (err) {
              fastify.log.warn({ err, linkUrl }, 'Failed to fetch link metadata during post creation');
            }
          }
          if (meta) {
            linkMetaId = meta.id;
          }
        }
      }

      // Determine post type based on content
      const hasContent = content || contentJson;
      let postType = 'text';
      if (poll && !hasContent) {
        postType = 'poll';
      } else if (linkUrl && !hasContent) {
        postType = 'link';
      }

      // Extract plain text from TipTap JSON for content intelligence
      const plainTextContent = contentJson
        ? extractTextFromTipTap(contentJson)
        : content;

      // Content Intelligence: analyze text and media
      const { textLength, textDensity, mediaType } = analyzePost({
        content: plainTextContent ?? null,
        postType,
      });

      // Determine content format
      const contentFormat = contentJson ? 'tiptap' : 'markdown';

      const postData: Prisma.PostCreateInput = {
        content: content ?? (contentJson ? plainTextContent : null) ?? null, // Store plain text for search/fallback
        contentJson: contentJson ?? Prisma.JsonNull,
        contentFormat,
        title: title ?? null,
        postType,
        textLength,
        textDensity,
        mediaType,
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
  // Public endpoint - anonymous users can browse, logged-in users get personalized features
  fastify.get(
    '/',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        nodeId: z.string().uuid().optional(),
        authorId: z.string().uuid().optional(),
        postType: z.string().optional(), // Single post type: "text", "image", "video", "link"
        postTypes: z.string().optional(), // Multiple post types: "text,image,video" (comma-separated)
        preset: z.enum(['latest', 'balanced', 'popular', 'expert', 'personal']).optional(),
        followingOnly: z.string().optional().transform(v => v === 'true'),
        qualityWeight: z.coerce.number().min(0).max(100).optional(),
        recencyWeight: z.coerce.number().min(0).max(100).optional(),
        engagementWeight: z.coerce.number().min(0).max(100).optional(),
        personalizationWeight: z.coerce.number().min(0).max(100).optional(),
        // Intermediate mode filters
        timeRange: z.enum(['1h', '6h', '24h', '7d', 'all']).optional(),
        textOnly: z.string().optional().transform(v => v === 'true'),
        mediaOnly: z.string().optional().transform(v => v === 'true'),
        linksOnly: z.string().optional().transform(v => v === 'true'),
        hasDiscussion: z.string().optional().transform(v => v === 'true'),
        // Content Intelligence (Tier 2)
        textDensity: z.enum(['micro', 'short', 'medium', 'long']).optional(),
        mediaType: z.enum(['photo', 'video', 'gif', 'audio']).optional(),
        // User Context (Tier 3)
        showSeenPosts: z.string().optional().transform(v => v === 'true'),
        hideMutedWords: z.string().optional().transform(v => v !== 'false'), // Default true
        discoveryRate: z.coerce.number().min(0).max(100).optional(),
        // Advanced mode - Quality sub-signals
        authorCredWeight: z.coerce.number().min(0).max(100).optional(),
        vectorQualityWeight: z.coerce.number().min(0).max(100).optional(),
        confidenceWeight: z.coerce.number().min(0).max(100).optional(),
        // Advanced mode - Recency sub-signals
        timeDecay: z.coerce.number().min(0).max(100).optional(),
        velocity: z.coerce.number().min(0).max(100).optional(),
        freshness: z.coerce.number().min(0).max(100).optional(),
        halfLifeHours: z.coerce.number().min(1).max(168).optional(),
        decayFunction: z.enum(['exponential', 'linear', 'step']).optional(),
        // Advanced mode - Engagement sub-signals
        intensity: z.coerce.number().min(0).max(100).optional(),
        discussionDepth: z.coerce.number().min(0).max(100).optional(),
        shareWeight: z.coerce.number().min(0).max(100).optional(),
        expertCommentBonus: z.coerce.number().min(0).max(100).optional(),
        // Advanced mode - Personalization sub-signals
        followingWeight: z.coerce.number().min(0).max(100).optional(),
        alignment: z.coerce.number().min(0).max(100).optional(),
        affinity: z.coerce.number().min(0).max(100).optional(),
        trustNetwork: z.coerce.number().min(0).max(100).optional(),
        // Advanced mode - Vector multipliers (JSON string)
        vectorMultipliers: z.string().optional().transform(v => v ? JSON.parse(v) : undefined),
        antiAlignmentPenalty: z.coerce.number().min(0).max(100).optional(),
        // Expert mode - Diversity controls
        maxPostsPerAuthor: z.coerce.number().min(1).max(10).optional(),
        topicClusteringPenalty: z.coerce.number().min(0).max(100).optional(),
        // Expert mode - Content type ratios
        textRatio: z.coerce.number().min(0).max(100).optional(),
        imageRatio: z.coerce.number().min(0).max(100).optional(),
        videoRatio: z.coerce.number().min(0).max(100).optional(),
        linkRatio: z.coerce.number().min(0).max(100).optional(),
        // Expert mode - Mood toggle
        moodToggle: z.enum(['normal', 'chill', 'intense', 'discovery']).optional(),
      });

      // Preset weight configurations
      const PRESET_WEIGHTS: Record<string, { qualityWeight: number; recencyWeight: number; engagementWeight: number; personalizationWeight: number }> = {
        latest: { qualityWeight: 10, recencyWeight: 70, engagementWeight: 10, personalizationWeight: 10 },
        balanced: { qualityWeight: 35, recencyWeight: 30, engagementWeight: 20, personalizationWeight: 15 },
        popular: { qualityWeight: 20, recencyWeight: 20, engagementWeight: 50, personalizationWeight: 10 },
        expert: { qualityWeight: 60, recencyWeight: 15, engagementWeight: 15, personalizationWeight: 10 },
        personal: { qualityWeight: 20, recencyWeight: 20, engagementWeight: 10, personalizationWeight: 50 },
      };

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { cursor, limit, nodeId, authorId, postType, postTypes, preset, followingOnly, timeRange, textOnly, mediaOnly, linksOnly, hasDiscussion } = parsed.data;
      // userId is optional - anonymous users can browse without logging in
      const userId = (request.user as { sub: string } | undefined)?.sub;

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

      // Vibe Validator Intermediate Filters
      // These override the general postTypeFilter if set
      if (textOnly) {
        postTypeFilter = ['text'];
      } else if (mediaOnly) {
        postTypeFilter = ['image', 'video'];
      } else if (linksOnly) {
        postTypeFilter = ['link'];
      }

      // Load user feed preferences or use defaults
      let preferences: FeedPreferences;
      // Advanced sub-signal preferences (Tier 1 wiring)
      let qualityPrefs: QualityPreferences;
      let recencyPrefs: RecencyPreferences;
      let engagementPrefs: EngagementPreferences;
      let personalizationPrefs: PersonalizationPreferences;
      let vectorMultipliers: VectorMultipliers;
      let antiAlignmentPenalty: number;
      let diversityPrefs: DiversityPreferences;
      let moodToggle: MoodType;

      // Ensure Prisma is available
      if (!fastify.prisma) {
        fastify.log.error('Prisma client not available - server may need restart after schema changes');
        return reply.status(500).send({ error: 'Database connection not available. Please restart the server.' });
      }

      try {
        // Anonymous users get default preferences
        const userPrefs = userId
          ? await fastify.prisma.userFeedPreference.findUnique({ where: { userId } })
          : null;

        // Get preset weights if preset is specified
        const presetWeights = preset ? PRESET_WEIGHTS[preset] : null;

        // Build preferences: query params > preset > database > defaults
        // This allows per-column settings in multi-column UI to override global user preferences
        const defaults = getDefaultPreferences();
        const dbPrefs = userPrefs || null;

        preferences = {
          qualityWeight: presetWeights?.qualityWeight ?? parsed.data.qualityWeight ?? dbPrefs?.qualityWeight ?? defaults.qualityWeight,
          recencyWeight: presetWeights?.recencyWeight ?? parsed.data.recencyWeight ?? dbPrefs?.recencyWeight ?? defaults.recencyWeight,
          engagementWeight: presetWeights?.engagementWeight ?? parsed.data.engagementWeight ?? dbPrefs?.engagementWeight ?? defaults.engagementWeight,
          personalizationWeight: presetWeights?.personalizationWeight ?? parsed.data.personalizationWeight ?? dbPrefs?.personalizationWeight ?? defaults.personalizationWeight,
          recencyHalfLife: dbPrefs?.recencyHalfLife ?? defaults.recencyHalfLife,
          followingOnly: followingOnly ?? dbPrefs?.followingOnly ?? defaults.followingOnly,
        };

        // Advanced sub-signal preferences: query params > database > defaults
        // Quality sub-signals
        qualityPrefs = {
          authorCredWeight: parsed.data.authorCredWeight ?? dbPrefs?.authorCredWeight ?? 50,
          vectorQualityWeight: parsed.data.vectorQualityWeight ?? dbPrefs?.vectorQualityWeight ?? 35,
          confidenceWeight: parsed.data.confidenceWeight ?? dbPrefs?.confidenceWeight ?? 15,
        };

        // Recency sub-signals
        recencyPrefs = {
          halfLifeHours: parsed.data.halfLifeHours ?? dbPrefs?.halfLifeHours ?? 12,
          decayFunction: parsed.data.decayFunction ?? (dbPrefs?.decayFunction as 'exponential' | 'linear' | 'step') ?? 'exponential',
          timeDecay: parsed.data.timeDecay ?? dbPrefs?.timeDecay ?? 60,
          velocity: parsed.data.velocity ?? dbPrefs?.velocity ?? 25,
          freshness: parsed.data.freshness ?? dbPrefs?.freshness ?? 15,
        };

        // Engagement sub-signals
        engagementPrefs = {
          intensity: parsed.data.intensity ?? dbPrefs?.intensity ?? 40,
          discussionDepth: parsed.data.discussionDepth ?? dbPrefs?.discussionDepth ?? 30,
          shareWeight: parsed.data.shareWeight ?? dbPrefs?.shareWeight ?? 20,
          expertCommentBonus: parsed.data.expertCommentBonus ?? dbPrefs?.expertCommentBonus ?? 10,
        };

        // Personalization sub-signals
        personalizationPrefs = {
          followingWeight: parsed.data.followingWeight ?? dbPrefs?.followingWeight ?? 50,
          alignment: parsed.data.alignment ?? dbPrefs?.alignment ?? 20,
          affinity: parsed.data.affinity ?? dbPrefs?.affinity ?? 15,
          trustNetwork: parsed.data.trustNetwork ?? dbPrefs?.trustNetwork ?? 15,
        };

        // Vector multipliers (can be passed as JSON string in query param)
        const defaultVectorMultipliers: VectorMultipliers = { insightful: 100, joy: 100, fire: 100, support: 100, shock: 100, questionable: 100 };
        vectorMultipliers = parsed.data.vectorMultipliers ?? (dbPrefs?.vectorMultipliers as unknown as VectorMultipliers) ?? defaultVectorMultipliers;

        // Anti-alignment penalty
        antiAlignmentPenalty = parsed.data.antiAlignmentPenalty ?? dbPrefs?.antiAlignmentPenalty ?? 20;

        // Diversity controls (Expert mode)
        diversityPrefs = {
          maxPostsPerAuthor: parsed.data.maxPostsPerAuthor ?? dbPrefs?.maxPostsPerAuthor ?? 3,
          topicClusteringPenalty: parsed.data.topicClusteringPenalty ?? dbPrefs?.topicClusteringPenalty ?? 20,
          textRatio: parsed.data.textRatio ?? dbPrefs?.textRatio ?? 40,
          imageRatio: parsed.data.imageRatio ?? dbPrefs?.imageRatio ?? 25,
          videoRatio: parsed.data.videoRatio ?? dbPrefs?.videoRatio ?? 20,
          linkRatio: parsed.data.linkRatio ?? dbPrefs?.linkRatio ?? 15,
        };

        // Mood toggle (Expert mode)
        moodToggle = parsed.data.moodToggle ?? (dbPrefs?.moodToggle as MoodType) ?? 'normal';
      } catch (error) {
        // If userFeedPreference table doesn't exist or Prisma not ready, use query params > defaults
        fastify.log.warn({ err: error }, 'Failed to load feed preferences, using query params and defaults');
        const defaults = getDefaultPreferences();
        const fallbackPresetWeights = preset ? PRESET_WEIGHTS[preset] : null;

        preferences = {
          qualityWeight: fallbackPresetWeights?.qualityWeight ?? parsed.data.qualityWeight ?? defaults.qualityWeight,
          recencyWeight: fallbackPresetWeights?.recencyWeight ?? parsed.data.recencyWeight ?? defaults.recencyWeight,
          engagementWeight: fallbackPresetWeights?.engagementWeight ?? parsed.data.engagementWeight ?? defaults.engagementWeight,
          personalizationWeight: fallbackPresetWeights?.personalizationWeight ?? parsed.data.personalizationWeight ?? defaults.personalizationWeight,
          recencyHalfLife: defaults.recencyHalfLife,
          followingOnly: followingOnly ?? defaults.followingOnly,
        };

        qualityPrefs = {
          authorCredWeight: parsed.data.authorCredWeight ?? 50,
          vectorQualityWeight: parsed.data.vectorQualityWeight ?? 35,
          confidenceWeight: parsed.data.confidenceWeight ?? 15,
        };
        recencyPrefs = {
          halfLifeHours: parsed.data.halfLifeHours ?? 12,
          decayFunction: parsed.data.decayFunction ?? 'exponential',
          timeDecay: parsed.data.timeDecay ?? 60,
          velocity: parsed.data.velocity ?? 25,
          freshness: parsed.data.freshness ?? 15,
        };
        engagementPrefs = {
          intensity: parsed.data.intensity ?? 40,
          discussionDepth: parsed.data.discussionDepth ?? 30,
          shareWeight: parsed.data.shareWeight ?? 20,
          expertCommentBonus: parsed.data.expertCommentBonus ?? 10,
        };
        personalizationPrefs = {
          followingWeight: parsed.data.followingWeight ?? 50,
          alignment: parsed.data.alignment ?? 20,
          affinity: parsed.data.affinity ?? 15,
          trustNetwork: parsed.data.trustNetwork ?? 15,
        };
        vectorMultipliers = parsed.data.vectorMultipliers ?? { insightful: 100, joy: 100, fire: 100, support: 100, shock: 100, questionable: 100 };
        antiAlignmentPenalty = parsed.data.antiAlignmentPenalty ?? 20;
        diversityPrefs = {
          maxPostsPerAuthor: parsed.data.maxPostsPerAuthor ?? 3,
          topicClusteringPenalty: parsed.data.topicClusteringPenalty ?? 20,
          textRatio: parsed.data.textRatio ?? 40,
          imageRatio: parsed.data.imageRatio ?? 25,
          videoRatio: parsed.data.videoRatio ?? 20,
          linkRatio: parsed.data.linkRatio ?? 15,
        };
        moodToggle = parsed.data.moodToggle ?? 'normal';
      }

      // Apply mood preset if not 'normal' - overrides weights temporarily
      if (moodToggle !== 'normal') {
        preferences = applyMoodPreset(preferences as unknown as Record<string, unknown>, moodToggle) as unknown as FeedPreferences;
      }

      // Phase 4: Expert Config Override & Rules
      let expertRules: ExpertRule[] = [];
      if (nodeId) {
        const nodeConfig = await fastify.prisma.nodeVectorConfig.findUnique({
          where: { nodeId },
        });

        if (nodeConfig) {
          // Override preferences if expert config exists
          const expertConfig = nodeConfig.expertConfig as Record<string, unknown>;
          if (expertConfig && Object.keys(expertConfig).length > 0) {
            preferences = {
              ...preferences,
              ...expertConfig
            };
          }

          // Load rules
          const suppression = (nodeConfig.suppressionRules as Record<string, unknown>[]) || [];
          const boost = (nodeConfig.boostRules as Record<string, unknown>[]) || [];
          // Validate and combine
          try {
            expertRules = [
              ...ExpertService.validateRules(suppression.map(r => ({ ...r, action: { type: 'suppress' } }))),
              ...ExpertService.validateRules(boost.map(r => ({ ...r, action: { type: 'boost', multiplier: (r.action as Record<string, unknown>)?.multiplier } })))
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

      // Vibe Validator: Time Range Filter
      if (timeRange && timeRange !== 'all') {
        const now = new Date();
        let cutoff: Date;
        switch (timeRange) {
          case '1h':
            cutoff = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '6h':
            cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case '24h':
            cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoff = new Date(0); // No cutoff
        }
        where.createdAt = { gte: cutoff };
      }

      // Vibe Validator: Has Discussion Filter (posts with at least 1 comment)
      if (hasDiscussion) {
        where.comments = { some: {} };
      }

      // Content Intelligence Filters (Tier 2)
      const { textDensity, mediaType } = parsed.data;
      if (textDensity) {
        where.textDensity = textDensity;
      }
      if (mediaType) {
        where.mediaType = mediaType;
      }

      // Following-Only Feed Filter (requires authentication)
      if (preferences.followingOnly && userId) {
        const following = await fastify.prisma.userFollow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        const followingIds = following.map((f) => f.followingId);
        // Include user's own posts too
        followingIds.push(userId);
        where.authorId = { in: followingIds };
      }

      // Extract Tier 3 params
      const showSeenPosts = parsed.data.showSeenPosts ?? true; // Default: show seen posts
      const hideMutedWords = parsed.data.hideMutedWords ?? true; // Default: hide muted words
      const discoveryRate = parsed.data.discoveryRate; // Optional discovery mixing

      // Block/Mute Enforcement - Hide posts from blocked/muted users (only for logged-in users)
      // Tier 3: Also load seen posts and muted words for filtering
      const [blocks, mutes, mutedNodes, savedPosts, seenPosts, mutedWords] = userId
        ? await Promise.all([
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
            // Get saved posts to mark in feed
            fastify.prisma.savedPost.findMany({
              where: { userId },
              select: { postId: true },
            }),
            // Tier 3: Get seen posts (recent 500 to avoid massive queries)
            !showSeenPosts
              ? fastify.prisma.userPostView.findMany({
                  where: { userId },
                  select: { postId: true },
                  orderBy: { viewedAt: 'desc' },
                  take: 500,
                })
              : Promise.resolve([]),
            // Tier 3: Get muted words
            hideMutedWords
              ? fastify.prisma.userMutedWord.findMany({
                  where: { userId },
                  select: { word: true, isRegex: true },
                })
              : Promise.resolve([]),
          ])
        : [[], [], [], [], [], []]; // Anonymous users: no blocks/mutes/saved/seen/mutedWords

      const savedPostIds = new Set(savedPosts.map(s => s.postId));

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

      // Tier 3: Seen Posts Filter - Exclude already-seen posts
      const seenPostIds = seenPosts.map((s) => s.postId);
      if (!showSeenPosts && seenPostIds.length > 0) {
        where.id = { notIn: seenPostIds };
      }

      // Fetch posts with metrics for scoring
      // Build include dynamically based on whether user is authenticated
      const postInclude: Prisma.PostInclude = {
        author: {
          select: {
            id: true,
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
        // Only include user's reactions if authenticated
        reactions: userId
          ? { where: { userId }, select: { intensities: true }, take: 1 }
          : false,
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' as const },
          include: {
            author: {
              select: {
                id: true,
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
              orderBy: { order: 'asc' as const }
            },
            // Only include user's votes if authenticated
            votes: userId
              ? { where: { userId }, select: { optionId: true } }
              : false,
          }
        }
      };

      // For MVP: Fetch more posts than needed, score them, sort, then paginate
      // This is less efficient but ensures correct ordering
      // TODO: Optimize with database-level scoring in future
      const fetchLimit = Math.min(limit * 3, 100); // Fetch 3x to account for scoring variance

      const queryArgs: Prisma.PostFindManyArgs = {
        take: fetchLimit,
        where,
        orderBy: { createdAt: 'desc' },
        include: postInclude,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      };

      type PostWithCounts = Prisma.PostGetPayload<{
        include: typeof postInclude;
      }>;

      let posts = (await fastify.prisma.post.findMany(
        queryArgs
      )) as PostWithCounts[];

      // Tier 3: Muted Words Filter - Filter out posts containing muted words
      if (hideMutedWords && mutedWords.length > 0) {
        // Build regex patterns and plain words for efficient matching
        const regexPatterns: RegExp[] = [];
        const plainWords: string[] = [];

        for (const mw of mutedWords) {
          if (mw.isRegex) {
            try {
              regexPatterns.push(new RegExp(mw.word, 'i'));
            } catch {
              // Invalid regex, skip
            }
          } else {
            plainWords.push(mw.word.toLowerCase());
          }
        }

        posts = posts.filter((post) => {
          // Check content and title for muted words
          const contentLower = (post.content || '').toLowerCase();
          const titleLower = (post.title || '').toLowerCase();
          const combinedText = `${contentLower} ${titleLower}`;

          // Check plain words (case-insensitive substring match)
          for (const word of plainWords) {
            if (combinedText.includes(word)) {
              return false; // Filter out this post
            }
          }

          // Check regex patterns
          for (const pattern of regexPatterns) {
            if (pattern.test(combinedText)) {
              return false; // Filter out this post
            }
          }

          return true; // Keep this post
        });
      }

      // Phase 4: Apply Expert Rules (Suppression & Boost)
      if (expertRules.length > 0) {
        posts = ExpertService.applyRules(posts, expertRules);
      }

      // Build personalization context for the user (only if authenticated)
      // This includes following list, node cred scores, vibe profile, and trust network
      const [user, userReactions, vouches] = userId
        ? await Promise.all([
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
          ])
        : [null, [], []]; // Anonymous users: no personalization data

      const personalizationContext: PersonalizationContext = {
        followingIds: new Set(user?.following.map(f => f.followingId) || []),
        userNodeCredScores: (user?.nodeCredScores as Record<string, number>) || {},
        userVibeProfile: buildVibeProfileFromReactions(
          userReactions.map(r => ({ intensities: r.intensities as Record<string, number> }))
        ),
        vouchNetwork: userId ? buildTrustNetwork(vouches, userId, 3) : new Map(),
      };

      // Calculate feed scores using LIVE sub-signal calculations (Tier 1 wiring)
      const postsWithScores = posts.map((post) => {
        // Cast Prisma vibeAggregate to our interface (compatible structure)
        const vibeAgg = post.vibeAggregate as unknown as import('../lib/feedScoring.js').PostVibeAggregate | null;

        // LIVE quality score using sub-signals (not pre-computed metrics)
        const qualityScore = calculateQualityScore(
          { vibeAggregate: vibeAgg },
          { cred: post.author?.cred ?? 0 },
          qualityPrefs
        );

        // LIVE recency score using sub-signals
        const recencyScore = calculateRecencyScore(
          vibeAgg
            ? { createdAt: post.createdAt, vibeAggregate: vibeAgg }
            : { createdAt: post.createdAt },
          recencyPrefs
        );

        // LIVE engagement score using sub-signals
        // Cast comments to access author.cred (included in query but TypeScript doesn't infer it)
        const commentsWithCred = (post.comments as Array<{ author?: { cred?: number } }>) ?? [];
        const engagementScore = calculateEngagementScore(
          {
            commentCount: post._count?.comments ?? 0,
            vibeAggregate: vibeAgg,
            comments: commentsWithCred.map(c => ({ author: { cred: c.author?.cred ?? 0 } })),
          },
          engagementPrefs
        );

        // LIVE personalization score with vector multipliers (ADVANCED signature)
        const personalizationScore = calculatePersonalizationScore(
          {
            authorId: post.authorId,
            nodeId: post.nodeId,
            vibeAggregate: vibeAgg,
          },
          personalizationContext,
          vectorMultipliers,
          antiAlignmentPenalty,
          personalizationPrefs
        );

        // Combine scores using main weights
        const boostMultiplier = (post as unknown as Record<string, unknown>).boostMultiplier as number || 1.0;
        const score = (
          (qualityScore * preferences.qualityWeight / 100) +
          (recencyScore * preferences.recencyWeight / 100) +
          (engagementScore * preferences.engagementWeight / 100) +
          (personalizationScore * preferences.personalizationWeight / 100)
        ) * boostMultiplier;

        return { post, score };
      });

      // Sort by score (descending)
      postsWithScores.sort((a, b) => b.score - a.score);

      // Apply Diversity Controls using user's settings (Tier 1 wiring)
      // Convert postsWithScores to ScoredPost format for applyDiversityControls
      const scoredPosts: ScoredPost[] = postsWithScores.map(({ post, score }) => ({
        id: post.id,
        authorId: post.authorId,
        score,
        postType: post.postType ?? undefined,
        vibeAggregate: (post.vibeAggregate as unknown as import('../lib/feedScoring.js').PostVibeAggregate) ?? undefined,
      }));

      // Apply diversity controls (max posts per author, topic clustering penalty)
      const diversifiedPosts = applyDiversityControls(
        scoredPosts,
        diversityPrefs,
        limit * 2 // Get more than we need, then paginate
      );

      // Map back to postsWithScores format
      const diversifiedIds = new Set(diversifiedPosts.map(p => p.id));
      const reorderedPosts = diversifiedPosts
        .map(dp => postsWithScores.find(pws => pws.post.id === dp.id))
        .filter((p): p is { post: typeof posts[0]; score: number } => p !== undefined);

      // Replace postsWithScores with reordered version
      postsWithScores.splice(0, postsWithScores.length, ...reorderedPosts);

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
        myReaction: post.reactions?.[0]?.intensities || null,
        vibeAggregate: post.vibeAggregate,
        reactions: undefined,
        isSaved: savedPostIds.has(post.id),
      }));

      return reply.send({
        posts: formattedPosts,
        nextCursor,
        hasMore: !!nextCursor,
      });
    }
  );

  // Get single post (public endpoint)
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
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

      // TipTap JSON schema for rich text content
      const tipTapNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
        type: z.string(),
        attrs: z.record(z.any()).optional(),
        content: z.array(tipTapNodeSchema).optional(),
        marks: z.array(z.object({
          type: z.string(),
          attrs: z.record(z.any()).optional(),
        })).optional(),
        text: z.string().optional(),
      }));

      const tipTapDocSchema = z.object({
        type: z.literal('doc'),
        content: z.array(tipTapNodeSchema),
      });

      const schema = z.object({
        content: z.string().min(1).max(6000).optional(),
        contentJson: tipTapDocSchema.optional(),
        title: z.string().min(1).max(300).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, contentJson, title } = parsed.data;

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

      const updateData: Prisma.PostUpdateInput = {
        updatedAt: new Date(),
        editedAt: new Date(),
      };

      if (contentJson !== undefined) {
        updateData.contentJson = contentJson;
        updateData.contentFormat = 'tiptap';
        updateData.content = extractTextFromTipTap(contentJson);
      } else if (content !== undefined) {
        updateData.content = content;
      }
      if (title !== undefined) updateData.title = title;

      const updatedPost = await fastify.prisma.post.update({
        where: { id },
        data: updateData,
        include: {
          author: {
            select: {
              id: true,
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
      preHandler: [fastify.requireVerified],
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
        const expertConfig = nodeConfig.expertConfig as Record<string, unknown>;
        if (expertConfig && Object.keys(expertConfig).length > 0) {
          preferences = { ...preferences, ...expertConfig };
        }

        // Apply Rules (Simplified for explain - just checking boost)
        const boostRules = (nodeConfig.boostRules as Record<string, unknown>[]) || [];
        const rules = ExpertService.validateRules(boostRules.map(r => ({ ...r, action: { type: 'boost', multiplier: (r.action as Record<string, unknown>)?.multiplier } })));

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
