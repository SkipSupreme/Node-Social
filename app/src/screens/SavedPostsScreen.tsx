import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowLeft } from '../components/ui/Icons';
import { COLORS } from '../constants/theme';
import { Feed } from '../components/ui/Feed';
import { getSavedPosts } from '../lib/api';
import { useAuthStore } from '../store/auth';

interface SavedPostsScreenProps {
    onBack: () => void;
}

export const SavedPostsScreen = ({ onBack }: SavedPostsScreenProps) => {
    const { user } = useAuthStore();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSavedPosts();
    }, []);

    const loadSavedPosts = async () => {
        setLoading(true);
        try {
            const data = await getSavedPosts();
            // Map API posts to UI posts
            const mappedPosts = data.posts.map((p: any) => ({
                id: p.id,
                node: { name: p.node?.name || 'Global', color: '#6366f1' },
                author: {
                    id: p.author.id,
                    username: p.author.username || p.author.email.split('@')[0],
                    avatar: p.author.avatar,
                    era: p.author.era || 'Lurker Era',
                    connoisseurCred: p.author.connoisseurCred || 0
                },
                title: p.title || 'Untitled Post',
                content: p.content,
                commentCount: p._count?.comments || 0,
                createdAt: p.createdAt,
                expertGated: false,
                vibes: [],
                linkMeta: p.linkMeta,
                poll: p.poll,
                comments: [] // Saved posts view doesn't need to load comments initially
            }));
            setPosts(mappedPosts);
        } catch (error) {
            console.error('Failed to load saved posts:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Saved Posts</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            ) : posts.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No saved posts yet.</Text>
                </View>
            ) : (
                <Feed posts={posts} currentUser={user} />
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
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
        gap: 16
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        color: COLORS.node.muted,
        fontSize: 16
    }
});
