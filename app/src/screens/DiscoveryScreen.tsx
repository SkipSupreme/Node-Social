import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ArrowLeft, TrendingUp, Hash, User, FileText, Bot } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { searchPosts, searchUsers, getFeed, Post, SearchUser } from '../lib/api';
import { PostCard } from '../components/PostCard';

const PAGE_SIZE = 20;

type SearchTab = 'posts' | 'users';

interface DiscoveryScreenProps {
    onBack: () => void;
    onPostClick?: (post: Post) => void;
    onUserClick?: (userId: string) => void;
}

export const DiscoveryScreen = ({ onBack, onPostClick, onUserClick }: DiscoveryScreenProps) => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<SearchTab>('posts');

    // Post results
    const [postResults, setPostResults] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [postOffset, setPostOffset] = useState(0);
    const [postHasMore, setPostHasMore] = useState(true);

    // User results
    const [userResults, setUserResults] = useState<SearchUser[]>([]);
    const [userOffset, setUserOffset] = useState(0);
    const [userHasMore, setUserHasMore] = useState(true);

    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        loadTrending();
    }, []);

    const loadTrending = async () => {
        try {
            const data = await getFeed({
                engagementWeight: 50,
                recencyWeight: 30,
                qualityWeight: 15,
                personalizationWeight: 5,
                limit: 20
            });
            setTrending(data.posts || []);
        } catch (error) {
            console.error('Failed to load trending:', error);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        setPostOffset(0);
        setUserOffset(0);
        setPostHasMore(true);
        setUserHasMore(true);

        try {
            // Search both posts and users in parallel
            const [postsData, usersData] = await Promise.all([
                searchPosts(query.trim(), PAGE_SIZE, 0),
                searchUsers(query.trim(), PAGE_SIZE, 0),
            ]);

            setPostResults(postsData.posts || []);
            setPostHasMore(postsData.hasMore ?? (postsData.posts?.length === PAGE_SIZE));
            setPostOffset(PAGE_SIZE);

            setUserResults(usersData.users || []);
            setUserHasMore(usersData.hasMore ?? (usersData.users?.length === PAGE_SIZE));
            setUserOffset(PAGE_SIZE);
        } catch (error) {
            console.error('Search failed:', error);
            setPostResults([]);
            setUserResults([]);
            setPostHasMore(false);
            setUserHasMore(false);
        } finally {
            setLoading(false);
        }
    };

    const loadMorePosts = useCallback(async () => {
        if (!searched || loadingMore || !postHasMore || !query.trim()) return;

        setLoadingMore(true);
        try {
            const data = await searchPosts(query.trim(), PAGE_SIZE, postOffset);
            const newPosts = data.posts || [];

            if (newPosts.length > 0) {
                setPostResults(prev => [...prev, ...newPosts]);
                setPostOffset(prev => prev + PAGE_SIZE);
                setPostHasMore(data.hasMore ?? (newPosts.length === PAGE_SIZE));
            } else {
                setPostHasMore(false);
            }
        } catch (error) {
            console.error('Load more posts failed:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [searched, loadingMore, postHasMore, query, postOffset]);

    const loadMoreUsers = useCallback(async () => {
        if (!searched || loadingMore || !userHasMore || !query.trim()) return;

        setLoadingMore(true);
        try {
            const data = await searchUsers(query.trim(), PAGE_SIZE, userOffset);
            const newUsers = data.users || [];

            if (newUsers.length > 0) {
                setUserResults(prev => [...prev, ...newUsers]);
                setUserOffset(prev => prev + PAGE_SIZE);
                setUserHasMore(data.hasMore ?? (newUsers.length === PAGE_SIZE));
            } else {
                setUserHasMore(false);
            }
        } catch (error) {
            console.error('Load more users failed:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [searched, loadingMore, userHasMore, query, userOffset]);

    const clearSearch = () => {
        setQuery('');
        setPostResults([]);
        setUserResults([]);
        setSearched(false);
        setPostOffset(0);
        setUserOffset(0);
        setPostHasMore(true);
        setUserHasMore(true);
    };

    const renderUserItem = ({ item }: { item: SearchUser }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => onUserClick?.(item.id)}
        >
            {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            ) : (
                <View style={[styles.userAvatarPlaceholder, item.isBot && styles.botAvatar]}>
                    {item.isBot ? (
                        <Bot size={20} color="#fff" />
                    ) : (
                        <User size={20} color="#fff" />
                    )}
                </View>
            )}
            <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                    <Text style={styles.userName}>@{item.username}</Text>
                    {item.isBot && (
                        <View style={styles.botBadge}>
                            <Text style={styles.botBadgeText}>BOT</Text>
                        </View>
                    )}
                </View>
                {(item.firstName || item.lastName) && (
                    <Text style={styles.userFullName}>
                        {[item.firstName, item.lastName].filter(Boolean).join(' ')}
                    </Text>
                )}
                {item.bio && (
                    <Text style={styles.userBio} numberOfLines={2}>{item.bio}</Text>
                )}
                <View style={styles.userStats}>
                    <Text style={styles.userStat}>{item.postCount} posts</Text>
                    <Text style={styles.userStatDot}>•</Text>
                    <Text style={styles.userStat}>{item.followerCount} followers</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const displayPosts = searched ? postResults : trending;
    const hasResults = activeTab === 'posts' ? postResults.length > 0 : userResults.length > 0;
    const currentHasMore = activeTab === 'posts' ? postHasMore : userHasMore;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Discovery</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color={COLORS.node.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search posts, users..."
                        placeholderTextColor={COLORS.node.muted}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={clearSearch}>
                            <Text style={styles.clearBtn}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs (only show when searched) */}
            {searched && (
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                        onPress={() => setActiveTab('posts')}
                    >
                        <FileText size={16} color={activeTab === 'posts' ? COLORS.node.accent : COLORS.node.muted} />
                        <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
                            Posts ({postResults.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'users' && styles.tabActive]}
                        onPress={() => setActiveTab('users')}
                    >
                        <User size={16} color={activeTab === 'users' ? COLORS.node.accent : COLORS.node.muted} />
                        <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
                            Users ({userResults.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Section Title (when not searched) */}
            {!searched && (
                <View style={styles.sectionHeader}>
                    <TrendingUp size={18} color={COLORS.node.accent} />
                    <Text style={styles.sectionTitle}>Trending Now</Text>
                </View>
            )}

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : activeTab === 'posts' || !searched ? (
                <FlatList
                    data={displayPosts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PostCard
                            post={item}
                            onPress={() => onPostClick?.(item)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    onEndReached={searched ? loadMorePosts : undefined}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color={COLORS.node.accent} />
                                <Text style={styles.loadingMoreText}>Loading more...</Text>
                            </View>
                        ) : searched && !postHasMore && postResults.length > 0 ? (
                            <View style={styles.endOfResultsContainer}>
                                <Text style={styles.endOfResultsText}>End of results</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Hash size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyText}>
                                {searched ? 'No posts found. Try a different search.' : 'No trending posts yet.'}
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={userResults}
                    keyExtractor={(item) => item.id}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={loadMoreUsers}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color={COLORS.node.accent} />
                                <Text style={styles.loadingMoreText}>Loading more...</Text>
                            </View>
                        ) : !userHasMore && userResults.length > 0 ? (
                            <View style={styles.endOfResultsContainer}>
                                <Text style={styles.endOfResultsText}>End of results</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <User size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyText}>
                                No users found. Try a different search.
                            </Text>
                        </View>
                    }
                />
            )}
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
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    backBtn: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        color: COLORS.node.text,
        fontSize: 16,
    },
    clearBtn: {
        color: COLORS.node.accent,
        fontSize: 14,
    },
    searchBtn: {
        backgroundColor: COLORS.node.accent,
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
    },
    searchBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
    tabRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    listContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
        gap: 16,
    },
    emptyText: {
        color: COLORS.node.muted,
        fontSize: 14,
        textAlign: 'center',
    },
    loadingMoreContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    loadingMoreText: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
    endOfResultsContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    endOfResultsText: {
        color: COLORS.node.muted,
        fontSize: 12,
    },
    // User item styles
    userItem: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        marginBottom: 8,
        gap: 12,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    userAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.node.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    botAvatar: {
        backgroundColor: '#10b981',
    },
    userInfo: {
        flex: 1,
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    botBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    botBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    userFullName: {
        fontSize: 14,
        color: COLORS.node.muted,
        marginTop: 2,
    },
    userBio: {
        fontSize: 13,
        color: COLORS.node.text,
        marginTop: 4,
    },
    userStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 6,
    },
    userStat: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    userStatDot: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
});
