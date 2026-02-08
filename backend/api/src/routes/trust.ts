/**
 * Trust System Routes
 * Per governance.md Section 3 - Web of Trust API
 *
 * Exposes Eigentrust scores, trust tiers, and seed node management.
 */

import type { FastifyPluginAsync } from 'fastify';
import {
  runEigentrust,
  getUserTrustScore,
  getTrustTierStats,
  addSeedNode,
  removeSeedNode,
  getUsersByTier,
  isInShadowRealm,
  getTrustNetworkForUser,
} from '../services/eigentrustService.js';

const trustRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /trust/me - Get current user's trust score
   */
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const trustScore = await getUserTrustScore(fastify.prisma, userId);

    if (!trustScore) {
      return reply.send({
        rawScore: 0,
        decayedScore: 0,
        tier: 'shadow',
        seedDistance: null,
        message: 'Trust score not yet computed. Run /trust/compute to calculate.',
      });
    }

    return reply.send(trustScore);
  });

  /**
   * GET /trust/user/:userId - Get a user's trust score
   */
  fastify.get<{ Params: { userId: string } }>('/user/:userId', async (request, reply) => {
    const { userId } = request.params;

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const trustScore = await getUserTrustScore(fastify.prisma, userId);

    return reply.send({
      userId,
      username: user.username,
      trust: trustScore || {
        rawScore: 0,
        decayedScore: 0,
        tier: 'shadow',
        seedDistance: null,
      },
    });
  });

  /**
   * GET /trust/stats - Get trust tier statistics
   */
  fastify.get('/stats', async (request, reply) => {
    const stats = await getTrustTierStats(fastify.prisma);

    const seedNodes = await fastify.prisma.seedNode.findMany({
      where: { active: true },
      select: {
        userId: true,
        reason: true,
        addedAt: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    const lastComputation = await fastify.prisma.trustComputationLog.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    return reply.send({
      tiers: stats,
      seedNodes: seedNodes.map((s) => ({
        userId: s.userId,
        username: s.user.username,
        avatar: s.user.avatar,
        reason: s.reason,
        addedAt: s.addedAt,
      })),
      lastComputation: lastComputation
        ? {
            completedAt: lastComputation.completedAt,
            usersProcessed: lastComputation.usersProcessed,
            iterations: lastComputation.iterations,
            convergenceDelta: lastComputation.convergenceDelta,
          }
        : null,
    });
  });

  /**
   * GET /trust/tier/:tier - Get users in a specific tier
   */
  fastify.get<{ Params: { tier: string }; Querystring: { limit?: string } }>(
    '/tier/:tier',
    async (request, reply) => {
      const { tier } = request.params;
      const limit = parseInt(request.query.limit || '50', 10) || 50;

      if (!['gold', 'silver', 'bronze', 'shadow'].includes(tier)) {
        return reply.status(400).send({ error: 'Invalid tier. Must be gold, silver, bronze, or shadow.' });
      }

      const users = await getUsersByTier(
        fastify.prisma,
        tier as 'gold' | 'silver' | 'bronze' | 'shadow',
        Math.min(limit, 100)
      );

      // Enrich with user data
      const userIds = users.map((u) => u.userId);
      const userData = await fastify.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          avatar: true,
          cred: true,
        },
      });

      const userMap = new Map(userData.map((u) => [u.id, u]));

      return reply.send({
        tier,
        users: users.map((u) => ({
          ...u,
          ...(userMap.get(u.userId) || {}),
        })),
      });
    }
  );

  /**
   * GET /trust/network - Get current user's trust network for feed personalization
   */
  fastify.get<{ Querystring: { maxHops?: string } }>(
    '/network',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const maxHops = parseInt(request.query.maxHops || '3', 10) || 3;

      const network = await getTrustNetworkForUser(
        fastify.prisma,
        userId,
        Math.min(maxHops, 5)
      );

      // Convert to array for JSON serialization
      const networkArray = Array.from(network.entries()).map(([id, weight]) => ({
        userId: id,
        trustWeight: weight,
      }));

      return reply.send({
        userId,
        networkSize: networkArray.length,
        network: networkArray.slice(0, 100), // Limit response size
      });
    }
  );

  /**
   * GET /trust/shadow-check/:userId - Check if a user is in the shadow realm
   */
  fastify.get<{ Params: { userId: string } }>('/shadow-check/:userId', async (request, reply) => {
    const { userId } = request.params;

    const inShadow = await isInShadowRealm(fastify.prisma, userId);

    return reply.send({
      userId,
      inShadowRealm: inShadow,
    });
  });

  // ==========================================
  // Admin-only routes
  // ==========================================

  /**
   * POST /trust/compute - Run Eigentrust algorithm (admin only)
   */
  fastify.post('/compute', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as { sub: string }).sub },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    // Check if computation is already running
    const running = await fastify.prisma.trustComputationLog.findFirst({
      where: { status: 'running' },
    });

    if (running) {
      return reply.status(409).send({
        error: 'Trust computation already in progress',
        startedAt: running.startedAt,
      });
    }

    // Run computation asynchronously
    const result = await runEigentrust(fastify.prisma);

    return reply.send({
      success: true,
      ...result,
    });
  });

  /**
   * POST /trust/seed-node/:userId - Add a user as a seed node (admin only)
   */
  fastify.post<{ Params: { userId: string }; Body: { reason?: string } }>(
    '/seed-node/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const adminUser = await fastify.prisma.user.findUnique({
        where: { id: (request.user as { sub: string }).sub },
        select: { id: true, role: true },
      });

      if (adminUser?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const { userId } = request.params;
      const { reason } = request.body || {};

      // Check user exists
      const targetUser = await fastify.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      await addSeedNode(fastify.prisma, userId, reason, adminUser.id);

      return reply.send({
        success: true,
        message: `User ${targetUser.username} added as seed node`,
      });
    }
  );

  /**
   * DELETE /trust/seed-node/:userId - Remove a seed node (admin only)
   */
  fastify.delete<{ Params: { userId: string } }>(
    '/seed-node/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const adminUser = await fastify.prisma.user.findUnique({
        where: { id: (request.user as { sub: string }).sub },
        select: { role: true },
      });

      if (adminUser?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const { userId } = request.params;

      try {
        await removeSeedNode(fastify.prisma, userId);
        return reply.send({ success: true });
      } catch {
        return reply.status(404).send({ error: 'Seed node not found' });
      }
    }
  );

  /**
   * GET /trust/computation-logs - Get recent computation logs (admin only)
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/computation-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const adminUser = await fastify.prisma.user.findUnique({
        where: { id: (request.user as { sub: string }).sub },
        select: { role: true },
      });

      if (adminUser?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const limit = parseInt(request.query.limit || '10', 10) || 10;

      const logs = await fastify.prisma.trustComputationLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: Math.min(limit, 50),
      });

      return reply.send({ logs });
    }
  );
};

export default trustRoutes;
