// Tier 5: External Platform Integration Routes
// API endpoints for fetching Bluesky and Mastodon feeds
// Supports Redis caching (5min TTL) and language filtering

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  fetchBlueskyDiscover,
  fetchBlueskyFeed,
  fetchBlueskyUserPosts,
  fetchBlueskyThread,
  fetchMastodonFeed,
  fetchMastodonTrending,
  fetchMastodonContext,
  fetchCombinedFeed,
  type ExternalPost,
} from '../services/externalFeedService.js';
import { batchGetExternalPostAggregates } from '../services/vibeService.js';
import {
  scoreExternalPost,
  scoreExternalPostAdvanced,
  filterExternalPosts,
  getDefaultPreferences,
  buildVibeProfileFromReactions,
  applyMoodPreset,
  applyDiversityControls,
  type ExternalScoringContext,
  type ExternalContentFilters,
  type VectorMultipliers,
  type MoodType,
} from '../lib/feedScoring.js';

// Augment external posts with vibe aggregate data + user's own reaction
async function attachVibeData(
  posts: ExternalPost[],
  prisma: import('@prisma/client').PrismaClient,
  userId?: string
): Promise<(ExternalPost & { vibeAggregate?: any; myReaction?: Record<string, number> | null })[]> {
  if (posts.length === 0) return posts;

  const ids = posts.map(p => p.id);
  const { aggregates, myReactions } = await batchGetExternalPostAggregates(prisma, ids, userId);

  return posts.map(post => ({
    ...post,
    vibeAggregate: aggregates[post.id] || null,
    myReaction: myReactions[post.id] || null,
  }));
}

/**
 * Load full scoring context for the authenticated user.
 * Returns null if user is not authenticated.
 */
async function loadScoringContext(
  prisma: import('@prisma/client').PrismaClient,
  userId: string | undefined,
  filterOverrides?: Partial<ExternalContentFilters>
): Promise<{ ctx: ExternalScoringContext; filters: ExternalContentFilters } | null> {
  if (!userId) return null;

  const [userPref, recentReactions, mutedWords] = await Promise.all([
    prisma.userFeedPreference.findUnique({ where: { userId } }),
    prisma.vibeReaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { intensities: true },
    }),
    prisma.userMutedWord.findMany({ where: { userId } }),
  ]);

  const defaults = getDefaultPreferences();
  const p = userPref;

  // Build basic preferences (with mood overlay)
  let preferences = {
    qualityWeight: p?.qualityWeight ?? defaults.qualityWeight,
    recencyWeight: p?.recencyWeight ?? defaults.recencyWeight,
    engagementWeight: p?.engagementWeight ?? defaults.engagementWeight,
    personalizationWeight: p?.personalizationWeight ?? defaults.personalizationWeight,
    recencyHalfLife: p?.recencyHalfLife ?? defaults.recencyHalfLife,
    followingOnly: p?.followingOnly ?? defaults.followingOnly,
  };

  // Apply mood preset overlay
  const mood = (p?.moodToggle ?? 'normal') as MoodType;
  if (mood !== 'normal') {
    preferences = applyMoodPreset(preferences, mood);
  }

  // Parse vector multipliers from JSON
  const defaultMultipliers: VectorMultipliers = { insightful: 100, joy: 100, fire: 100, support: 100, shock: 100, questionable: 100 };
  let vectorMultipliers = defaultMultipliers;
  if (p?.vectorMultipliers) {
    try {
      vectorMultipliers = typeof p.vectorMultipliers === 'string'
        ? JSON.parse(p.vectorMultipliers) as VectorMultipliers
        : p.vectorMultipliers as unknown as VectorMultipliers;
    } catch {
      vectorMultipliers = defaultMultipliers;
    }
  }

  const userVibeProfile = recentReactions.length > 0
    ? buildVibeProfileFromReactions(
        recentReactions.map(r => ({ intensities: r.intensities as Record<string, number> }))
      )
    : null;

  const ctx: ExternalScoringContext = {
    preferences,
    qualityPrefs: {
      authorCredWeight: p?.authorCredWeight ?? 50,
      vectorQualityWeight: p?.vectorQualityWeight ?? 35,
      confidenceWeight: p?.confidenceWeight ?? 15,
    },
    recencyPrefs: {
      halfLifeHours: p?.halfLifeHours ?? 12,
      decayFunction: (p?.decayFunction as 'exponential' | 'linear' | 'step') ?? 'exponential',
      timeDecay: p?.timeDecay ?? 60,
      velocity: p?.velocity ?? 25,
      freshness: p?.freshness ?? 15,
    },
    engagementPrefs: {
      intensity: p?.intensity ?? 40,
      discussionDepth: p?.discussionDepth ?? 30,
      shareWeight: p?.shareWeight ?? 20,
      expertCommentBonus: p?.expertCommentBonus ?? 10,
    },
    personalizationPrefs: {
      followingWeight: p?.followingWeight ?? 50,
      alignment: p?.alignment ?? 20,
      affinity: p?.affinity ?? 15,
      trustNetwork: p?.trustNetwork ?? 15,
    },
    vectorMultipliers,
    antiAlignmentPenalty: p?.antiAlignmentPenalty ?? 20,
    userVibeProfile,
    diversityPrefs: {
      maxPostsPerAuthor: p?.maxPostsPerAuthor ?? 3,
      topicClusteringPenalty: p?.topicClusteringPenalty ?? 20,
      textRatio: p?.textRatio ?? 40,
      imageRatio: p?.imageRatio ?? 25,
      videoRatio: p?.videoRatio ?? 20,
      linkRatio: p?.linkRatio ?? 15,
    },
    mood,
  };

  // Build content filters from DB prefs + query overrides
  const filters: ExternalContentFilters = {
    timeRange: (filterOverrides?.timeRange ?? (p?.timeRange as ExternalContentFilters['timeRange']) ?? 'all'),
    postLength: filterOverrides?.postLength ?? 'any',
    mediaType: filterOverrides?.mediaType ?? 'any',
    textOnly: filterOverrides?.textOnly ?? p?.textOnly ?? false,
    mediaOnly: filterOverrides?.mediaOnly ?? p?.mediaOnly ?? false,
    linksOnly: filterOverrides?.linksOnly ?? p?.linksOnly ?? false,
    hasDiscussion: filterOverrides?.hasDiscussion ?? p?.hasDiscussion ?? false,
    hideMutedWords: p?.hideMutedWords ?? true,
    mutedWords: mutedWords.map(mw => ({ word: mw.word, isRegex: mw.isRegex })),
  };

  return { ctx, filters };
}

