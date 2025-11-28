import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import { updateProfile, getUserCredHistory, getUserPosts } from '../lib/api';
import { ArrowLeft, Edit2, Share2, ChevronRight, Hexagon, Award, Users, TrendingUp, Clock, MessageSquare, Heart } from 'lucide-react-native';
import { ERAS, COLORS } from '../constants/theme';

interface CredBreakdown {
    nodeId: string;
    nodeName: string;
    nodeSlug: string;
    cred: number;
}

interface RecentActivity {
    id: string;
    type: 'post' | 'comment' | 'reaction';
    title: string;
    timestamp: string;
    node?: string;
}

interface ProfileScreenProps {
    onBack: () => void;
    user?: any;
    isEditable?: boolean;
    onCredClick?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, user: propUser, isEditable = false, onCredClick }) => {
    const { user: authUser, updateUser } = useAuthStore();
    const user = propUser || authUser;
    const canEdit = isEditable || (authUser && user && authUser.id === user.id);

    const [loading, setLoading] = useState(false);
    const [credBreakdown, setCredBreakdown] = useState<CredBreakdown[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Fetch user's cred breakdown by node and recent activity
    useEffect(() => {
        const fetchProfileData = async () => {
            if (!user?.id) return;
            setLoadingData(true);
            try {
                // Fetch cred history to get breakdown by node
                const credHistory = await getUserCredHistory(user.id);

                // Aggregate cred by node
                const nodeCredMap = new Map<string, { nodeName: string; nodeSlug: string; cred: number }>();
                credHistory.forEach((entry: any) => {
                    if (entry.node) {
                        const existing = nodeCredMap.get(entry.node.id) || {
                            nodeName: entry.node.name,
                            nodeSlug: entry.node.slug,
                            cred: 0
                        };
                        existing.cred += entry.amount;
                        nodeCredMap.set(entry.node.id, existing);
                    }
                });

                const breakdown: CredBreakdown[] = Array.from(nodeCredMap.entries())
                    .map(([nodeId, data]) => ({
                        nodeId,
                        nodeName: data.nodeName,
                        nodeSlug: data.nodeSlug,
                        cred: data.cred
                    }))
                    .sort((a, b) => b.cred - a.cred)
                    .slice(0, 5); // Top 5 nodes

                setCredBreakdown(breakdown);

                // Fetch recent posts for activity
                const posts = await getUserPosts(user.id, 5);
                const activities: RecentActivity[] = posts.map((p: any) => ({
                    id: p.id,
                    type: 'post' as const,
                    title: p.title,
                    timestamp: p.createdAt,
                    node: p.node?.name
                }));
                setRecentActivity(activities);

            } catch (error) {
                console.error('Failed to fetch profile data:', error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchProfileData();
    }, [user?.id]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out @${user?.username} on Node Social!`,
                url: `https://nodesocial.app/u/${user?.username}`,
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    const timeAgo = (date: string) => {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now.getTime() - past.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 7) return past.toLocaleDateString();
        if (diffDay > 0) return `${diffDay}d ago`;
        if (diffHour > 0) return `${diffHour}h ago`;
        if (diffMin > 0) return `${diffMin}m ago`;
        return 'Just now';
    };

    if (!user) return null;

    const totalCred = user.cred || 0;
    const maxNodeCred = credBreakdown.length > 0 ? Math.max(...credBreakdown.map(n => n.cred)) : 1;
    const eraStyle = ERAS[user.era] || ERAS['Default'];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft color={COLORS.node.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    {/* Avatar */}
                    <View style={styles.avatarWrapper}>
                        <View style={[styles.avatar, { borderColor: COLORS.node.accent }]}>
                            {user.avatar ? (
                                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user.firstName?.[0]}{user.lastName?.[0] || user.username?.[0]}
                                </Text>
                            )}
                        </View>
                        {/* Era Badge on Avatar */}
                        <View style={[styles.eraBadgeCorner, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border }]}>
                            <Hexagon size={12} color={eraStyle.text} fill={eraStyle.text} />
                        </View>
                    </View>

                    {/* Name & Username */}
                    <Text style={styles.displayName}>
                        {user.firstName || user.username}
                    </Text>
                    <View style={styles.usernameRow}>
                        <View style={[styles.eraBadge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border }]}>
                            <Text style={[styles.eraBadgeText, { color: eraStyle.text }]}>{user.era || 'Explorer'}</Text>
                        </View>
                        <Text style={styles.username}>@{user.username}</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        {canEdit && (
                            <TouchableOpacity style={styles.editButton}>
                                <Edit2 size={16} color={COLORS.node.text} />
                                <Text style={styles.editButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                            <Share2 size={16} color={COLORS.node.accent} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Cred Section */}
                <TouchableOpacity
                    style={styles.credSection}
                    onPress={onCredClick}
                    activeOpacity={onCredClick ? 0.7 : 1}
                >
                    <View style={styles.credHeader}>
                        <View style={styles.credTitleRow}>
                            <Award size={20} color="#fbbf24" />
                            <Text style={styles.credTitle}>ConnoisseurCred</Text>
                        </View>
                        <View style={styles.totalCredBadge}>
                            <Text style={styles.totalCredValue}>{totalCred}</Text>
                            <Text style={styles.totalCredLabel}>Total Cred</Text>
                        </View>
                    </View>

                    {/* Top Nodes Breakdown */}
                    {credBreakdown.length > 0 && (
                        <View style={styles.nodesBreakdown}>
                            <Text style={styles.sectionSubtitle}>Top Nodes</Text>
                            {credBreakdown.map((node, idx) => (
                                <View key={node.nodeId} style={styles.nodeRow}>
                                    <View style={styles.nodeInfo}>
                                        <View style={[styles.nodeRankBadge, idx === 0 && styles.nodeRankGold]}>
                                            <Text style={styles.nodeRankText}>{idx + 1}</Text>
                                        </View>
                                        <Text style={styles.nodeName}>n/{node.nodeSlug}</Text>
                                    </View>
                                    <View style={styles.nodeCredContainer}>
                                        <View style={styles.nodeCredBarBg}>
                                            <View
                                                style={[
                                                    styles.nodeCredBar,
                                                    { width: `${(node.cred / maxNodeCred) * 100}%` }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.nodeCredValue}>{node.cred}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {onCredClick && (
                        <View style={styles.viewMoreRow}>
                            <Text style={styles.viewMoreText}>View Full History</Text>
                            <ChevronRight size={16} color={COLORS.node.accent} />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <TrendingUp size={20} color={COLORS.node.accent} />
                        <Text style={styles.statValue}>{user.multiplier || 100}%</Text>
                        <Text style={styles.statLabel}>Multiplier</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Heart size={20} color="#f87171" />
                        <Text style={styles.statValue}>{user.receivedReactions || 0}</Text>
                        <Text style={styles.statLabel}>Received</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Users size={20} color="#34d399" />
                        <Text style={styles.statValue}>{user.councilVotes || 0}</Text>
                        <Text style={styles.statLabel}>Council</Text>
                    </View>
                </View>

                {/* Recent Activity */}
                {recentActivity.length > 0 && (
                    <View style={styles.activitySection}>
                        <View style={styles.activityHeader}>
                            <Clock size={18} color={COLORS.node.muted} />
                            <Text style={styles.activityTitle}>Recent Activity</Text>
                        </View>
                        {recentActivity.map((activity) => (
                            <View key={activity.id} style={styles.activityItem}>
                                <View style={styles.activityIcon}>
                                    {activity.type === 'post' && <MessageSquare size={14} color={COLORS.node.accent} />}
                                    {activity.type === 'comment' && <MessageSquare size={14} color="#34d399" />}
                                    {activity.type === 'reaction' && <Heart size={14} color="#f87171" />}
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={styles.activityText} numberOfLines={1}>
                                        {activity.title}
                                    </Text>
                                    <View style={styles.activityMeta}>
                                        {activity.node && (
                                            <Text style={styles.activityNode}>{activity.node}</Text>
                                        )}
                                        <Text style={styles.activityTime}>{timeAgo(activity.timestamp)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutButton} onPress={() => useAuthStore.getState().logout()}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
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
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    content: {
        padding: 16,
        paddingBottom: 100,
    },
    // Profile Card
    profileCard: {
        alignItems: 'center',
        backgroundColor: COLORS.node.panel,
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.node.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 48,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
    },
    eraBadgeCorner: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    displayName: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.node.text,
        marginBottom: 8,
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
    },
    eraBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    eraBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    username: {
        fontSize: 14,
        color: COLORS.node.muted,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.node.bg,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    shareButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: `${COLORS.node.accent}20`,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    // Cred Section
    credSection: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    credHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    credTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    credTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    totalCredBadge: {
        alignItems: 'flex-end',
    },
    totalCredValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fbbf24',
    },
    totalCredLabel: {
        fontSize: 11,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nodesBreakdown: {
        gap: 12,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    nodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nodeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    nodeRankBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nodeRankGold: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
    },
    nodeRankText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.node.text,
    },
    nodeName: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.text,
    },
    nodeCredContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        maxWidth: 150,
    },
    nodeCredBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.node.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    nodeCredBar: {
        height: '100%',
        backgroundColor: COLORS.node.accent,
        borderRadius: 3,
    },
    nodeCredValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.node.text,
        width: 40,
        textAlign: 'right',
    },
    viewMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.node.border,
    },
    viewMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.node.text,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Activity Section
    activitySection: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    activityIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.node.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityContent: {
        flex: 1,
    },
    activityText: {
        fontSize: 14,
        color: COLORS.node.text,
        marginBottom: 4,
    },
    activityMeta: {
        flexDirection: 'row',
        gap: 8,
    },
    activityNode: {
        fontSize: 12,
        color: COLORS.node.accent,
    },
    activityTime: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    // Sign Out
    signOutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});
