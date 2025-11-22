// src/lib/metrics.ts
// Service for updating PostMetric values
import type { FastifyInstance } from 'fastify';

/**
 * Update PostMetric for a given post
 * Calculates engagement score and updates all metric counts
 */
export async function updatePostMetrics(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  try {
    // Count non-deleted comments
    const commentCount = await fastify.prisma.comment.count({
      where: {
        postId,
        deletedAt: null,
      },
    });

    // Get existing metrics or use defaults
    const existing = await fastify.prisma.postMetric.findUnique({
      where: { postId },
    });

    const likeCount = existing?.likeCount ?? 0;
    const shareCount = existing?.shareCount ?? 0;
    const saveCount = existing?.saveCount ?? 0;
    const viewCount = existing?.viewCount ?? 0;

    // Calculate engagement score
    // Formula: (commentCount * 2) + (likeCount * 1) + (shareCount * 3)
    // This prioritizes shares (reputation staking) and comments (discussion)
    const engagementScore =
      commentCount * 2 + likeCount * 1 + shareCount * 3 + saveCount * 1;

    // Quality score defaults to 50.0, can be updated later with ConnoisseurCred
    const qualityScore = existing?.qualityScore ?? 50.0;

    // Upsert PostMetric
    await fastify.prisma.postMetric.upsert({
      where: { postId },
      create: {
        postId,
        commentCount,
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        viewCount: 0,
        engagementScore,
        qualityScore,
      },
      update: {
        commentCount,
        engagementScore,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Log error but don't throw - metrics updates shouldn't break the API
    fastify.log.error({ err: error, postId }, 'Failed to update post metrics');
  }
}

/**
 * Initialize PostMetric when a post is created
 */
export async function initializePostMetrics(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  try {
    await fastify.prisma.postMetric.upsert({
      where: { postId },
      create: {
        postId,
        commentCount: 0,
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        viewCount: 0,
        engagementScore: 0,
        qualityScore: 50.0, // Default quality score
      },
      update: {}, // No-op if exists
    });
  } catch (error) {
    fastify.log.error({ err: error, postId }, 'Failed to initialize post metrics');
  }
}

