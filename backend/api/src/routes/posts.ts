import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const postRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new post
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        content: z.string().min(1).max(5000),
        nodeId: z.string().uuid().optional(), // Optional node/community
        title: z.string().max(500).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, nodeId, title } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Check if node exists if nodeId is provided
      if (nodeId) {
        const node = await fastify.prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) {
          return reply.status(404).send({ error: 'Node not found' });
        }
      }

      const post = await fastify.prisma.post.create({
        data: {
          content,
          nodeId,
          title,
          authorId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true, // In real app, use username/avatar
            },
          },
        },
      });

      return reply.status(201).send(post);
    }
  );

  // Get feed (all posts or filtered by node)
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate], // Require auth for feed for now
    },
    async (request, reply) => {
      const schema = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        nodeId: z.string().uuid().optional(),
        authorId: z.string().uuid().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { cursor, limit, nodeId, authorId } = parsed.data;

      const where: any = {
        deletedAt: null, // Exclude deleted posts
      };

      if (nodeId) where.nodeId = nodeId;
      if (authorId) where.authorId = authorId;

      // Cursor-based pagination
      const posts = await fastify.prisma.post.findMany({
        take: limit + 1, // Fetch one extra to determine if there's a next page
        where,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      // Format response
      const formattedPosts = posts.map((post) => ({
        ...post,
        commentCount: post._count.comments,
        _count: undefined,
      }));

      return reply.send({
        posts: formattedPosts,
        nextCursor,
        hasMore: !!nextCursor,
      });
    }
  );

  // Get single post
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const post = await fastify.prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          node: true,
          _count: {
            select: { comments: true },
          },
        },
      });

      if (!post || post.deletedAt) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      return reply.send({
        ...post,
        commentCount: post._count.comments,
        _count: undefined,
      });
    }
  );

  // Soft delete post
  fastify.delete(
    '/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = (request.user as { sub: string }).sub;

      const post = await fastify.prisma.post.findUnique({ where: { id } });

      if (!post) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Check authorization (only author can delete for now)
      if (post.authorId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Soft delete
      await fastify.prisma.post.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return reply.send({ message: 'Post deleted successfully' });
    }
  );
};

export default postRoutes;

