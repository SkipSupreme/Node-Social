// src/routes/feedPreferences.ts
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

const feedPreferenceRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's feed preferences (or defaults)
  fastify.get(
    '/feed-preferences',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      let preferences = await fastify.prisma.userFeedPreference.findUnique({
        where: { userId },
      });

      // Return defaults if no preferences exist
      if (!preferences) {
        preferences = {
          userId,
          qualityWeight: 35.0,
          recencyWeight: 30.0,
          engagementWeight: 20.0,
          personalizationWeight: 15.0,
          presetMode: 'balanced',
          recencyHalfLife: '12h',
          followingOnly: false,
          minConnoisseurCred: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return reply.send(preferences);
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

      const schema = z.object({
        preset: z.enum(['latest', 'balanced', 'popular', 'expert', 'personal', 'custom']).optional(),
        qualityWeight: z.number().min(0).max(100).optional(),
        recencyWeight: z.number().min(0).max(100).optional(),
        engagementWeight: z.number().min(0).max(100).optional(),
        personalizationWeight: z.number().min(0).max(100).optional(),
        recencyHalfLife: z.enum(['1h', '6h', '12h', '24h', '7d']).optional(),
        followingOnly: z.boolean().optional(),
        minConnoisseurCred: z.number().min(0).optional().nullable(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const data = parsed.data;
      const optionalFields = {
        ...(data.recencyHalfLife !== undefined ? { recencyHalfLife: data.recencyHalfLife } : {}),
        ...(data.followingOnly !== undefined ? { followingOnly: data.followingOnly } : {}),
        ...(data.minConnoisseurCred !== undefined ? { minConnoisseurCred: data.minConnoisseurCred } : {}),
      };

      // If preset is provided, use preset values
      if (data.preset && data.preset !== 'custom') {
        const preset = PRESETS[data.preset];
        const presetUpdate = {
          ...preset,
          ...optionalFields,
        };

        const preferences = await fastify.prisma.userFeedPreference.upsert({
          where: { userId },
          create: {
            userId,
            ...preset,
            recencyHalfLife: data.recencyHalfLife ?? '12h',
            followingOnly: data.followingOnly ?? false,
            minConnoisseurCred: data.minConnoisseurCred ?? null,
          },
          update: presetUpdate,
        });

        return reply.send(preferences);
      }

      // Custom mode: validate weights sum to 100
      if (data.preset === 'custom' || (!data.preset && (data.qualityWeight !== undefined || data.recencyWeight !== undefined))) {
        const qualityWeight = data.qualityWeight ?? 35;
        const recencyWeight = data.recencyWeight ?? 30;
        const engagementWeight = data.engagementWeight ?? 20;
        const personalizationWeight = data.personalizationWeight ?? 15;

        const total = qualityWeight + recencyWeight + engagementWeight + personalizationWeight;
        if (Math.abs(total - 100) > 0.01) {
          return reply.status(400).send({
            error: 'Weights must sum to 100',
            total,
          });
        }

        const preferences = await fastify.prisma.userFeedPreference.upsert({
          where: { userId },
          create: {
            userId,
            qualityWeight,
            recencyWeight,
            engagementWeight,
            personalizationWeight,
            presetMode: 'custom',
            recencyHalfLife: data.recencyHalfLife ?? '12h',
            followingOnly: data.followingOnly ?? false,
            minConnoisseurCred: data.minConnoisseurCred ?? null,
          },
          update: {
            qualityWeight,
            recencyWeight,
            engagementWeight,
            personalizationWeight,
            presetMode: 'custom',
            ...(data.recencyHalfLife !== undefined ? { recencyHalfLife: data.recencyHalfLife } : {}),
            ...(data.followingOnly !== undefined ? { followingOnly: data.followingOnly } : {}),
            ...(data.minConnoisseurCred !== undefined ? { minConnoisseurCred: data.minConnoisseurCred } : {}),
          },
        });

        return reply.send(preferences);
      }

      // Partial update (only update provided fields)
      const partialUpdate = {
        ...(data.qualityWeight !== undefined ? { qualityWeight: data.qualityWeight } : {}),
        ...(data.recencyWeight !== undefined ? { recencyWeight: data.recencyWeight } : {}),
        ...(data.engagementWeight !== undefined ? { engagementWeight: data.engagementWeight } : {}),
        ...(data.personalizationWeight !== undefined ? { personalizationWeight: data.personalizationWeight } : {}),
        ...(data.recencyHalfLife !== undefined ? { recencyHalfLife: data.recencyHalfLife } : {}),
        ...(data.followingOnly !== undefined ? { followingOnly: data.followingOnly } : {}),
        ...(data.minConnoisseurCred !== undefined ? { minConnoisseurCred: data.minConnoisseurCred } : {}),
        ...(data.preset ? { presetMode: data.preset } : {}),
      };

      const preferences = await fastify.prisma.userFeedPreference.upsert({
        where: { userId },
        create: {
          userId,
          qualityWeight: data.qualityWeight ?? 35.0,
          recencyWeight: data.recencyWeight ?? 30.0,
          engagementWeight: data.engagementWeight ?? 20.0,
          personalizationWeight: data.personalizationWeight ?? 15.0,
          presetMode: data.preset ?? 'balanced',
          recencyHalfLife: data.recencyHalfLife ?? '12h',
          followingOnly: data.followingOnly ?? false,
          minConnoisseurCred: data.minConnoisseurCred ?? null,
        },
        update: partialUpdate,
      });

      return reply.send(preferences);
    }
  );
};

export default feedPreferenceRoutes;
