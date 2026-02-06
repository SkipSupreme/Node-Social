import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react-native';
import { api, type Conversation, type Message } from '../lib/api';
import { COLORS } from '../constants/theme';
import { useSocket } from '../context/SocketContext';

/** Participant user info as returned nested in a Conversation */
interface ConversationParticipantUser {
    id: string;
    username: string;
    avatar: string | null;
    firstName?: string;
    lastName?: string;
}

interface MessagesScreenProps {
    onBack: () => void;
    onNavigate: (screen: string, params: Record<string, unknown>) => void;
}

export const MessagesScreen = ({ onBack, onNavigate }: MessagesScreenProps) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('message:new', (message) => {
            fetchConversations();
        });

        return () => {
            socket.off('message:new');
        };
    }, [socket]);

    const fetchConversations = async () => {
        try {
            const res = await api.get<Conversation[]>('/conversations');
            setConversations(res);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: Conversation }) => {
        const otherParticipant = item.participants[0]?.user;
        const lastMessage = item.messages?.[0];

        return (
            <TouchableOpacity
                style={styles.conversationItem}
                onPress={() => onNavigate('chat', { conversationId: item.id, recipient: otherParticipant })}
            >
                <Image source={{ uri: otherParticipant?.avatar || 'https://picsum.photos/200' }} style={styles.avatar} />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.username}>{otherParticipant?.username || 'Unknown'}</Text>
                        <Text style={styles.time}>{lastMessage ? new Date(lastMessage.createdAt).toLocaleDateString() : ''}</Text>
                    </View>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {lastMessage ? lastMessage.content : 'No messages yet'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft color={COLORS.node.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.title}>Messages</Text>
                <TouchableOpacity style={styles.newMsgBtn}>
                    <MessageSquarePlus color={COLORS.node.accent} size={24} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.node.accent} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No messages yet.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.node.bg },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.node.border
    },
    backBtn: { padding: 4 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.node.text },
    newMsgBtn: { padding: 4 },
    list: { padding: 16 },
    conversationItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 12, backgroundColor: COLORS.node.panel,
        borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.node.border
    },
    avatar: { width: 48, height: 48, borderRadius: 12 },
    content: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    username: { fontSize: 16, fontWeight: 'bold', color: COLORS.node.text },
    time: { fontSize: 12, color: COLORS.node.muted },
    lastMessage: { fontSize: 14, color: COLORS.node.muted },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: COLORS.node.muted, fontSize: 16 }
});
