/**
 * Exploration Tax Service
 * Per governance.md Section 5.3 - Enforcing Discoverability
 *
 * "Regardless of the user's Vibe settings, 5% to 10% of the feed slots
 * are reserved for Probationary Content."
 *
 * This is the protocol-level mechanism that ensures new voices have
 * a chance to enter the Web of Trust, preventing the "Quora Trap".
 */

import type { PrismaClient } from '@prisma/client';

// Configuration
const DEFAULT_EXPLORATION_RATE = 0.10; // 10% of feed
const MIN_EXPLORATION_RATE = 0.05; // 5% minimum (protocol enforced)
const MAX_EXPLORATION_RATE = 0.30; // 30% maximum
const TRUST_BOOST_FOR_ENGAGEMENT = 0.01; // Trust boost when user engages with exploration content

// Probationary content criteria
const NEW_USER_DAYS_THRESHOLD = 30; // Users under 30 days old
const LOW_VISIBILITY_REACTION_THRESHOLD = 5; // Posts with fewer than 5 reactions

export interface ExplorationSlot {
  postId: string;
  nodeId: string;
  authorId: string;
  reason: 'new_user' | 'low_visibility' | 'contextual_match';
}

/**
 * Calculate the number of exploration slots for a given feed size.
 * Per governance.md: Protocol-level minimum of 5-10%.
 */
export function calculateExplorationSlots(
  feedSize: number,
  userExplorationRate: number = DEFAULT_EXPLORATION_RATE
): number {
  // Enforce minimum rate
  const effectiveRate = Math.max(MIN_EXPLORATION_RATE, Math.min(MAX_EXPLORATION_RATE, userExplorationRate));
  return Math.ceil(feedSize * effectiveRate);
}

/**
 * Get probationary content for exploration slots.
 * Uses contextual bandits: If user likes "Gardening", show new posts from /n/Gardening.
 */
