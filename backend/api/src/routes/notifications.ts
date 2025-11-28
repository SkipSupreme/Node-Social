import type { FastifyPluginAsync } from 'fastify';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
    // Get notifications
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            try {
                const userId = (request.user as { sub: string })?.sub;

                if (!userId) {
                    return reply.status(401).send({ error: 'User not authenticated' });
                }

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
            } catch (error) {
                fastify.log.error({ error }, 'Failed to fetch notifications');
                return reply.status(500).send({ error: 'Failed to fetch notifications' });
            }
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
