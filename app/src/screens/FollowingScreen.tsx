import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, UserPlus } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';
import { getFeed, Post } from '../lib/api';
import { PostCard } from '../components/PostCard';

interface FollowingScreenProps {
    onBack: () => void;
    onPostClick?: (post: Post) => void;
}

export const FollowingScreen = ({ onBack, onPostClick }: FollowingScreenProps) => {
    const theme = useAppTheme();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadPosts = useCallback(async () => {
        try {
            const data = await getFeed({
                followingOnly: true,
                limit: 30,
                recencyWeight: 40,
                qualityWeight: 30,
                engagementWeight: 20,
                personalizationWeight: 10,
            });
            setPosts(data.posts || []);
        } catch (error) {
            console.error('Failed to load following feed:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadPosts();
    };

    const renderPostItem = useCallback(({ item }: { item: Post }) => (
        <PostCard
            post={item}
            onPress={() => onPostClick?.(item)}
        />
    ), [onPostClick]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Users size={20} color={theme.accent} />
                    <Text style={[styles.title, { color: theme.text }]}>Following</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <Text style={[styles.loadingText, { color: theme.muted }]}>Loading your feed...</Text>
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPostItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={theme.accent}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <UserPlus size={64} color={theme.muted} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
                            <Text style={[styles.emptyText, { color: theme.muted }]}>
                                Follow some users to see their posts here.
                                {'\n'}Discover new people in the Discovery tab!
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
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
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
        paddingTop: 80,
        paddingHorizontal: 32,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
});
