import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ExpertService } from '../services/expertService.js';
import { PrismaClient } from '@prisma/client';

const expertRoutes: FastifyPluginAsync = async (fastify) => {
    const prisma = new PrismaClient(); // Or inject via fastify

    // GET /expert/config
    fastify.get('/config', {
        // schema removed
    }, async (request, reply) => {
        const schema = z.object({
            nodeId: z.string().uuid(),
        });

        const parsed = schema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
        }

        const { nodeId } = parsed.data;

        const config = await prisma.nodeVectorConfig.findUnique({
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
        // schema removed
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

        // Validate
        const validated = ExpertService.validateConfig(expertConfig);

        await prisma.nodeVectorConfig.upsert({
            where: { nodeId },
            update: { expertConfig: validated as any },
            create: { nodeId, expertConfig: validated as any },
        });

        return { success: true, config: validated };
    });

    // PUT /expert/rules
    fastify.put('/rules', {
        // schema removed
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

        // Validate
        const validated = ExpertService.validateRules(rules);

        const updateData: any = {};
        if (type === 'suppression') {
            updateData.suppressionRules = validated as any;
        } else {
            updateData.boostRules = validated as any;
        }

        await prisma.nodeVectorConfig.upsert({
            where: { nodeId },
            update: updateData,
            create: { nodeId, ...updateData },
        });

        return { success: true, rules: validated };
    });
};

export default expertRoutes;
