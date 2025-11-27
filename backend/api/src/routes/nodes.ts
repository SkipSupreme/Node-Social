import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const nodeRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new node
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().min(3).max(50),
        slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
        description: z.string().max(500).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { name, slug, description } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Check if slug exists
      const existing = await fastify.prisma.node.findUnique({ where: { slug } });
      if (existing) {
        return reply.status(409).send({ error: 'Node with this slug already exists' });
      }

      const node = await fastify.prisma.node.create({
        data: {
          name,
          slug,
          description: description ?? null,
          creatorId: userId,
        },
      });

      // Auto-subscribe creator as admin
      await fastify.prisma.nodeSubscription.create({
        data: {
          userId,
          nodeId: node.id,
          role: 'admin',
        },
      });

      return reply.status(201).send({ ...node, subscriberCount: 1, isSubscribed: true });
    }
  );

  // List all nodes (with subscriber counts)
  fastify.get('/', async (request, reply) => {
    const userId = (request.user as { sub: string } | undefined)?.sub;

    const nodes = await fastify.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { subscriptions: true } },
        ...(userId ? {
          subscriptions: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        } : {}),
      },
    });

    const formatted = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      color: node.color,
      createdAt: node.createdAt,
      subscriberCount: node._count.subscriptions,
      isSubscribed: userId ? node.subscriptions?.length > 0 : false,
      myRole: userId ? node.subscriptions?.[0]?.role || null : null,
    }));

    return reply.send(formatted);
  });

  // Get user's subscribed nodes
  fastify.get('/subscribed', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;

    const subscriptions = await fastify.prisma.nodeSubscription.findMany({
      where: { userId },
      include: {
        node: {
          include: {
            _count: { select: { subscriptions: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const nodes = subscriptions.map((sub) => ({
      id: sub.node.id,
      name: sub.node.name,
      slug: sub.node.slug,
      description: sub.node.description,
      color: sub.node.color,
      subscriberCount: sub.node._count.subscriptions,
      isSubscribed: true,
      myRole: sub.role,
      joinedAt: sub.joinedAt,
    }));

    return reply.send(nodes);
  });

  // Get a single node by slug or ID
  fastify.get('/:idOrSlug', async (request, reply) => {
    const { idOrSlug } = request.params as { idOrSlug: string };
    const userId = (request.user as { sub: string } | undefined)?.sub;

    // Try finding by slug first, then ID (if it looks like a UUID)
    let node = await fastify.prisma.node.findUnique({
      where: { slug: idOrSlug },
      include: {
        _count: { select: { subscriptions: true } },
        ...(userId ? {
          subscriptions: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        } : {}),
      },
    });

    if (!node && /^[0-9a-fA-F-]{36}$/.test(idOrSlug)) {
      node = await fastify.prisma.node.findUnique({
        where: { id: idOrSlug },
        include: {
          _count: { select: { subscriptions: true } },
          ...(userId ? {
            subscriptions: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          } : {}),
        },
      });
    }

    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    return reply.send({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      color: node.color,
      createdAt: node.createdAt,
      subscriberCount: node._count.subscriptions,
      isSubscribed: userId ? node.subscriptions?.length > 0 : false,
      myRole: userId ? node.subscriptions?.[0]?.role || null : null,
    });
  });

  // Toggle subscribe to node
  fastify.post('/:id/subscribe', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check node exists
    const node = await fastify.prisma.node.findUnique({ where: { id } });
    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    // Check existing subscription
    const existing = await fastify.prisma.nodeSubscription.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (existing) {
      // Unsubscribe
      await fastify.prisma.nodeSubscription.delete({
        where: { userId_nodeId: { userId, nodeId: id } },
      });

      const count = await fastify.prisma.nodeSubscription.count({ where: { nodeId: id } });
      return reply.send({ subscribed: false, subscriberCount: count });
    } else {
      // Subscribe
      await fastify.prisma.nodeSubscription.create({
        data: { userId, nodeId: id, role: 'member' },
      });

      const count = await fastify.prisma.nodeSubscription.count({ where: { nodeId: id } });
      return reply.send({ subscribed: true, subscriberCount: count });
    }
  });

  // Get node members
  fastify.get('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      limit: z.coerce.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { limit, cursor } = parsed.data;

    const subscriptions = await fastify.prisma.nodeSubscription.findMany({
      where: { nodeId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            era: true,
            cred: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = subscriptions.length > limit;
    const members = subscriptions.slice(0, limit).map((sub) => ({
      id: sub.user.id,
      username: sub.user.username,
      avatar: sub.user.avatar,
      era: sub.user.era,
      cred: sub.user.cred,
      role: sub.role,
      joinedAt: sub.joinedAt,
    }));

    return reply.send({
      members,
      nextCursor: hasMore && members.length > 0 ? subscriptions[limit - 1]?.id ?? null : null,
      hasMore,
    });
  });
};

export default nodeRoutes;

