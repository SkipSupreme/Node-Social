import type { FastifyInstance, FastifyRequest } from 'fastify';

// Debounce period - only update once per 5 minutes per user
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const recentUpdates = new Map<string, number>();

/**
 * Update user's lastActiveAt timestamp
 * Debounced to avoid excessive database writes
 */
export async function trackUserActivity(
  fastify: FastifyInstance,
  userId: string
): Promise<void> {
  const now = Date.now();
  const lastUpdate = recentUpdates.get(userId);

  // Skip if recently updated
  if (lastUpdate && now - lastUpdate < UPDATE_INTERVAL_MS) {
    return;
  }

  // Update in background (don't block the request)
  fastify.prisma.user
    .update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    })
    .then(() => {
      recentUpdates.set(userId, now);
    })
    .catch((err) => {
      fastify.log.error({ err, userId }, 'Failed to update lastActiveAt');
    });
}

/**
 * Calculate activity multiplier for governance weight
 * 100% at 7 days, decaying to 50% at 60+ days
 */
export function calculateActivityMultiplier(lastActiveAt: Date): number {
  const now = new Date();
  const daysSinceActive = Math.floor(
    (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActive <= 7) return 1.0;
  if (daysSinceActive >= 60) return 0.5;

  // Linear decay from 1.0 to 0.5 over 53 days (7-60)
  return 1.0 - ((daysSinceActive - 7) / 53) * 0.5;
}

/**
 * Fastify plugin to automatically track activity on authenticated requests
 */
export function activityTrackerPlugin(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Only track for authenticated users
    const user = request.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id || user?.sub;
    if (userId) {
      await trackUserActivity(fastify, userId);
    }
  });
}
