import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

// Use localhost for Android emulator (10.0.2.2) or iOS simulator (localhost)
// In production, this would be the actual API URL
const SOCKET_URL = Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://localhost:3000',
    default: 'http://localhost:3000',
});

class SocketManager {
    private socket: Socket | null = null;
    private listeners: Map<string, Function[]> = new Map();

    connect() {
        if (this.socket?.connected) return;

        this.socket = io(SOCKET_URL, {
            transports: ['websocket'],
            autoConnect: true,
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('post:update', (data: any) => {
            this.notifyListeners(`post:${data.postId}`, data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinPost(postId: string) {
        this.socket?.emit('join:post', postId);
    }

    leavePost(postId: string) {
        this.socket?.emit('leave:post', postId);
    }

    subscribeToPost(postId: string, callback: (data: any) => void) {
        const key = `post:${postId}`;
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
            this.joinPost(postId);
        }
        this.listeners.get(key)?.push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
                if (callbacks.length === 0) {
                    this.listeners.delete(key);
                    this.leavePost(postId);
                }
            }
        };
    }

    private notifyListeners(key: string, data: any) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }
}

export const socketManager = new SocketManager();
