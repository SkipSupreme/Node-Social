import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/auth';
import { API_URL } from '../config';

// Use the same URL logic as the API - production or local
const SOCKET_URL = API_URL;

/** Data payload for post update events from the socket */
interface PostUpdateData {
    postId: string;
    [key: string]: unknown;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    subscribeToPost: (postId: string, callback: (data: PostUpdateData) => void) => () => void;
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
    // Use ref for socket to avoid recreating subscribeToPost on every socket change
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Don't connect if no token is available
        if (!token) {
            socketRef.current = null;
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
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
            console.log('Socket connected:', socketInstance.id);
            setIsConnected(true);

            // Rejoin all rooms on reconnect
            listenersRef.current.forEach((_, key) => {
                const postId = key.replace('post:', '');
                socketInstance.emit('join:post', postId);
            });
        });

        socketInstance.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.log('Socket connection error:', error.message);
        });

        // Handle post updates and notify subscribers
        socketInstance.on('post:update', (data: PostUpdateData) => {
            const key = `post:${data.postId}`;
            const callbacks = listenersRef.current.get(key);
            if (callbacks) {
                callbacks.forEach(cb => cb(data));
            }
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
            socketRef.current = null;
            listenersRef.current.clear();
        };
    }, [token]);

    // Stable subscribeToPost that uses ref instead of socket state
    const subscribeToPost = useCallback((postId: string, callback: (data: PostUpdateData) => void) => {
        const key = `post:${postId}`;

        if (!listenersRef.current.has(key)) {
            listenersRef.current.set(key, []);
            // Join the post room using ref
            socketRef.current?.emit('join:post', postId);
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
                    // Leave the post room using ref
                    socketRef.current?.emit('leave:post', postId);
                }
            }
        };
    }, []); // Empty deps - uses refs internally

    // Memoize context value so consumers (PostCardInner) don't re-render
    // when this provider re-renders for unrelated reasons
    const contextValue = useMemo(
        () => ({ socket, isConnected, subscribeToPost }),
        [socket, isConnected, subscribeToPost]
    );

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};
