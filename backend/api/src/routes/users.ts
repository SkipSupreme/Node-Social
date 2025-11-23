import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
    // Get current user profile
    fastify.get('/me', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = await fastify.prisma.user.findUnique({
            where: { id: request.user.sub },
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
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
        }

        const { bio, avatar, theme } = parsed.data;

        const user = await fastify.prisma.user.update({
            where: { id: request.user.sub },
            data: {
                bio,
                avatar,
                theme,
            },
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
            }
        });

        return { user };
    });
};

export default usersRoutes;