export async function getProbationaryContent(
  prisma: PrismaClient,
  userId: string,
  nodeContext: string | null,
  slotCount: number
): Promise<ExplorationSlot[]> {
  const slots: ExplorationSlot[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pre-fetch post IDs the user has already seen via exploration slots
  const seenSlots = await prisma.explorationSlot.findMany({
    where: { userId },
    select: { postId: true },
  });
  const seenPostIds = seenSlots.map((s) => s.postId);

  // Strategy 1: New users in user's interest areas (contextual bandit)
  if (nodeContext) {
    const newUserPosts = await prisma.post.findMany({
      where: {
        nodeId: nodeContext,
        deletedAt: null,
        author: {
          createdAt: { gte: thirtyDaysAgo },
          id: { not: userId },
        },
        // Exclude posts user has already seen
        id: { notIn: seenPostIds },
      },
      select: {
        id: true,
        nodeId: true,
        authorId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(slotCount / 2),
    });

    for (const post of newUserPosts) {
      if (slots.length >= slotCount) break;
      slots.push({
        postId: post.id,
        nodeId: post.nodeId!,
        authorId: post.authorId,
        reason: 'new_user',
      });
    }
  }

  // Strategy 2: Low visibility posts (few reactions)
  if (slots.length < slotCount) {
    const lowVisibilityPosts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        authorId: { not: userId },
        // Posts with few reactions (or no aggregate at all)
        OR: [
          { vibeAggregate: { totalReactors: { lt: LOW_VISIBILITY_REACTION_THRESHOLD } } },
          { vibeAggregate: { is: null } },
        ],
        // Recent posts only
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        // Not already in slots and exclude posts user has already seen
        id: { notIn: [...slots.map((s) => s.postId), ...seenPostIds] },
      },
      select: {
        id: true,
        nodeId: true,
        authorId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: slotCount - slots.length,
    });

    for (const post of lowVisibilityPosts) {
      if (slots.length >= slotCount) break;
      if (post.nodeId) {
        slots.push({
          postId: post.id,
          nodeId: post.nodeId,
          authorId: post.authorId,
          reason: 'low_visibility',
        });
      }
    }
  }

  // Strategy 3: Random contextual matches from user's subscribed nodes
  if (slots.length < slotCount) {
    const userSubscriptions = await prisma.nodeSubscription.findMany({
      where: { userId },
      select: { nodeId: true },
    });

    const subscribedNodeIds = userSubscriptions.map((s) => s.nodeId);

    if (subscribedNodeIds.length > 0) {
      const contextualPosts = await prisma.post.findMany({
        where: {
          nodeId: { in: subscribedNodeIds },
          deletedAt: null,
          authorId: { not: userId },
          id: { notIn: slots.map((s) => s.postId) },
          // Prefer posts from users not in user's trust network
          author: {
            NOT: {
              vouchesReceived: {
                some: { voucherId: userId },
              },
            },
          },
        },
        select: {
          id: true,
          nodeId: true,
          authorId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: slotCount - slots.length,
      });

      for (const post of contextualPosts) {
        if (slots.length >= slotCount) break;
        if (post.nodeId) {
          slots.push({
            postId: post.id,
            nodeId: post.nodeId,
            authorId: post.authorId,
            reason: 'contextual_match',
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Record that an exploration slot was shown to a user.
 */
export async function recordExplorationSlot(
  prisma: PrismaClient,
  userId: string,
  postId: string,
  nodeId: string
): Promise<string> {
  const slot = await prisma.explorationSlot.create({
    data: {
      userId,
      postId,
      nodeId,
    },
  });

  return slot.id;
}

/**
 * Record user interaction with exploration content.
 * Per governance.md: "If the user interacts with this Tax content,
 * the new user's Trust Score rises."
 */
export async function recordExplorationInteraction(
  prisma: PrismaClient,
  slotId: string,
  interactionType: 'view' | 'react' | 'comment' | 'follow'
): Promise<{ trustBoosted: boolean; boostAmount: number }> {
  const slot = await prisma.explorationSlot.findUnique({
    where: { id: slotId },
  });

  if (!slot) {
    throw new Error('Exploration slot not found');
  }

  // Update slot
  await prisma.explorationSlot.update({
    where: { id: slotId },
    data: {
      interacted: true,
      interactionType,
      interactedAt: new Date(),
    },
  });

  // Only boost trust for meaningful interactions
  if (interactionType === 'view') {
    return { trustBoosted: false, boostAmount: 0 };
  }

  // Boost the author's trust score — look up the post to get the authorId
  const post = await prisma.post.findUnique({
    where: { id: slot.postId },
    select: { authorId: true },
  });
  const authorId = post?.authorId;

  if (authorId) {
    const authorTrust = await prisma.trustScore.findUnique({
      where: { userId: authorId },
    });

    if (authorTrust) {
      const boostAmount = TRUST_BOOST_FOR_ENGAGEMENT;
      await prisma.trustScore.update({
        where: { userId: authorId },
        data: {
          rawScore: { increment: boostAmount },
          decayedScore: { increment: boostAmount },
        },
      });

      // Update slot
      await prisma.explorationSlot.update({
        where: { id: slotId },
        data: {
          trustBoostApplied: true,
          trustBoostAmount: boostAmount,
        },
      });

      return { trustBoosted: true, boostAmount };
    }
  }

  return { trustBoosted: false, boostAmount: 0 };
}

/**
 * Get exploration stats for analytics.
 */
export async function getExplorationStats(
  prisma: PrismaClient,
  days: number = 30
): Promise<{
  totalSlots: number;
  interactionRate: number;
  trustBoostTotal: number;
  byReason: { new_user: number; low_visibility: number; contextual_match: number };
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const slots = await prisma.explorationSlot.findMany({
    where: { shownAt: { gte: since } },
    select: {
      interacted: true,
      trustBoostAmount: true,
    },
  });

  const totalSlots = slots.length;
  const interactedSlots = slots.filter((s) => s.interacted).length;
  const interactionRate = totalSlots > 0 ? interactedSlots / totalSlots : 0;
  const trustBoostTotal = slots.reduce((sum, s) => sum + (s.trustBoostAmount || 0), 0);

  // Count by reason would require a field, so return placeholders
  return {
    totalSlots,
    interactionRate,
    trustBoostTotal,
    byReason: {
      new_user: 0,
      low_visibility: 0,
      contextual_match: 0,
    },
  };
}

/**
 * Interleave exploration slots into a feed.
 * This is the protocol-level enforcement of the exploration tax.
 */
export function interleaveExplorationSlots<T extends { id: string }>(
  mainFeed: T[],
  explorationPosts: T[],
  explorationRate: number = DEFAULT_EXPLORATION_RATE
): T[] {
  if (explorationPosts.length === 0 || explorationRate <= 0) {
    return mainFeed;
  }

  const result: T[] = [];
  const explorationInterval = Math.floor(1 / explorationRate);

  let mainIndex = 0;
  let explorationIndex = 0;

  for (let i = 0; mainIndex < mainFeed.length || explorationIndex < explorationPosts.length; i++) {
    // Insert exploration slot at regular intervals
    if (i > 0 && i % explorationInterval === 0 && explorationIndex < explorationPosts.length) {
      result.push(explorationPosts[explorationIndex]!);
      explorationIndex++;
    } else if (mainIndex < mainFeed.length) {
      result.push(mainFeed[mainIndex]!);
      mainIndex++;
    } else if (explorationIndex < explorationPosts.length) {
      result.push(explorationPosts[explorationIndex]!);
      explorationIndex++;
    }
  }

  return result;
}

export const explorationTaxConstants = {
  DEFAULT_EXPLORATION_RATE,
  MIN_EXPLORATION_RATE,
  MAX_EXPLORATION_RATE,
  TRUST_BOOST_FOR_ENGAGEMENT,
  NEW_USER_DAYS_THRESHOLD,
  LOW_VISIBILITY_REACTION_THRESHOLD,
};
