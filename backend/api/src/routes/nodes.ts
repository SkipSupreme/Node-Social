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
          description,
          creatorId: userId,
        },
      });

      return reply.status(201).send(node);
    }
  );

  // List all nodes
  fastify.get('/', async (request, reply) => {
    const nodes = await fastify.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return reply.send(nodes);
  });

  // Get a single node by slug or ID
  fastify.get('/:idOrSlug', async (request, reply) => {
    const { idOrSlug } = request.params as { idOrSlug: string };

    // Try finding by slug first, then ID (if it looks like a UUID)
    let node = await fastify.prisma.node.findUnique({
      where: { slug: idOrSlug },
    });

    if (!node && /^[0-9a-fA-F-]{36}$/.test(idOrSlug)) {
      node = await fastify.prisma.node.findUnique({
        where: { id: idOrSlug },
      });
    }

    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    return reply.send(node);
  });
};

export default nodeRoutes;

