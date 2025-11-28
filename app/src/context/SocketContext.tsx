import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/auth';

// Use localhost for Android emulator (10.0.2.2) or iOS simulator (localhost)
const SOCKET_URL = Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://localhost:3000',
    default: 'http://localhost:3000',
});

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    subscribeToPost: (postId: string, callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    subscribeToPost: () => () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { token } = useAuthStore();
    const listenersRef = useRef<Map<string, Function[]>>(new Map());

    useEffect(() => {
        // Don't connect if no token is available
        if (!token) {
            setSocket(null);
            setIsConnected(false);
            return;
        }

        const socketInstance = io(SOCKET_URL, {
            auth: {
                token: token,
            },
            transports: ['websocket'],
            autoConnect: true,
        });

        socketInstance.on('connect', () => {
            console.log('Socket connected:', socketInstance.id);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        // Handle post updates and notify subscribers
        socketInstance.on('post:update', (data: any) => {
            const key = `post:${data.postId}`;
            const callbacks = listenersRef.current.get(key);
            if (callbacks) {
                callbacks.forEach(cb => cb(data));
            }
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
            listenersRef.current.clear();
        };
    }, [token]);

    const subscribeToPost = useCallback((postId: string, callback: (data: any) => void) => {
        const key = `post:${postId}`;

        if (!listenersRef.current.has(key)) {
            listenersRef.current.set(key, []);
            // Join the post room
            socket?.emit('join:post', postId);
        }

        listenersRef.current.get(key)?.push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = listenersRef.current.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
                if (callbacks.length === 0) {
                    listenersRef.current.delete(key);
                    // Leave the post room
                    socket?.emit('leave:post', postId);
                }
            }
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, subscribeToPost }}>
            {children}
        </SocketContext.Provider>
    );
};
