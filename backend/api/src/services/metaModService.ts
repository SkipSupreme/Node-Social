/**
 * Meta-Moderation Service
 * Per governance.md Section 8.2 - Slashdot's Meta-Moderation System
 *
 * "A random sample of high-trust users is shown the deleted comment
 * and asked: Was this moderation fair?"
 *
 * This creates a self-healing system where tyrannical mods are removed
 * by the community without admin intervention.
 */

import type { PrismaClient } from '@prisma/client';

// Configuration
const META_MOD_SAMPLE_SIZE = 5; // Number of meta-moderators per task
const META_MOD_DEADLINE_HOURS = 48; // Time to vote
const MIN_TRUST_FOR_META_MOD = 'silver'; // Minimum tier to meta-moderate
const SAMPLE_RATE = 0.10; // 10% of mod actions get meta-moderated

// Trust impacts
const FAIR_TRUST_BONUS = 0.01; // Mod gains trust when ruled fair
const UNFAIR_TRUST_PENALTY = -0.05; // Mod loses trust when ruled unfair
const BIAS_TRUST_PENALTY = -0.08; // Mod loses more for bias
const OVERREACTION_TRUST_PENALTY = -0.03; // Mod loses for overreacting

export type MetaModVoteType = 'fair' | 'unfair' | 'bias' | 'overreaction';

/**
 * Determine if a moderation action should be meta-moderated.
 * Uses random sampling to select actions for review.
 */
export function shouldMetaModerate(): boolean {
  return Math.random() < SAMPLE_RATE;
}

/**
 * Create a meta-moderation task for a mod action.
 */
export async function createMetaModTask(
  prisma: PrismaClient,
  modActionId: string,
  moderatorId: string
): Promise<{ taskId: string; jurors: string[] }> {
  // Select eligible meta-moderators
  const eligibleUsers = await prisma.trustScore.findMany({
    where: {
      tier: { in: ['gold', 'silver'] },
      userId: { not: moderatorId }, // Can't meta-mod yourself
    },
    select: {
      userId: true,
      decayedScore: true,
    },
    orderBy: { decayedScore: 'desc' },
    take: 50,
  });

  if (eligibleUsers.length < META_MOD_SAMPLE_SIZE) {
    throw new Error(`Not enough eligible meta-moderators. Need ${META_MOD_SAMPLE_SIZE}, found ${eligibleUsers.length}`);
  }

  // Weighted random selection (prefer higher trust)
  const selected: string[] = [];
  const pool = [...eligibleUsers];

  for (let i = 0; i < META_MOD_SAMPLE_SIZE && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, u) => sum + u.decayedScore, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < pool.length; j++) {
      random -= pool[j]!.decayedScore;
      if (random <= 0) {
        selected.push(pool[j]!.userId);
        pool.splice(j, 1);
        break;
      }
    }
  }

  // Create the task
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + META_MOD_DEADLINE_HOURS);

  const task = await prisma.metaModerationTask.create({
    data: {
      modActionId,
      moderatorId,
      expiresAt,
    },
  });

  return { taskId: task.id, jurors: selected };
}

/**
 * Submit a meta-moderation vote.
 */
export async function submitMetaModVote(
  prisma: PrismaClient,
  taskId: string,
  voterId: string,
  vote: MetaModVoteType
): Promise<void> {
  const task = await prisma.metaModerationTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Meta-moderation task not found');
  }

  if (task.status !== 'pending') {
    throw new Error('Task is no longer accepting votes');
  }

  if (new Date() > task.expiresAt) {
    throw new Error('Voting deadline has passed');
  }

  // Check voter eligibility
  const voterTrust = await prisma.trustScore.findUnique({
    where: { userId: voterId },
  });

  if (!voterTrust || !['gold', 'silver'].includes(voterTrust.tier)) {
    throw new Error('You must be Gold or Silver tier to meta-moderate');
  }

  // Submit vote
  await prisma.metaModVote.upsert({
    where: {
      taskId_voterId: { taskId, voterId },
    },
    update: { vote },
    create: { taskId, voterId, vote },
  });

  // Update aggregates
  const voteField = `${vote}Votes` as const;
  await prisma.metaModerationTask.update({
    where: { id: taskId },
    data: {
      [voteField]: { increment: 1 },
    },
  });
}

/**
 * Tally votes and determine verdict for a meta-moderation task.
 */
export async function tallyMetaModVotes(
  prisma: PrismaClient,
  taskId: string
): Promise<{
  verdict: MetaModVoteType;
  trustImpact: number;
  reverseMod: boolean;
}> {
  const task = await prisma.metaModerationTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  const votes = {
    fair: task.fairVotes,
    unfair: task.unfairVotes,
    bias: task.biasVotes,
    overreaction: task.overreactionVotes,
  };

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  if (totalVotes === 0) {
    return { verdict: 'fair', trustImpact: 0, reverseMod: false };
  }

  // Find the majority verdict
  const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const verdict = sortedVotes[0]![0] as MetaModVoteType;

  // Calculate trust impact
  let trustImpact: number;
  let reverseMod = false;

  switch (verdict) {
    case 'fair':
      trustImpact = FAIR_TRUST_BONUS;
      break;
    case 'unfair':
      trustImpact = UNFAIR_TRUST_PENALTY;
      reverseMod = true;
      break;
    case 'bias':
      trustImpact = BIAS_TRUST_PENALTY;
      reverseMod = true;
      break;
    case 'overreaction':
      trustImpact = OVERREACTION_TRUST_PENALTY;
      reverseMod = true;
      break;
    default:
      trustImpact = 0;
  }

  return { verdict, trustImpact, reverseMod };
}

