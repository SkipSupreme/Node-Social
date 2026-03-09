import type { PrismaClient, PostVibeAggregate, Prisma } from '@prisma/client';
import { NOTIFICATION_TYPES } from '../lib/constants.js';

// Constants for Flag Score Calculation
const WEIGHTS = {
    QUESTIONABLE: 1.5,
    SHOCK: 1.2,
    REPORT: 5.0,
    VELOCITY_SPIKE: 2.0,
};

const THRESHOLDS = {
    CRITICAL: 50,
    HIGH: 30,
    MEDIUM: 15,
    LOW: 5,
};

interface FlagScoreResult {
    score: number;
    breakdown: {
        questionableRatio: number;
        shockRatio: number;
        comboRatio: number;
        velocitySpike: number;
        reportCount: number;
    };
    priority: 'critical' | 'high' | 'medium' | 'low' | 'monitor';
}

export class ModerationService {
    /**
     * Calculate the Flag Score for a post based on its vibe aggregate and reports.
     */
    static calculateFlagScore(
        aggregate: PostVibeAggregate,
        reportCount: number = 0
    ): FlagScoreResult {
        const total = aggregate.totalIntensity || 1; // Avoid div by zero

        const questionableRatio = aggregate.questionableSum / total;
        const shockRatio = aggregate.shockSum / total;

        // Combo ratio: if both questionable AND shock are high, it's worse
        const comboRatio = questionableRatio * shockRatio;

        // Velocity spike (simplified for now, would need historical data)
        // Assuming reactionsLastHour is available in aggregate
        const velocitySpike = aggregate.reactionsLastHour > 100 ? 1.5 : 1.0;

        let score = 0;
        score += questionableRatio * 100 * WEIGHTS.QUESTIONABLE;
        score += shockRatio * 100 * WEIGHTS.SHOCK;
        score += comboRatio * 100 * 2.0; // Bonus multiplier for combo
        score += reportCount * WEIGHTS.REPORT;

        // Apply velocity multiplier
        if (velocitySpike > 1.0) {
            score *= WEIGHTS.VELOCITY_SPIKE;
        }

        let priority: FlagScoreResult['priority'] = 'monitor';
        if (score >= THRESHOLDS.CRITICAL) priority = 'critical';
        else if (score >= THRESHOLDS.HIGH) priority = 'high';
        else if (score >= THRESHOLDS.MEDIUM) priority = 'medium';
        else if (score >= THRESHOLDS.LOW) priority = 'low';

        return {
            score,
            breakdown: {
                questionableRatio,
                shockRatio,
                comboRatio,
                velocitySpike,
                reportCount,
            },
            priority,
        };
    }

    /**
     * Check if a post needs to be added to or updated in the Mod Queue.
     */
    static async checkAndAddToModQueue(
        prisma: PrismaClient,
        postId: string,
        nodeId: string,
        aggregate: PostVibeAggregate
    ) {
        const reportCount = 0;
        const result = ModerationService.calculateFlagScore(aggregate, reportCount);

        if (result.priority === 'monitor') {
            return;
        }

        const existingItem = await prisma.modQueueItem.findFirst({
            where: {
                postId,
                status: { in: ['pending', 'reviewing'] },
            },
        });

        if (existingItem) {
            await prisma.modQueueItem.update({
                where: { id: existingItem.id },
                data: {
                    flagScore: result.score,
                    weightedFlagScore: result.score,
                    priority: result.priority,
                    questionableRatio: result.breakdown.questionableRatio,
                    shockRatio: result.breakdown.shockRatio,
                    comboRatio: result.breakdown.comboRatio,
                    velocitySpike: result.breakdown.velocitySpike,
                    lastUpdated: new Date(),
                },
            });
        } else {
            await prisma.modQueueItem.create({
                data: {
                    postId,
                    nodeId,
                    flagScore: result.score,
                    weightedFlagScore: result.score,
                    priority: result.priority,
                    questionableRatio: result.breakdown.questionableRatio,
                    shockRatio: result.breakdown.shockRatio,
                    comboRatio: result.breakdown.comboRatio,
                    velocitySpike: result.breakdown.velocitySpike,
                    reportCount,
                    status: 'pending',
                },
            });
        }
    }

    /**
     * Get items from the Mod Queue.
     */
    static async getModQueue(
        prisma: PrismaClient,
        nodeId?: string,
        status: string = 'pending',
        limit: number = 20,
        cursor?: string
    ) {
        const where: Prisma.ModQueueItemWhereInput = { status };
        if (nodeId) {
            where.nodeId = nodeId;
        }

        return prisma.modQueueItem.findMany({
            where,
            orderBy: [
                { priority: 'asc' },
                { flagScore: 'desc' },
            ],
            take: limit,
            skip: cursor ? 1 : 0,
            ...(cursor ? { cursor: { id: cursor } } : {}),
            include: {
                post: {
                    include: {
                        author: true,
                        vibeAggregate: true,
                    }
                }
            }
        });
    }

    /**
     * Resolve a Mod Queue item.
     */
    static async resolveItem(
        prisma: PrismaClient,
        itemId: string,
        resolverId: string,
        action: 'approved' | 'removed' | 'warned' | 'banned',
        reason?: string
    ) {
        const item = await prisma.modQueueItem.findUnique({ where: { id: itemId } });
        if (!item) throw new Error('Item not found');

        await prisma.$transaction(async (tx) => {
            // 1. Update ModQueueItem
            await tx.modQueueItem.update({
                where: { id: itemId },
                data: {
                    status: 'resolved',
                    resolutionAction: action,
                    resolutionReason: reason ?? null,
                    resolvedBy: resolverId,
                    resolvedAt: new Date(),
                },
            });

            // 2. Apply action to Post/User
            if (action === 'removed') {
                await tx.post.update({
                    where: { id: item.postId },
                    data: { visibility: 'removed' }
                });

                const post = await tx.post.findUnique({
                    where: { id: item.postId },
                    select: { authorId: true }
                });

                if (post) {
                    await tx.notification.create({
                        data: {
                            userId: post.authorId,
                            actorId: resolverId,
                            type: NOTIFICATION_TYPES.MOD_REMOVED,
                            content: reason || 'Your post was removed by a moderator.',
                            postId: item.postId,
                        }
                    });
                }
            }

            if (action === 'warned') {
                const post = await tx.post.findUnique({
                    where: { id: item.postId },
                    select: { authorId: true }
                });

                if (post) {
                    await tx.notification.create({
                        data: {
                            userId: post.authorId,
                            actorId: resolverId,
                            type: NOTIFICATION_TYPES.WARNING,
                            content: reason || 'You have received a warning from a moderator.',
                            postId: item.postId,
                        }
                    });
                }
            }

            if (action === 'banned') {
                const post = await tx.post.findUnique({
                    where: { id: item.postId },
                    select: { authorId: true, nodeId: true }
                });

                if (post && post.nodeId) {
                    await tx.nodeSubscription.updateMany({
                        where: {
                            userId: post.authorId,
                            nodeId: post.nodeId,
                        },
                        data: {
                            role: 'banned',
                        }
                    });

                    await tx.notification.create({
                        data: {
                            userId: post.authorId,
                            actorId: resolverId,
                            type: NOTIFICATION_TYPES.BANNED,
                            content: reason || 'You have been banned from this community.',
                            postId: item.postId,
                        }
                    });
                }
            }
        });
    }
}
