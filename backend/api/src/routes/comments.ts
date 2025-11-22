import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { updatePostMetrics } from '../lib/metrics.js';
import { logModAction } from '../lib/moderation.js';

const commentRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new comment
  fastify.post(
    '/posts/:postId/comments',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { postId } = request.params as { postId: string };
      
      const schema = z.object({
        content: z.string().min(1).max(2000),
        parentId: z.string().uuid().optional(), // Optional parent comment for threading
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { content, parentId } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Check if post exists
      const post = await fastify.prisma.post.findUnique({ where: { id: postId } });
      if (!post) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Check if parent comment exists if provided
      if (parentId) {
        const parent = await fastify.prisma.comment.findUnique({ where: { id: parentId } });
        if (!parent) {
          return reply.status(404).send({ error: 'Parent comment not found' });
        }
        if (parent.postId !== postId) {
          return reply.status(400).send({ error: 'Parent comment belongs to a different post' });
        }
      }

      const comment = await fastify.prisma.comment.create({
        data: {
          content,
          postId,
          authorId: userId,
          parentId: parentId ?? null,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      // Update PostMetric (fire-and-forget, don't block response)
      updatePostMetrics(fastify, postId).catch((err) => {
        fastify.log.error({ err, postId }, 'Failed to update metrics after comment create');
      });

      return reply.status(201).send(comment);
    }
  );

  // Get comments for a post
  fastify.get(
    '/posts/:postId/comments',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { postId } = request.params as { postId: string };
      const schema = z.object({
        parentId: z.string().uuid().optional(), // Filter by parent (for fetching replies)
        limit: z.coerce.number().min(1).max(100).default(50),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { parentId, limit } = parsed.data;

      const comments = await fastify.prisma.comment.findMany({
        where: {
          postId,
          parentId: parentId || null, // If not provided, fetch top-level comments (parentId: null)
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' }, // Newest first
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          _count: {
            select: { replies: true },
          },
        },
      });

      // Format response
      const formattedComments = comments.map((comment) => ({
        ...comment,
        replyCount: comment._count.replies,
        _count: undefined,
      }));

      return reply.send(formattedComments);
    }
  );

  // Soft delete comment
  fastify.delete(
    '/comments/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = (request.user as { sub: string }).sub;

      const comment = await fastify.prisma.comment.findUnique({ where: { id } });

      if (!comment) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      // Check authorization
      if (comment.authorId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await fastify.prisma.comment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Update PostMetric after deletion
      updatePostMetrics(fastify, comment.postId).catch((err) => {
        fastify.log.error({ err, postId: comment.postId }, 'Failed to update metrics after comment delete');
      });

      // Log moderation action (self-delete by author)
      logModAction(fastify, 'delete', 'comment', id, {
        moderatorId: null, // null = self-delete
        reason: 'Author deleted own comment',
      }).catch((err) => {
        fastify.log.error({ err, commentId: id }, 'Failed to log moderation action');
      });

      return reply.send({ message: 'Comment deleted successfully' });
    }
  );
};

export default commentRoutes;

