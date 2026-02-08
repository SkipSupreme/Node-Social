import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowLeft } from '../components/ui/Icons';
import { useAppTheme } from '../hooks/useTheme';
import { Feed, type UIPost } from '../components/ui/Feed';
import { getSavedPosts } from '../lib/api';
import { useAuthStore } from '../store/auth';

interface SavedPostsScreenProps {
    onBack: () => void;
    onPostClick?: (post: UIPost) => void;
    onAuthorClick?: (authorId: string) => void;
}

export const SavedPostsScreen = ({ onBack, onPostClick, onAuthorClick }: SavedPostsScreenProps) => {
    const theme = useAppTheme();
    const { user } = useAuthStore();
    const [posts, setPosts] = useState<UIPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSavedPosts();
    }, []);

    const loadSavedPosts = async () => {
        setLoading(true);
        try {
            const data = await getSavedPosts();
            // Map API posts to UI posts
            const mappedPosts: UIPost[] = data.posts.map((p) => ({
                id: p.id,
                node: { id: p.node?.id, name: p.node?.name || 'Global', color: '#6366f1' },
                author: {
                    id: p.author.id,
                    username: p.author.username || 'User',
                    avatar: p.author.avatar || '',
                    era: p.author.era || 'Lurker Era',
                    cred: p.author.cred || 0
                },
                title: p.title || 'Untitled Post',
                content: p.content,
                commentCount: p.commentCount || 0,
                createdAt: p.createdAt,
                expertGated: false,
                vibes: [],
                linkUrl: p.linkUrl,
                linkMeta: p.linkMeta ? {
                    id: p.linkMeta.id,
                    url: p.linkMeta.url,
                    title: p.linkMeta.title,
                    description: p.linkMeta.description,
                    image: p.linkMeta.image,
                    domain: p.linkMeta.domain,
                } : undefined,
                poll: p.poll ? {
                    id: p.poll.id,
                    question: p.poll.question,
                    options: p.poll.options.map(o => ({
                        id: o.id,
                        text: o.text,
                        _count: o._count,
                    })),
                    votes: p.poll.votes,
                } : undefined,
                comments: [],
                isSaved: true, // All posts in saved view are saved
            }));
            setPosts(mappedPosts);
        } catch (error) {
            console.error('Failed to load saved posts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle save toggle - remove post from list when unsaved
    const handleSaveToggle = (postId: string, saved: boolean) => {
        if (!saved) {
            // Post was unsaved, remove from list
            setPosts(prev => prev.filter(p => p.id !== postId));
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Saved Posts</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : posts.length === 0 ? (
                <View style={styles.center}>
                    <Text style={[styles.emptyText, { color: theme.muted }]}>No saved posts yet.</Text>
                </View>
            ) : (
                <Feed
                    posts={posts}
                    currentUser={user ?? undefined}
                    onPostClick={onPostClick}
                    onAuthorClick={onAuthorClick}
                    onSaveToggle={handleSaveToggle}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        gap: 16
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        fontSize: 16
    }
});
