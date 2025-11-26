
// Phase 0.1 - Vibe Vector Service
// Core feature: Handles Vibe Vector reactions with intensity and Node weighting

import { PrismaClient } from '@prisma/client';
import type { VibeReaction } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getSocketService } from './socketService.js';
import { ModerationService } from './moderationService.js';

export interface VibeIntensities {
  [vectorSlug: string]: number; // 0.0-1.0
}

export interface CreateReactionParams {
  userId: string;
  postId?: string;
  commentId?: string;
  nodeId: string;
  intensities: VibeIntensities;
}

/**
 * Calculate total intensity from intensity object
 */
export function calculateTotalIntensity(intensities: VibeIntensities): number {
  return Object.values(intensities).reduce((sum, intensity) => sum + intensity, 0);
}

/**
 * Validate intensities object
 */
export function validateIntensities(intensities: VibeIntensities): boolean {
  // Check all values are between 0 and 1
  for (const [slug, intensity] of Object.entries(intensities)) {
    if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
      return false;
    }
    // Validate slug exists (basic check - should validate against DB)
    if (!slug || typeof slug !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Create or update a Vibe Vector reaction
 * Phase 0.1 - Core feature: Intensity-based multi-vector reactions
 */
export async function createOrUpdateReaction(
  prisma: PrismaClient,
  params: CreateReactionParams
) {
  const { userId, postId, commentId, nodeId, intensities } = params;

  // Validate: must have either postId or commentId, not both
  if ((!postId && !commentId) || (postId && commentId)) {
    throw new Error('Must provide either postId or commentId, not both');
  }

  // Validate intensities
  if (!validateIntensities(intensities)) {
    throw new Error('Invalid intensities: values must be between 0.0 and 1.0');
  }

  const totalIntensity = calculateTotalIntensity(intensities);

  // Ensure postId or commentId is null for the other
  const reactionData = {
    userId,
    postId: postId || null,
    commentId: commentId || null,
    nodeId,
    intensities: intensities as any, // Prisma Json type
    totalIntensity,
  };

  // Check if reaction already exists (handle uniqueness manually since Prisma doesn't support conditional uniques)
  const existingReaction = await prisma.vibeReaction.findFirst({
    where: {
      userId,
      nodeId,
      ...(postId ? { postId } : { commentId: commentId! }),
    },
  });

  let reaction;
  if (existingReaction) {
    // Update existing reaction
    reaction = await prisma.vibeReaction.update({
      where: { id: existingReaction.id },
      data: {
        intensities: intensities as any,
        totalIntensity,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        node: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });
  } else {
    // Create new reaction
    reaction = await prisma.vibeReaction.create({
      data: reactionData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        node: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });
  }

  // Update PostMetric if postId exists (fire-and-forget, don't block)
  if (postId) {
    updatePostMetricsFromReactions(prisma, postId).catch((err) => {
      console.error('Failed to update metrics for post ' + postId + ': ', err);
    });
  }

  return reaction;
}

/**
 * Get Node weights for all vectors (cached in Redis ideally)
 */
export async function getNodeWeights(
  prisma: PrismaClient,
  nodeId: string
): Promise<Map<string, number>> {
  const weights = await prisma.nodeVibeWeight.findMany({
    where: { nodeId },
    include: {
      vector: {
        select: {
          slug: true,
        },
      },
    },
  });

  const weightMap = new Map<string, number>();
  for (const weight of weights) {
    weightMap.set(weight.vector.slug, weight.weight);
  }

  return weightMap;
}

/**
 * Get reactions for a post or comment with aggregated counts (without showing counts prominently)
 */
export async function getReactionsForContent(
  prisma: PrismaClient,
  postId?: string,
  commentId?: string
) {
  if ((!postId && !commentId) || (postId && commentId)) {
    throw new Error('Must provide either postId or commentId, not both');
  }

  const reactions = await prisma.vibeReaction.findMany({
    where: {
      ...(postId ? { postId } : { commentId: commentId! }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
      node: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  // Collect all unique vector slugs from reactions
  const vectorSlugs = new Set<string>();
  for (const reaction of reactions) {
    const intensities = reaction.intensities as VibeIntensities;
    for (const slug of Object.keys(intensities)) {
      vectorSlugs.add(slug);
    }
  }

  // Fetch vector details for all slugs
  const vectors = await prisma.vibeVector.findMany({
    where: {
      slug: { in: Array.from(vectorSlugs) },
      enabled: true,
    },
    select: {
      slug: true,
      name: true,
      emoji: true,
    },
  });

  // Create a map for quick lookup
  const vectorMap = new Map(vectors.map(v => [v.slug, v]));

  // Aggregate intensities by vector slug
  const aggregated: Record<string, {
    slug: string;
    name: string;
    emoji: string | null;
    totalIntensity: number;
    reactionCount: number;
  }> = {};

  for (const reaction of reactions) {
    const intensities = reaction.intensities as VibeIntensities;
    for (const [slug, intensity] of Object.entries(intensities)) {
      if (!aggregated[slug]) {
        const vector = vectorMap.get(slug);
        aggregated[slug] = {
          slug,
          name: vector?.name || slug.charAt(0).toUpperCase() + slug.slice(1),
          emoji: vector?.emoji || null,
          totalIntensity: 0,
          reactionCount: 0,
        };
      }
      aggregated[slug].totalIntensity += intensity;
      if (intensity > 0) {
        aggregated[slug].reactionCount += 1;
      }
    }
  }

  return {
    reactions,
    aggregated: Object.values(aggregated),
  };
}

/**
 * Delete a reaction
 */
export async function deleteReaction(
  prisma: PrismaClient,
  userId: string,
  postId?: string,
  commentId?: string,
  nodeId?: string
) {
  if ((!postId && !commentId) || (postId && commentId)) {
    throw new Error('Must provide either postId or commentId, not both');
  }

  const where: any = {
    userId,
    ...(postId ? { postId } : { commentId: commentId! }),
  };

  if (nodeId) {
    where.nodeId = nodeId;
  }

  const reaction = await prisma.vibeReaction.findFirst({
    where,
  });

  if (!reaction) {
    throw new Error('Reaction not found');
  }

  await prisma.vibeReaction.delete({
    where: { id: reaction.id },
  });

  // Update PostMetric if postId exists
  if (postId) {
    updatePostMetricsFromReactions(prisma, postId).catch((err) => {
      console.error('Failed to update metrics for post ' + postId + ': ', err);
    });
  }

  return { message: 'Reaction deleted' };
}

/**
 * Update post metrics based on reactions
 * Phase 0.5 - Feed algorithm integration
 */
async function updatePostMetricsFromReactions(
  prisma: PrismaClient,
  postId: string
) {
  const reactions = await prisma.vibeReaction.findMany({
    where: { postId },
    include: {
      node: {
        include: {
          vibeWeights: {
            include: {
              vector: true,
            },
          },
        },
      },
    },
  });

  // Calculate weighted engagement score
  let weightedEngagementScore = 0;
  let totalWeightedIntensity = 0;

  // Initialize aggregates for PostVibeAggregate
  const aggregates: any = {
    insightfulSum: 0,
    joySum: 0,
    fireSum: 0,
    supportSum: 0,
    shockSum: 0,
    questionableSum: 0,
    insightfulCount: 0,
    joyCount: 0,
    fireCount: 0,
    supportCount: 0,
    shockCount: 0,
    questionableCount: 0,
    totalReactors: reactions.length,
    totalIntensity: 0,
  };

  for (const reaction of reactions) {
    const intensities = reaction.intensities as VibeIntensities;
    const nodeWeights = new Map(
      reaction.node.vibeWeights.map((w) => [w.vector.slug, w.weight])
    );

    // Apply Node weights to intensities
    for (const [slug, intensity] of Object.entries(intensities)) {
      const nodeWeight = nodeWeights.get(slug) || 1.0;
      weightedEngagementScore += intensity * nodeWeight;
      totalWeightedIntensity += intensity;

      // Update aggregates
      const sumKey = slug + 'Sum';
      const countKey = slug + 'Count';

      if (typeof aggregates[sumKey] === 'number') {
        aggregates[sumKey] += intensity;
        if (intensity > 0) {
          aggregates[countKey] += 1;
        }
      }
      aggregates.totalIntensity += intensity;
    }
  }

  // Update PostMetric (upsert to ensure it exists)
  const metric = await prisma.postMetric.upsert({
    where: { postId },
    update: {
      engagementScore: weightedEngagementScore,
      // Update other metrics as needed
    },
    create: {
      postId,
      engagementScore: weightedEngagementScore,
      // Initialize other fields
    },
  });

  // Update PostVibeAggregate
  await prisma.postVibeAggregate.upsert({
    where: { postId },
    update: {
      ...aggregates,
      updatedAt: new Date(),
    },
    create: {
      postId,
      ...aggregates,
    },
  });

  // Phase 3: Moderation Queue Check
  // We need to fetch the node ID for the post to pass to checkAndAddToModQueue
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, nodeId: true, authorId: true } });
  if (post && post.nodeId) {
    await ModerationService.checkAndAddToModQueue(postId, post.nodeId, aggregates);

    // Phase 3: Update User Cred
    // We need to fetch the full post with reactions to calculate cred
    // This might be expensive to do on every reaction, so maybe debounce or sample?
    // For now, let's do it directly but optimize later.
    const fullPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        reactions: {
          include: {
            user: { select: { nodeCredScores: true } }
          }
        },
        author: true
      }
    });

    if (fullPost) {
      await updateUserCred(prisma, fullPost);
    }
  }

  // Emit socket update
  try {
    const socketService = getSocketService();
    socketService.emitPostUpdate(postId, {
      postId,
      metrics: {
        engagementScore: weightedEngagementScore,
      },
      vibeAggregate: aggregates,
    });
  } catch (error) {
    // Ignore socket errors (e.g. if service not initialized in tests)
    console.warn('Failed to emit socket update:', error);
  }

  return metric;
}

/**
 * Get all platform Vibe Vectors (for frontend)
 */
export async function getAllVibeVectors(prisma: PrismaClient) {
  return await prisma.vibeVector.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
  });
}