/**
 * Apply full scoring pipeline: filter → score → diversity controls → sort.
 */
function scoreAndSort(
  posts: Array<ExternalPost & { vibeAggregate?: any; myReaction?: Record<string, number> | null }>,
  ctx: ExternalScoringContext,
  filters: ExternalContentFilters,
  limit: number
) {
  // 1. Apply content filters
  let filtered = filterExternalPosts(posts as any, filters);

  // 2. Score each post
  const scored = filtered.map(post => ({
    ...post,
    feedScore: scoreExternalPostAdvanced(post, ctx),
  }));

  // 3. Apply diversity controls
  if (ctx.diversityPrefs) {
    const diversified = applyDiversityControls(
      scored.map(p => ({
        id: p.id,
        authorId: p.author.id,
        score: p.feedScore,
        postType: p.mediaUrls.length > 0 ? 'image' : 'text',
        vibeAggregate: p.vibeAggregate ? { ...p.vibeAggregate, reactionCount: p.vibeAggregate.totalReactors ?? 0 } : null,
      })),
      ctx.diversityPrefs,
      limit
    );

    // Rebuild posts in diversified order
    const orderMap = new Map(diversified.map((d, i) => [d.id, i]));
    const scoredMap = new Map(scored.map(p => [p.id, p]));
    const ordered = diversified
      .map(d => scoredMap.get(d.id))
      .filter((p): p is NonNullable<typeof p> => p != null);
    return ordered;
  }

  // No diversity controls — just sort by score
  scored.sort((a, b) => b.feedScore - a.feedScore);
  return scored.slice(0, limit);
}

// Common query parameters for all endpoints
const commonQuerySchema = {
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
  language: z.string().length(2).optional(), // ISO 639-1 code (en, es, ja, etc.)
};

