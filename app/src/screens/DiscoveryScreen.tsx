import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ArrowLeft, TrendingUp, Hash } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { searchPosts, getFeed, Post } from '../lib/api';
import { PostCard } from '../components/PostCard';

interface DiscoveryScreenProps {
    onBack: () => void;
    onPostClick?: (post: Post) => void;
}

export const DiscoveryScreen = ({ onBack, onPostClick }: DiscoveryScreenProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        // Load trending/hot posts on mount
        loadTrending();
    }, []);

    const loadTrending = async () => {
        try {
            // Fetch "hot" posts (high engagement, recent)
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
        try {
            const data = await searchPosts(query.trim(), 30, 0);
            setResults(data.posts || []);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
    };

    const displayPosts = searched ? results : trending;

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
                        placeholder="Search posts, topics..."
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

            {/* Section Title */}
            <View style={styles.sectionHeader}>
                {searched ? (
                    <>
                        <Search size={18} color={COLORS.node.accent} />
                        <Text style={styles.sectionTitle}>
                            {results.length > 0 ? `Results for "${query}"` : `No results for "${query}"`}
                        </Text>
                    </>
                ) : (
                    <>
                        <TrendingUp size={18} color={COLORS.node.accent} />
                        <Text style={styles.sectionTitle}>Trending Now</Text>
                    </>
                )}
            </View>

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : (
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
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Hash size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyText}>
                                {searched ? 'No posts found. Try a different search.' : 'No trending posts yet.'}
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
});
