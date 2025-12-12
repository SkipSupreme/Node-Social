// src/routes/feedPreferences.ts
// Full Vibe Validator settings persistence API
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Preset configurations from weighted_parameters_starter.md
const PRESETS = {
  latest: {
    qualityWeight: 10,
    recencyWeight: 80,
    engagementWeight: 5,
    personalizationWeight: 5,
    presetMode: 'latest',
  },
  balanced: {
    qualityWeight: 35,
    recencyWeight: 30,
    engagementWeight: 20,
    personalizationWeight: 15,
    presetMode: 'balanced',
  },
  popular: {
    qualityWeight: 25,
    recencyWeight: 15,
    engagementWeight: 50,
    personalizationWeight: 10,
    presetMode: 'popular',
  },
  expert: {
    qualityWeight: 60,
    recencyWeight: 5,
    engagementWeight: 15,
    personalizationWeight: 20,
    presetMode: 'expert',
  },
  personal: {
    qualityWeight: 10,
    recencyWeight: 25,
    engagementWeight: 5,
    personalizationWeight: 60,
    presetMode: 'personal',
  },
} as const;

// Vector multipliers schema
const vectorMultipliersSchema = z.object({
  insightful: z.number().min(0).max(200),
  joy: z.number().min(0).max(200),
  fire: z.number().min(0).max(200),
  support: z.number().min(0).max(200),
  shock: z.number().min(0).max(200),
  questionable: z.number().min(0).max(200),
}).partial();

// Full update schema with all Vibe Validator settings
const feedPreferencesUpdateSchema = z.object({
  // Basic / Simple mode
  preset: z.enum(['latest', 'balanced', 'popular', 'expert', 'personal', 'custom']).optional(),
  qualityWeight: z.number().min(0).max(100).optional(),
  recencyWeight: z.number().min(0).max(100).optional(),
  engagementWeight: z.number().min(0).max(100).optional(),
  personalizationWeight: z.number().min(0).max(100).optional(),

  // Legacy (kept for backwards compat)
  recencyHalfLife: z.enum(['1h', '6h', '12h', '24h', '7d']).optional(),

  // Intermediate mode
  timeRange: z.enum(['1h', '6h', '24h', '7d', 'all']).optional(),
  discoveryRate: z.number().int().min(0).max(100).optional(),
  hideMutedWords: z.boolean().optional(),
  showSeenPosts: z.boolean().optional(),
  textOnly: z.boolean().optional(),
  mediaOnly: z.boolean().optional(),
  linksOnly: z.boolean().optional(),
  hasDiscussion: z.boolean().optional(),
  followingOnly: z.boolean().optional(),
  minCred: z.number().min(0).optional().nullable(),

  // Advanced - Quality sub-signals
  authorCredWeight: z.number().int().min(0).max(100).optional(),
  vectorQualityWeight: z.number().int().min(0).max(100).optional(),
  confidenceWeight: z.number().int().min(0).max(100).optional(),

  // Advanced - Recency sub-signals
  timeDecay: z.number().int().min(0).max(100).optional(),
  velocity: z.number().int().min(0).max(100).optional(),
  freshness: z.number().int().min(0).max(100).optional(),
  halfLifeHours: z.number().int().min(1).max(168).optional(),
  decayFunction: z.enum(['exponential', 'linear', 'step']).optional(),

  // Advanced - Engagement sub-signals
  intensity: z.number().int().min(0).max(100).optional(),
  discussionDepth: z.number().int().min(0).max(100).optional(),
  shareWeight: z.number().int().min(0).max(100).optional(),
  expertCommentBonus: z.number().int().min(0).max(100).optional(),

  // Advanced - Personalization sub-signals
  followingWeight: z.number().int().min(0).max(100).optional(),
  alignment: z.number().int().min(0).max(100).optional(),
  affinity: z.number().int().min(0).max(100).optional(),
  trustNetwork: z.number().int().min(0).max(100).optional(),

  // Advanced - Vector multipliers & anti-alignment
  vectorMultipliers: vectorMultipliersSchema.optional(),
  antiAlignmentPenalty: z.number().int().min(0).max(100).optional(),

  // Expert mode
  maxPostsPerAuthor: z.number().int().min(1).max(10).optional(),
  topicClusteringPenalty: z.number().int().min(0).max(100).optional(),
  textRatio: z.number().int().min(0).max(100).optional(),
  imageRatio: z.number().int().min(0).max(100).optional(),
  videoRatio: z.number().int().min(0).max(100).optional(),
  linkRatio: z.number().int().min(0).max(100).optional(),
  explorationPool: z.enum(['global', 'network', 'node']).optional(),
  moodToggle: z.enum(['normal', 'chill', 'intense', 'discovery']).optional(),
  enableExperiments: z.boolean().optional(),
  timeBasedProfiles: z.boolean().optional(),
});