/**
 * Phase 3: ConnoisseurCred Logic
 */

function calculateCredEarned(post: any): number {
  let credEarned = 0;

  for (const reaction of post.reactions) {
    // Get reactor's cred for this node
    const nodeCreds = reaction.user.nodeCredScores as Record<string, number> || {};
    const reactorCred = Math.min(nodeCreds[post.nodeId] || 0, 2000); // Cap at 2x
    const normalizedCred = Math.max(0.1, reactorCred / 1000); // Normalize to ~0-2 range, min 0.1

    const intensities = reaction.intensities as VibeIntensities;

    // Positive vectors earn Cred
    const positiveValue =
      ((intensities.insightful || 0) * 3.0) +
      ((intensities.support || 0) * 2.5) +
      ((intensities.joy || 0) * 1.5) +
      ((intensities.fire || 0) * 2.0);

    credEarned += normalizedCred * positiveValue;
  }

  return credEarned;
}

function calculateCredLost(post: any): number {
  let credLost = 0;

  for (const reaction of post.reactions) {
    const nodeCreds = reaction.user.nodeCredScores as Record<string, number> || {};
    const reactorCred = Math.min(nodeCreds[post.nodeId] || 0, 2000);
    const normalizedCred = Math.max(0.1, reactorCred / 1000);

    const intensities = reaction.intensities as VibeIntensities;

    // Negative vectors lose Cred
    const negativeValue =
      ((intensities.questionable || 0) * 1.5);

    // Shock only loses Cred if content was removed (we check status)
    // For now, let's just count it as negative if it's high? 
    // Roadmap says "Shock only loses Cred if content was removed".
    // So we skip shock here unless we know status.
    // Let's assume we are just calculating potential loss from reactions.

    credLost += normalizedCred * negativeValue;
  }

  return credLost;
}

