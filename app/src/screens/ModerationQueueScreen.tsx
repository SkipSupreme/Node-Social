import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { showAlert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
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

type ActionType = 'approved' | 'removed' | 'warned' | 'banned';

interface PendingAction {
    itemId: string;
    action: ActionType;
}

export const ModerationQueueScreen = ({ onBack }: ModerationQueueScreenProps) => {
    const [items, setItems] = useState<ModQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reasonModalVisible, setReasonModalVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [reason, setReason] = useState('');

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

    const handleResolve = (itemId: string, action: ActionType) => {
        if (action === 'approved') {
            // Approve doesn't need a reason
            executeAction(itemId, action);
        } else {
            // Remove, warn, ban need a reason
            setPendingAction({ itemId, action });
            setReason('');
            setReasonModalVisible(true);
        }
    };

    const executeAction = async (itemId: string, action: ActionType, actionReason?: string) => {
        try {
            await api.post(`/api/v1/mod/queue/${itemId}/resolve`, { action, reason: actionReason });
            // Optimistic update
            setItems(prev => prev.filter(item => item.id !== itemId));

            const messages: Record<ActionType, string> = {
                approved: 'Post approved',
                removed: 'Post removed and author notified',
                warned: 'Warning sent to author',
                banned: 'User banned from node',
            };
            showAlert('Success', messages[action]);
        } catch (error) {
            console.error('Failed to resolve item:', error);
            showAlert('Error', 'Failed to resolve item');
        }
    };

    const handleSubmitAction = () => {
        if (!pendingAction) return;
        setReasonModalVisible(false);
        executeAction(pendingAction.itemId, pendingAction.action, reason);
        setPendingAction(null);
        setReason('');
    };

    const getActionTitle = (action?: ActionType) => {
        switch (action) {
            case 'removed': return 'Remove Post';
            case 'warned': return 'Warn User';
            case 'banned': return 'Ban User';
            default: return 'Take Action';
        }
    };

    const getReasonPlaceholder = (action?: ActionType) => {
        switch (action) {
            case 'removed': return 'Reason for removal (e.g., "Violates community guidelines")';
            case 'warned': return 'Warning message (e.g., "Please be respectful to other users")';
            case 'banned': return 'Reason for ban (e.g., "Repeated violations of community rules")';
            default: return 'Enter reason...';
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

            {/* Reason Modal */}
            <Modal
                visible={reasonModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReasonModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: COLORS.node.bg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: COLORS.node.text }]}>
                                {getActionTitle(pendingAction?.action)}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setReasonModalVisible(false);
                                    setPendingAction(null);
                                }}
                                style={styles.modalClose}
                            >
                                <X size={20} color={COLORS.node.muted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalLabel, { color: COLORS.node.muted }]}>
                            {pendingAction?.action === 'warned'
                                ? 'This message will be sent to the user as a notification:'
                                : 'Provide a reason for this action:'}
                        </Text>

                        <TextInput
                            style={[styles.reasonInput, { color: COLORS.node.text, borderColor: COLORS.node.border }]}
                            value={reason}
                            onChangeText={setReason}
                            placeholder={getReasonPlaceholder(pendingAction?.action)}
                            placeholderTextColor={COLORS.node.muted}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setReasonModalVisible(false);
                                    setPendingAction(null);
                                }}
                            >
                                <Text style={[styles.cancelButtonText, { color: COLORS.node.muted }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.submitButton,
                                    { backgroundColor: pendingAction?.action === 'warned' ? '#FF9800' : '#F44336' }
                                ]}
                                onPress={handleSubmitAction}
                            >
                                <Text style={styles.submitButtonText}>
                                    {pendingAction?.action === 'warned' ? 'Send Warning' :
                                     pendingAction?.action === 'banned' ? 'Ban User' : 'Remove Post'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalClose: {
        padding: 4,
    },
    modalLabel: {
        fontSize: 14,
        marginBottom: 12,
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        minHeight: 80,
        backgroundColor: COLORS.node.panel,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    cancelButton: {
        backgroundColor: COLORS.node.panel,
    },
    cancelButtonText: {
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#F44336',
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
