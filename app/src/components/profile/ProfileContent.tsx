import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
    ScrollView,
} from 'react-native';
import { MessageSquare, TrendingUp } from 'lucide-react-native';
import { ERAS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import { getUserPosts, getUserComments, getUserCredHistory, type UserComment, type Post } from '../../lib/api';
import { PostCard } from '../PostCard';

// Vibe vector definitions
const VIBE_VECTORS = [
    { key: 'insightful', label: 'Insightful', emoji: '💡', color: '#f59e0b' },
    { key: 'joy', label: 'Joy', emoji: '😂', color: '#ec4899' },
    { key: 'fire', label: 'Fire', emoji: '🔥', color: '#ef4444' },
    { key: 'support', label: 'Support', emoji: '💚', color: '#22c55e' },
    { key: 'shock', label: 'Shock', emoji: '😱', color: '#8b5cf6' },
    { key: 'questionable', label: 'Questionable', emoji: '🤔', color: '#6b7280' },
];

interface CredTransaction {
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
    node?: { id: string; name: string; slug: string };
}

interface ProfileContentProps {
    userId: string;
    eraStyle: typeof ERAS[keyof typeof ERAS];
    onPostPress?: (postId: string) => void;
    onAuthorClick?: (authorId: string) => void;
}

type TabType = 'posts' | 'replies' | 'media' | 'vibes' | 'cred';

const timeAgo = (date: string): string => {
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
    return 'now';
};

// Reply card component
const ReplyCard: React.FC<{
    comment: UserComment;
    onPress?: () => void;
}> = ({ comment, onPress }) => {
    const theme = useAppTheme();
    return (
        <TouchableOpacity
            style={[styles.replyCard, { backgroundColor: theme.panel, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.replyHeader}>
                <MessageSquare size={14} color={theme.muted} />
                <Text style={[styles.replyTime, { color: theme.muted }]}>{timeAgo(comment.createdAt)}</Text>
            </View>

            <Text style={[styles.replyContent, { color: theme.text }]} numberOfLines={3}>
                {comment.content}
            </Text>

            {comment.post && (
                <View style={[styles.replyContext, { borderTopColor: theme.border }]}>
                    <Text style={[styles.replyLabel, { color: theme.muted }]}>on</Text>
                    <Text style={[styles.replyPostTitle, { color: theme.text }]} numberOfLines={1}>
                        {comment.post.title || comment.post.content?.slice(0, 50) || 'a post'}
                    </Text>
                    {comment.post.node && (
                        <Text style={[styles.replyNode, { color: theme.accent }]}>in n/{comment.post.node.slug}</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

// Cred transaction card
const CredCard: React.FC<{
    transaction: CredTransaction;
}> = ({ transaction }) => {
    const theme = useAppTheme();
    return (
        <View style={[styles.credCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <View style={styles.credLeft}>
                <View style={[styles.credIcon, { backgroundColor: transaction.amount > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <TrendingUp size={14} color={transaction.amount > 0 ? '#22c55e' : '#ef4444'} />
                </View>
                <View style={styles.credInfo}>
                    <Text style={[styles.credReason, { color: theme.text }]}>{transaction.reason || 'Cred transaction'}</Text>
                    <Text style={[styles.credTime, { color: theme.muted }]}>{timeAgo(transaction.createdAt)}</Text>
                </View>
            </View>
            <Text style={[styles.credAmount, { color: transaction.amount > 0 ? '#22c55e' : '#ef4444' }]}>
                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
            </Text>
        </View>
    );
};

// Aggregate vibes from posts
interface AggregatedVibes {
    [key: string]: { sum: number; count: number };
}

export const ProfileContent: React.FC<ProfileContentProps> = ({
    userId,
    eraStyle,
    onPostPress,
    onAuthorClick,
}) => {
    const theme = useAppTheme();
    const [activeTab, setActiveTab] = useState<TabType>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [replies, setReplies] = useState<UserComment[]>([]);
    const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
    const [credHistory, setCredHistory] = useState<CredTransaction[]>([]);
    const [aggregatedVibes, setAggregatedVibes] = useState<AggregatedVibes>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const [postsData, commentsData, credData] = await Promise.all([
                    getUserPosts(userId, 50),
                    getUserComments(userId, 50),
                    getUserCredHistory(userId),
                ]);
                setPosts(postsData);
                setReplies(commentsData.comments);
                // Filter posts that have media (linkMeta.image)
                setMediaPosts(postsData.filter((p: Post) => p.linkMeta?.image));
                setCredHistory(credData);

                // Aggregate vibe reactions from posts
                const vibes: AggregatedVibes = {};
                VIBE_VECTORS.forEach(v => {
                    vibes[v.key] = { sum: 0, count: 0 };
                });

                postsData.forEach((post) => {
                    const postWithVibes = post as Post & { vibeAggregate?: Record<string, number> };
                    if (postWithVibes.vibeAggregate) {
                        const agg = postWithVibes.vibeAggregate;
                        if (agg.insightfulSum) { vibes.insightful.sum += agg.insightfulSum; vibes.insightful.count += agg.insightfulCount || 0; }
                        if (agg.joySum) { vibes.joy.sum += agg.joySum; vibes.joy.count += agg.joyCount || 0; }
                        if (agg.fireSum) { vibes.fire.sum += agg.fireSum; vibes.fire.count += agg.fireCount || 0; }
                        if (agg.supportSum) { vibes.support.sum += agg.supportSum; vibes.support.count += agg.supportCount || 0; }
                        if (agg.shockSum) { vibes.shock.sum += agg.shockSum; vibes.shock.count += agg.shockCount || 0; }
                        if (agg.questionableSum) { vibes.questionable.sum += agg.questionableSum; vibes.questionable.count += agg.questionableCount || 0; }
                    }
                });
                setAggregatedVibes(vibes);
            } catch (error) {
                console.error('Failed to fetch profile content:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [userId]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
    };

    // Tab configurations
    const tabs: { id: TabType; label: string }[] = [
        { id: 'posts', label: 'Posts' },
        { id: 'replies', label: 'Replies' },
        { id: 'media', label: 'Media' },
        { id: 'vibes', label: 'Vibes' },
        { id: 'cred', label: 'Cred' },
    ];

    // Check if vibes have any data
    const totalVibes = Object.values(aggregatedVibes).reduce((acc, v) => acc + v.count, 0);

    // Render content based on active tab
    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={eraStyle.text} />
                </View>
            );
        }

        switch (activeTab) {
            case 'posts':
                if (posts.length === 0) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No posts yet</Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.contentList}>
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                onPress={() => onPostPress?.(post.id)}
                                onAuthorClick={onAuthorClick}
                            />
                        ))}
                    </View>
                );

            case 'replies':
                if (replies.length === 0) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No replies yet</Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.contentList}>
                        {replies.map((comment) => (
                            <ReplyCard
                                key={comment.id}
                                comment={comment}
                                onPress={() => onPostPress?.(comment.post.id)}
                            />
                        ))}
                    </View>
                );

            case 'media':
                if (mediaPosts.length === 0) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No media yet</Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.mediaGrid}>
                        {mediaPosts.map((post) => (
                            <TouchableOpacity
                                key={post.id}
                                style={[styles.mediaCard, { backgroundColor: theme.border }]}
                                onPress={() => onPostPress?.(post.id)}
                                activeOpacity={0.85}
                            >
                                <Image
                                    source={{ uri: post.linkMeta?.image }}
                                    style={styles.mediaImage}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 'vibes':
                if (totalVibes === 0) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No vibe reactions yet</Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.vibesGrid}>
                        {VIBE_VECTORS.map((vibe) => {
                            const data = aggregatedVibes[vibe.key];
                            if (!data || data.count === 0) return null;
                            return (
                                <View key={vibe.key} style={[styles.vibeCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                                    <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
                                    <Text style={[styles.vibeCount, { color: vibe.color }]}>
                                        {data.count}
                                    </Text>
                                    <Text style={[styles.vibeLabel, { color: theme.text }]}>{vibe.label}</Text>
                                    <Text style={[styles.vibeIntensity, { color: theme.muted }]}>
                                        {Math.round(data.sum / data.count * 10) / 10} avg
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                );

            case 'cred':
                if (credHistory.length === 0) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No cred history yet</Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.credList}>
                        {credHistory.map((tx: CredTransaction) => (
                            <CredCard key={tx.id} transaction={tx} />
                        ))}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Tab Bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.tabScrollView, { borderBottomColor: theme.border }]}
                contentContainerStyle={styles.tabBar}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => handleTabChange(tab.id)}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: theme.muted },
                                isActive && [styles.tabTextActive, { color: theme.text }],
                            ]}>
                                {tab.label}
                            </Text>
                            {isActive && (
                                <View style={[styles.tabUnderline, { backgroundColor: theme.accent }]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Content */}
            <View style={styles.content}>
                {renderContent()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabScrollView: {
        borderBottomWidth: 1,
    },
    tabBar: {
        flexDirection: 'row',
    },
    tab: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        position: 'relative',
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    tabActive: {},
    tabText: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '500',
    },
    tabTextActive: {
        fontWeight: '700',
    },
    tabUnderline: {
        position: 'absolute',
        bottom: 0,
        left: SPACING.lg,
        right: SPACING.lg,
        height: 3,
        borderRadius: 2,
    },
    content: {
        paddingTop: SPACING.md,
    },
    loadingContainer: {
        paddingVertical: SPACING.xxxl,
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: SPACING.xxxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: TYPOGRAPHY.sizes.body,
    },
    contentList: {
        gap: SPACING.md,
    },
    // Reply card
    replyCard: {
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
    },
    replyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    replyTime: {
        fontSize: TYPOGRAPHY.sizes.xs,
    },
    replyContent: {
        fontSize: TYPOGRAPHY.sizes.body,
        lineHeight: TYPOGRAPHY.sizes.body * 1.5,
    },
    replyContext: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
    },
    replyLabel: {
        fontSize: TYPOGRAPHY.sizes.small,
    },
    replyPostTitle: {
        fontSize: TYPOGRAPHY.sizes.small,
        fontWeight: '500',
        flex: 1,
    },
    replyNode: {
        fontSize: TYPOGRAPHY.sizes.xs,
    },
    // Media grid
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    mediaCard: {
        width: '31%',
        aspectRatio: 1,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    // Vibes grid
    vibesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
    },
    vibeCard: {
        width: '30%',
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
    },
    vibeEmoji: {
        fontSize: 32,
        marginBottom: SPACING.xs,
    },
    vibeCount: {
        fontSize: TYPOGRAPHY.sizes.h3,
        fontWeight: '800',
    },
    vibeLabel: {
        fontSize: TYPOGRAPHY.sizes.small,
        fontWeight: '600',
        marginTop: SPACING.xs,
    },
    vibeIntensity: {
        fontSize: TYPOGRAPHY.sizes.xs,
        marginTop: 2,
    },
    // Cred list
    credList: {
        gap: SPACING.sm,
    },
    credCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
    },
    credLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        flex: 1,
    },
    credIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    credInfo: {
        flex: 1,
    },
    credReason: {
        fontSize: TYPOGRAPHY.sizes.small,
        fontWeight: '500',
    },
    credTime: {
        fontSize: TYPOGRAPHY.sizes.xs,
        marginTop: 2,
    },
    credAmount: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
    },
});

export default ProfileContent;
