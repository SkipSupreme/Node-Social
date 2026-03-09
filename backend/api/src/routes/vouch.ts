import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const MIN_CRED_TO_VOUCH = 100; // Minimum cred required to vouch for someone
const DEFAULT_VOUCH_STAKE = 100; // Default stake amount

const vouchRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /vouch/:userId - Vouch for a user
  fastify.post<{ Params: { userId: string } }>(
    '/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId: voucheeId } = request.params;
      const voucherId = (request.user as { sub: string }).sub;

      const bodySchema = z.object({
        stake: z.number().int().min(1).max(100000).optional(),
      });
      const bodyParsed = bodySchema.safeParse(request.body || {});
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }
      const stake = bodyParsed.data.stake ?? DEFAULT_VOUCH_STAKE;

      // Can't vouch for yourself
      if (voucherId === voucheeId) {
        return reply.status(400).send({ error: 'Cannot vouch for yourself' });
      }

      // Check voucher has enough cred
      const voucher = await fastify.prisma.user.findUnique({
        where: { id: voucherId },
        select: { cred: true },
      });

      if (!voucher || voucher.cred < MIN_CRED_TO_VOUCH) {
        return reply.status(403).send({
          error: `Need at least ${MIN_CRED_TO_VOUCH} cred to vouch for others`,
        });
      }

      // Check stake doesn't exceed cred
      if (stake > voucher.cred) {
        return reply.status(400).send({
          error: `Cannot stake more than your current cred (${voucher.cred})`,
        });
      }

      // Check vouchee exists
      const vouchee = await fastify.prisma.user.findUnique({
        where: { id: voucheeId },
      });

      if (!vouchee) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Check if already vouched
      const existingVouch = await fastify.prisma.vouch.findUnique({
        where: {
          voucherId_voucheeId: { voucherId, voucheeId },
        },
      });

      if (existingVouch && existingVouch.active) {
        return reply.status(400).send({ error: 'Already vouched for this user' });
      }

      // Create or reactivate vouch
      const vouch = await fastify.prisma.vouch.upsert({
        where: {
          voucherId_voucheeId: { voucherId, voucheeId },
        },
        update: {
          active: true,
          stake,
          revokedAt: null,
        },
        create: {
          voucherId,
          voucheeId,
          stake,
        },
      });

      return reply.status(201).send(vouch);
    }
  );

  // DELETE /vouch/:userId - Revoke vouch with 50% penalty
  fastify.delete<{ Params: { userId: string } }>(
    '/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId: voucheeId } = request.params;
      const voucherId = (request.user as { sub: string }).sub;

      const vouch = await fastify.prisma.vouch.findUnique({
        where: {
          voucherId_voucheeId: { voucherId, voucheeId },
        },
      });

      if (!vouch || !vouch.active) {
        return reply.status(404).send({ error: 'Active vouch not found' });
      }

      // Calculate 50% penalty
      const penalty = Math.floor(vouch.stake * 0.5);

      // Transaction: deduct penalty from voucher's cred and update vouch
      const [updatedVouch] = await fastify.prisma.$transaction([
        fastify.prisma.vouch.update({
          where: { id: vouch.id },
          data: {
            active: false,
            revokedAt: new Date(),
            penaltyPaid: penalty,
          },
        }),
        fastify.prisma.user.update({
          where: { id: voucherId },
          data: {
            cred: { decrement: penalty },
          },
        }),
      ]);

      return reply.send({
        success: true,
        vouch: updatedVouch,
        penaltyPaid: penalty,
        credReturned: vouch.stake - penalty,
      });
    }
  );

  // GET /vouch/given - Get vouches given by current user (includes revoked for history)
  fastify.get(
    '/given',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const vouches = await fastify.prisma.vouch.findMany({
        where: {
          voucherId: userId,
        },
        include: {
          vouchee: {
            select: {
              id: true,
              username: true,
              avatar: true,
              cred: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(vouches);
    }
  );

  // GET /vouch/received - Get vouches received by current user (includes revoked for history)
  fastify.get(
    '/received',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const vouches = await fastify.prisma.vouch.findMany({
        where: {
          voucheeId: userId,
        },
        include: {
          voucher: {
            select: {
              id: true,
              username: true,
              avatar: true,
              cred: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(vouches);
    }
  );

  // GET /vouch/user/:userId - Get vouch stats for a user
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId',
    { onRequest: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { userId } = request.params;

      const currentUserId = (request.user as { sub?: string } | undefined)?.sub;

      const [vouchesGiven, vouchesReceived, currentUserVouch] = await Promise.all([
        fastify.prisma.vouch.count({
          where: { voucherId: userId, active: true },
        }),
        fastify.prisma.vouch.findMany({
          where: { voucheeId: userId, active: true },
          include: {
            voucher: {
              select: {
                id: true,
                username: true,
                avatar: true,
                cred: true,
              },
            },
          },
          orderBy: { stake: 'desc' },
          take: 10, // Top 10 vouchers
        }),
        currentUserId
          ? fastify.prisma.vouch.findUnique({
              where: {
                voucherId_voucheeId: {
                  voucherId: currentUserId,
                  voucheeId: userId,
                },
              },
            })
          : null,
      ]);

      // Calculate total stake received
      const totalStake = vouchesReceived.reduce((sum, v) => sum + v.stake, 0);

      return reply.send({
        vouchesGivenCount: vouchesGiven,
        vouchesReceivedCount: vouchesReceived.length,
        totalStakeReceived: totalStake,
        topVouchers: vouchesReceived,
        hasVouched: currentUserVouch?.active || false,
        myVouchStake: currentUserVouch?.stake || null,
      });
    }
  );
};

export default vouchRoutes;
