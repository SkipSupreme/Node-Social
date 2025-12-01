import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { api } from '../lib/api';
import { PostCard } from '../components/PostCard';
import { COLORS } from '../constants/theme';

interface ModQueueItem {
    id: string;
    postId: string;
    flagScore: number;
    priority: 'critical' | 'high' | 'medium' | 'low' | 'monitor';
    breakdown: any;
    post: any; // Full post object
    status: string;
}

interface ModerationQueueScreenProps {
    onBack: () => void;
}

export const ModerationQueueScreen = ({ onBack }: ModerationQueueScreenProps) => {
    const [items, setItems] = useState<ModQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchQueue = async () => {
        try {
            const response = await api.get<{ items: ModQueueItem[] }>('/api/v1/mod/queue');
            setItems(response.items);
        } catch (error) {
            console.error('Failed to fetch mod queue:', error);
            showAlert('Error', 'Failed to fetch moderation queue');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const handleResolve = async (itemId: string, action: 'approved' | 'removed' | 'warned' | 'banned') => {
        try {
            await api.post(`/api/v1/mod/queue/${itemId}/resolve`, { action });
            // Optimistic update
            setItems(prev => prev.filter(item => item.id !== itemId));
            showAlert('Success', `Item ${action}`);
        } catch (error) {
            console.error('Failed to resolve item:', error);
            showAlert('Error', 'Failed to resolve item');
        }
    };

    const renderItem = ({ item }: { item: ModQueueItem }) => {
        return (
            <View style={[styles.itemContainer, { backgroundColor: COLORS.node.panel }]}>
                <View style={styles.header}>
                    <View style={[styles.badge, { backgroundColor: getPriorityColor(item.priority) }]}>
                        <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.score, { color: COLORS.node.text }]}>Score: {item.flagScore}</Text>
                </View>

                {/* Render Post Preview */}
                <View style={styles.postPreview}>
                    <PostCard post={item.post} />
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                        onPress={() => handleResolve(item.id, 'approved')}
                    >
                        <Text style={styles.actionText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                        onPress={() => handleResolve(item.id, 'removed')}
                    >
                        <Text style={styles.actionText}>Remove</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                        onPress={() => handleResolve(item.id, 'warned')}
                    >
                        <Text style={styles.actionText}>Warn</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return '#D32F2F';
            case 'high': return '#F44336';
            case 'medium': return '#FF9800';
            case 'low': return '#FFC107';
            default: return '#9E9E9E';
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.node.bg }]}>
            <View style={styles.screenHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: COLORS.node.text }]}>Moderation Queue</Text>
                <TouchableOpacity onPress={fetchQueue} style={styles.refreshBtn}>
                    <Text style={{ color: COLORS.node.accent }}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.node.accent} />
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchQueue();
                    }}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={[styles.emptyText, { color: COLORS.node.muted }]}>
                            No items in queue. Good job!
                        </Text>
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
    screenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    backBtn: {
        padding: 8,
    },
    refreshBtn: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        borderRadius: 12,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    score: {
        fontWeight: 'bold',
    },
    postPreview: {
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    actionText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});
