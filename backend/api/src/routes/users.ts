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
                connoisseurCred: true,
                era: true,
                theme: true,
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
            avatar: z.string().url().optional(),
            theme: z.string().optional(),
            customCss: z.string().max(5000).optional(),
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
        }

        const { bio, avatar, theme, customCss } = parsed.data;
        const userId = (request.user as { sub: string }).sub;
        const updateData = {
            ...(bio !== undefined ? { bio } : {}),
            ...(avatar !== undefined ? { avatar } : {}),
            ...(theme !== undefined ? { theme } : {}),
            ...(customCss !== undefined ? { customCss } : {}),
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
                connoisseurCred: true,
                era: true,
                theme: true,
                emailVerified: true,
                createdAt: true,
                customCss: true,
            }
        });

        return { user };
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
};

export default usersRoutes;
