import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { ArrowLeft, Ban, BellOff, UserX } from 'lucide-react-native';
import { COLORS, ERAS } from '../constants/theme';
import { getBlockedUsers, getMutedUsers, blockUser, muteUser, type BlockedMutedUser } from '../lib/api';
import { showToast } from '../lib/alert';

interface BlockedMutedScreenProps {
    onBack: () => void;
    onUserClick?: (userId: string) => void;
}

type TabType = 'blocked' | 'muted';

export const BlockedMutedScreen: React.FC<BlockedMutedScreenProps> = ({
    onBack,
    onUserClick,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('blocked');
    const [blockedUsers, setBlockedUsers] = useState<BlockedMutedUser[]>([]);
    const [mutedUsers, setMutedUsers] = useState<BlockedMutedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const [blocked, muted] = await Promise.all([
                getBlockedUsers(),
                getMutedUsers(),
            ]);
            setBlockedUsers(blocked.users);
            setMutedUsers(muted.users);
        } catch (error) {
            console.error('Failed to load blocked/muted users:', error);
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (user: BlockedMutedUser) => {
        setActionLoading(user.id);
        try {
            await blockUser(user.id); // Toggle - will unblock
            setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
            showToast(`@${user.username} unblocked`, 'success');
        } catch (error) {
            console.error('Failed to unblock user:', error);
            showToast('Failed to unblock user', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnmute = async (user: BlockedMutedUser) => {
        setActionLoading(user.id);
        try {
            await muteUser(user.id); // Toggle - will unmute
            setMutedUsers(prev => prev.filter(u => u.id !== user.id));
            showToast(`@${user.username} unmuted`, 'success');
        } catch (error) {
            console.error('Failed to unmute user:', error);
            showToast('Failed to unmute user', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const users = activeTab === 'blocked' ? blockedUsers : mutedUsers;
    const handleAction = activeTab === 'blocked' ? handleUnblock : handleUnmute;
    const actionLabel = activeTab === 'blocked' ? 'Unblock' : 'Unmute';
    const emptyMessage = activeTab === 'blocked'
        ? "You haven't blocked anyone"
        : "You haven't muted anyone";

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Blocked & Muted</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'blocked' && styles.tabActive]}
                    onPress={() => setActiveTab('blocked')}
                >
                    <Ban size={18} color={activeTab === 'blocked' ? COLORS.node.accent : COLORS.node.muted} />
                    <Text style={[styles.tabText, activeTab === 'blocked' && styles.tabTextActive]}>
                        Blocked ({blockedUsers.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'muted' && styles.tabActive]}
                    onPress={() => setActiveTab('muted')}
                >
                    <BellOff size={18} color={activeTab === 'muted' ? COLORS.node.accent : COLORS.node.muted} />
                    <Text style={[styles.tabText, activeTab === 'muted' && styles.tabTextActive]}>
                        Muted ({mutedUsers.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            ) : users.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <UserX size={48} color={COLORS.node.muted} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                </View>
            ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {users.map(user => {
                        const eraStyle = ERAS[user.era] || ERAS['Default'];
                        const isLoading = actionLoading === user.id;

                        return (
                            <View key={user.id} style={styles.userRow}>
                                <TouchableOpacity
                                    style={styles.userInfo}
                                    onPress={() => onUserClick?.(user.id)}
                                >
                                    {user.avatar ? (
                                        <Image source={{ uri: user.avatar }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: eraStyle.bg }]}>
                                            <Text style={[styles.avatarText, { color: eraStyle.text }]}>
                                                {user.username?.[0]?.toUpperCase() || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.userDetails}>
                                        <Text style={styles.username}>@{user.username}</Text>
                                        <View style={styles.badges}>
                                            <Text style={[styles.badge, { backgroundColor: eraStyle.bg, color: eraStyle.text }]}>
                                                {user.era}
                                            </Text>
                                            <Text style={styles.credBadge}>{user.cred} Cred</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
                                    onPress={() => handleAction(user)}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color={COLORS.node.accent} />
                                    ) : (
                                        <Text style={styles.actionButtonText}>{actionLabel}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.node.accent,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.muted,
    },
    tabTextActive: {
        color: COLORS.node.accent,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.node.muted,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
    },
    userDetails: {
        flex: 1,
        gap: 4,
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    badges: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        fontSize: 11,
        fontWeight: '500',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    credBadge: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.node.muted,
    },
    actionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: COLORS.node.bgAlt,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        minWidth: 80,
        alignItems: 'center',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
});
