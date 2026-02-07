import React, { useState, useEffect, useMemo, useCallback, useRef, type ComponentType } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    FlatList,
    ActivityIndicator,
    Modal,
    TextInput,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Crown, Globe, Scale, Ban } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';
import {
    api,
    type Post,
    getNodeCouncil,
    getCouncilEligibility,
    type CouncilInfo,
    type CouncilEligibility,
    type CouncilMember,
} from '../lib/api';
import { showAlert } from '../lib/alert';

// ── Types ──────────────────────────────────────────────────────

type TabId = 'moderation' | 'council' | 'trust' | 'appeals' | 'blocked';

interface GovernanceScreenProps {
    onBack: () => void;
    initialTab?: TabId;
    nodeId?: string;
    nodeName?: string;
    userId?: string;
    onUserClick?: (userId: string) => void;
}

interface TabDef {
    id: TabId;
    label: string;
    Icon: ComponentType<{ size?: number; color?: string }>;
}

// ── Moderation types ────────────────────────────────────────────

interface FlagBreakdown {
    toxicity?: number;
    spam?: number;
    reports?: number;
    [key: string]: number | undefined;
}

interface ModQueueItem {
    id: string;
    postId: string;
    flagScore: number;
    priority: 'critical' | 'high' | 'medium' | 'low' | 'monitor';
    breakdown: FlagBreakdown;
    post: Post;
    status: string;
}

type ModAction = 'approved' | 'removed' | 'warned';

interface PendingModAction {
    itemId: string;
    action: ModAction;
}

type PriorityFilter = 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_COLORS: Record<string, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#6b7280',
    monitor: '#9ca3af',
};

const PRIORITY_FILTERS: PriorityFilter[] = ['critical', 'high', 'medium', 'low'];

// ── Constants ──────────────────────────────────────────────────

const TABS: TabDef[] = [
    { id: 'moderation', label: 'Moderation', Icon: Shield },
    { id: 'council', label: 'Council', Icon: Crown },
    { id: 'trust', label: 'Trust', Icon: Globe },
    { id: 'appeals', label: 'Appeals', Icon: Scale },
    { id: 'blocked', label: 'Blocked', Icon: Ban },
];

// ── Static styles (non-themed) ─────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 8,
        width: 40,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSpacer: {
        width: 40,
    },
    tabBar: {
        borderBottomWidth: 1,
    },
    tabBarContent: {
        flexDirection: 'row',
        paddingHorizontal: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderText: {
        fontSize: 16,
    },
});

// ── Moderation static styles ────────────────────────────────────

const modStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    filterStrip: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 5,
    },
    filterPillLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    filterPillCount: {
        fontSize: 11,
        fontWeight: '800',
        minWidth: 18,
        textAlign: 'center',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    queueList: {
        flex: 1,
    },
    queueListContent: {
        paddingBottom: 20,
    },
    // Queue row
    queueRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 64,
    },
    priorityBar: {
        width: 3,
    },
    rowContent: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 4,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    username: {
        fontSize: 12,
        fontWeight: '600',
    },
    contentPreview: {
        flex: 1,
        fontSize: 13,
    },
    rowBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    flagBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    flagBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
    },
    categoryChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    categoryChipText: {
        fontSize: 10,
        fontWeight: '600',
    },
    timeAgo: {
        fontSize: 10,
        marginLeft: 'auto',
    },
    // Actions
    actionsCol: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: 10,
        paddingLeft: 4,
        gap: 4,
    },
    actionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        alignItems: 'center',
        minWidth: 60,
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    // Loading / Empty
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    // Reason Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 12,
        padding: 20,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 12,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        minWidth: 72,
        alignItems: 'center',
    },
    modalBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

// ── Council static styles ────────────────────────────────────────

const councilStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 24,
    },
    // Status card
    statusCard: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 10,
        borderWidth: 1.5,
        padding: 14,
    },
    statusCardOnCouncil: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusCardTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    statusCardSub: {
        fontSize: 13,
        marginTop: 2,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    progressValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: 8,
        borderRadius: 4,
    },
    progressHint: {
        fontSize: 12,
        marginTop: 6,
    },
    // Stats row
    statsRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    statsText: {
        fontSize: 13,
    },
    statsBold: {
        fontWeight: '700',
    },
    // Leaderboard row
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontSize: 12,
        fontWeight: '800',
    },
    memberAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    memberAvatarFallback: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberAvatarInitial: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    memberInfo: {
        flex: 1,
        gap: 4,
    },
    memberUsername: {
        fontSize: 13,
        fontWeight: '600',
    },
    weightBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    weightBarBg: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    weightBarFill: {
        height: 6,
        borderRadius: 3,
    },
    weightLabel: {
        fontSize: 11,
        fontWeight: '700',
        minWidth: 36,
        textAlign: 'right',
    },
    activityPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    activityPillText: {
        fontSize: 10,
        fontWeight: '700',
    },
    // Loading / Error / Empty
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
});

// ── Helpers ──────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d`;
    return `${Math.floor(diffDay / 30)}mo`;
}

function getInitials(post: Post): string {
    const name = post.author.username ?? post.author.email;
    return name.slice(0, 2).toUpperCase();
}

function getPreviewText(post: Post): string {
    if (post.title) return post.title;
    if (post.content) return post.content.replace(/\n/g, ' ');
    return '(no content)';
}

// ── ModerationTab ────────────────────────────────────────────────

