import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ModerationService } from '../services/moderationService.js';

const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /mod/queue
  fastify.get('/queue', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    // Check if user is a moderator
    const userId = (request.user as { sub: string }).sub;
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { isModerator: true }
    });

    if (!user?.isModerator) {
      return reply.status(403).send({ error: 'Forbidden: Moderator access required' });
    }

    const schema = z.object({
      nodeId: z.string().uuid().optional(),
      status: z.enum(['pending', 'reviewing', 'resolved', 'escalated']).default('pending'),
      limit: z.coerce.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
    }

    const { nodeId, status, limit, cursor } = parsed.data;

    const items = await ModerationService.getModQueue(nodeId, status, limit, cursor);

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1]?.id : undefined,
    };
  });

  // POST /mod/queue/:itemId/resolve
  fastify.post('/queue/:itemId/resolve', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    // Check if user is a moderator
    const userId = (request.user as { sub: string }).sub;
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { isModerator: true }
    });

    if (!user?.isModerator) {
      return reply.status(403).send({ error: 'Forbidden: Moderator access required' });
    }

    const paramsSchema = z.object({
      itemId: z.string().uuid(),
    });

    const bodySchema = z.object({
      action: z.enum(['approved', 'removed', 'warned', 'banned']),
      reason: z.string().optional(),
    });

    const parsedParams = paramsSchema.safeParse(request.params);
    const parsedBody = bodySchema.safeParse(request.body);

    if (!parsedParams.success) {
      return reply.status(400).send({ error: 'Invalid params', details: parsedParams.error });
    }
    if (!parsedBody.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsedBody.error });
    }

    const { itemId } = parsedParams.data;
    const { action, reason } = parsedBody.data;

    await ModerationService.resolveItem(itemId, userId, action, reason);

    return { success: true };
  });
};

export default moderationRoutes;
