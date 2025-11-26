import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, UserPlus } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { getFeed, Post } from '../lib/api';
import { PostCard } from '../components/PostCard';

interface FollowingScreenProps {
    onBack: () => void;
    onPostClick?: (post: Post) => void;
}

export const FollowingScreen = ({ onBack, onPostClick }: FollowingScreenProps) => {
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Users size={20} color={COLORS.node.accent} />
                    <Text style={styles.title}>Following</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                    <Text style={styles.loadingText}>Loading your feed...</Text>
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PostCard
                            post={item}
                            onPress={() => onPostClick?.(item)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={COLORS.node.accent}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <UserPlus size={64} color={COLORS.node.muted} />
                            <Text style={styles.emptyTitle}>No posts yet</Text>
                            <Text style={styles.emptyText}>
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
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
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
        paddingTop: 80,
        paddingHorizontal: 32,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    emptyText: {
        color: COLORS.node.muted,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
});