const ModerationTab = React.memo(function ModerationTab() {
    const theme = useAppTheme();
    const [items, setItems] = useState<ModQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilters, setActiveFilters] = useState<Set<PriorityFilter>>(new Set());
    const [reasonModalVisible, setReasonModalVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingModAction | null>(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const reasonInputRef = useRef<TextInput>(null);

    // Themed styles
    const mts = useMemo(() => StyleSheet.create({
        filterStrip: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        queueRow: { borderBottomColor: theme.border },
        username: { color: theme.text },
        contentPreview: { color: theme.muted },
        timeAgo: { color: theme.muted },
        categoryChip: { borderColor: theme.border, backgroundColor: theme.bgAlt },
        categoryChipText: { color: theme.textSecondary },
        emptyTitle: { color: theme.text },
        emptySubtitle: { color: theme.muted },
        modalCard: { backgroundColor: theme.panel },
        modalTitle: { color: theme.text },
        modalInput: { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text },
    }), [theme]);

    // Fetch queue
    const fetchQueue = useCallback(async () => {
        try {
            const response = await api.get<{ items: ModQueueItem[] }>('/api/v1/mod/queue');
            setItems(response.items);
        } catch (err) {
            console.error('Failed to fetch mod queue:', err);
            showAlert('Error', 'Failed to load moderation queue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // Filter logic
    const toggleFilter = useCallback((priority: PriorityFilter) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(priority)) {
                next.delete(priority);
            } else {
                next.add(priority);
            }
            return next;
        });
    }, []);

    const filteredItems = useMemo(() => {
        if (activeFilters.size === 0) return items;
        return items.filter(item => activeFilters.has(item.priority as PriorityFilter));
    }, [items, activeFilters]);

    // Priority counts
    const priorityCounts = useMemo(() => {
        const counts: Record<PriorityFilter, number> = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const item of items) {
            if (item.priority in counts) {
                counts[item.priority as PriorityFilter] += 1;
            }
        }
        return counts;
    }, [items]);

    // Actions
    const handleAction = useCallback((itemId: string, action: ModAction) => {
        if (action === 'approved') {
            resolveItem(itemId, action);
        } else {
            setPendingAction({ itemId, action });
            setReason('');
            setReasonModalVisible(true);
        }
    }, []);

    const resolveItem = useCallback(async (itemId: string, action: ModAction, actionReason?: string) => {
        try {
            setSubmitting(true);
            await api.post(`/api/v1/mod/queue/${itemId}/resolve`, {
                action,
                ...(actionReason ? { reason: actionReason } : {}),
            });
            setItems(prev => prev.filter(i => i.id !== itemId));
            showAlert('Done', `Post ${action} successfully`);
        } catch (err) {
            console.error('Failed to resolve mod item:', err);
            showAlert('Error', 'Failed to perform action');
        } finally {
            setSubmitting(false);
        }
    }, []);

    const submitReasonModal = useCallback(() => {
        if (!pendingAction) return;
        if (!reason.trim()) {
            showAlert('Required', 'Please provide a reason');
            return;
        }
        setReasonModalVisible(false);
        resolveItem(pendingAction.itemId, pendingAction.action, reason.trim());
        setPendingAction(null);
    }, [pendingAction, reason, resolveItem]);

    const cancelReasonModal = useCallback(() => {
        setReasonModalVisible(false);
        setPendingAction(null);
        setReason('');
    }, []);

    // Render queue item
    const renderItem = useCallback(({ item }: { item: ModQueueItem }) => {
        const priorityColor = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.monitor;
        const breakdownEntries = Object.entries(item.breakdown).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0
        );

        return (
            <View style={[modStyles.queueRow, mts.queueRow]}>
                {/* Priority bar */}
                <View style={[modStyles.priorityBar, { backgroundColor: priorityColor }]} />

                {/* Content */}
                <View style={modStyles.rowContent}>
                    {/* Row 1: avatar + username + preview */}
                    <View style={modStyles.rowTop}>
                        <View style={[modStyles.avatar, { backgroundColor: priorityColor }]}>
                            <Text style={modStyles.avatarInitial}>{getInitials(item.post)}</Text>
                        </View>
                        <Text style={[modStyles.username, mts.username]} numberOfLines={1}>
                            @{item.post.author.username ?? item.post.author.email.split('@')[0]}
                        </Text>
                        <Text style={[modStyles.contentPreview, mts.contentPreview]} numberOfLines={1}>
                            {getPreviewText(item.post)}
                        </Text>
                    </View>

                    {/* Row 2: flag score + categories + time */}
                    <View style={modStyles.rowBottom}>
                        <View style={[modStyles.flagBadge, { backgroundColor: priorityColor }]}>
                            <Text style={modStyles.flagBadgeText}>{item.flagScore.toFixed(1)}</Text>
                        </View>
                        {breakdownEntries.map(([key, val]) => (
                            <View key={key} style={[modStyles.categoryChip, mts.categoryChip]}>
                                <Text style={[modStyles.categoryChipText, mts.categoryChipText]}>
                                    {key} {val}
                                </Text>
                            </View>
                        ))}
                        <Text style={[modStyles.timeAgo, mts.timeAgo]}>
                            {formatTimeAgo(item.post.createdAt)}
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={modStyles.actionsCol}>
                    <TouchableOpacity
                        style={[modStyles.actionBtn, { backgroundColor: '#16a34a' }]}
                        onPress={() => handleAction(item.id, 'approved')}
                        activeOpacity={0.7}
                    >
                        <Text style={modStyles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[modStyles.actionBtn, { backgroundColor: '#dc2626' }]}
                        onPress={() => handleAction(item.id, 'removed')}
                        activeOpacity={0.7}
                    >
                        <Text style={modStyles.actionBtnText}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[modStyles.actionBtn, { backgroundColor: '#d97706' }]}
                        onPress={() => handleAction(item.id, 'warned')}
                        activeOpacity={0.7}
                    >
                        <Text style={modStyles.actionBtnText}>Warn</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }, [mts, handleAction]);

    const keyExtractor = useCallback((item: ModQueueItem) => item.id, []);

    // Loading state
    if (loading) {
        return (
            <View style={modStyles.centered}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    return (
        <View style={modStyles.container}>
            {/* Priority filter pills */}
            <View style={[modStyles.filterStrip, mts.filterStrip]}>
                {PRIORITY_FILTERS.map(priority => {
                    const color = PRIORITY_COLORS[priority];
                    const isActive = activeFilters.has(priority);
                    const count = priorityCounts[priority];
                    return (
                        <Pressable
                            key={priority}
                            style={[
                                modStyles.filterPill,
                                {
                                    borderColor: color,
                                    backgroundColor: isActive ? color : 'transparent',
                                },
                            ]}
                            onPress={() => toggleFilter(priority)}
                        >
                            <Text
                                style={[
                                    modStyles.filterPillLabel,
                                    { color: isActive ? '#fff' : color },
                                ]}
                            >
                                {priority}
                            </Text>
                            <Text
                                style={[
                                    modStyles.filterPillCount,
                                    {
                                        backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : color,
                                        color: isActive ? '#fff' : '#fff',
                                    },
                                ]}
                            >
                                {count}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Queue */}
            {filteredItems.length === 0 ? (
                <View style={modStyles.centered}>
                    <Shield size={36} color={theme.muted} />
                    <Text style={[modStyles.emptyTitle, mts.emptyTitle]}>Queue clear</Text>
                    <Text style={[modStyles.emptySubtitle, mts.emptySubtitle]}>
                        {items.length > 0
                            ? 'No items match the selected filters'
                            : 'No items pending moderation'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredItems}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    style={modStyles.queueList}
                    contentContainerStyle={modStyles.queueListContent}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                />
            )}

            {/* Reason modal — rendered lazily */}
            {reasonModalVisible && (
                <Modal
                    visible={reasonModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={cancelReasonModal}
                    onShow={() => reasonInputRef.current?.focus()}
                >
                    <Pressable style={modStyles.modalOverlay} onPress={cancelReasonModal}>
                        <Pressable style={[modStyles.modalCard, mts.modalCard]} onPress={() => {}}>
                            <Text style={[modStyles.modalTitle, mts.modalTitle]}>
                                {pendingAction?.action === 'removed' ? 'Remove Post' : 'Warn User'}
                            </Text>
                            <TextInput
                                ref={reasonInputRef}
                                style={[modStyles.modalInput, mts.modalInput]}
                                placeholder="Reason (required)"
                                placeholderTextColor={theme.muted}
                                value={reason}
                                onChangeText={setReason}
                                multiline
                                autoFocus
                            />
                            <View style={modStyles.modalActions}>
                                <TouchableOpacity
                                    style={[modStyles.modalBtn, { backgroundColor: theme.bgAlt }]}
                                    onPress={cancelReasonModal}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[modStyles.modalBtnText, { color: theme.text }]}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        modStyles.modalBtn,
                                        {
                                            backgroundColor:
                                                pendingAction?.action === 'removed' ? '#dc2626' : '#d97706',
                                        },
                                    ]}
                                    onPress={submitReasonModal}
                                    disabled={submitting}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[modStyles.modalBtnText, { color: '#fff' }]}>
                                        {submitting ? 'Submitting...' : 'Submit'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
        </View>
    );
});

// ── CouncilTab ──────────────────────────────────────────────────

interface CouncilTabProps {
    nodeId: string;
    nodeName: string;
}

const CouncilTab = React.memo(function CouncilTab({ nodeId, nodeName }: CouncilTabProps) {
    const theme = useAppTheme();
    const [council, setCouncil] = useState<CouncilInfo | null>(null);
    const [eligibility, setEligibility] = useState<CouncilEligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Themed styles
    const cts = useMemo(() => StyleSheet.create({
        statusCardBorder: { borderColor: '#d4a017', backgroundColor: theme.panel },
        statusCardDefault: { borderColor: theme.border, backgroundColor: theme.panel },
        statusCardTitle: { color: theme.text },
        statusCardSub: { color: theme.muted },
        progressLabel: { color: theme.text },
        progressValue: { color: theme.accent },
        progressBarBg: { backgroundColor: theme.bgAlt },
        progressBarFill: { backgroundColor: theme.accent },
        progressHint: { color: theme.muted },
        statsText: { color: theme.muted },
        statsBold: { color: theme.text },
        leaderRow: { borderBottomColor: theme.border },
        rankBadgeDefault: { backgroundColor: theme.bgAlt },
        rankText: { color: theme.text },
        memberUsername: { color: theme.text },
        weightBarBg: { backgroundColor: theme.bgAlt },
        weightBarFill: { backgroundColor: theme.accent },
        weightLabel: { color: theme.textSecondary },
        activityPill: { backgroundColor: theme.bgAlt },
        activityPillText: { color: theme.textSecondary },
        emptyTitle: { color: theme.text },
        emptySubtitle: { color: theme.muted },
    }), [theme]);

    // Fetch data
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const [councilData, eligibilityData] = await Promise.all([
                    getNodeCouncil(nodeId),
                    getCouncilEligibility(nodeId).catch(() => null),
                ]);

                if (cancelled) return;
                setCouncil(councilData);
                setEligibility(eligibilityData);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to fetch council data:', err);
                setError('Failed to load council data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [nodeId]);

    // Derived: max governance weight for proportional bars
    const maxWeight = useMemo(() => {
        if (!council?.members.length) return 1;
        return Math.max(...council.members.map(m => m.governanceWeight), 1);
    }, [council]);

    // Render leaderboard row
    const renderMember = useCallback(({ item, index }: { item: CouncilMember; index: number }) => {
        const rank = index + 1;
        const isFirst = rank === 1;
        const barWidthPercent = (item.governanceWeight / maxWeight) * 100;
        const activityPercent = Math.round(item.activityMultiplier * 100);

        return (
            <View style={[councilStyles.leaderRow, cts.leaderRow]}>
                {/* Rank badge */}
                <View
                    style={[
                        councilStyles.rankBadge,
                        isFirst
                            ? { backgroundColor: '#d4a017' }
                            : cts.rankBadgeDefault,
                    ]}
                >
                    {isFirst ? (
                        <Crown size={14} color="#fff" />
                    ) : (
                        <Text style={[councilStyles.rankText, cts.rankText]}>{rank}</Text>
                    )}
                </View>

                {/* Avatar */}
                {item.avatar ? (
                    <Image
                        source={{ uri: item.avatar }}
                        style={councilStyles.memberAvatar}
                    />
                ) : (
                    <View style={[councilStyles.memberAvatarFallback, { backgroundColor: theme.accent }]}>
                        <Text style={councilStyles.memberAvatarInitial}>
                            {item.username.slice(0, 1).toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* Name + weight bar */}
                <View style={councilStyles.memberInfo}>
                    <Text style={[councilStyles.memberUsername, cts.memberUsername]} numberOfLines={1}>
                        @{item.username}
                    </Text>
                    <View style={councilStyles.weightBarRow}>
                        <View style={[councilStyles.weightBarBg, cts.weightBarBg]}>
                            <View
                                style={[
                                    councilStyles.weightBarFill,
                                    cts.weightBarFill,
                                    { width: `${barWidthPercent}%` },
                                ]}
                            />
                        </View>
                        <Text style={[councilStyles.weightLabel, cts.weightLabel]}>
                            {item.governanceWeight.toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Activity multiplier pill */}
                <View style={[councilStyles.activityPill, cts.activityPill]}>
                    <Text style={[councilStyles.activityPillText, cts.activityPillText]}>
                        {activityPercent}%
                    </Text>
                </View>
            </View>
        );
    }, [maxWeight, theme, cts]);

    const keyExtractor = useCallback((item: CouncilMember) => item.id, []);

    // List header: status card + stats row
    const ListHeader = useMemo(() => {
        if (!council) return null;

        const memberCount = council.members.length;
        const totalWeight = council.totalGovernanceWeight;

        return (
            <View>
                {/* Your Status Card */}
                {eligibility != null && (
                    eligibility.isOnCouncil ? (
                        <View style={[councilStyles.statusCard, cts.statusCardBorder, councilStyles.statusCardOnCouncil]}>
                            <Crown size={22} color="#d4a017" />
                            <View style={{ flex: 1 }}>
                                <Text style={[councilStyles.statusCardTitle, cts.statusCardTitle]}>
                                    You&apos;re on the Council!
                                </Text>
                                <Text style={[councilStyles.statusCardSub, cts.statusCardSub]}>
                                    Rank #{eligibility.rank ?? '—'} in {nodeName}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={[councilStyles.statusCard, cts.statusCardDefault]}>
                            <View style={councilStyles.progressRow}>
                                <Text style={[councilStyles.progressLabel, cts.progressLabel]}>
                                    Your Weight
                                </Text>
                                <Text style={[councilStyles.progressValue, cts.progressValue]}>
                                    {eligibility.governanceWeight.toLocaleString()}
                                </Text>
                            </View>
                            <View style={[councilStyles.progressBarBg, cts.progressBarBg]}>
                                <View
                                    style={[
                                        councilStyles.progressBarFill,
                                        cts.progressBarFill,
                                        {
                                            width: eligibility.credNeededForCouncil > 0
                                                ? `${Math.min(
                                                    (eligibility.governanceWeight / (eligibility.governanceWeight + eligibility.credNeededForCouncil)) * 100,
                                                    100
                                                )}%`
                                                : '100%',
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[councilStyles.progressHint, cts.progressHint]}>
                                {eligibility.credNeededForCouncil > 0
                                    ? `Need ${eligibility.credNeededForCouncil.toLocaleString()} more weight to join`
                                    : 'You meet the threshold — keep it up!'}
                            </Text>
                        </View>
                    )
                )}

                {/* Stats row */}
                <View style={councilStyles.statsRow}>
                    <Text style={[councilStyles.statsText, cts.statsText]}>
                        <Text style={[councilStyles.statsBold, cts.statsBold]}>{memberCount}</Text>
                        {' '}Member{memberCount !== 1 ? 's' : ''} · <Text style={[councilStyles.statsBold, cts.statsBold]}>{totalWeight.toLocaleString()}</Text>
                        {' '}Total Weight
                    </Text>
                </View>
            </View>
        );
    }, [council, eligibility, nodeName, cts]);

    // Loading state
    if (loading) {
        return (
            <View style={councilStyles.centered}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    // Error state
    if (error || !council) {
        return (
            <View style={councilStyles.centered}>
                <Crown size={36} color={theme.muted} />
                <Text style={[councilStyles.emptyTitle, cts.emptyTitle]}>
                    {error ?? 'No council data'}
                </Text>
                <Text style={[councilStyles.emptySubtitle, cts.emptySubtitle]}>
                    Council data could not be loaded for this node
                </Text>
            </View>
        );
    }

    // Empty council
    if (council.members.length === 0) {
        return (
            <View style={councilStyles.centered}>
                <Crown size={36} color={theme.muted} />
                <Text style={[councilStyles.emptyTitle, cts.emptyTitle]}>No council members yet</Text>
                <Text style={[councilStyles.emptySubtitle, cts.emptySubtitle]}>
                    Earn cred in {nodeName} to become a council member
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={council.members}
            renderItem={renderMember}
            keyExtractor={keyExtractor}
            style={councilStyles.container}
            contentContainerStyle={councilStyles.listContent}
            ListHeaderComponent={ListHeader}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
        />
    );
});

// ── Component ──────────────────────────────────────────────────

export const GovernanceScreen = ({
    onBack,
    initialTab = 'moderation',
    nodeId,
    nodeName,
    userId: _userId,
    onUserClick: _onUserClick,
}: GovernanceScreenProps) => {
    const theme = useAppTheme();
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    // Memoized themed style overrides
    const ts = useMemo(() => StyleSheet.create({
        container: { backgroundColor: theme.bg },
        header: { borderBottomColor: theme.border },
        title: { color: theme.text },
        tabBar: { backgroundColor: theme.panel, borderBottomColor: theme.border },
        activeTabBorder: { borderBottomColor: theme.accent },
        activeTabLabel: { color: theme.accent },
        inactiveTabLabel: { color: theme.muted },
        placeholderText: { color: theme.muted },
    }), [theme]);

    const handleTabPress = useCallback((tabId: TabId) => {
        setActiveTab(tabId);
    }, []);

    const activeTabDef = TABS.find(t => t.id === activeTab);

    return (
        <SafeAreaView style={[styles.container, ts.container]}>
            {/* Header */}
            <View style={[styles.header, ts.header]}>
                <Pressable onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </Pressable>
                <Text style={[styles.title, ts.title]}>Command Center</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, ts.tabBar]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBarContent}
                >
                    {TABS.map((tab) => {
                        const isActive = tab.id === activeTab;
                        const iconColor = isActive ? theme.accent : theme.muted;

                        return (
                            <Pressable
                                key={tab.id}
                                style={[
                                    styles.tab,
                                    isActive && ts.activeTabBorder,
                                ]}
                                onPress={() => handleTabPress(tab.id)}
                            >
                                <tab.Icon size={18} color={iconColor} />
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        isActive ? ts.activeTabLabel : ts.inactiveTabLabel,
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Tab Content */}
            {activeTab === 'moderation' ? (
                <ModerationTab />
            ) : activeTab === 'council' ? (
                <CouncilTab nodeId={nodeId ?? ''} nodeName={nodeName ?? 'this node'} />
            ) : (
                <View style={styles.content}>
                    <Text style={[styles.placeholderText, ts.placeholderText]}>
                        {activeTabDef ? `${activeTabDef.label} tab placeholder` : ''}
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};
