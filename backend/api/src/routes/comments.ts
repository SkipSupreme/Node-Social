import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
              username: true,
              avatar: true,
              era: true,
              connoisseurCred: true,
            },
          },
          _count: {
            select: { replies: true },
          },
        },
      });

      // Create Notification for Post Author
      if (post.authorId !== userId) {
        await fastify.prisma.notification.create({
          data: {
            userId: post.authorId,
            actorId: userId,
            type: 'comment',
            content: `commented on your post: "${post.content.substring(0, 20)}..."`,
            postId: post.id,
            commentId: comment.id
          }
        });
      }

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
        all: z.enum(['true', 'false']).optional(),
        sortBy: z.enum(['newest', 'insightful', 'joy', 'fire', 'support', 'shock', 'questionable']).optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { parentId, limit, all, sortBy } = parsed.data;

      const where: Prisma.CommentWhereInput = {
        postId,
        deletedAt: null,
      };

      if (all !== 'true') {
        where.parentId = parentId || null;
      }

      // If sorting by vibe, we need to fetch more to find the top ones
      // For MVP, we'll fetch up to 200, sort in memory, and return limit
      const fetchLimit = sortBy && sortBy !== 'newest' ? 200 : limit;

      let comments = await fastify.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // Default to newest first for initial fetch
        take: fetchLimit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
              era: true,
              connoisseurCred: true,
            },
          },
          _count: {
            select: { replies: true },
          },
          reactions: true, // Include reactions for sorting
        },
      });

      // Sort in memory if needed
      if (sortBy && sortBy !== 'newest') {
        comments.sort((a, b) => {
          const getScore = (c: typeof a) => {
            return c.reactions.reduce((sum: number, r) => {
              const intensities = r.intensities as Record<string, number>;
              return sum + (intensities[sortBy] || 0);
            }, 0);
          };
          return getScore(b) - getScore(a);
        });

        // Apply limit after sorting
        if (comments.length > limit) {
          comments = comments.slice(0, limit);
        }
      }

      // Format response
      type CommentWithRelations = Prisma.CommentGetPayload<{
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
              era: true,
              connoisseurCred: true,
            },
          },
          _count: {
            select: { replies: true },
          },
          reactions: true,
        }
      }>;

      const formattedComments = (comments as CommentWithRelations[]).map((comment) => ({
        ...comment,
        replyCount: comment._count.replies,
        _count: undefined,
        reactions: undefined, // Don't send full reactions array to client to save bandwidth? 
        // Or maybe send it so client can show "Top Vibe"?
        // For now, let's remove it to match previous behavior unless we want to show it.
        // But wait, Feed.tsx might want to show the vibe counts.
        // Let's keep it undefined for now to match interface.
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

