import type { FastifyInstance } from 'fastify';
import { calculateActivityMultiplier } from '../lib/activityTracker.js';

const MIN_CRED_TO_APPEAL = 50; // Minimum cred to create an appeal
const MIN_STAKE = 25; // Minimum stake for an appeal
const MAX_STAKE = 500; // Maximum stake for an appeal
const JURY_SIZE = 5; // Default jury size
const VOTING_PERIOD_HOURS = 48; // Hours for jury to vote
const MIN_JUROR_CRED = 100; // Minimum cred to be a juror

export type AppealStatus = 'pending' | 'voting' | 'upheld' | 'overturned' | 'expired';

/**
 * Select random jurors for an appeal
 * - Excludes appellant
 * - Excludes users involved in the original action
 * - Prefers high-cred, active users
 */
export async function selectJury(
  fastify: FastifyInstance,
  appealId: string,
  appellantId: string,
  nodeId: string | null,
  excludeUserIds: string[] = []
): Promise<string[]> {
  // Get eligible jurors - high cred, recently active
  const activityThreshold = new Date();
  activityThreshold.setDate(activityThreshold.getDate() - 30);

  const excludeIds = [appellantId, ...excludeUserIds];

  // Find eligible users
  const eligibleUsers = await fastify.prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      cred: { gte: MIN_JUROR_CRED },
      lastActiveAt: { gte: activityThreshold },
    },
    select: {
      id: true,
      cred: true,
      lastActiveAt: true,
      nodeCredScores: true,
    },
    orderBy: { cred: 'desc' },
    take: 50, // Get pool of top users
  });

  if (eligibleUsers.length < JURY_SIZE) {
    throw new Error(`Not enough eligible jurors. Need ${JURY_SIZE}, found ${eligibleUsers.length}`);
  }

  // Weight by cred and activity, then randomly select
  const weighted = eligibleUsers.map((user) => {
    const activityMultiplier = calculateActivityMultiplier(user.lastActiveAt);
    const nodeCredScores = user.nodeCredScores as Record<string, number>;
    const nodeCred = nodeId ? (nodeCredScores[nodeId] || 0) : 0;

    // Weight = global cred + node cred bonus + activity bonus
    const weight = user.cred + (nodeCred * 2) + (activityMultiplier * 50);

    return { userId: user.id, weight };
  });

  // Weighted random selection
  const selected: string[] = [];
  const pool = [...weighted];

  for (let i = 0; i < JURY_SIZE && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, u) => sum + u.weight, 0);
    if (totalWeight === 0) break; // No eligible jurors with weight
    let random = Math.random() * totalWeight;

    for (let j = 0; j < pool.length; j++) {
      const poolItem = pool[j];
      if (!poolItem) continue;
      random -= poolItem.weight;
      if (random <= 0) {
        selected.push(poolItem.userId);
        pool.splice(j, 1);
        break;
      }
    }
  }

  // Create juror records
  await fastify.prisma.appealJuror.createMany({
    data: selected.map((userId) => ({
      appealId,
      userId,
    })),
  });

  // TODO: Send notifications to jurors

  return selected;
}

/**
 * Tally votes and determine verdict
 */
export async function tallyVotes(
  fastify: FastifyInstance,
  appealId: string
): Promise<{ verdict: 'upheld' | 'overturned'; reason: string }> {
  const votes = await fastify.prisma.appealVote.findMany({
    where: { appealId },
  });

  if (votes.length === 0) {
    return { verdict: 'upheld', reason: 'No votes cast - original decision stands' };
  }

  let upholdWeight = 0;
  let overturnWeight = 0;

  for (const vote of votes) {
    if (vote.vote === 'uphold') {
      upholdWeight += vote.weight;
    } else {
      overturnWeight += vote.weight;
    }
  }

  const totalWeight = upholdWeight + overturnWeight;
  if (totalWeight === 0) {
    return { verdict: 'upheld', reason: 'No weighted votes - original decision stands' };
  }
  const overturnPercent = (overturnWeight / totalWeight) * 100;

  // Need >60% weighted vote to overturn
  if (overturnPercent > 60) {
    return {
      verdict: 'overturned',
      reason: `${overturnPercent.toFixed(1)}% weighted vote to overturn (${votes.length} jurors voted)`,
    };
  }

  return {
    verdict: 'upheld',
    reason: `Only ${overturnPercent.toFixed(1)}% voted to overturn (need >60%). ${votes.length} jurors voted.`,
  };
}

/**
 * Execute verdict - restore content or burn stake
 */
export async function executeVerdict(
  fastify: FastifyInstance,
  appeal: {
    id: string;
    appellantId: string;
    targetType: string;
    targetId: string;
    stake: number;
    verdict: 'upheld' | 'overturned';
  }
): Promise<void> {
  if (appeal.verdict === 'overturned') {
    // Return stake + bonus
    const bonus = Math.floor(appeal.stake * 0.2); // 20% bonus for successful appeal
    await fastify.prisma.$transaction([
      fastify.prisma.user.update({
        where: { id: appeal.appellantId },
        data: { cred: { increment: appeal.stake + bonus } },
      }),
      fastify.prisma.credTransaction.create({
        data: {
          userId: appeal.appellantId,
          amount: appeal.stake + bonus,
          reason: 'appeal_successful',
          sourceType: 'appeal',
          sourceId: appeal.id,
        },
      }),
    ]);

    // Restore content if it was removed
    if (appeal.targetType === 'post') {
      await fastify.prisma.post.update({
        where: { id: appeal.targetId },
        data: { deletedAt: null },
      });
    } else if (appeal.targetType === 'comment') {
      await fastify.prisma.comment.update({
        where: { id: appeal.targetId },
        data: { deletedAt: null },
      });
    }

    // Log the restoration
    await fastify.prisma.modActionLog.create({
      data: {
        targetType: appeal.targetType,
        targetId: appeal.targetId,
        action: 'appeal_restore',
        reason: `Appeal ${appeal.id} overturned original decision`,
        metadata: { appealId: appeal.id },
      },
    });
  } else {
    // Burn stake - appellant loses their cred
    await fastify.prisma.credTransaction.create({
      data: {
        userId: appeal.appellantId,
        amount: -appeal.stake,
        reason: 'appeal_failed',
        sourceType: 'appeal',
        sourceId: appeal.id,
      },
    });

    // Note: Stake was already deducted when appeal was created
    // No need to deduct again
  }
}

/**
 * Check and process expired appeals
 */
export async function processExpiredAppeals(fastify: FastifyInstance): Promise<number> {
  const expiredAppeals = await fastify.prisma.appeal.findMany({
    where: {
      status: 'voting',
      juryDeadline: { lt: new Date() },
    },
  });

  let processed = 0;

  for (const appeal of expiredAppeals) {
    const { verdict, reason } = await tallyVotes(fastify, appeal.id);

    await fastify.prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: verdict,
        verdict,
        verdictReason: reason,
        resolvedAt: new Date(),
      },
    });

    await executeVerdict(fastify, {
      ...appeal,
      verdict,
    });

    processed++;
  }

  return processed;
}

export const appealConstants = {
  MIN_CRED_TO_APPEAL,
  MIN_STAKE,
  MAX_STAKE,
  JURY_SIZE,
  VOTING_PERIOD_HOURS,
  MIN_JUROR_CRED,
};
