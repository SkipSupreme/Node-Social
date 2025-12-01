import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ModerationService } from '../services/moderationService.js';

const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to check moderator access
  // Returns: { isSiteMod: boolean, adminNodeIds: string[] }
  async function getModeratorAccess(userId: string) {
    const [user, nodeSubscriptions] = await Promise.all([
      fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { isModerator: true }
      }),
      // Get nodes where user is admin or moderator
      fastify.prisma.nodeSubscription.findMany({
        where: {
          userId,
          role: { in: ['admin', 'moderator'] }
        },
        select: { nodeId: true, role: true }
      })
    ]);

    return {
      isSiteMod: user?.isModerator ?? false,
      adminNodeIds: nodeSubscriptions.map(s => s.nodeId)
    };
  }

  // GET /mod/queue
  fastify.get('/queue', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { isSiteMod, adminNodeIds } = await getModeratorAccess(userId);

    // Must be site mod OR admin of at least one node
    if (!isSiteMod && adminNodeIds.length === 0) {
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

    let { nodeId, status, limit, cursor } = parsed.data;

    // If not a site mod, restrict to their admin nodes
    if (!isSiteMod) {
      if (nodeId) {
        // If requesting a specific node, verify they have access
        if (!adminNodeIds.includes(nodeId)) {
          return reply.status(403).send({ error: 'Forbidden: You are not a moderator of this node' });
        }
      } else {
        // No specific node requested - we'll filter to their nodes in the service
        // For now, just get the first node they admin (TODO: support multiple nodes)
        nodeId = adminNodeIds[0];
      }
    }

    const items = await ModerationService.getModQueue(nodeId, status, limit, cursor);

    // If not site mod, filter items to only their nodes (extra safety)
    const filteredItems = isSiteMod
      ? items
      : items.filter(item => item.post?.nodeId && adminNodeIds.includes(item.post.nodeId));

    return {
      items: filteredItems,
      nextCursor: filteredItems.length === limit ? filteredItems[filteredItems.length - 1]?.id : undefined,
    };
  });

  // POST /mod/queue/:itemId/resolve
  fastify.post('/queue/:itemId/resolve', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { isSiteMod, adminNodeIds } = await getModeratorAccess(userId);

    if (!isSiteMod && adminNodeIds.length === 0) {
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

    // If not site mod, verify they have access to this item's node
    if (!isSiteMod) {
      const item = await fastify.prisma.modQueueItem.findUnique({
        where: { id: itemId },
        include: { post: { select: { nodeId: true } } }
      });

      if (!item) {
        return reply.status(404).send({ error: 'Mod queue item not found' });
      }

      if (item.post?.nodeId && !adminNodeIds.includes(item.post.nodeId)) {
        return reply.status(403).send({ error: 'Forbidden: You are not a moderator of this node' });
      }
    }

    await ModerationService.resolveItem(itemId, userId, action, reason);

    return { success: true };
  });
};

export default moderationRoutes;
