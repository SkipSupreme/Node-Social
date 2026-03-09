import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../lib/constants.js';

interface UserPayload {
    id: string;
    username: string;
}

export default async function messagesRoutes(app: FastifyInstance) {
    // Get all conversations for the current user
    app.get('/conversations', { onRequest: [app.authenticate] }, async (req, reply) => {
        const user = req.user as unknown as UserPayload;
        const userId = user.id;

        const conversations = await app.prisma.conversation.findMany({
            where: {
                participants: {
                    some: { userId },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return conversations;
    });

    // Get messages for a specific conversation
    app.get('/conversations/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
        const user = req.user as unknown as UserPayload;
        const userId = user.id;
        const { id } = req.params as { id: string };

        // Verify participation
        const participation = await app.prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: id,
                    userId,
                },
            },
        });

        if (!participation) {
            return reply.status(403).send({ error: 'Not a participant' });
        }

        const messages = await app.prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                    },
                },
            },
        });

        return messages;
    });

    // Start a new conversation
    app.post('/conversations', { onRequest: [app.authenticate] }, async (req, reply) => {
        const user = req.user as unknown as UserPayload;
        const userId = user.id;
        const recipientParsed = z.object({ recipientId: z.string().uuid() }).safeParse(req.body);
        if (!recipientParsed.success) {
            return reply.status(400).send({ error: 'Invalid input' });
        }
        const { recipientId } = recipientParsed.data;

        if (userId === recipientId) {
            return reply.status(400).send({ error: 'Cannot message yourself' });
        }

        // Check if conversation already exists
        // This is a bit complex in Prisma, simplified approach: find conversations where both are participants
        // For 1-on-1 chats, we might want to enforce uniqueness, but for now let's allow multiple or just create new
        // Better: Find if there is a conversation with EXACTLY these two participants

        // Quick check for existing 1-on-1
        const existing = await app.prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { userId } } },
                    { participants: { some: { userId: recipientId } } },
                ],
            },
        });

        if (existing) {
            return existing;
        }

        const conversation = await app.prisma.conversation.create({
            data: {
                participants: {
                    create: [
                        { userId },
                        { userId: recipientId },
                    ],
                },
            },
        });

        return conversation;
    });

    // Send a message
    app.post('/conversations/:id/messages', { onRequest: [app.authenticate] }, async (req, reply) => {
        const user = req.user as unknown as UserPayload;
        const userId = user.id;
        const { id } = req.params as { id: string };
        const bodyParsed = z.object({ content: z.string().min(1).max(10000) }).safeParse(req.body);
        if (!bodyParsed.success) {
            return reply.status(400).send({ error: 'Invalid input' });
        }
        const { content } = bodyParsed.data;

        // Verify participation
        const participation = await app.prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: id,
                    userId,
                },
            },
        });

        if (!participation) {
            return reply.status(403).send({ error: 'Not a participant' });
        }

        const message = await app.prisma.message.create({
            data: {
                conversationId: id,
                senderId: userId,
                content,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                    },
                },
            },
        });

        await app.prisma.conversation.update({
            where: { id },
            data: { updatedAt: new Date() },
        });

        // Emit socket event
        app.io.to(`conversation:${id}`).emit('message:new', message);

        // Notify recipient(s)
        const otherParticipants = await app.prisma.conversationParticipant.findMany({
            where: { conversationId: id, userId: { not: userId } }
        });

        for (const p of otherParticipants) {
            app.io.to(`user:${p.userId}`).emit('notification:new', {
                type: NOTIFICATION_TYPES.MESSAGE,
                content: `New message from ${user.username}`,
                conversationId: id
            });
        }

        return message;
    });
}
