import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send } from 'lucide-react-native';
import { api, type Message } from '../lib/api';
import { useAppTheme } from '../hooks/useTheme';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../store/auth';

/** Minimal recipient info passed from the messages screen */
interface ChatRecipient {
    id: string;
    username: string;
    avatar: string | null;
}

interface ChatScreenProps {
    onBack: () => void;
    conversationId: string;
    recipient: ChatRecipient;
}

export const ChatScreen = ({ onBack, conversationId, recipient }: ChatScreenProps) => {
    const theme = useAppTheme();
    const { user: currentUser } = useAuthStore();
    const { socket } = useSocket();

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchMessages();

        if (socket) {
            socket.emit('join_room', `conversation:${conversationId}`);

            socket.on('message:new', (message: Message) => {
                if (message.conversationId === conversationId) {
                    setMessages(prev => [...prev, message]);
                    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
                }
            });
        }

        return () => {
            if (socket) {
                socket.emit('leave_room', `conversation:${conversationId}`);
                socket.off('message:new');
            }
        };
    }, [conversationId, socket]);

    const fetchMessages = async () => {
        try {
            const res = await api.get<Message[]>(`/conversations/${conversationId}`);
            setMessages(res);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    };

    const sendMessage = async () => {
        if (!text.trim() || !currentUser) return;

        // const tempId = Date.now().toString();
        // const tempMsg = {
        //     id: tempId,
        //     content: text,
        //     senderId: currentUser.id,
        //     createdAt: new Date().toISOString(),
        //     sender: currentUser
        // };

        // Optimistic update removed for simplicity as per thought process
        // setMessages(prev => [...prev, tempMsg]);
        setText('');
        // setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

        try {
            await api.post(`/conversations/${conversationId}/messages`, { content: text });
            // Socket will handle the update
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = currentUser && item.senderId === currentUser.id;
        return (
            <View style={[styles.msgContainer, isMe ? styles.msgRight : styles.msgLeft]}>
                {!isMe && <Image source={{ uri: item.sender?.avatar || 'https://picsum.photos/200' }} style={styles.avatarSmall} />}
                <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft, { backgroundColor: theme.panel }, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.msgText, isMe ? styles.textRight : styles.textLeft, { color: theme.text }]}>{item.content}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.panel }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Image source={{ uri: recipient?.avatar || 'https://picsum.photos/200' }} style={styles.avatarHeader} />
                    <Text style={[styles.username, { color: theme.text }]}>{recipient?.username || 'Chat'}</Text>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                <View style={[styles.inputBar, { borderTopColor: theme.border, backgroundColor: theme.panel }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.muted}
                        value={text}
                        onChangeText={setText}
                        onSubmitEditing={sendMessage}
                    />
                    <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                        <Send color={theme.accent} size={20} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 8 },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 },
    avatarHeader: { width: 32, height: 32, borderRadius: 8 },
    username: { fontSize: 16, fontWeight: 'bold' },
    list: { padding: 16, paddingBottom: 20 },
    msgContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
    msgLeft: { alignSelf: 'flex-start' },
    msgRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    avatarSmall: { width: 24, height: 24, borderRadius: 6 },
    bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
    bubbleLeft: { borderBottomLeftRadius: 4 },
    bubbleRight: { borderBottomRightRadius: 4 },
    msgText: { fontSize: 16 },
    textLeft: {},
    textRight: { color: '#fff' },
    inputBar: {
        flexDirection: 'row', padding: 12, gap: 12,
        borderTopWidth: 1,
    },
    input: {
        flex: 1, borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center', alignItems: 'center'
    }
});
