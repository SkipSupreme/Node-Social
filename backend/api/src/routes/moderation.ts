// src/routes/moderation.ts
// Moderation endpoints (stub for future Node Court integration)
// Per FINAL_PLAN.md Section 5.2 - Foundation for moderator tooling
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  // Get moderation action log (public, for transparency)
  fastify.get(
    '/moderation/actions',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        targetType: z.enum(['post', 'comment', 'user']).optional(),
        targetId: z.string().uuid().optional(),
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { targetType, targetId, limit, offset } = parsed.data;

      const where: any = {};
      if (targetType) where.targetType = targetType;
      if (targetId) where.targetId = targetId;

      const actions = await fastify.prisma.modActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await fastify.prisma.modActionLog.count({ where });

      return reply.send({
        actions,
        total,
        hasMore: offset + limit < total,
      });
    }
  );

  // Create moderation action (stub - future: Node Court integration, moderator permissions)
  fastify.post(
    '/moderation/actions',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      // TODO: Check moderator permissions
      // TODO: Integrate with Node Court appeals
      // For now, this is a stub endpoint

      const schema = z.object({
        action: z.enum(['delete', 'hide', 'warn', 'ban']),
        targetType: z.enum(['post', 'comment', 'user']),
        targetId: z.string().uuid(),
        reason: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { action, targetType, targetId, reason, metadata } = parsed.data;
      const moderatorId = (request.user as { sub: string }).sub;

      // Import here to avoid circular dependency
      const { logModAction } = await import('../lib/moderation.js');

      await logModAction(fastify, action, targetType, targetId, {
        moderatorId,
        reason: reason ?? null,
        metadata: metadata ?? undefined,
      });

      return reply.status(201).send({
        message: 'Moderation action logged',
        action: {
          action,
          targetType,
          targetId,
        },
      });
    }
  );
};

export default moderationRoutes;

