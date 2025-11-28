import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Heart, MessageSquare, UserPlus } from '../components/ui/Icons';
import { COLORS } from '../constants/theme';
import { getNotifications, markNotificationsRead } from '../lib/api';

interface NotificationsScreenProps {
    onBack: () => void;
}

const MOCK_NOTIFICATIONS = [
    { id: '1', type: 'like', user: 'joshhunter', content: 'liked your post "Building the future of social"', time: '2m ago' },
    { id: '2', type: 'comment', user: 'sarah_dev', content: 'commented: "This is exactly what we need!"', time: '15m ago' },
    { id: '3', type: 'follow', user: 'crypto_king', content: 'started following you', time: '1h ago' },
    { id: '4', type: 'system', user: 'NodeSocial', content: 'Welcome to the Builder Era!', time: '1d ago' },
];

export const NotificationsScreen = ({ onBack }: NotificationsScreenProps) => {
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications();
            setNotifications(data.notifications || []);
            // Mark as read in background - don't fail if this errors
            markNotificationsRead().catch(err =>
                console.warn('Failed to mark notifications as read:', err)
            );
        } catch (error) {
            console.error('Failed to load notifications:', error);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart size={20} color="#ef4444" fill="#ef4444" />;
            case 'comment': return <MessageSquare size={20} color="#3b82f6" />;
            case 'follow': return <UserPlus size={20} color="#10b981" />;
            default: return <Bell size={20} color={COLORS.node.accent} />;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.item}>
                            <View style={styles.iconContainer}>
                                {getIcon(item.type)}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemText}>
                                    <Text style={{ fontWeight: 'bold' }}>@{item.actor.username}</Text> {item.content}
                                </Text>
                                <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                            {!item.read && <View style={styles.dot} />}
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: COLORS.node.muted }}>No notifications yet.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.node.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderBottomWidth: 1, borderBottomColor: COLORS.node.border,
        backgroundColor: COLORS.node.panel
    },
    backBtn: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    item: {
        flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16,
        backgroundColor: COLORS.node.panel, marginBottom: 8, borderRadius: 12,
        borderWidth: 1, borderColor: COLORS.node.border
    },
    iconContainer: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center'
    },
    itemText: { fontSize: 14, color: COLORS.node.text, lineHeight: 20 },
    time: { fontSize: 12, color: COLORS.node.muted, marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.node.accent }
});
