import type { FastifyPluginAsync } from 'fastify';
import { calculateActivityMultiplier } from '../lib/activityTracker.js';

const COUNCIL_SIZE = 5; // Number of council members per node
const ACTIVITY_THRESHOLD_DAYS = 30; // Must be active within this many days

const councilRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /council/:nodeId - Get council members for a node
  fastify.get<{ Params: { nodeId: string } }>(
    '/:nodeId',
    async (request, reply) => {
      const { nodeId } = request.params;

      // Calculate activity threshold date
      const activityThreshold = new Date();
      activityThreshold.setDate(activityThreshold.getDate() - ACTIVITY_THRESHOLD_DAYS);

      // Get users subscribed to this node with high cred and recent activity
      // We check their nodeCredScores for per-node cred
      const subscriptions = await fastify.prisma.nodeSubscription.findMany({
        where: { nodeId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              cred: true,
              nodeCredScores: true,
              lastActiveAt: true,
            },
          },
        },
      });

      // Filter to active users and sort by node-specific cred
      const activeMembers = subscriptions
        .filter((sub) => sub.user.lastActiveAt >= activityThreshold)
        .map((sub) => {
          const nodeCredScores = sub.user.nodeCredScores as Record<string, number>;
          const nodeCred = nodeCredScores[nodeId] || 0;
          return {
            ...sub.user,
            nodeCred,
            role: sub.role,
            joinedAt: sub.joinedAt,
          };
        })
        .sort((a, b) => b.nodeCred - a.nodeCred)
        .slice(0, COUNCIL_SIZE);

      // Calculate activity multiplier for each member
      const councilWithMultiplier = activeMembers.map((member) => {
        const multiplier = calculateActivityMultiplier(member.lastActiveAt);
        return {
          id: member.id,
          username: member.username,
          avatar: member.avatar,
          cred: member.cred,
          nodeCred: member.nodeCred,
          role: member.role,
          joinedAt: member.joinedAt,
          activityMultiplier: multiplier,
          governanceWeight: Math.floor(member.nodeCred * multiplier),
        };
      });

      return reply.send({
        nodeId,
        councilSize: COUNCIL_SIZE,
        activityThresholdDays: ACTIVITY_THRESHOLD_DAYS,
        members: councilWithMultiplier,
        totalGovernanceWeight: councilWithMultiplier.reduce(
          (sum, m) => sum + m.governanceWeight,
          0
        ),
      });
    }
  );

  // GET /council/:nodeId/eligibility - Check if current user is eligible for council
  fastify.get<{ Params: { nodeId: string } }>(
    '/:nodeId/eligibility',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { nodeId } = request.params;
      const userId = (request.user as { sub: string }).sub;

      // Get user's subscription and stats
      const [subscription, user] = await Promise.all([
        fastify.prisma.nodeSubscription.findUnique({
          where: {
            userId_nodeId: { userId, nodeId },
          },
        }),
        fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            cred: true,
            nodeCredScores: true,
            lastActiveAt: true,
          },
        }),
      ]);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const nodeCredScores = user.nodeCredScores as Record<string, number>;
      const nodeCred = nodeCredScores[nodeId] || 0;
      const activityMultiplier = calculateActivityMultiplier(user.lastActiveAt);
      const governanceWeight = Math.floor(nodeCred * activityMultiplier);

      // Check activity threshold
      const activityThreshold = new Date();
      activityThreshold.setDate(activityThreshold.getDate() - ACTIVITY_THRESHOLD_DAYS);
      const isActive = user.lastActiveAt >= activityThreshold;

      // Get current council to check ranking
      const subscriptions = await fastify.prisma.nodeSubscription.findMany({
        where: { nodeId },
        include: {
          user: {
            select: {
              id: true,
              nodeCredScores: true,
              lastActiveAt: true,
            },
          },
        },
      });

      const rankedMembers = subscriptions
        .filter((sub) => sub.user.lastActiveAt >= activityThreshold)
        .map((sub) => {
          const scores = sub.user.nodeCredScores as Record<string, number>;
          return {
            userId: sub.user.id,
            governanceWeight: Math.floor(
              (scores[nodeId] || 0) *
                calculateActivityMultiplier(sub.user.lastActiveAt)
            ),
          };
        })
        .sort((a, b) => b.governanceWeight - a.governanceWeight);

      const rank = rankedMembers.findIndex((m) => m.userId === userId) + 1;
      const isOnCouncil = rank > 0 && rank <= COUNCIL_SIZE;
      const lastCouncilMember = rankedMembers[COUNCIL_SIZE - 1];
      const credNeededForCouncil =
        rankedMembers.length >= COUNCIL_SIZE && lastCouncilMember
          ? lastCouncilMember.governanceWeight - governanceWeight + 1
          : 0;

      return reply.send({
        isSubscribed: !!subscription,
        isActive,
        nodeCred,
        activityMultiplier,
        governanceWeight,
        rank: rank || null,
        totalMembers: rankedMembers.length,
        isOnCouncil,
        credNeededForCouncil: isOnCouncil ? 0 : Math.max(0, credNeededForCouncil),
      });
    }
  );
};


export default councilRoutes;