// Default values for all fields (matching Prisma schema defaults)
const DEFAULT_PREFERENCES = {
  qualityWeight: 35.0,
  recencyWeight: 30.0,
  engagementWeight: 20.0,
  personalizationWeight: 15.0,
  presetMode: 'balanced',
  recencyHalfLife: '12h',
  timeRange: 'all',
  discoveryRate: 15,
  hideMutedWords: true,
  showSeenPosts: false,
  textOnly: false,
  mediaOnly: false,
  linksOnly: false,
  hasDiscussion: false,
  followingOnly: false,
  minCred: null,
  authorCredWeight: 50,
  vectorQualityWeight: 35,
  confidenceWeight: 15,
  timeDecay: 60,
  velocity: 25,
  freshness: 15,
  halfLifeHours: 12,
  decayFunction: 'exponential',
  intensity: 40,
  discussionDepth: 30,
  shareWeight: 20,
  expertCommentBonus: 10,
  followingWeight: 50,
  alignment: 20,
  affinity: 15,
  trustNetwork: 15,
  vectorMultipliers: {
    insightful: 100,
    joy: 100,
    fire: 100,
    support: 100,
    shock: 100,
    questionable: 100,
  },
  antiAlignmentPenalty: 20,
  maxPostsPerAuthor: 3,
  topicClusteringPenalty: 20,
  textRatio: 40,
  imageRatio: 25,
  videoRatio: 20,
  linkRatio: 15,
  explorationPool: 'global',
  moodToggle: 'normal',
  enableExperiments: false,
  timeBasedProfiles: false,
};

const feedPreferenceRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's feed preferences (or defaults)
  fastify.get(
    '/feed-preferences',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const preferences = await fastify.prisma.userFeedPreference.findUnique({
        where: { userId },
      });

      // Return defaults if no preferences exist
      if (!preferences) {
        return reply.send({
          userId,
          ...DEFAULT_PREFERENCES,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Parse vectorMultipliers from JSON if stored as string
      const result = {
        ...preferences,
        vectorMultipliers: typeof preferences.vectorMultipliers === 'string'
          ? JSON.parse(preferences.vectorMultipliers)
          : preferences.vectorMultipliers,
      };

      return reply.send(result);
    }
  );

  // Update user's feed preferences
  fastify.put(
    '/feed-preferences',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const parsed = feedPreferencesUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const data = parsed.data;

      // If preset is provided (not custom), apply preset values
      if (data.preset && data.preset !== 'custom') {
        const preset = PRESETS[data.preset];

        // Build update object with preset values + any other provided fields
        const updateData = {
          ...preset,
          // Apply any additional fields from the request
          ...(data.timeRange !== undefined && { timeRange: data.timeRange }),
          ...(data.discoveryRate !== undefined && { discoveryRate: data.discoveryRate }),
          ...(data.hideMutedWords !== undefined && { hideMutedWords: data.hideMutedWords }),
          ...(data.showSeenPosts !== undefined && { showSeenPosts: data.showSeenPosts }),
          ...(data.textOnly !== undefined && { textOnly: data.textOnly }),
          ...(data.mediaOnly !== undefined && { mediaOnly: data.mediaOnly }),
          ...(data.linksOnly !== undefined && { linksOnly: data.linksOnly }),
          ...(data.hasDiscussion !== undefined && { hasDiscussion: data.hasDiscussion }),
          ...(data.followingOnly !== undefined && { followingOnly: data.followingOnly }),
          ...(data.minCred !== undefined && { minCred: data.minCred }),
          ...(data.recencyHalfLife !== undefined && { recencyHalfLife: data.recencyHalfLife }),
          // Advanced fields
          ...(data.authorCredWeight !== undefined && { authorCredWeight: data.authorCredWeight }),
          ...(data.vectorQualityWeight !== undefined && { vectorQualityWeight: data.vectorQualityWeight }),
          ...(data.confidenceWeight !== undefined && { confidenceWeight: data.confidenceWeight }),
          ...(data.timeDecay !== undefined && { timeDecay: data.timeDecay }),
          ...(data.velocity !== undefined && { velocity: data.velocity }),
          ...(data.freshness !== undefined && { freshness: data.freshness }),
          ...(data.halfLifeHours !== undefined && { halfLifeHours: data.halfLifeHours }),
          ...(data.decayFunction !== undefined && { decayFunction: data.decayFunction }),
          ...(data.intensity !== undefined && { intensity: data.intensity }),
          ...(data.discussionDepth !== undefined && { discussionDepth: data.discussionDepth }),
          ...(data.shareWeight !== undefined && { shareWeight: data.shareWeight }),
          ...(data.expertCommentBonus !== undefined && { expertCommentBonus: data.expertCommentBonus }),
          ...(data.followingWeight !== undefined && { followingWeight: data.followingWeight }),
          ...(data.alignment !== undefined && { alignment: data.alignment }),
          ...(data.affinity !== undefined && { affinity: data.affinity }),
          ...(data.trustNetwork !== undefined && { trustNetwork: data.trustNetwork }),
          ...(data.vectorMultipliers !== undefined && { vectorMultipliers: data.vectorMultipliers }),
          ...(data.antiAlignmentPenalty !== undefined && { antiAlignmentPenalty: data.antiAlignmentPenalty }),
          // Expert fields
          ...(data.maxPostsPerAuthor !== undefined && { maxPostsPerAuthor: data.maxPostsPerAuthor }),
          ...(data.topicClusteringPenalty !== undefined && { topicClusteringPenalty: data.topicClusteringPenalty }),
          ...(data.textRatio !== undefined && { textRatio: data.textRatio }),
          ...(data.imageRatio !== undefined && { imageRatio: data.imageRatio }),
          ...(data.videoRatio !== undefined && { videoRatio: data.videoRatio }),
          ...(data.linkRatio !== undefined && { linkRatio: data.linkRatio }),
          ...(data.explorationPool !== undefined && { explorationPool: data.explorationPool }),
          ...(data.moodToggle !== undefined && { moodToggle: data.moodToggle }),
          ...(data.enableExperiments !== undefined && { enableExperiments: data.enableExperiments }),
          ...(data.timeBasedProfiles !== undefined && { timeBasedProfiles: data.timeBasedProfiles }),
        };

        const preferences = await fastify.prisma.userFeedPreference.upsert({
          where: { userId },
          create: {
            userId,
            ...DEFAULT_PREFERENCES,
            ...updateData,
          },
          update: updateData,
        });

        return reply.send({
          ...preferences,
          vectorMultipliers: typeof preferences.vectorMultipliers === 'string'
            ? JSON.parse(preferences.vectorMultipliers)
            : preferences.vectorMultipliers,
        });
      }

      // Custom mode or partial update: validate main weights if all four are provided
      if (
        data.qualityWeight !== undefined &&
        data.recencyWeight !== undefined &&
        data.engagementWeight !== undefined &&
        data.personalizationWeight !== undefined
      ) {
        const total = data.qualityWeight + data.recencyWeight + data.engagementWeight + data.personalizationWeight;
        if (Math.abs(total - 100) > 0.01) {
          return reply.status(400).send({
            error: 'Weights must sum to 100',
            total,
          });
        }
      }

      // Build update object from all provided fields
      const updateData: Record<string, any> = {};

      // Basic
      if (data.preset !== undefined) updateData.presetMode = data.preset;
      if (data.qualityWeight !== undefined) updateData.qualityWeight = data.qualityWeight;
      if (data.recencyWeight !== undefined) updateData.recencyWeight = data.recencyWeight;
      if (data.engagementWeight !== undefined) updateData.engagementWeight = data.engagementWeight;
      if (data.personalizationWeight !== undefined) updateData.personalizationWeight = data.personalizationWeight;
      if (data.recencyHalfLife !== undefined) updateData.recencyHalfLife = data.recencyHalfLife;

      // Intermediate
      if (data.timeRange !== undefined) updateData.timeRange = data.timeRange;
      if (data.discoveryRate !== undefined) updateData.discoveryRate = data.discoveryRate;
      if (data.hideMutedWords !== undefined) updateData.hideMutedWords = data.hideMutedWords;
      if (data.showSeenPosts !== undefined) updateData.showSeenPosts = data.showSeenPosts;
      if (data.textOnly !== undefined) updateData.textOnly = data.textOnly;
      if (data.mediaOnly !== undefined) updateData.mediaOnly = data.mediaOnly;
      if (data.linksOnly !== undefined) updateData.linksOnly = data.linksOnly;
      if (data.hasDiscussion !== undefined) updateData.hasDiscussion = data.hasDiscussion;
      if (data.followingOnly !== undefined) updateData.followingOnly = data.followingOnly;
      if (data.minCred !== undefined) updateData.minCred = data.minCred;

      // Advanced - Quality
      if (data.authorCredWeight !== undefined) updateData.authorCredWeight = data.authorCredWeight;
      if (data.vectorQualityWeight !== undefined) updateData.vectorQualityWeight = data.vectorQualityWeight;
      if (data.confidenceWeight !== undefined) updateData.confidenceWeight = data.confidenceWeight;

      // Advanced - Recency
      if (data.timeDecay !== undefined) updateData.timeDecay = data.timeDecay;
      if (data.velocity !== undefined) updateData.velocity = data.velocity;
      if (data.freshness !== undefined) updateData.freshness = data.freshness;
      if (data.halfLifeHours !== undefined) updateData.halfLifeHours = data.halfLifeHours;
      if (data.decayFunction !== undefined) updateData.decayFunction = data.decayFunction;

      // Advanced - Engagement
      if (data.intensity !== undefined) updateData.intensity = data.intensity;
      if (data.discussionDepth !== undefined) updateData.discussionDepth = data.discussionDepth;
      if (data.shareWeight !== undefined) updateData.shareWeight = data.shareWeight;
      if (data.expertCommentBonus !== undefined) updateData.expertCommentBonus = data.expertCommentBonus;

      // Advanced - Personalization
      if (data.followingWeight !== undefined) updateData.followingWeight = data.followingWeight;
      if (data.alignment !== undefined) updateData.alignment = data.alignment;
      if (data.affinity !== undefined) updateData.affinity = data.affinity;
      if (data.trustNetwork !== undefined) updateData.trustNetwork = data.trustNetwork;

      // Advanced - Vector multipliers
      if (data.vectorMultipliers !== undefined) updateData.vectorMultipliers = data.vectorMultipliers;
      if (data.antiAlignmentPenalty !== undefined) updateData.antiAlignmentPenalty = data.antiAlignmentPenalty;

      // Expert
      if (data.maxPostsPerAuthor !== undefined) updateData.maxPostsPerAuthor = data.maxPostsPerAuthor;
      if (data.topicClusteringPenalty !== undefined) updateData.topicClusteringPenalty = data.topicClusteringPenalty;
      if (data.textRatio !== undefined) updateData.textRatio = data.textRatio;
      if (data.imageRatio !== undefined) updateData.imageRatio = data.imageRatio;
      if (data.videoRatio !== undefined) updateData.videoRatio = data.videoRatio;
      if (data.linkRatio !== undefined) updateData.linkRatio = data.linkRatio;
      if (data.explorationPool !== undefined) updateData.explorationPool = data.explorationPool;
      if (data.moodToggle !== undefined) updateData.moodToggle = data.moodToggle;
      if (data.enableExperiments !== undefined) updateData.enableExperiments = data.enableExperiments;
      if (data.timeBasedProfiles !== undefined) updateData.timeBasedProfiles = data.timeBasedProfiles;

      const preferences = await fastify.prisma.userFeedPreference.upsert({
        where: { userId },
        create: {
          userId,
          ...DEFAULT_PREFERENCES,
          ...updateData,
        },
        update: updateData,
      });

      return reply.send({
        ...preferences,
        vectorMultipliers: typeof preferences.vectorMultipliers === 'string'
          ? JSON.parse(preferences.vectorMultipliers)
          : preferences.vectorMultipliers,
      });
    }
  );
};

export default feedPreferenceRoutes;
