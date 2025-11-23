// Phase 0.1 - Vibe Vector Service
// Core feature: Handles Vibe Vector reactions with intensity and Node weighting

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { FastifyInstance } from 'fastify';

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
      ...(postId ? { postId } : { commentId }),
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
      console.error(`Failed to update metrics for post ${postId}:`, err);
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
      ...(postId ? { postId } : { commentId }),
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
    ...(postId ? { postId } : { commentId }),
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
      console.error(`Failed to update metrics for post ${postId}:`, err);
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

