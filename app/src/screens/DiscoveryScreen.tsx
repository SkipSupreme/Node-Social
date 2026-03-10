import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ArrowLeft, TrendingUp, Hash, User, FileText, Bot } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';
import { searchPosts, searchUsers, getFeed, Post, SearchUser } from '../lib/api';
import { PostCard } from '../components/PostCard';

const PAGE_SIZE = 20;

type SearchTab = 'posts' | 'users';

interface DiscoveryScreenProps {
    onBack: () => void;
    onPostClick?: (post: Post) => void;
    onUserClick?: (userId: string) => void;
    initialQuery?: string;
}

export const DiscoveryScreen = ({ onBack, onPostClick, onUserClick, initialQuery }: DiscoveryScreenProps) => {
    const theme = useAppTheme();
    const [query, setQuery] = useState(initialQuery ?? '');
    const [activeTab, setActiveTab] = useState<SearchTab>('posts');

    // Post results
    const [postResults, setPostResults] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [postCursor, setPostCursor] = useState<string | undefined>(undefined);
    const [postHasMore, setPostHasMore] = useState(true);

    // User results
    const [userResults, setUserResults] = useState<SearchUser[]>([]);
    const [userCursor, setUserCursor] = useState<string | undefined>(undefined);
    const [userHasMore, setUserHasMore] = useState(true);

    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        loadTrending();
    }, []);

    // Auto-search when navigated to with an initialQuery (e.g. from FeedHeader search)
    useEffect(() => {
        if (initialQuery && initialQuery.trim()) {
            setQuery(initialQuery);
            // Trigger search with the initial query directly since setQuery is async
            (async () => {
                setLoading(true);
                setSearched(true);
                setPostCursor(undefined);
                setUserCursor(undefined);
                setPostHasMore(true);
                setUserHasMore(true);
                try {
                    const [postsData, usersData] = await Promise.all([
                        searchPosts(initialQuery.trim(), PAGE_SIZE),
                        searchUsers(initialQuery.trim(), PAGE_SIZE),
                    ]);
                    setPostResults(postsData.posts || []);
                    setPostHasMore(postsData.hasMore ?? (postsData.posts?.length === PAGE_SIZE));
                    setPostCursor(postsData.nextCursor);
                    setUserResults(usersData.users || []);
                    setUserHasMore(usersData.hasMore ?? (usersData.users?.length === PAGE_SIZE));
                    setUserCursor(usersData.nextCursor);
                } catch (error) {
                    console.error('Initial search failed:', error);
                    setPostResults([]);
                    setUserResults([]);
                    setPostHasMore(false);
                    setUserHasMore(false);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [initialQuery]);

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
        setPostCursor(undefined);
        setUserCursor(undefined);
        setPostHasMore(true);
        setUserHasMore(true);

        try {
            // Search both posts and users in parallel
            const [postsData, usersData] = await Promise.all([
                searchPosts(query.trim(), PAGE_SIZE),
                searchUsers(query.trim(), PAGE_SIZE),
            ]);

            setPostResults(postsData.posts || []);
            setPostHasMore(postsData.hasMore ?? (postsData.posts?.length === PAGE_SIZE));
            setPostCursor(postsData.nextCursor);

            setUserResults(usersData.users || []);
            setUserHasMore(usersData.hasMore ?? (usersData.users?.length === PAGE_SIZE));
            setUserCursor(usersData.nextCursor);
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
        if (!searched || loadingMore || !postHasMore || !query.trim() || !postCursor) return;

        setLoadingMore(true);
        try {
            const data = await searchPosts(query.trim(), PAGE_SIZE, postCursor);
            const newPosts = data.posts || [];

            if (newPosts.length > 0) {
                setPostResults(prev => [...prev, ...newPosts]);
                setPostCursor(data.nextCursor);
                setPostHasMore(data.hasMore ?? (newPosts.length === PAGE_SIZE));
            } else {
                setPostHasMore(false);
            }
        } catch (error) {
            console.error('Load more posts failed:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [searched, loadingMore, postHasMore, query, postCursor]);

    const loadMoreUsers = useCallback(async () => {
        if (!searched || loadingMore || !userHasMore || !query.trim() || !userCursor) return;

        setLoadingMore(true);
        try {
            const data = await searchUsers(query.trim(), PAGE_SIZE, userCursor);
            const newUsers = data.users || [];

            if (newUsers.length > 0) {
                setUserResults(prev => [...prev, ...newUsers]);
                setUserCursor(data.nextCursor);
                setUserHasMore(data.hasMore ?? (newUsers.length === PAGE_SIZE));
            } else {
                setUserHasMore(false);
            }
        } catch (error) {
            console.error('Load more users failed:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [searched, loadingMore, userHasMore, query, userCursor]);

    const clearSearch = () => {
        setQuery('');
        setPostResults([]);
        setUserResults([]);
        setSearched(false);
        setPostCursor(undefined);
        setUserCursor(undefined);
        setPostHasMore(true);
        setUserHasMore(true);
    };

    const renderUserItem = useCallback(({ item }: { item: SearchUser }) => (
        <TouchableOpacity
            style={[styles.userItem, { backgroundColor: theme.panel, borderColor: theme.border }]}
            onPress={() => onUserClick?.(item.id)}
        >
            {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            ) : (
                <View style={[styles.userAvatarPlaceholder, item.isBot && styles.botAvatar, { backgroundColor: theme.accent }]}>
                    {item.isBot ? (
                        <Bot size={20} color="#fff" />
                    ) : (
                        <User size={20} color="#fff" />
                    )}
                </View>
            )}
            <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: theme.text }]}>@{item.username}</Text>
                    {item.isBot && (
                        <View style={styles.botBadge}>
                            <Text style={styles.botBadgeText}>BOT</Text>
                        </View>
                    )}
                </View>
                {(item.firstName || item.lastName) && (
                    <Text style={[styles.userFullName, { color: theme.muted }]}>
                        {[item.firstName, item.lastName].filter(Boolean).join(' ')}
                    </Text>
                )}
                {item.bio && (
                    <Text style={[styles.userBio, { color: theme.text }]} numberOfLines={2}>{item.bio}</Text>
                )}
                <View style={styles.userStats}>
                    <Text style={[styles.userStat, { color: theme.muted }]}>{item.postCount} posts</Text>
                    <Text style={[styles.userStatDot, { color: theme.muted }]}>•</Text>
                    <Text style={[styles.userStat, { color: theme.muted }]}>{item.followerCount} followers</Text>
                </View>
            </View>
        </TouchableOpacity>
    ), [theme, onUserClick]);

    const renderPostItem = useCallback(({ item }: { item: Post }) => (
        <PostCard
            post={item}
            onPress={() => onPostClick?.(item)}
        />
    ), [onPostClick]);

    const displayPosts = searched ? postResults : trending;
    const hasResults = activeTab === 'posts' ? postResults.length > 0 : userResults.length > 0;
    const currentHasMore = activeTab === 'posts' ? postHasMore : userHasMore;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Discovery</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <Search size={20} color={theme.muted} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Search posts, users..."
                        placeholderTextColor={theme.muted}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={clearSearch}>
                            <Text style={[styles.clearBtn, { color: theme.accent }]}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.accent }]} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs (only show when searched) */}
            {searched && (
                <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && styles.tabActive, { borderBottomColor: theme.accent }]}
                        onPress={() => setActiveTab('posts')}
                    >
                        <FileText size={16} color={activeTab === 'posts' ? theme.accent : theme.muted} />
                        <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive, { color: theme.muted }]}>
                            Posts ({postResults.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'users' && styles.tabActive, { borderBottomColor: theme.accent }]}
                        onPress={() => setActiveTab('users')}
                    >
                        <User size={16} color={activeTab === 'users' ? theme.accent : theme.muted} />
                        <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive, { color: theme.muted }, { color: theme.accent }]}>
                            Users ({userResults.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Section Title (when not searched) */}
            {!searched && (
                <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
                    <TrendingUp size={18} color={theme.accent} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Trending Now</Text>
                </View>
            )}

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <Text style={[styles.loadingText, { color: theme.muted }]}>Searching...</Text>
                </View>
            ) : activeTab === 'posts' || !searched ? (
                <FlatList
                    data={displayPosts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPostItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={searched ? loadMorePosts : undefined}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color={theme.accent} />
                                <Text style={[styles.loadingMoreText, { color: theme.muted }]}>Loading more...</Text>
                            </View>
                        ) : searched && !postHasMore && postResults.length > 0 ? (
                            <View style={styles.endOfResultsContainer}>
                                <Text style={[styles.endOfResultsText, { color: theme.muted }]}>End of results</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Hash size={48} color={theme.muted} />
                            <Text style={[styles.emptyText, { color: theme.muted }]}>
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
                                <ActivityIndicator size="small" color={theme.accent} />
                                <Text style={[styles.loadingMoreText, { color: theme.muted }]}>Loading more...</Text>
                            </View>
                        ) : !userHasMore && userResults.length > 0 ? (
                            <View style={styles.endOfResultsContainer}>
                                <Text style={[styles.endOfResultsText, { color: theme.muted }]}>End of results</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <User size={48} color={theme.muted} />
                            <Text style={[styles.emptyText, { color: theme.muted }]}>
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
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
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 16,
    },
    clearBtn: {
        fontSize: 14,
    },
    searchBtn: {
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
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    tabTextActive: {
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
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
        fontSize: 14,
    },
    endOfResultsContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    endOfResultsText: {
        fontSize: 12,
    },
    // User item styles
    userItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
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
        marginTop: 2,
    },
    userBio: {
        fontSize: 13,
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
    },
    userStatDot: {
        fontSize: 12,
    },
});
