// src/lib/moderation.ts
// Moderation action logging
import type { FastifyInstance } from 'fastify';

export type ModAction = 'delete' | 'hide' | 'warn' | 'ban';
export type ModTargetType = 'post' | 'comment' | 'user';

/**
 * Log a moderation action
 * This creates an immutable public log entry for transparency
 * Per FINAL_PLAN.md Section 5.2 - ModActionLog feeds analytics and Node Court
 */
export async function logModAction(
  fastify: FastifyInstance,
  action: ModAction,
  targetType: ModTargetType,
  targetId: string,
  options?: {
    moderatorId?: string | null; // null for automated/self-delete
    reason?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await fastify.prisma.modActionLog.create({
      data: {
        action,
        targetType,
        targetId,
        moderatorId: options?.moderatorId ?? null,
        reason: options?.reason ?? null,
        metadata: options?.metadata ?? null,
      },
    });
  } catch (error) {
    // Log error but don't throw - moderation logging shouldn't break the API
    fastify.log.error(
      { err: error, action, targetType, targetId },
      'Failed to log moderation action'
    );
  }
}

