import fp from 'fastify-plugin';
import { Server, Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { initSocketService } from '../services/socketService.js';

declare module 'fastify' {
    interface FastifyInstance {
        io: Server;
    }
}

export default fp(async (fastify: FastifyInstance) => {
    const io = new Server(fastify.server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // Initialize SocketService
    initSocketService(io);

    io.on('connection', (socket: Socket) => {
        fastify.log.info(`Socket connected: ${socket.id}`);

        socket.on('join_room', (room: string) => {
            socket.join(room);
            fastify.log.info(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on('leave_room', (room: string) => {
            socket.leave(room);
            fastify.log.info(`Socket ${socket.id} left room ${room}`);
        });

        socket.on('disconnect', () => {
            fastify.log.info(`Socket disconnected: ${socket.id}`);
        });
    });

    fastify.decorate('io', io);

    fastify.addHook('onClose', (instance, done) => {
        instance.io.close();
        done();
    });
});