/**
 * Complete a meta-moderation task and apply consequences.
 */
export async function completeMetaModTask(
  prisma: PrismaClient,
  taskId: string
): Promise<void> {
  const { verdict, trustImpact, reverseMod } = await tallyMetaModVotes(prisma, taskId);

  const task = await prisma.metaModerationTask.findUnique({
    where: { id: taskId },
    include: { modAction: true },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Update the task
  await prisma.metaModerationTask.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      verdict,
      verdictAt: new Date(),
      modTrustImpact: trustImpact,
    },
  });

  // Apply trust impact to moderator
  if (trustImpact !== 0) {
    const currentTrust = await prisma.trustScore.findUnique({
      where: { userId: task.moderatorId },
    });

    if (currentTrust) {
      const newScore = Math.max(0, currentTrust.rawScore + trustImpact);
      await prisma.trustScore.update({
        where: { userId: task.moderatorId },
        data: { rawScore: newScore, decayedScore: newScore },
      });
    }
  }

  // Reverse moderation if needed
  if (reverseMod && task.modAction) {
    // Restore content based on action type
    if (task.modAction.action === 'delete' || task.modAction.action === 'hide') {
      if (task.modAction.targetType === 'post') {
        await prisma.post.update({
          where: { id: task.modAction.targetId },
          data: { deletedAt: null },
        });
      } else if (task.modAction.targetType === 'comment') {
        await prisma.comment.update({
          where: { id: task.modAction.targetId },
          data: { deletedAt: null },
        });
      }
    }

    // Log the reversal
    await prisma.modActionLog.create({
      data: {
        targetType: task.modAction.targetType,
        targetId: task.modAction.targetId,
        action: 'meta_mod_reversal',
        reason: `Meta-moderation verdict: ${verdict}`,
        metadata: {
          originalActionId: task.modActionId,
          metaModTaskId: taskId,
        },
      },
    });
  }
}

/**
 * Process expired meta-moderation tasks.
 */
export async function processExpiredMetaModTasks(
  prisma: PrismaClient
): Promise<number> {
  const expiredTasks = await prisma.metaModerationTask.findMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() },
    },
  });

  let processed = 0;

  for (const task of expiredTasks) {
    try {
      await completeMetaModTask(prisma, task.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process meta-mod task ${task.id}:`, error);
    }
  }

  return processed;
}

/**
 * Get pending meta-moderation tasks for a user.
 */
export async function getPendingMetaModTasks(
  prisma: PrismaClient,
  userId: string
): Promise<Array<{
  taskId: string;
  modAction: {
    targetType: string;
    action: string;
    reason: string | null;
  };
  expiresAt: Date;
}>> {
  // Check if user is eligible
  const userTrust = await prisma.trustScore.findUnique({
    where: { userId },
  });

  if (!userTrust || !['gold', 'silver'].includes(userTrust.tier)) {
    return [];
  }

  // Get tasks the user hasn't voted on yet
  const tasks = await prisma.metaModerationTask.findMany({
    where: {
      status: 'pending',
      expiresAt: { gt: new Date() },
      votes: {
        none: { voterId: userId },
      },
    },
    include: {
      modAction: {
        select: {
          targetType: true,
          action: true,
          reason: true,
        },
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  return tasks.map((t) => ({
    taskId: t.id,
    modAction: t.modAction,
    expiresAt: t.expiresAt,
  }));
}

/**
 * Get a moderator's meta-moderation history.
 */
export async function getModeratorMetaModHistory(
  prisma: PrismaClient,
  moderatorId: string
): Promise<{
  totalReviewed: number;
  fairCount: number;
  unfairCount: number;
  biasCount: number;
  overreactionCount: number;
  netTrustImpact: number;
}> {
  const tasks = await prisma.metaModerationTask.findMany({
    where: {
      moderatorId,
      status: 'completed',
    },
    select: {
      verdict: true,
      modTrustImpact: true,
    },
  });

  const stats = {
    totalReviewed: tasks.length,
    fairCount: 0,
    unfairCount: 0,
    biasCount: 0,
    overreactionCount: 0,
    netTrustImpact: 0,
  };

  for (const task of tasks) {
    if (task.verdict === 'fair') stats.fairCount++;
    else if (task.verdict === 'unfair') stats.unfairCount++;
    else if (task.verdict === 'bias') stats.biasCount++;
    else if (task.verdict === 'overreaction') stats.overreactionCount++;

    stats.netTrustImpact += task.modTrustImpact || 0;
  }

  return stats;
}

export const metaModConstants = {
  META_MOD_SAMPLE_SIZE,
  META_MOD_DEADLINE_HOURS,
  MIN_TRUST_FOR_META_MOD,
  SAMPLE_RATE,
  FAIR_TRUST_BONUS,
  UNFAIR_TRUST_PENALTY,
  BIAS_TRUST_PENALTY,
  OVERREACTION_TRUST_PENALTY,
};
