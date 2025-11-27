import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  selectJury,
  tallyVotes,
  executeVerdict,
  appealConstants,
} from '../services/appealService.js';
import { calculateActivityMultiplier } from '../lib/activityTracker.js';

const appealRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /appeals - Create a new appeal
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const schema = z.object({
        targetType: z.enum(['post', 'comment', 'mod_action']),
        targetId: z.string().uuid(),
        nodeId: z.string().uuid().optional(),
        reason: z.string().min(10).max(2000),
        stake: z.number().int().min(appealConstants.MIN_STAKE).max(appealConstants.MAX_STAKE),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { targetType, targetId, nodeId, reason, stake } = parsed.data;
      const userId = (request.user as { id: string }).id;

      // Check user has enough cred
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { cred: true },
      });

      if (!user || user.cred < appealConstants.MIN_CRED_TO_APPEAL) {
        return reply.status(403).send({
          error: `Need at least ${appealConstants.MIN_CRED_TO_APPEAL} cred to create an appeal`,
        });
      }

      if (user.cred < stake) {
        return reply.status(400).send({
          error: `Cannot stake ${stake} cred. You only have ${user.cred} cred.`,
        });
      }

      // Check target exists and was actually actioned
      let targetExists = false;
      let excludeUserIds: string[] = [];

      if (targetType === 'post') {
        const post = await fastify.prisma.post.findUnique({
          where: { id: targetId },
          select: { deletedAt: true, authorId: true },
        });
        targetExists = !!post;
        if (post?.authorId) excludeUserIds.push(post.authorId);
      } else if (targetType === 'comment') {
        const comment = await fastify.prisma.comment.findUnique({
          where: { id: targetId },
          select: { deletedAt: true, authorId: true },
        });
        targetExists = !!comment;
        if (comment?.authorId) excludeUserIds.push(comment.authorId);
      } else if (targetType === 'mod_action') {
        const action = await fastify.prisma.modActionLog.findUnique({
          where: { id: targetId },
          select: { moderatorId: true },
        });
        targetExists = !!action;
        if (action?.moderatorId) excludeUserIds.push(action.moderatorId);
      }

      if (!targetExists) {
        return reply.status(404).send({ error: 'Target not found' });
      }

      // Check for existing active appeal
      const existingAppeal = await fastify.prisma.appeal.findFirst({
        where: {
          targetType,
          targetId,
          status: { in: ['pending', 'voting'] },
        },
      });

      if (existingAppeal) {
        return reply.status(400).send({
          error: 'An active appeal already exists for this target',
          existingAppealId: existingAppeal.id,
        });
      }

      // Calculate jury deadline
      const juryDeadline = new Date();
      juryDeadline.setHours(juryDeadline.getHours() + appealConstants.VOTING_PERIOD_HOURS);

      // Create appeal and deduct stake
      const appeal = await fastify.prisma.$transaction(async (tx) => {
        // Deduct stake
        await tx.user.update({
          where: { id: userId },
          data: { cred: { decrement: stake } },
        });

        // Record transaction
        await tx.credTransaction.create({
          data: {
            userId,
            amount: -stake,
            reason: 'appeal_stake',
            sourceType: 'appeal',
          },
        });

        // Create appeal
        return tx.appeal.create({
          data: {
            targetType,
            targetId,
            nodeId: nodeId || null,
            appellantId: userId,
            reason,
            stake,
            jurySize: appealConstants.JURY_SIZE,
            juryDeadline,
            status: 'pending',
          },
        });
      });

      // Select jury
      try {
        await selectJury(fastify, appeal.id, userId, nodeId || null, excludeUserIds);

        // Update status to voting
        await fastify.prisma.appeal.update({
          where: { id: appeal.id },
          data: { status: 'voting' },
        });
      } catch (err) {
        // Not enough jurors - refund and cancel
        await fastify.prisma.$transaction([
          fastify.prisma.user.update({
            where: { id: userId },
            data: { cred: { increment: stake } },
          }),
          fastify.prisma.appeal.update({
            where: { id: appeal.id },
            data: { status: 'expired', verdictReason: 'Not enough eligible jurors' },
          }),
          fastify.prisma.credTransaction.create({
            data: {
              userId,
              amount: stake,
              reason: 'appeal_refund_no_jury',
              sourceType: 'appeal',
              sourceId: appeal.id,
            },
          }),
        ]);

        return reply.status(500).send({ error: 'Could not form jury. Stake refunded.' });
      }

      const finalAppeal = await fastify.prisma.appeal.findUnique({
        where: { id: appeal.id },
        include: {
          appellant: { select: { id: true, username: true } },
          jurors: { select: { userId: true } },
        },
      });

      return reply.status(201).send(finalAppeal);
    }
  );

  // GET /appeals - List appeals
  fastify.get(
    '/',
    async (request, reply) => {
      const schema = z.object({
        status: z.enum(['pending', 'voting', 'upheld', 'overturned', 'expired']).optional(),
        targetType: z.enum(['post', 'comment', 'mod_action']).optional(),
        targetId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error });
      }

      const { status, targetType, targetId, limit, cursor } = parsed.data;

      const where: any = {};
      if (status) where.status = status;
      if (targetType) where.targetType = targetType;
      if (targetId) where.targetId = targetId;
      if (cursor) where.createdAt = { lt: new Date(cursor) };

      const appeals = await fastify.prisma.appeal.findMany({
        where,
        include: {
          appellant: { select: { id: true, username: true, avatar: true } },
          _count: { select: { votes: true, jurors: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = appeals.length > limit;
      if (hasMore) appeals.pop();

      return reply.send({
        appeals,
        nextCursor: hasMore ? appeals[appeals.length - 1]?.createdAt.toISOString() : null,
      });
    }
  );

  // GET /appeals/:id - Get appeal details
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      const appeal = await fastify.prisma.appeal.findUnique({
        where: { id },
        include: {
          appellant: { select: { id: true, username: true, avatar: true, cred: true } },
          jurors: {
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
          },
          votes: {
            include: {
              juror: { select: { id: true, username: true } },
            },
          },
        },
      });

      if (!appeal) {
        return reply.status(404).send({ error: 'Appeal not found' });
      }

      // Check if current user is a juror
      const currentUserId = (request.user as { id?: string } | undefined)?.id;
      const isJuror = appeal.jurors.some((j) => j.userId === currentUserId);
      const hasVoted = appeal.votes.some((v) => v.jurorId === currentUserId);

      return reply.send({
        ...appeal,
        isJuror,
        hasVoted,
        canVote: isJuror && !hasVoted && appeal.status === 'voting',
      });
    }
  );

  // POST /appeals/:id/vote - Cast a vote on an appeal
  fastify.post<{ Params: { id: string } }>(
    '/:id/vote',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = (request.user as { id: string }).id;

      const schema = z.object({
        vote: z.enum(['uphold', 'overturn']),
        reason: z.string().max(1000).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { vote, reason } = parsed.data;

      // Check appeal exists and is in voting status
      const appeal = await fastify.prisma.appeal.findUnique({
        where: { id },
      });

      if (!appeal) {
        return reply.status(404).send({ error: 'Appeal not found' });
      }

      if (appeal.status !== 'voting') {
        return reply.status(400).send({ error: 'Appeal is not open for voting' });
      }

      if (new Date() > appeal.juryDeadline) {
        return reply.status(400).send({ error: 'Voting period has ended' });
      }

      // Check user is a juror
      const jurorRecord = await fastify.prisma.appealJuror.findUnique({
        where: {
          appealId_userId: { appealId: id, userId },
        },
      });

      if (!jurorRecord) {
        return reply.status(403).send({ error: 'You are not a juror on this appeal' });
      }

      if (jurorRecord.hasVoted) {
        return reply.status(400).send({ error: 'You have already voted' });
      }

      // Get user's cred for weighted vote
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { cred: true, lastActiveAt: true },
      });

      const activityMultiplier = calculateActivityMultiplier(user!.lastActiveAt);
      const weight = Math.sqrt(user!.cred) * activityMultiplier; // Square root to reduce whale influence

      // Cast vote
      await fastify.prisma.$transaction([
        fastify.prisma.appealVote.create({
          data: {
            appealId: id,
            jurorId: userId,
            vote,
            reason: reason ?? null,
            weight,
          },
        }),
        fastify.prisma.appealJuror.update({
          where: { id: jurorRecord.id },
          data: { hasVoted: true },
        }),
      ]);

      // Check if all jurors have voted
      const [totalJurors, totalVotes] = await Promise.all([
        fastify.prisma.appealJuror.count({ where: { appealId: id } }),
        fastify.prisma.appealVote.count({ where: { appealId: id } }),
      ]);

      // If all votes are in, resolve immediately
      if (totalVotes >= totalJurors) {
        const { verdict, reason: verdictReason } = await tallyVotes(fastify, id);

        await fastify.prisma.appeal.update({
          where: { id },
          data: {
            status: verdict,
            verdict,
            verdictReason,
            resolvedAt: new Date(),
          },
        });

        await executeVerdict(fastify, {
          id,
          appellantId: appeal.appellantId,
          targetType: appeal.targetType,
          targetId: appeal.targetId,
          stake: appeal.stake,
          verdict,
        });
      }

      return reply.send({
        success: true,
        votesIn: totalVotes + 1,
        totalJurors,
        allVotesIn: totalVotes + 1 >= totalJurors,
      });
    }
  );

  // GET /appeals/my-duties - Get appeals where current user is a juror
  fastify.get(
    '/my-duties',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;

      const duties = await fastify.prisma.appealJuror.findMany({
        where: { userId },
        include: {
          appeal: {
            include: {
              appellant: { select: { id: true, username: true } },
              _count: { select: { votes: true } },
            },
          },
        },
        orderBy: { notifiedAt: 'desc' },
      });

      const pending = duties.filter(
        (d) => !d.hasVoted && d.appeal.status === 'voting'
      );
      const completed = duties.filter((d) => d.hasVoted);

      return reply.send({ pending, completed, total: duties.length });
    }
  );

  // GET /appeals/my-appeals - Get appeals created by current user
  fastify.get(
    '/my-appeals',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;

      const appeals = await fastify.prisma.appeal.findMany({
        where: { appellantId: userId },
        include: {
          _count: { select: { votes: true, jurors: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(appeals);
    }
  );
};

export default appealRoutes;
