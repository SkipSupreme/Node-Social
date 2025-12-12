import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
    // Get current user profile
    fastify.get('/me', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;

        const user = await fastify.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                bio: true,
                avatar: true,
                bannerColor: true,
                bannerImage: true,
                location: true,
                website: true,
                cred: true,
                era: true,
                theme: true,
                role: true,
                emailVerified: true,
                createdAt: true,
                customCss: true,
            }
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        return { user };
    });

    // Update user profile
    fastify.put('/me', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const schema = z.object({
            bio: z.string().max(500).optional(),
            avatar: z.string().url().optional().or(z.literal('')),
            bannerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal('')),
            bannerImage: z.string().url().optional().or(z.literal('')),
            theme: z.string().optional(),
            era: z.string().optional(),
            customCss: z.string().max(5000).optional(),
            location: z.string().max(100).optional().or(z.literal('')),
            website: z.string().max(200).optional().or(z.literal('')),
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
        }

        const { bio, avatar, bannerColor, bannerImage, theme, era, customCss, location, website } = parsed.data;
        const userId = (request.user as { sub: string }).sub;
        const updateData = {
            ...(bio !== undefined ? { bio } : {}),
            ...(avatar !== undefined ? { avatar: avatar || null } : {}),
            ...(bannerColor !== undefined ? { bannerColor: bannerColor || null } : {}),
            ...(bannerImage !== undefined ? { bannerImage: bannerImage || null } : {}),
            ...(theme !== undefined ? { theme } : {}),
            ...(era !== undefined ? { era } : {}),
            ...(customCss !== undefined ? { customCss } : {}),
            ...(location !== undefined ? { location: location || null } : {}),
            ...(website !== undefined ? { website: website || null } : {}),
        };

        if (Object.keys(updateData).length === 0) {
            return reply.status(400).send({ error: 'No profile fields provided' });
        }

        const user = await fastify.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                bio: true,
                avatar: true,
                bannerColor: true,
                bannerImage: true,
                location: true,
                website: true,
                cred: true,
                era: true,
                theme: true,
                role: true,
                emailVerified: true,
                createdAt: true,
                customCss: true,
            }
        });

        return { user };
    });

    // Get user by ID (public profile)
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        // Try to get current user ID for isFollowing check
        let currentUserId: string | null = null;
        try {
            const authHeader = request.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                const decoded = await fastify.jwt.verify(authHeader.slice(7)) as { sub: string };
                currentUserId = decoded.sub;
            }
        } catch {
            // Not authenticated, that's fine
        }

        const user = await fastify.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                bio: true,
                avatar: true,
                bannerColor: true,
                bannerImage: true,
                location: true,
                website: true,
                cred: true,
                era: true,
                role: true,
                createdAt: true,
            }
        });

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        // Check if current user is following this user
        let isFollowing = false;
        if (currentUserId && currentUserId !== id) {
            const follow = await fastify.prisma.userFollow.findUnique({
                where: { followerId_followingId: { followerId: currentUserId, followingId: id } }
            });
            isFollowing = !!follow;
        }

        // Check if user has been vouched for (for verification badge)
        const vouchCount = await fastify.prisma.vouch.count({
            where: { voucheeId: id, active: true }
        });
        const isVouched = vouchCount > 0;

        return { ...user, isFollowing, isVouched };
    });

    // Get Cred History
    fastify.get('/cred/history', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;
        const transactions = await fastify.prisma.credTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return { transactions };
    });

    // Toggle Mute User
    fastify.post('/:id/mute', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const muterId = (request.user as { sub: string }).sub;

        if (muterId === id) return reply.status(400).send({ error: 'Cannot mute yourself' });

        const existing = await fastify.prisma.userMute.findUnique({
            where: { muterId_mutedId: { muterId, mutedId: id } }
        });

        if (existing) {
            await fastify.prisma.userMute.delete({
                where: { muterId_mutedId: { muterId, mutedId: id } }
            });
            return { muted: false };
        } else {
            await fastify.prisma.userMute.create({
                data: { muterId, mutedId: id }
            });
            return { muted: true };
        }
    });

    // Toggle Block User
    fastify.post('/:id/block', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const blockerId = (request.user as { sub: string }).sub;

        if (blockerId === id) return reply.status(400).send({ error: 'Cannot block yourself' });

        const existing = await fastify.prisma.userBlock.findUnique({
            where: { blockerId_blockedId: { blockerId, blockedId: id } }
        });

        if (existing) {
            await fastify.prisma.userBlock.delete({
                where: { blockerId_blockedId: { blockerId, blockedId: id } }
            });
            return { blocked: false };
        } else {
            await fastify.prisma.userBlock.create({
                data: { blockerId, blockedId: id }
            });
            return { blocked: true };
        }
    });

    // Toggle Follow User
    fastify.post('/:id/follow', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const followerId = (request.user as { sub: string }).sub;

        if (followerId === id) return reply.status(400).send({ error: 'Cannot follow yourself' });

        const existing = await fastify.prisma.userFollow.findUnique({
            where: { followerId_followingId: { followerId, followingId: id } }
        });

        if (existing) {
            await fastify.prisma.userFollow.delete({
                where: { followerId_followingId: { followerId, followingId: id } }
            });
            return { following: false };
        } else {
            await fastify.prisma.userFollow.create({
                data: { followerId, followingId: id }
            });

            // Create Notification
            await fastify.prisma.notification.create({
                data: {
                    userId: id,
                    actorId: followerId,
                    type: 'follow',
                    content: 'started following you'
                }
            });

            return { following: true };
        }
    });

    // Get user's cred history
    fastify.get('/:userId/cred/history', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const { userId } = request.params as { userId: string };

        // Get cred transactions
        const transactions = await fastify.prisma.credTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        // For transactions from posts, get the node info
        const postIds = transactions
            .filter(t => t.sourceType === 'post' && t.sourceId)
            .map(t => t.sourceId as string);

        const posts = postIds.length > 0
            ? await fastify.prisma.post.findMany({
                where: { id: { in: postIds } },
                select: { id: true, node: { select: { id: true, name: true, slug: true } } }
            })
            : [];

        const postNodeMap = new Map(posts.map(p => [p.id, p.node]));

        // Enrich transactions with node info
        const enrichedTransactions = transactions.map(t => ({
            ...t,
            node: t.sourceType === 'post' && t.sourceId ? postNodeMap.get(t.sourceId) || null : null
        }));

        return { transactions: enrichedTransactions };
    });

    // Get user's posts
    fastify.get('/:userId/posts', async (request, reply) => {
        const { userId } = request.params as { userId: string };
        const { limit = '10' } = request.query as { limit?: string };

        const posts = await fastify.prisma.post.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            take: Math.min(parseInt(limit) || 10, 50),
            include: {
                node: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    }
                },
                author: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        avatar: true,
                        era: true,
                        cred: true,
                    }
                }
            }
        });

        return { posts };
    });

    // Get user's profile stats (posts, followers, reactions, etc.)
    fastify.get('/:userId/stats', async (request, reply) => {
        const { userId } = request.params as { userId: string };

        // Run all queries in parallel for performance
        const [
            postsCount,
            commentsCount,
            followersCount,
            followingCount,
            reactionsReceived,
            nodeSubscriptions,
            vouchesReceived,
        ] = await Promise.all([
            // Count user's posts
            fastify.prisma.post.count({
                where: { authorId: userId, deletedAt: null }
            }),
            // Count user's comments
            fastify.prisma.comment.count({
                where: { authorId: userId, deletedAt: null }
            }),
            // Count followers
            fastify.prisma.userFollow.count({
                where: { followingId: userId }
            }),
            // Count following
            fastify.prisma.userFollow.count({
                where: { followerId: userId }
            }),
            // Count reactions received on user's posts
            fastify.prisma.vibeReaction.count({
                where: {
                    post: { authorId: userId }
                }
            }),
            // Count node memberships
            fastify.prisma.nodeSubscription.count({
                where: { userId }
            }),
            // Get total vouch stake received
            fastify.prisma.vouch.aggregate({
                where: { voucheeId: userId, active: true },
                _sum: { stake: true },
                _count: true,
            }),
        ]);

        return {
            postsCount,
            commentsCount,
            followersCount,
            followingCount,
            reactionsReceived,
            nodeSubscriptions,
            vouchesReceived: vouchesReceived._count,
            totalVouchStake: vouchesReceived._sum.stake || 0,
        };
    });

    // Get user's comments (for profile scrolling)
    fastify.get('/:userId/comments', async (request, reply) => {
        const { userId } = request.params as { userId: string };
        const { limit = '10', cursor } = request.query as { limit?: string; cursor?: string };

        const take = Math.min(parseInt(limit) || 10, 50);

        const comments = await fastify.prisma.comment.findMany({
            where: {
                authorId: userId,
                deletedAt: null,
                ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take,
            include: {
                post: {
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        node: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            }
                        }
                    }
                },
                reactions: {
                    select: {
                        intensities: true,
                    }
                }
            }
        });

        const nextCursor = comments.length === take && comments.length > 0
            ? comments[comments.length - 1]!.createdAt.toISOString()
            : null;

        return { comments, nextCursor };
    });
};

export default usersRoutes;
