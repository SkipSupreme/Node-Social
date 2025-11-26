import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PresetService } from '../services/presetService.js';

const presetRoutes: FastifyPluginAsync = async (fastify) => {
    // Create a preset
    fastify.post(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const schema = z.object({
                name: z.string().min(1).max(50),
                description: z.string().max(200).optional(),
                config: z.any(), // Validated by service
                isPublic: z.boolean().optional(),
            });

            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
            }

            const userId = (request.user as { sub: string }).sub;
            const { name, description, config, isPublic } = parsed.data;

            const preset = await PresetService.createPreset(fastify.prisma, {
                name,
                ...(description ? { description } : {}),
                creatorId: userId,
                config,
                ...(isPublic !== undefined ? { isPublic } : {}),
            });

            return reply.status(201).send(preset);
        }
    );

    // Get my presets
    fastify.get(
        '/mine',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const userId = (request.user as { sub: string }).sub;
            const presets = await (fastify.prisma as any).feedPreset.findMany({
                where: { creatorId: userId },
                orderBy: { createdAt: 'desc' },
            });
            return reply.send({ presets });
        }
    );

    // Get marketplace presets
    fastify.get(
        '/marketplace',
        async (request, reply) => {
            const schema = z.object({
                limit: z.coerce.number().min(1).max(50).optional(),
                cursor: z.string().optional(),
                sort: z.enum(['popular', 'newest']).optional(),
            });

            const parsed = schema.safeParse(request.query);
            if (!parsed.success) {
                return reply.status(400).send({ error: 'Invalid query params' });
            }

            const presets = await PresetService.getMarketplace(fastify.prisma, {
                ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
                ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
                ...(parsed.data.sort ? { sort: parsed.data.sort } : {}),
            });
            return reply.send({ presets });
        }
    );

    // Install a preset
    fastify.post(
        '/:id/install',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const userId = (request.user as { sub: string }).sub;

            try {
                const preset = await PresetService.installPreset(fastify.prisma, userId, id);
                return reply.send({ message: 'Preset installed successfully', preset });
            } catch (error) {
                fastify.log.error(error);
                return reply.status(404).send({ error: 'Preset not found or failed to install' });
            }
        }
    );
};

export default presetRoutes;
