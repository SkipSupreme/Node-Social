import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const PresetConfigSchema = z.object({
    qualityWeight: z.number().optional(),
    recencyWeight: z.number().optional(),
    engagementWeight: z.number().optional(),
    personalizationWeight: z.number().optional(),
    recencyHalfLife: z.string().optional(),
    followingOnly: z.boolean().optional(),
    // Expert params
    epsilon: z.number().optional(),
    maxPostsPerAuthor: z.number().optional(),
    authorCooldown: z.number().optional(),
    // Rules
    suppressionRules: z.array(z.any()).optional(),
    boostRules: z.array(z.any()).optional(),
});

export class PresetService {
    /**
     * Create a new preset
     */
    static async createPreset(prisma: PrismaClient, data: {
        name: string;
        description?: string;
        creatorId: string;
        config: any;
        isPublic?: boolean;
    }) {
        // Validate config
        const validatedConfig = PresetConfigSchema.parse(data.config);

        return prisma.feedPreset.create({
            data: {
                name: data.name,
                description: data.description ?? null,
                creatorId: data.creatorId,
                config: validatedConfig as any,
                isPublic: data.isPublic ?? false,
            },
        });
    }

    /**
     * Get marketplace presets
     */
    static async getMarketplace(prisma: PrismaClient, options: {
        limit?: number;
        cursor?: string;
        sort?: 'popular' | 'newest';
    }) {
        const { limit = 20, cursor, sort = 'popular' } = options;

        return prisma.feedPreset.findMany({
            where: { isPublic: true },
            take: limit,
            skip: cursor ? 1 : 0,
            ...(cursor ? { cursor: { id: cursor } } : {}),
            orderBy: sort === 'popular' ? { downloads: 'desc' } : { createdAt: 'desc' },
            include: {
                creator: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                        cred: true,
                    },
                },
            },
        });
    }

    /**
     * Install a preset (copy config to user preferences)
     */
    static async installPreset(prisma: PrismaClient, userId: string, presetId: string) {
        const preset = await prisma.feedPreset.findUnique({
            where: { id: presetId },
        });

        if (!preset) {
            throw new Error('Preset not found');
        }

        // Increment downloads
        await prisma.feedPreset.update({
            where: { id: presetId },
            data: { downloads: { increment: 1 } },
        });

        const config = preset.config as any;

        // Update UserFeedPreference
        // Note: This overwrites current settings. 
        // Ideally we might want to store "activePresetId" on the user, but for now we copy values.

        // We need to handle expert config vs basic preferences.
        // Basic preferences go to UserFeedPreference.
        // Expert config (rules) might need a place.
        // Currently UserFeedPreference only has basic weights.
        // If we want to support installing Expert presets, we need to update UserFeedPreference schema 
        // or store it elsewhere.

        // For Phase 5 MVP, let's assume we map what we can to UserFeedPreference
        // and maybe add a 'customConfig' JSON field to UserFeedPreference later?
        // Or just update the weights.

        await prisma.userFeedPreference.upsert({
            where: { userId },
            create: {
                userId,
                qualityWeight: config.qualityWeight ?? 35,
                recencyWeight: config.recencyWeight ?? 30,
                engagementWeight: config.engagementWeight ?? 20,
                personalizationWeight: config.personalizationWeight ?? 15,
                recencyHalfLife: config.recencyHalfLife ?? '12h',
                followingOnly: config.followingOnly ?? false,
            },
            update: {
                qualityWeight: config.qualityWeight,
                recencyWeight: config.recencyWeight,
                engagementWeight: config.engagementWeight,
                personalizationWeight: config.personalizationWeight,
                recencyHalfLife: config.recencyHalfLife,
                followingOnly: config.followingOnly,
            },
        });

        return preset;
    }
}
