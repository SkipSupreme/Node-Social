import type { FastifyPluginAsync } from 'fastify';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
    // Get notifications
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const userId = (request.user as { sub: string }).sub;

            const notifications = await fastify.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    actor: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true,
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            });

            return reply.send({ notifications });
        }
    );

    // Mark all as read
    fastify.post(
        '/read-all',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            const userId = (request.user as { sub: string }).sub;

            await fastify.prisma.notification.updateMany({
                where: { userId, read: false },
                data: { read: true }
            });

            return reply.send({ success: true });
        }
    );
};

export default notificationRoutes;
