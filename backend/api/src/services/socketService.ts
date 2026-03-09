import type { FastifyInstance } from 'fastify';
import { Server, Socket } from 'socket.io';

export class SocketService {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
        this.setupConnectionHandler();
    }

    private setupConnectionHandler() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // User room — clients emit join:user with their userId after connecting
            // so they can receive notification:new events
            socket.on('join:user', (userId: string) => {
                socket.join(`user:${userId}`);
            });

            socket.on('leave:user', (userId: string) => {
                socket.leave(`user:${userId}`);
            });

            socket.on('join:post', (postId: string) => {
                socket.join(`post:${postId}`);
            });

            socket.on('leave:post', (postId: string) => {
                socket.leave(`post:${postId}`);
            });

            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    public emitPostUpdate(postId: string, data: any) {
        this.io.to(`post:${postId}`).emit('post:update', data);
    }
}

let socketService: SocketService | null = null;

export const initSocketService = (io: Server) => {
    socketService = new SocketService(io);
    return socketService;
};

export const getSocketService = () => {
    if (!socketService) {
        throw new Error('SocketService not initialized');
    }
    return socketService;
};