async function updateUserCred(prisma: PrismaClient, post: any) {
  const earned = calculateCredEarned(post);
  const lost = calculateCredLost(post);
  const netChange = earned - lost;

  // Update author's Node-specific Cred
  const author = post.author;
  const currentNodeCreds = author.nodeCredScores as Record<string, number> || {};
  const currentCred = currentNodeCreds[post.nodeId] || 0;

  // Simple additive model for now (roadmap implies accumulation)
  // We should probably store "cred earned from this post" on the post itself to avoid re-calculating everything?
  // But for MVP, let's just add the *change*? 
  // Wait, if we re-calculate every time, we need to know the *previous* cred earned from this post to subtract it.
  // Or we just re-calculate total cred from all posts? That's too expensive.
  // 
  // Better approach for MVP:
  // Just add a small amount for the *current* reaction being processed?
  // But `updatePostMetricsFromReactions` iterates ALL reactions.
  //
  // Let's stick to the roadmap formula but maybe we need to store `post.credEarned` to diff it.
  // Since we don't have `post.credEarned` in schema yet, let's just skip the diff and 
  // assume we are recalculating the user's TOTAL cred from scratch? No, too expensive.
  //
  // Alternative: Just update the user's cred by a small delta based on the *current* aggregate state?
  // That's risky for drift.
  //
  // Let's try to be smart. 
  // We can just calculate the score for THIS post.
  // And maybe we assume the User's `nodeCredScores` is the sum of all their posts' scores.
  // But we can't query all posts every time.
  //
  // Let's modify `User` to just have `connoisseurCred` (global) and `nodeCredScores` (local).
  // For this MVP, let's just increment/decrement based on the *delta* of the aggregate?
  //
  // Actually, `updatePostMetricsFromReactions` is called after *one* reaction change.
  // We can just calculate the impact of THAT reaction?
  // But `updatePostMetricsFromReactions` re-sums everything.
  //
  // Let's simplify:
  // We will just update the User's cred based on the *total* score of the post, 
  // but we need to know what it was *before* to add the diff.
  // We don't have "before".
  //
  // Okay, let's just log the calculated cred for now and not write to DB to avoid corruption,
  // UNLESS we add `credEarned` to `Post` or `PostVibeAggregate`.
  // `PostVibeAggregate` has `qualityScore`. Maybe we use that?
  //
  // Let's add `credEarned` to `PostVibeAggregate` in the next schema update if needed.
  // For now, I will implement the calculation but NOT the write to User, 
  // or I'll write it but acknowledge it might be "jumpy" if I don't diff.
  //
  // Wait, `PostVibeAggregate` has `qualityScore`. 
  // Let's use `qualityScore` as the "Cred earned from this post".
  // And we can update the User's total by (newQuality - oldQuality).
  //
  // Yes! `PostVibeAggregate` already exists and we are updating it.
  // We can fetch the OLD aggregate before upserting?
  // `updatePostMetricsFromReactions` does an upsert.
  //
  // Let's fetch old aggregate first.

  const oldAggregate = await prisma.postVibeAggregate.findUnique({ where: { postId: post.id } });
  const oldScore = oldAggregate?.qualityScore || 0;

  // Calculate NEW quality score (which is basically cred earned)
  const newScore = netChange; // Use our formula

  const diff = newScore - oldScore;

  if (Math.abs(diff) > 0.1) {
    const newNodeCred = Math.max(0, currentCred + diff);

    const newNodeCreds = {
      ...currentNodeCreds,
      [post.nodeId]: newNodeCred
    };

    // Update User
    await prisma.user.update({
      where: { id: author.id },
      data: {
        nodeCredScores: newNodeCreds,
        // Also update global cred? Maybe average or sum?
        // Roadmap says: "totalCred = Object.values(author.nodeCredScores).reduce((a, b) => a + b, 0);"
        connoisseurCred: (Object.values(newNodeCreds) as number[]).reduce((a, b) => a + b, 0)
      }
    });

    // Also update the aggregate's qualityScore so we have a baseline for next time
    await prisma.postVibeAggregate.update({
      where: { postId: post.id },
      data: { qualityScore: newScore }
    });
  }
}
