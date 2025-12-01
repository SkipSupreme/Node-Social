import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Heart, MessageSquare, UserPlus, AlertTriangle, Ban, Trash2 } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { getNotifications, markNotificationsRead } from '../lib/api';

interface NotificationsScreenProps {
    onBack: () => void;
    onNavigateToPost?: (postId: string) => void;
    onNavigateToUser?: (userId: string) => void;
}

export const NotificationsScreen = ({ onBack, onNavigateToPost, onNavigateToUser }: NotificationsScreenProps) => {
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
            case 'warning': return <AlertTriangle size={20} color="#f59e0b" />;
            case 'mod_removed': return <Trash2 size={20} color="#ef4444" />;
            case 'banned': return <Ban size={20} color="#ef4444" />;
            default: return <Bell size={20} color={COLORS.node.accent} />;
        }
    };

    const getNotificationContent = (item: any) => {
        // For mod notifications, the content field contains the reason/message
        if (item.type === 'warning' || item.type === 'mod_removed' || item.type === 'banned') {
            return item.content;
        }
        // For social notifications, show actor's action
        return item.content;
    };

    const getNotificationPrefix = (item: any) => {
        switch (item.type) {
            case 'warning': return '⚠️ Warning: ';
            case 'mod_removed': return '🗑️ Post removed: ';
            case 'banned': return '🚫 Banned: ';
            default: return `@${item.actor?.username} `;
        }
    };

    const handleNotificationPress = (item: any) => {
        if (item.postId && onNavigateToPost) {
            onNavigateToPost(item.postId);
        } else if (item.actor?.id && onNavigateToUser) {
            onNavigateToUser(item.actor.id);
        }
    };

    const isClickable = (item: any) => {
        return (item.postId && onNavigateToPost) || (item.actor?.id && onNavigateToUser);
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
                    renderItem={({ item }) => {
                        const isModNotification = ['warning', 'mod_removed', 'banned'].includes(item.type);
                        const clickable = isClickable(item);

                        return (
                            <TouchableOpacity
                                style={[
                                    styles.item,
                                    isModNotification && styles.modItem,
                                    clickable && styles.clickableItem,
                                ]}
                                onPress={() => handleNotificationPress(item)}
                                disabled={!clickable}
                            >
                                <View style={[
                                    styles.iconContainer,
                                    isModNotification && styles.modIconContainer,
                                ]}>
                                    {getIcon(item.type)}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.itemText, isModNotification && styles.modItemText]}>
                                        {isModNotification ? (
                                            <>
                                                <Text style={{ fontWeight: 'bold' }}>{getNotificationPrefix(item)}</Text>
                                                {getNotificationContent(item)}
                                            </>
                                        ) : (
                                            <>
                                                <Text style={{ fontWeight: 'bold' }}>@{item.actor?.username}</Text> {item.content}
                                            </>
                                        )}
                                    </Text>
                                    <View style={styles.metaRow}>
                                        <Text style={styles.time}>
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </Text>
                                        {clickable && (
                                            <Text style={styles.viewLink}>
                                                {item.postId ? 'View post →' : 'View profile →'}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                {!item.read && <View style={styles.dot} />}
                            </TouchableOpacity>
                        );
                    }}
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
    modItem: {
        borderColor: '#f59e0b',
        borderLeftWidth: 3,
    },
    clickableItem: {
        opacity: 1,
    },
    iconContainer: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center'
    },
    modIconContainer: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    itemText: { fontSize: 14, color: COLORS.node.text, lineHeight: 20 },
    modItemText: {
        color: '#fbbf24',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 12,
    },
    time: { fontSize: 12, color: COLORS.node.muted },
    viewLink: {
        fontSize: 12,
        color: COLORS.node.accent,
        fontWeight: '500',
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.node.accent }
});
