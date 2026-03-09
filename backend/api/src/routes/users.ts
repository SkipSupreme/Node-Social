import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getErrorMessage } from '../lib/errors.js';
import { NOTIFICATION_TYPES } from '../lib/constants.js';

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
                customTheme: true,
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
            theme: z.string().max(50).optional(),
            era: z.string().optional(),
            customCss: z.string().max(5000).optional().refine(
                (css) => {
                    if (!css) return true;
                    const lower = css.toLowerCase();
                    // Block data exfiltration (url), code execution (expression, javascript),
                    // external resource loading (@import), legacy browser exploits (behavior, -moz-binding)
                    const dangerous = [
                        '@import', 'javascript:', 'expression(', 'behavior:',
                        '-moz-binding', '@charset',
                    ];
                    if (dangerous.some(pattern => lower.includes(pattern))) return false;
                    // Block url() — primary data exfiltration vector
                    // Allows common safe values that happen to contain "url" as substring
                    if (/url\s*\(/i.test(css)) return false;
                    return true;
                },
                { message: 'CSS contains disallowed patterns (url(), @import, expression(), javascript:, etc.)' }
            ),
            customTheme: z.record(z.string(), z.unknown()).optional(),
            location: z.string().max(100).optional().or(z.literal('')),
            website: z.string().max(200).optional().or(z.literal('')),
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
        }

        const { bio, avatar, bannerColor, bannerImage, theme, era, customCss, customTheme, location, website } = parsed.data;
        const userId = (request.user as { sub: string }).sub;
        const updateData = {
            ...(bio !== undefined ? { bio } : {}),
            ...(avatar !== undefined ? { avatar: avatar || null } : {}),
            ...(bannerColor !== undefined ? { bannerColor: bannerColor || null } : {}),
            ...(bannerImage !== undefined ? { bannerImage: bannerImage || null } : {}),
            ...(theme !== undefined ? { theme } : {}),
            ...(era !== undefined ? { era } : {}),
            ...(customCss !== undefined ? { customCss } : {}),
            ...(customTheme !== undefined ? { customTheme: customTheme as Prisma.InputJsonValue } : {}),
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
                customTheme: true,
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
                customTheme: true,
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
        try {
            const { id } = request.params as { id: string };
            const muterId = (request.user as { sub: string }).sub;

            fastify.log.info({ targetId: id, muterId }, 'Mute request received');

            if (muterId === id) return reply.status(400).send({ error: 'Cannot mute yourself' });

            // Verify target user exists
            const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
            if (!targetUser) {
                fastify.log.warn({ targetId: id }, 'Mute target user not found');
                return reply.status(404).send({ error: 'User not found' });
            }

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
        } catch (error: unknown) {
            fastify.log.error({ error: getErrorMessage(error), stack: error instanceof Error ? error.stack : undefined }, 'Mute failed');
            return reply.status(500).send({ error: 'Failed to mute user' });
        }
    });

    // Toggle Block User
    fastify.post('/:id/block', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const blockerId = (request.user as { sub: string }).sub;

            fastify.log.info({ targetId: id, blockerId }, 'Block request received');

            if (blockerId === id) return reply.status(400).send({ error: 'Cannot block yourself' });

            // Verify target user exists
            const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
            if (!targetUser) {
                fastify.log.warn({ targetId: id }, 'Block target user not found');
                return reply.status(404).send({ error: 'User not found' });
            }

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
        } catch (error: unknown) {
            fastify.log.error({ error: getErrorMessage(error), stack: error instanceof Error ? error.stack : undefined }, 'Block failed');
            return reply.status(500).send({ error: 'Failed to block user' });
        }
    });

    // Get blocked users
    fastify.get('/me/blocked', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;

        const blocks = await fastify.prisma.userBlock.findMany({
            where: { blockerId: userId },
            include: {
                blocked: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                        era: true,
                        cred: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return { users: blocks.map(b => ({ ...b.blocked, blockedAt: b.createdAt })) };
    });

    // Get muted users
    fastify.get('/me/muted', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const userId = (request.user as { sub: string }).sub;

        const mutes = await fastify.prisma.userMute.findMany({
            where: { muterId: userId },
            include: {
                muted: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                        era: true,
                        cred: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return { users: mutes.map(m => ({ ...m.muted, mutedAt: m.createdAt })) };
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
                    type: NOTIFICATION_TYPES.FOLLOW,
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
            where: { authorId: userId, deletedAt: null },
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

    // Update bot profile (site admin only)
    fastify.patch('/bots/:botId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { botId } = request.params as { botId: string };
        const userId = (request.user as { sub: string }).sub;

        // Check if current user is a site admin
        const currentUser = await fastify.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (currentUser?.role !== 'admin') {
            return reply.status(403).send({ error: 'Only site admins can edit bot profiles' });
        }

        // Verify target is a bot
        const bot = await fastify.prisma.user.findUnique({
            where: { id: botId },
            select: { id: true, isBot: true }
        });

        if (!bot) {
            return reply.status(404).send({ error: 'Bot not found' });
        }

        if (!bot.isBot) {
            return reply.status(400).send({ error: 'Target user is not a bot' });
        }

        const schema = z.object({
            bio: z.string().max(500).optional(),
            avatar: z.string().url().optional().or(z.literal('')),
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
        }

        const { bio, avatar } = parsed.data;
        const updateData: { bio?: string; avatar?: string | null } = {};

        if (bio !== undefined) updateData.bio = bio;
        if (avatar !== undefined) updateData.avatar = avatar || null;

        if (Object.keys(updateData).length === 0) {
            return reply.status(400).send({ error: 'No fields provided to update' });
        }

        const updatedBot = await fastify.prisma.user.update({
            where: { id: botId },
            data: updateData,
            select: {
                id: true,
                username: true,
                avatar: true,
                bio: true,
                isBot: true,
            }
        });

        return { bot: updatedBot };
    });

    // Upload bot avatar (site admin only)
    fastify.post('/bots/:botId/avatar', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { botId } = request.params as { botId: string };
        const userId = (request.user as { sub: string }).sub;

        // Check if current user is a site admin
        const currentUser = await fastify.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (currentUser?.role !== 'admin') {
            return reply.status(403).send({ error: 'Only site admins can edit bot avatars' });
        }

        // Verify target is a bot
        const bot = await fastify.prisma.user.findUnique({
            where: { id: botId },
            select: { id: true, isBot: true, avatar: true }
        });

        if (!bot) {
            return reply.status(404).send({ error: 'Bot not found' });
        }

        if (!bot.isBot) {
            return reply.status(400).send({ error: 'Target user is not a bot' });
        }

        try {
            const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
            if (!data) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(data.mimetype)) {
                return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' });
            }

            const buffer = await data.toBuffer();

            // Import sharp dynamically
            const sharp = (await import('sharp')).default;
            const { randomUUID } = await import('crypto');
            const path = await import('path');
            const fs = await import('fs/promises');

            const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

            // Ensure uploads dir exists
            try {
                await fs.access(UPLOADS_DIR);
            } catch {
                await fs.mkdir(UPLOADS_DIR, { recursive: true });
            }

            // Process avatar: square, resize to 200x200, WebP for smaller files
            const processedImage = await sharp(buffer)
                .flatten({ background: { r: 30, g: 30, b: 46 } })
                .resize(200, 200, { fit: 'cover', position: 'center' })
                .webp({ quality: 80 })
                .toBuffer();

            const filename = `bot_avatar_${botId}_${randomUUID()}.webp`;
            const filepath = path.join(UPLOADS_DIR, filename);

            // Delete old avatar if it's a local upload
            if (bot.avatar && bot.avatar.includes('/uploads/')) {
                const parts = bot.avatar.split('/uploads/');
                const oldFilename = parts[1];
                if (oldFilename) {
                    const oldPath = path.resolve(UPLOADS_DIR, oldFilename);
                    if (oldPath.startsWith(UPLOADS_DIR + path.sep)) {
                        try {
                            await fs.unlink(oldPath);
                        } catch { /* ignore */ }
                    }
                }
            }

            await fs.writeFile(filepath, processedImage);

            // Store relative path - frontend resolves full URL from API base
            const avatarUrl = `/uploads/${filename}`;

            const updatedBot = await fastify.prisma.user.update({
                where: { id: botId },
                data: { avatar: avatarUrl },
                select: {
                    id: true,
                    username: true,
                    avatar: true,
                    bio: true,
                    isBot: true,
                }
            });

            return { success: true, bot: updatedBot, avatarUrl };
        } catch (error: unknown) {
            fastify.log.error({ error }, 'Bot avatar upload error');
            if (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' });
            }
            return reply.status(500).send({ error: 'Failed to upload avatar' });
        }
    });
};

export default usersRoutes;
