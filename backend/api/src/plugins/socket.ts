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
        transports: ['websocket'],          // Skip HTTP long-polling; connect via WebSocket directly
        pingInterval: 25_000,
        pingTimeout: 20_000,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,   // Re-deliver missed events within 2 min
            skipMiddlewares: true,
        },
    });

    // Initialize SocketService
    initSocketService(io);

    io.on('connection', (socket: Socket) => {
        fastify.log.debug(`Socket connected: ${socket.id}`);

        socket.on('join_room', (room: string) => {
            socket.join(room);
            fastify.log.debug(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on('leave_room', (room: string) => {
            socket.leave(room);
            fastify.log.debug(`Socket ${socket.id} left room ${room}`);
        });

        socket.on('disconnect', () => {
            fastify.log.debug(`Socket disconnected: ${socket.id}`);
        });
    });

    fastify.decorate('io', io);

    fastify.addHook('onClose', (instance, done) => {
        instance.io.close();
        done();
    });
});
