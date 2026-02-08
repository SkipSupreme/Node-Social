import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const themeRoutes: FastifyPluginAsync = async (fastify) => {
  // List shared themes (public marketplace)
  fastify.get('/', async (request, reply) => {
    const schema = z.object({
      sort: z.enum(['popular', 'newest', 'rating']).default('popular'),
      limit: z.coerce.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error });
    }

    const { sort, limit, cursor } = parsed.data;

    const orderBy = sort === 'popular'
      ? { installs: 'desc' as const }
      : sort === 'newest'
        ? { createdAt: 'desc' as const }
        : { rating: 'desc' as const };

    const themes = await fastify.prisma.sharedTheme.findMany({
      where: { isPublic: true },
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const hasMore = themes.length > limit;
    const items = themes.slice(0, limit);

    return reply.send({
      themes: items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
      hasMore,
    });
  });

  // Get a single theme by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const theme = await fastify.prisma.sharedTheme.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!theme) {
      return reply.status(404).send({ error: 'Theme not found' });
    }

    return reply.send(theme);
  });

  // Share a theme to the marketplace (authenticated)
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      tokens: z.record(z.string(), z.unknown()),
      isPublic: z.boolean().default(true),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
    }

    const userId = (request.user as { sub: string }).sub;
    const { name, description, tokens, isPublic } = parsed.data;

    const theme = await fastify.prisma.sharedTheme.create({
      data: {
        name,
        description: description ?? null,
        tokens: tokens as Prisma.InputJsonValue,
        authorId: userId,
        isPublic,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return reply.status(201).send(theme);
  });

  // Update own theme
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const existing = await fastify.prisma.sharedTheme.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Theme not found' });
    }
    if (existing.authorId !== userId) {
      return reply.status(403).send({ error: 'You can only edit your own themes' });
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      tokens: z.record(z.string(), z.unknown()).optional(),
      isPublic: z.boolean().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.tokens !== undefined) updateData.tokens = parsed.data.tokens as Prisma.InputJsonValue;
    if (parsed.data.isPublic !== undefined) updateData.isPublic = parsed.data.isPublic;

    const updated = await fastify.prisma.sharedTheme.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return reply.send(updated);
  });

  // Install (use) a theme — increments install count
  fastify.post('/:id/install', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const theme = await fastify.prisma.sharedTheme.findUnique({ where: { id } });
    if (!theme) {
      return reply.status(404).send({ error: 'Theme not found' });
    }

    await fastify.prisma.sharedTheme.update({
      where: { id },
      data: { installs: { increment: 1 } },
    });

    return reply.send({ success: true, tokens: theme.tokens });
  });

  // Delete own theme
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const existing = await fastify.prisma.sharedTheme.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Theme not found' });
    }
    if (existing.authorId !== userId) {
      // Allow admins to delete any theme
      const user = await fastify.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'You can only delete your own themes' });
      }
    }

    await fastify.prisma.sharedTheme.delete({ where: { id } });

    return reply.send({ success: true });
  });
};

export default themeRoutes;
