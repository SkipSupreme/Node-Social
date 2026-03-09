// Phase 0.1 - Vibe Vector Reactions API Routes
// Core feature: Intensity-based multi-vector reactions

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../lib/constants.js';
import {
  createOrUpdateReaction,
  getReactionsForContent,
  deleteReaction,
  deleteExternalReaction,
  getReactionsForExternalPost,
  batchGetExternalPostAggregates,
  getAllVibeVectors,
  validateIntensities,
  type VibeIntensities,
} from '../services/vibeService.js';

const reactionRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all platform Vibe Vectors (for frontend to populate radial wheel)
  // Public: anonymous users need this to render the reaction UI
  fastify.get(
    '/vectors',
    async (request, reply) => {
      try {
        const vectors = await getAllVibeVectors(fastify.prisma);
        return reply.send({ vectors });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to get Vibe Vectors');
        return reply.status(500).send({ error: 'Failed to get Vibe Vectors' });
      }
    }
  );

  // Create or update a reaction on a post
  fastify.post(
    '/posts/:postId',
    {
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireVerified],
      config: {
        rateLimit: {
          max: 100, // Allow frequent reaction updates
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        nodeId: z.string().uuid().optional(), // Optional: defaults to global node
        intensities: z.record(z.string(), z.number().min(0).max(1)), // Vibe Vector intensities
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { postId } = request.params as { postId: string };
      let { nodeId, intensities } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Validate intensities
      if (!validateIntensities(intensities)) {
        return reply.status(400).send({ error: 'Invalid intensities: values must be between 0.0 and 1.0' });
      }

      // Verify post exists
      const post = await fastify.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post || post.deletedAt) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      // If no nodeId provided, use global node
      if (!nodeId) {
        const globalNode = await fastify.prisma.node.findUnique({ where: { slug: 'global' } });
        if (!globalNode) {
          return reply.status(500).send({ error: 'Global node not configured' });
        }
        nodeId = globalNode.id;
      }

      // Verify node exists
      const node = await fastify.prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return reply.status(404).send({ error: 'Node not found' });
      }

      try {
        const reaction = await createOrUpdateReaction(fastify.prisma, {
          userId,
          postId,
          nodeId,
          intensities: intensities as VibeIntensities,
        });

        // Create Notification for Post Author
        if (post.authorId !== userId) {
          // Check if notification already exists for this user/post/type to avoid spam?
          // For MVP, just create it. Or maybe check recent?
          // Let's just create it for now.
          await fastify.prisma.notification.create({
            data: {
              userId: post.authorId,
              actorId: userId,
              type: NOTIFICATION_TYPES.LIKE,
              content: `reacted to your post`,
              postId: post.id
            }
          });
        }

        return reply.status(201).send(reaction);
      } catch (error) {
        fastify.log.error({ err: error, postId, nodeId }, 'Failed to create/update reaction');
        return reply.status(500).send({ error: 'Failed to create/update reaction' });
      }
    }
  );

  // Create or update a reaction on a comment
  fastify.post(
    '/comments/:commentId',
    {
      onRequest: [fastify.authenticate],
      preHandler: [fastify.requireVerified],
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        nodeId: z.string().uuid().optional(), // Optional: defaults to global node
        intensities: z.record(z.string(), z.number().min(0).max(1)),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { commentId } = request.params as { commentId: string };
      let { nodeId, intensities } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Validate intensities
      if (!validateIntensities(intensities)) {
        return reply.status(400).send({ error: 'Invalid intensities: values must be between 0.0 and 1.0' });
      }

      // Verify comment exists
      const comment = await fastify.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.deletedAt) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      // If no nodeId provided, use global node
      if (!nodeId) {
        const globalNode = await fastify.prisma.node.findUnique({ where: { slug: 'global' } });
        if (!globalNode) {
          return reply.status(500).send({ error: 'Global node not configured' });
        }
        nodeId = globalNode.id;
      }

      // Verify node exists
      const node = await fastify.prisma.node.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return reply.status(404).send({ error: 'Node not found' });
      }

      try {
        const reaction = await createOrUpdateReaction(fastify.prisma, {
          userId,
          commentId,
          nodeId,
          intensities: intensities as VibeIntensities,
        });

        return reply.status(201).send(reaction);
      } catch (error) {
        fastify.log.error({ err: error, commentId, nodeId }, 'Failed to create/update reaction');
        return reply.status(500).send({ error: 'Failed to create/update reaction' });
      }
    }
  );

  // Get reactions for a post
  // Public: anonymous users can see reaction aggregates
  fastify.get(
    '/posts/:postId',
    async (request, reply) => {
      const { postId } = request.params as { postId: string };

      // Verify post exists
      const post = await fastify.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post || post.deletedAt) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      try {
        const { reactions, aggregated } = await getReactionsForContent(fastify.prisma, postId);

        return reply.send({
          reactions,
          aggregated, // Aggregated counts (use sparingly, per master plan philosophy)
        });
      } catch (error) {
        fastify.log.error({ err: error, postId }, 'Failed to get reactions');
        return reply.status(500).send({ error: 'Failed to get reactions' });
      }
    }
  );

  // Get reactions for a comment
  // Public: anonymous users can see reaction aggregates
  fastify.get(
    '/comments/:commentId',
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };

      // Verify comment exists
      const comment = await fastify.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.deletedAt) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      try {
        const { reactions, aggregated } = await getReactionsForContent(fastify.prisma, undefined, commentId);

        return reply.send({
          reactions,
          aggregated,
        });
      } catch (error) {
        fastify.log.error({ err: error, commentId }, 'Failed to get reactions');
        return reply.status(500).send({ error: 'Failed to get reactions' });
      }
    }
  );

  // Delete reaction on a post
  fastify.delete(
    '/posts/:postId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { postId } = request.params as { postId: string };
      const schema = z.object({
        nodeId: z.string().uuid().optional(), // Optional: delete specific node reaction or all
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { nodeId } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      try {
        await deleteReaction(fastify.prisma, userId, postId, undefined, nodeId || undefined);
        return reply.send({ message: 'Reaction deleted successfully' });
      } catch (error: any) {
        if (error.message === 'Reaction not found') {
          return reply.status(404).send({ error: 'Reaction not found' });
        }
        fastify.log.error({ err: error, postId }, 'Failed to delete reaction');
        return reply.status(500).send({ error: 'Failed to delete reaction' });
      }
    }
  );

  // Delete reaction on a comment
  fastify.delete(
    '/comments/:commentId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };
      const schema = z.object({
        nodeId: z.string().uuid().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { nodeId } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      try {
        await deleteReaction(fastify.prisma, userId, undefined, commentId, nodeId || undefined);
        return reply.send({ message: 'Reaction deleted successfully' });
      } catch (error: any) {
        if (error.message === 'Reaction not found') {
          return reply.status(404).send({ error: 'Reaction not found' });
        }
        fastify.log.error({ err: error, commentId }, 'Failed to delete reaction');
        return reply.status(500).send({ error: 'Failed to delete reaction' });
      }
    }
  );
  // ============================================
  // External Post Reactions
  // ============================================

  // Create or update a reaction on an external post
  fastify.post(
    '/external-posts/:externalPostId',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        nodeId: z.string().uuid().optional(),
        intensities: z.record(z.string(), z.number().min(0).max(1)),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { externalPostId } = request.params as { externalPostId: string };
      let { nodeId, intensities } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Validate externalPostId format
      if (!externalPostId.startsWith('bsky_') && !externalPostId.startsWith('masto_')) {
        return reply.status(400).send({ error: 'Invalid externalPostId format — must start with bsky_ or masto_' });
      }

      if (!validateIntensities(intensities)) {
        return reply.status(400).send({ error: 'Invalid intensities: values must be between 0.0 and 1.0' });
      }

      // If no nodeId provided, use global node
      if (!nodeId) {
        const globalNode = await fastify.prisma.node.findUnique({ where: { slug: 'global' } });
        if (!globalNode) {
          return reply.status(500).send({ error: 'Global node not configured' });
        }
        nodeId = globalNode.id;
      }

      try {
        const reaction = await createOrUpdateReaction(fastify.prisma, {
          userId,
          externalPostId,
          nodeId,
          intensities: intensities as VibeIntensities,
        });

        return reply.status(201).send(reaction);
      } catch (error) {
        fastify.log.error({ err: error, externalPostId, nodeId }, 'Failed to create/update external reaction');
        return reply.status(500).send({ error: 'Failed to create/update reaction' });
      }
    }
  );

  // Get reactions for an external post
  fastify.get(
    '/external-posts/:externalPostId',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const { externalPostId } = request.params as { externalPostId: string };
      const userId = (request.user as { sub: string } | undefined)?.sub;

      try {
        const result = await getReactionsForExternalPost(fastify.prisma, externalPostId, userId);
        return reply.send(result);
      } catch (error) {
        fastify.log.error({ err: error, externalPostId }, 'Failed to get external reactions');
        return reply.status(500).send({ error: 'Failed to get reactions' });
      }
    }
  );

  // Delete reaction on an external post
  fastify.delete(
    '/external-posts/:externalPostId',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { externalPostId } = request.params as { externalPostId: string };
      const schema = z.object({
        nodeId: z.string().uuid().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { nodeId } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      try {
        await deleteExternalReaction(fastify.prisma, userId, externalPostId, nodeId || undefined);
        return reply.send({ message: 'Reaction deleted successfully' });
      } catch (error: any) {
        if (error.message === 'Reaction not found') {
          return reply.status(404).send({ error: 'Reaction not found' });
        }
        fastify.log.error({ err: error, externalPostId }, 'Failed to delete external reaction');
        return reply.status(500).send({ error: 'Failed to delete reaction' });
      }
    }
  );

  // Batch-fetch aggregates for multiple external posts
  fastify.post(
    '/external-posts/aggregates',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        ids: z.array(z.string()).max(100),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const userId = (request.user as { sub: string } | undefined)?.sub;

      try {
        const result = await batchGetExternalPostAggregates(fastify.prisma, parsed.data.ids, userId);
        return reply.send(result);
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to batch-fetch external post aggregates');
        return reply.status(500).send({ error: 'Failed to fetch aggregates' });
      }
    }
  );
};

export default reactionRoutes;

