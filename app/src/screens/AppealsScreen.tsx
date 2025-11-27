import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Scale, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, X } from 'lucide-react-native';
import { listAppeals, getMyJuryDuties, voteOnAppeal, Appeal, AppealStatus, JuryDuty } from '../lib/api';
import { COLORS } from '../constants/theme';

interface AppealsScreenProps {
    onBack: () => void;
}

type TabType = 'all' | 'jury' | 'mine';

const STATUS_COLORS: Record<AppealStatus, string> = {
    pending: '#f59e0b',
    voting: '#3b82f6',
    upheld: '#10b981',
    overturned: '#ef4444',
    expired: '#6b7280',
};

const STATUS_ICONS: Record<AppealStatus, React.ReactNode> = {
    pending: <Clock size={14} color="#f59e0b" />,
    voting: <Scale size={14} color="#3b82f6" />,
    upheld: <CheckCircle size={14} color="#10b981" />,
    overturned: <XCircle size={14} color="#ef4444" />,
    expired: <AlertCircle size={14} color="#6b7280" />,
};

export const AppealsScreen = ({ onBack }: AppealsScreenProps) => {
    const [tab, setTab] = useState<TabType>('all');
    const [appeals, setAppeals] = useState<Appeal[]>([]);
    const [juryDuties, setJuryDuties] = useState<JuryDuty | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Vote modal state
    const [voteModal, setVoteModal] = useState<{ visible: boolean; appealId: string; appellantName: string } | null>(null);
    const [voteReason, setVoteReason] = useState('');
    const [voting, setVoting] = useState(false);

    const fetchData = async () => {
        try {
            if (tab === 'jury') {
                const duties = await getMyJuryDuties();
                setJuryDuties(duties);
            } else {
                const data = await listAppeals(tab === 'mine' ? { status: undefined } : undefined);
                setAppeals(data.appeals);
            }
        } catch (err) {
            console.error('Failed to fetch appeals:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [tab]);

    const handleVote = async (vote: 'uphold' | 'overturn') => {
        if (!voteModal) return;
        setVoting(true);
        try {
            await voteOnAppeal(voteModal.appealId, vote, voteReason || undefined);
            setVoteModal(null);
            setVoteReason('');
            fetchData(); // Refresh
        } catch (err) {
            console.error('Failed to vote:', err);
        } finally {
            setVoting(false);
        }
    };

    const renderAppeal = ({ item }: { item: Appeal }) => {
        const timeLeft = item.juryDeadline
            ? Math.max(0, Math.floor((new Date(item.juryDeadline).getTime() - Date.now()) / 3600000))
            : null;

        return (
            <TouchableOpacity style={styles.appealCard}>
                <View style={styles.appealHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}20` }]}>
                        {STATUS_ICONS[item.status]}
                        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                    <Text style={styles.appealDate}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>

                <Text style={styles.appealType}>
                    Appeal against {item.targetType}
                </Text>

                <Text style={styles.appealReason} numberOfLines={2}>
                    {item.reason}
                </Text>

                <View style={styles.appealFooter}>
                    <View style={styles.stakeInfo}>
                        <Text style={styles.stakeLabel}>Stake:</Text>
                        <Text style={styles.stakeValue}>{item.stake} Cred</Text>
                    </View>

                    {item.status === 'voting' && timeLeft !== null && (
                        <View style={styles.timeInfo}>
                            <Clock size={12} color={COLORS.node.muted} />
                            <Text style={styles.timeText}>{timeLeft}h left</Text>
                        </View>
                    )}

                    <ChevronRight size={20} color={COLORS.node.muted} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderJuryDuty = ({ item }: { item: JuryDuty['pending'][0] }) => {
        const appeal = item.appeal;
        const timeLeft = appeal.juryDeadline
            ? Math.max(0, Math.floor((new Date(appeal.juryDeadline).getTime() - Date.now()) / 3600000))
            : null;

        return (
            <View style={[styles.appealCard, styles.juryCard]}>
                <View style={styles.appealHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: '#3b82f620' }]}>
                        <Scale size={14} color="#3b82f6" />
                        <Text style={[styles.statusText, { color: '#3b82f6' }]}>
                            Your Vote Needed
                        </Text>
                    </View>
                    {timeLeft !== null && (
                        <View style={styles.timeInfo}>
                            <Clock size={12} color="#f59e0b" />
                            <Text style={[styles.timeText, { color: '#f59e0b' }]}>{timeLeft}h left</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.appealType}>
                    Appeal against {appeal.targetType}
                </Text>

                <Text style={styles.appealReason} numberOfLines={3}>
                    {appeal.reason}
                </Text>

                <View style={styles.voteButtons}>
                    <TouchableOpacity
                        style={[styles.voteBtn, styles.upholdBtn]}
                        onPress={() => setVoteModal({ visible: true, appealId: appeal.id, appellantName: appeal.appellant?.username || 'User' })}
                    >
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.voteBtnText}>Uphold</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.voteBtn, styles.overturnBtn]}
                        onPress={() => setVoteModal({ visible: true, appealId: appeal.id, appellantName: appeal.appellant?.username || 'User' })}
                    >
                        <XCircle size={16} color="#fff" />
                        <Text style={styles.voteBtnText}>Overturn</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Node Court</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                {(['all', 'jury', 'mine'] as TabType[]).map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, tab === t && styles.tabActive]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {t === 'all' ? 'All Appeals' : t === 'jury' ? 'Jury Duties' : 'My Appeals'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            ) : tab === 'jury' ? (
                <FlatList
                    data={juryDuties?.pending || []}
                    keyExtractor={(item) => item.appealId}
                    renderItem={renderJuryDuty}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
                    }
                    ListHeaderComponent={
                        juryDuties && juryDuties.pending.length > 0 ? (
                            <View style={styles.juryHeader}>
                                <Scale size={20} color={COLORS.node.accent} />
                                <Text style={styles.juryHeaderText}>
                                    You have {juryDuties.pending.length} pending vote{juryDuties.pending.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Scale size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyTitle}>No Jury Duties</Text>
                            <Text style={styles.emptyText}>
                                You'll be notified when you're selected as a juror
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={appeals}
                    keyExtractor={(item) => item.id}
                    renderItem={renderAppeal}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Scale size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyTitle}>No Appeals</Text>
                            <Text style={styles.emptyText}>
                                {tab === 'mine'
                                    ? "You haven't created any appeals yet"
                                    : 'No appeals have been filed'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Vote Modal */}
            <Modal visible={!!voteModal?.visible} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVoteModal(null)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cast Your Vote</Text>
                            <TouchableOpacity onPress={() => setVoteModal(null)}>
                                <X size={24} color={COLORS.node.muted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Your vote helps determine the outcome of this appeal
                        </Text>

                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Add a reason for your vote (optional)"
                            placeholderTextColor={COLORS.node.muted}
                            value={voteReason}
                            onChangeText={setVoteReason}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.upholdBtn]}
                                onPress={() => handleVote('uphold')}
                                disabled={voting}
                            >
                                <CheckCircle size={18} color="#fff" />
                                <Text style={styles.modalBtnText}>Uphold Original</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.overturnBtn]}
                                onPress={() => handleVote('overturn')}
                                disabled={voting}
                            >
                                <XCircle size={18} color="#fff" />
                                <Text style={styles.modalBtnText}>Overturn</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    backBtn: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    juryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: `${COLORS.node.accent}20`,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    juryHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    appealCard: {
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    juryCard: {
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    appealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    appealDate: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    appealType: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 4,
    },
    appealReason: {
        fontSize: 14,
        color: COLORS.node.muted,
        lineHeight: 20,
        marginBottom: 12,
    },
    appealFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stakeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    stakeLabel: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    stakeValue: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    timeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    voteButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    voteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 8,
    },
    upholdBtn: {
        backgroundColor: '#10b981',
    },
    overturnBtn: {
        backgroundColor: '#ef4444',
    },
    voteBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.node.muted,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    modalSubtitle: {
        fontSize: 14,
        color: COLORS.node.muted,
        marginBottom: 16,
    },
    reasonInput: {
        backgroundColor: COLORS.node.bg,
        borderRadius: 8,
        padding: 12,
        color: COLORS.node.text,
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 8,
    },
    modalBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
});
