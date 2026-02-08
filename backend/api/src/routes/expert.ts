import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ExpertService } from '../services/expertService.js';

const expertRoutes: FastifyPluginAsync = async (fastify) => {
    // Helper: verify user is node creator or site admin
    async function verifyNodeAdmin(userId: string, nodeId: string) {
        const [user, node] = await Promise.all([
            fastify.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
            fastify.prisma.node.findUnique({ where: { id: nodeId }, select: { creatorId: true } }),
        ]);
        if (!node) return { allowed: false as const, reason: 'Node not found' };
        if (user?.role === 'admin' || node.creatorId === userId) return { allowed: true as const };
        return { allowed: false as const, reason: 'Only node creator or site admin can modify expert config' };
    }

    // GET /expert/config (authenticated — any member can read)
    fastify.get('/config', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const schema = z.object({
            nodeId: z.string().uuid(),
        });

        const parsed = schema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
        }

        const { nodeId } = parsed.data;

        const config = await fastify.prisma.nodeVectorConfig.findUnique({
            where: { nodeId },
        });

        if (!config) {
            return { expertConfig: {}, suppressionRules: [], boostRules: [] };
        }

        return {
            expertConfig: config.expertConfig,
            suppressionRules: config.suppressionRules,
            boostRules: config.boostRules,
        };
    });

    // PUT /expert/config
    fastify.put('/config', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const schema = z.object({
            nodeId: z.string().uuid(),
            expertConfig: z.any(), // Validated by service
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid body', details: parsed.error });
        }

        const { nodeId, expertConfig } = parsed.data;
        const userId = (request.user as { sub: string }).sub;

        // Authorization: node creator or site admin only
        const auth = await verifyNodeAdmin(userId, nodeId);
        if (!auth.allowed) {
            return reply.status(403).send({ error: auth.reason });
        }

        // Validate
        const validated = ExpertService.validateConfig(expertConfig);

        await fastify.prisma.nodeVectorConfig.upsert({
            where: { nodeId },
            update: { expertConfig: validated as any },
            create: { nodeId, expertConfig: validated as any },
        });

        return { success: true, config: validated };
    });

    // PUT /expert/rules
    fastify.put('/rules', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const schema = z.object({
            nodeId: z.string().uuid(),
            type: z.enum(['suppression', 'boost']),
            rules: z.array(z.any()), // Validated by service
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid body', details: parsed.error });
        }

        const { nodeId, type, rules } = parsed.data;
        const userId = (request.user as { sub: string }).sub;

        // Authorization: node creator or site admin only
        const auth = await verifyNodeAdmin(userId, nodeId);
        if (!auth.allowed) {
            return reply.status(403).send({ error: auth.reason });
        }

        // Validate
        const validated = ExpertService.validateRules(rules);

        const updateData: any = {};
        if (type === 'suppression') {
            updateData.suppressionRules = validated as any;
        } else {
            updateData.boostRules = validated as any;
        }

        await fastify.prisma.nodeVectorConfig.upsert({
            where: { nodeId },
            update: updateData,
            create: { nodeId, ...updateData },
        });

        return { success: true, rules: validated };
    });
};

export default expertRoutes;
