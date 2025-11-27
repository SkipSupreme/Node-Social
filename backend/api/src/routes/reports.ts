import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const VALID_REASONS = ['spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'other'] as const;
const VALID_TARGET_TYPES = ['post', 'comment', 'user'] as const;

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  // Submit a report
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        targetType: z.enum(VALID_TARGET_TYPES),
        targetId: z.string().min(1),
        reason: z.enum(VALID_REASONS),
        details: z.string().max(1000).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { targetType, targetId, reason, details } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Verify target exists
      let targetExists = false;
      let nodeId: string | null = null;

      if (targetType === 'post') {
        const post = await fastify.prisma.post.findUnique({
          where: { id: targetId },
          select: { id: true, nodeId: true },
        });
        targetExists = !!post;
        nodeId = post?.nodeId || null;
      } else if (targetType === 'comment') {
        const comment = await fastify.prisma.comment.findUnique({
          where: { id: targetId },
          select: { id: true, post: { select: { nodeId: true } } },
        });
        targetExists = !!comment;
        nodeId = comment?.post?.nodeId || null;
      } else if (targetType === 'user') {
        const user = await fastify.prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        targetExists = !!user;
      }

      if (!targetExists) {
        return reply.status(404).send({ error: `${targetType} not found` });
      }

      // Prevent self-reporting
      if (targetType === 'user' && targetId === userId) {
        return reply.status(400).send({ error: 'Cannot report yourself' });
      }

      // Check for duplicate report
      const existingReport = await fastify.prisma.report.findFirst({
        where: {
          reporterId: userId,
          targetType,
          targetId,
          status: 'pending',
        },
      });

      if (existingReport) {
        return reply.status(409).send({ error: 'You have already reported this content' });
      }

      // Create the report
      const report = await fastify.prisma.report.create({
        data: {
          reporterId: userId,
          targetType,
          targetId,
          reason,
          details: details || null,
        },
      });

      // If reporting a post, increment the report count in mod queue
      if (targetType === 'post' && nodeId) {
        const existingQueueItem = await fastify.prisma.modQueueItem.findFirst({
          where: { postId: targetId },
        });

        if (existingQueueItem) {
          // Increment report count and recalculate flag score
          await fastify.prisma.modQueueItem.update({
            where: { id: existingQueueItem.id },
            data: {
              reportCount: { increment: 1 },
              // Each report adds 5.0 to flag score
              flagScore: { increment: 5.0 },
              weightedFlagScore: { increment: 5.0 },
            },
          });
        } else {
          // Create new mod queue item
          await fastify.prisma.modQueueItem.create({
            data: {
              postId: targetId,
              nodeId,
              flagScore: 5.0,
              weightedFlagScore: 5.0,
              priority: 'medium',
              reportCount: 1,
            },
          });
        }
      }

      return reply.status(201).send({
        message: 'Report submitted successfully',
        reportId: report.id,
      });
    }
  );

  // Get user's own reports (optional - for transparency)
  fastify.get(
    '/mine',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const reports = await fastify.prisma.report.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send(reports);
    }
  );
};

export default reportRoutes;