// Optional scoring filter parameters that can be sent from frontend
const scoringQuerySchema = {
  scored: z.enum(['true', 'false']).optional(),
  postLength: z.enum(['any', 'micro', 'short', 'medium', 'long']).optional(),
  mediaType: z.enum(['any', 'photos', 'videos', 'gifs']).optional(),
};

const externalRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // BLUESKY ENDPOINTS
  // ============================================

  // Get Bluesky "What's Hot" feed
  fastify.get(
    '/bluesky/discover',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({ ...commonQuerySchema, ...scoringQuerySchema });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { limit, cursor, language, scored, postLength, mediaType } = parsed.data;
      const result = await fetchBlueskyDiscover({
        limit: scored === 'true' ? Math.min(limit * 2, 50) : limit, // Fetch extra for filtering
        ...(cursor != null && { cursor }),
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      const userId = (request.user as { sub: string } | undefined)?.sub;
      const augmented = await attachVibeData(result.posts, fastify.prisma, userId);

      if (scored === 'true') {
        const scoring = await loadScoringContext(fastify.prisma, userId, {
          ...(postLength != null && { postLength }),
          ...(mediaType != null && { mediaType }),
        });
        if (scoring) {
          const sortedPosts = scoreAndSort(augmented, scoring.ctx, scoring.filters, limit);
          return reply.send({ ...result, posts: sortedPosts, scored: true });
        }
      }

      result.posts = augmented as typeof result.posts;
      return reply.send(result);
    }
  );

  // Get posts from a specific Bluesky feed
  fastify.get(
    '/bluesky/feed',
    async (request, reply) => {
      const schema = z.object({
        feed: z.string().optional(), // AT URI of feed generator
        ...commonQuerySchema,
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { feed, limit, cursor, language } = parsed.data;
      const result = await fetchBlueskyFeed(feed, {
        limit,
        ...(cursor != null && { cursor }),
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      return reply.send(result);
    }
  );

  // Get posts from a specific Bluesky user
  fastify.get(
    '/bluesky/user/:handle',
    async (request, reply) => {
      const paramsSchema = z.object({
        handle: z.string().min(1),
      });
      const querySchema = z.object(commonQuerySchema);

      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = querySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({ error: 'Invalid parameters' });
      }

      const { handle } = paramsResult.data;
      const { limit, cursor, language } = queryResult.data;
      const result = await fetchBlueskyUserPosts(handle, {
        limit,
        ...(cursor != null && { cursor }),
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      return reply.send(result);
    }
  );

  // Get thread/replies for a Bluesky post
  fastify.get(
    '/bluesky/thread',
    async (request, reply) => {
      const schema = z.object({
        uri: z.string(), // AT URI of the post
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters - uri required' });
      }

      const { uri } = parsed.data;
      const result = await fetchBlueskyThread(uri);

      return reply.send(result);
    }
  );

  // ============================================
  // MASTODON ENDPOINTS
  // ============================================

  // Get Mastodon public timeline
  fastify.get(
    '/mastodon/timeline',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        timeline: z.enum(['public', 'local']).default('public'),
        ...commonQuerySchema,
        ...scoringQuerySchema,
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { instance, timeline, limit, cursor, language, scored, postLength, mediaType } = parsed.data;
      const result = await fetchMastodonFeed(instance, timeline, {
        limit: scored === 'true' ? Math.min(limit * 2, 50) : limit,
        ...(cursor != null && { cursor }),
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      const userId = (request.user as { sub: string } | undefined)?.sub;
      const augmented = await attachVibeData(result.posts, fastify.prisma, userId);

      if (scored === 'true') {
        const scoring = await loadScoringContext(fastify.prisma, userId, {
          ...(postLength != null && { postLength }),
          ...(mediaType != null && { mediaType }),
        });
        if (scoring) {
          const sortedPosts = scoreAndSort(augmented, scoring.ctx, scoring.filters, limit);
          return reply.send({ ...result, posts: sortedPosts, scored: true });
        }
      }

      result.posts = augmented as typeof result.posts;
      return reply.send(result);
    }
  );

  // Get Mastodon trending posts
  fastify.get(
    '/mastodon/trending',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
        language: z.string().length(2).optional(),
        ...scoringQuerySchema,
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { instance, limit, offset, language, scored, postLength, mediaType } = parsed.data;
      const result = await fetchMastodonTrending(instance, {
        limit: scored === 'true' ? Math.min(limit * 2, 50) : limit,
        offset,
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      const userId = (request.user as { sub: string } | undefined)?.sub;
      const augmented = await attachVibeData(result.posts, fastify.prisma, userId);

      if (scored === 'true') {
        const scoring = await loadScoringContext(fastify.prisma, userId, {
          ...(postLength != null && { postLength }),
          ...(mediaType != null && { mediaType }),
        });
        if (scoring) {
          const sortedPosts = scoreAndSort(augmented, scoring.ctx, scoring.filters, limit);
          return reply.send({ ...result, posts: sortedPosts, scored: true });
        }
      }

      result.posts = augmented as typeof result.posts;
      return reply.send(result);
    }
  );

  // Get thread/replies for a Mastodon post
  fastify.get(
    '/mastodon/thread',
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        statusId: z.string(), // Status ID
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters - statusId required' });
      }

      const { instance, statusId } = parsed.data;
      const result = await fetchMastodonContext(instance, statusId);

      return reply.send(result);
    }
  );

  // ============================================
  // COMBINED FEED
  // ============================================

  // Get combined feed from multiple platforms
  fastify.get(
    '/combined',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        limit: z.coerce.number().min(1).max(50).default(20),
        platforms: z.string().optional(), // comma-separated: "bluesky,mastodon"
        mastodonInstance: z.string().optional(),
        language: z.string().length(2).optional(),
        ...scoringQuerySchema,
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { limit, platforms, mastodonInstance, language, scored, postLength, mediaType } = parsed.data;

      // Parse platforms
      const platformList = platforms
        ? platforms.split(',').map(p => p.trim().toLowerCase())
        : ['bluesky', 'mastodon'];

      const sources: Array<{ platform: 'bluesky' | 'mastodon'; config?: any }> = [];

      if (platformList.includes('bluesky')) {
        sources.push({ platform: 'bluesky' });
      }
      if (platformList.includes('mastodon')) {
        sources.push({
          platform: 'mastodon',
          config: { instance: mastodonInstance || 'mastodon.social' },
        });
      }

      if (sources.length === 0) {
        return reply.status(400).send({ error: 'At least one platform must be specified' });
      }

      const posts = await fetchCombinedFeed(sources, {
        limit: scored === 'true' ? Math.min(limit * 2, 50) : limit,
        ...(language != null && { language }),
        redis: fastify.redis,
      });

      // Attach vibe aggregates + user's reactions
      const userId = (request.user as { sub: string } | undefined)?.sub;
      const augmented = await attachVibeData(posts, fastify.prisma, userId);

      // Apply full scoring pipeline
      if (scored === 'true') {
        const scoring = await loadScoringContext(fastify.prisma, userId, {
          ...(postLength != null && { postLength }),
          ...(mediaType != null && { mediaType }),
        });
        if (scoring) {
          const sortedPosts = scoreAndSort(augmented, scoring.ctx, scoring.filters, limit);
          return reply.send({
            posts: sortedPosts,
            platforms: platformList,
            scored: true,
          });
        }
      }

      return reply.send({
        posts: augmented,
        platforms: platformList,
      });
    }
  );

  // ============================================
  // AVAILABLE FEEDS METADATA
  // ============================================

  // Get list of available external feeds
  fastify.get(
    '/available',
    async (request, reply) => {
      return reply.send({
        platforms: [
          {
            id: 'bluesky',
            name: 'Bluesky',
            icon: '🦋',
            feeds: [
              { id: 'discover', name: "What's Hot", description: 'Popular posts from Bluesky' },
              { id: 'user', name: 'User Feed', description: 'Posts from a specific user', requiresHandle: true },
            ],
          },
          {
            id: 'mastodon',
            name: 'Mastodon',
            icon: '🦣',
            feeds: [
              { id: 'public', name: 'Federated', description: 'Public posts from across the Fediverse' },
              { id: 'local', name: 'Local', description: 'Posts from a specific instance' },
              { id: 'trending', name: 'Trending', description: 'Currently trending posts' },
            ],
            popularInstances: [
              'mastodon.social',
              'mas.to',
              'hachyderm.io',
              'fosstodon.org',
              'infosec.exchange',
              'techhub.social',
            ],
          },
        ],
      });
    }
  );
};

export default externalRoutes;
