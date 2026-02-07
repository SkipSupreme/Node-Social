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
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Crown, Globe, Scale, Ban, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react-native';
import Svg, { Circle, Line, G, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../hooks/useTheme';
import {
    api,
    type Post,
    type Vouch,
    getNodeCouncil,
    getCouncilEligibility,
    getVouchesGiven,
    getVouchesReceived,
    listAppeals,
    getMyJuryDuties,
    getMyAppeals,
    voteOnAppeal,
    type CouncilInfo,
    type CouncilEligibility,
    type CouncilMember,
    type Appeal,
    type AppealStatus,
    type JuryDuty,
    type AppealJuror,
} from '../lib/api';
import { showAlert, showToast } from '../lib/alert';
import { useAuthStore } from '../store/auth';
import { RevokeVouchModal } from '../components/ui/RevokeVouchModal';

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

// ── Trust types ──────────────────────────────────────────────────

type VouchFilter = 'all' | 'given' | 'received' | 'revoked';

/** Shape of a vouch as returned in the trust graph endpoints */
interface TrustVouch {
    amount: number;
    vouchee: {
        id: string;
        username: string;
        avatar?: string | null;
        cred: number;
    };
    voucher: {
        id: string;
        username: string;
        avatar?: string | null;
        cred: number;
    };
}

interface TrustNode {
    id: string;
    username: string;
    avatar?: string | null;
    cred: number;
    x: number;
    y: number;
    radius: number;
    color: string;
    type: 'self' | 'vouched' | 'voucher';
}

interface TrustEdge {
    from: string;
    to: string;
    amount: number;
    color: string;
}

// ── Trust static styles ──────────────────────────────────────────

const trustStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    // Section headers
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    // Stats strip
    statsStrip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    statsText: {
        fontSize: 13,
        lineHeight: 20,
    },
    statsBold: {
        fontWeight: '700',
    },
    // Filter pills
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    filterPillLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    filterPillCount: {
        fontSize: 11,
        fontWeight: '700',
        minWidth: 18,
        textAlign: 'center',
    },
    // Vouch row
    vouchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    vouchRowRevoked: {
        opacity: 0.6,
    },
    vouchAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    vouchAvatarFallback: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    vouchAvatarInitial: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    vouchInfo: {
        flex: 1,
        gap: 2,
    },
    vouchUsername: {
        fontSize: 13,
        fontWeight: '600',
    },
    vouchDetail: {
        fontSize: 12,
    },
    vouchPenalty: {
        fontSize: 11,
        color: '#ef4444',
    },
    revokeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    revokeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ef4444',
    },
    // Graph
    graphContainer: {
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        alignItems: 'center',
    },
    graphWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Legend
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 16,
        flexWrap: 'wrap',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: 11,
    },
    // Selected node detail
    selectedCard: {
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectedAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    selectedInfo: {
        flex: 1,
    },
    selectedUsername: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectedMeta: {
        fontSize: 12,
    },
    // Empty / loading
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

// ── TrustTab ──────────────────────────────────────────────────

interface TrustTabProps {
    userId?: string;
    onUserClick?: (userId: string) => void;
}

const VOUCH_FILTERS: { id: VouchFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'given', label: 'Given' },
    { id: 'received', label: 'Received' },
    { id: 'revoked', label: 'Revoked' },
];

const TrustTab = React.memo(function TrustTab({ userId, onUserClick }: TrustTabProps) {
    const theme = useAppTheme();
    const { user: authUser } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [givenVouches, setGivenVouches] = useState<Vouch[]>([]);
    const [receivedVouches, setReceivedVouches] = useState<Vouch[]>([]);
    const [filter, setFilter] = useState<VouchFilter>('all');
    const [revokeTarget, setRevokeTarget] = useState<{ userId: string; username: string; stake: number } | null>(null);

    // Graph state
    const [graphNodes, setGraphNodes] = useState<TrustNode[]>([]);
    const [graphEdges, setGraphEdges] = useState<TrustEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);

    const targetUserId = userId ?? authUser?.id;
    const screenWidth = Dimensions.get('window').width;
    const GRAPH_SIZE = Math.min(screenWidth - 40, 400);
    const CENTER_XY = GRAPH_SIZE / 2;

    // Themed styles
    const tts = useMemo(() => StyleSheet.create({
        statsText: { color: theme.muted },
        statsBold: { color: theme.text },
        statsAccent: { color: theme.accent },
        sectionTitle: { color: theme.text },
        filterPillActive: { backgroundColor: theme.accent },
        filterPillInactive: { backgroundColor: theme.bgAlt },
        filterPillLabelActive: { color: '#fff' },
        filterPillLabelInactive: { color: theme.textSecondary },
        filterPillCountActive: { color: 'rgba(255,255,255,0.8)' },
        filterPillCountInactive: { color: theme.muted },
        vouchRow: { borderBottomColor: theme.border },
        vouchUsername: { color: theme.text },
        vouchDetail: { color: theme.muted },
        graphContainer: { backgroundColor: theme.panel, borderColor: theme.border },
        legendText: { color: theme.muted },
        selectedCard: { backgroundColor: theme.panel, borderColor: theme.accent },
        selectedUsername: { color: theme.text },
        selectedMeta: { color: theme.muted },
        emptyTitle: { color: theme.text },
        emptySubtitle: { color: theme.muted },
    }), [theme]);

    // Fetch vouch data
    const fetchData = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            const [given, received] = await Promise.all([
                getVouchesGiven(),
                getVouchesReceived(),
            ]);
            setGivenVouches(given);
            setReceivedVouches(received);

            // Build graph from trust graph API endpoints
            try {
                const [graphGiven, graphReceived] = await Promise.all([
                    api.get<{ vouches: TrustVouch[] }>(`/vouches/given/${targetUserId}`),
                    api.get<{ vouches: TrustVouch[] }>(`/vouches/received/${targetUserId}`),
                ]);

                const givenList = graphGiven.vouches ?? [];
                const receivedList = graphReceived.vouches ?? [];

                const nodeMap = new Map<string, TrustNode>();

                // Self node at center
                nodeMap.set(targetUserId, {
                    id: targetUserId,
                    username: authUser?.username ?? 'You',
                    avatar: authUser?.avatar,
                    cred: authUser?.cred ?? 0,
                    x: CENTER_XY,
                    y: CENTER_XY,
                    radius: 35,
                    color: theme.accent,
                    type: 'self',
                });

                // Inner ring: users you vouched for
                const vouchedCount = givenList.length;
                givenList.forEach((vouch, index) => {
                    const angle = (2 * Math.PI * index) / Math.max(vouchedCount, 1) - Math.PI / 2;
                    const distance = 100;
                    const x = CENTER_XY + Math.cos(angle) * distance;
                    const y = CENTER_XY + Math.sin(angle) * distance;

                    nodeMap.set(vouch.vouchee.id, {
                        id: vouch.vouchee.id,
                        username: vouch.vouchee.username,
                        avatar: vouch.vouchee.avatar,
                        cred: vouch.vouchee.cred,
                        x,
                        y,
                        radius: Math.max(15, Math.min(25, 15 + vouch.amount / 20)),
                        color: '#10b981',
                        type: 'vouched',
                    });
                });

                // Outer ring: users who vouched for you
                const voucherCount = receivedList.length;
                receivedList.forEach((vouch, index) => {
                    if (nodeMap.has(vouch.voucher.id)) {
                        // Bidirectional — mark gold
                        const existing = nodeMap.get(vouch.voucher.id);
                        if (existing) {
                            existing.color = '#f59e0b';
                        }
                    } else {
                        const angle = (2 * Math.PI * index) / Math.max(voucherCount, 1);
                        const distance = 150;
                        const x = CENTER_XY + Math.cos(angle) * distance;
                        const y = CENTER_XY + Math.sin(angle) * distance;

                        nodeMap.set(vouch.voucher.id, {
                            id: vouch.voucher.id,
                            username: vouch.voucher.username,
                            avatar: vouch.voucher.avatar,
                            cred: vouch.voucher.cred,
                            x,
                            y,
                            radius: Math.max(15, Math.min(25, 15 + vouch.amount / 20)),
                            color: '#8b5cf6',
                            type: 'voucher',
                        });
                    }
                });

                // Build edges
                const edgeList: TrustEdge[] = [];
                for (const vouch of givenList) {
                    edgeList.push({
                        from: targetUserId,
                        to: vouch.vouchee.id,
                        amount: vouch.amount,
                        color: '#10b981',
                    });
                }
                for (const vouch of receivedList) {
                    edgeList.push({
                        from: vouch.voucher.id,
                        to: targetUserId,
                        amount: vouch.amount,
                        color: '#8b5cf6',
                    });
                }

                setGraphNodes(Array.from(nodeMap.values()));
                setGraphEdges(edgeList);
            } catch (graphErr) {
                console.error('Failed to fetch trust graph data:', graphErr);
                // Graph is non-critical, vouch list still works
            }
        } catch (err) {
            console.error('Failed to fetch vouch data:', err);
            showAlert('Error', 'Failed to load vouch data');
        } finally {
            setLoading(false);
        }
    }, [targetUserId, authUser, CENTER_XY, theme.accent]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Derived stats
    const activeGiven = useMemo(() => givenVouches.filter(v => v.active), [givenVouches]);
    const activeReceived = useMemo(() => receivedVouches.filter(v => v.active), [receivedVouches]);
    const revokedVouches = useMemo(() => [
        ...givenVouches.filter(v => !v.active),
        ...receivedVouches.filter(v => !v.active),
    ], [givenVouches, receivedVouches]);

    const totalCredOut = useMemo(() => activeGiven.reduce((sum, v) => sum + v.stake, 0), [activeGiven]);
    const totalCredIn = useMemo(() => activeReceived.reduce((sum, v) => sum + v.stake, 0), [activeReceived]);
    const trustScore = Math.round((totalCredIn + totalCredOut) / 2);

    // Filter counts
    const filterCounts: Record<VouchFilter, number> = useMemo(() => ({
        all: activeGiven.length + activeReceived.length,
        given: activeGiven.length,
        received: activeReceived.length,
        revoked: revokedVouches.length,
    }), [activeGiven, activeReceived, revokedVouches]);

    // Filtered vouch list
    const filteredVouches = useMemo(() => {
        switch (filter) {
            case 'given': return activeGiven;
            case 'received': return activeReceived;
            case 'revoked': return revokedVouches;
            default: return [...activeGiven, ...activeReceived];
        }
    }, [filter, activeGiven, activeReceived, revokedVouches]);

    // Handlers
    const handleRevokeSuccess = useCallback((penaltyPaid: number) => {
        showToast(`Vouch revoked. ${penaltyPaid} cred penalty.`, 'info');
        fetchData();
    }, [fetchData]);

    const handleNodePress = useCallback((node: TrustNode) => {
        if (node.type === 'self') {
            setSelectedNode(null);
        } else {
            setSelectedNode(node);
        }
    }, []);

    // SVG graph render (memoized — expensive)
    const renderGraph = useMemo(() => {
        if (graphNodes.length === 0) return null;

        return (
            <Svg width={GRAPH_SIZE} height={GRAPH_SIZE} viewBox={`0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}`}>
                <Defs>
                    <RadialGradient id="trustSelfGlow" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor={theme.accent} stopOpacity="0.4" />
                        <Stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Edges */}
                <G>
                    {graphEdges.map((edge, index) => {
                        const fromNode = graphNodes.find(n => n.id === edge.from);
                        const toNode = graphNodes.find(n => n.id === edge.to);
                        if (!fromNode || !toNode) return null;

                        return (
                            <Line
                                key={`trust-edge-${index}`}
                                x1={fromNode.x}
                                y1={fromNode.y}
                                x2={toNode.x}
                                y2={toNode.y}
                                stroke={edge.color}
                                strokeWidth={Math.max(1, Math.min(4, edge.amount / 50))}
                                strokeOpacity={0.5}
                            />
                        );
                    })}
                </G>

                {/* Self glow */}
                <Circle cx={CENTER_XY} cy={CENTER_XY} r={60} fill="url(#trustSelfGlow)" />

                {/* Nodes */}
                <G>
                    {graphNodes.map((node) => (
                        <G key={node.id}>
                            <Circle
                                cx={node.x}
                                cy={node.y}
                                r={node.radius}
                                fill={node.color}
                                stroke={selectedNode?.id === node.id ? '#fff' : theme.border}
                                strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                                onPress={() => handleNodePress(node)}
                            />
                            <SvgText
                                x={node.x}
                                y={node.y + node.radius + 14}
                                fontSize={node.type === 'self' ? 12 : 10}
                                fill={theme.text}
                                textAnchor="middle"
                                fontWeight={node.type === 'self' ? 'bold' : 'normal'}
                            >
                                {node.type === 'self' ? 'You' : `@${node.username.slice(0, 8)}`}
                            </SvgText>
                            <SvgText
                                x={node.x}
                                y={node.y + 5}
                                fontSize={node.radius * 0.8}
                                fill="#fff"
                                textAnchor="middle"
                                fontWeight="bold"
                            >
                                {node.username[0]?.toUpperCase() ?? '?'}
                            </SvgText>
                        </G>
                    ))}
                </G>
            </Svg>
        );
    }, [graphNodes, graphEdges, selectedNode, GRAPH_SIZE, CENTER_XY, theme, handleNodePress]);

    // Loading state
    if (loading) {
        return (
            <View style={trustStyles.centered}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    // Determine if a vouch is "given" by the current user
    const isGivenVouch = (v: Vouch) => v.voucherId === authUser?.id;

    return (
        <View style={trustStyles.container}>
            <ScrollView contentContainerStyle={trustStyles.scrollContent}>
                {/* ── Section 1: Vouch Management ── */}

                {/* Stats strip */}
                <View style={trustStyles.statsStrip}>
                    <Text style={[trustStyles.statsText, tts.statsText]}>
                        <Text style={[trustStyles.statsBold, tts.statsAccent]}>{activeGiven.length}</Text>
                        <Text> Given</Text>
                        <Text> · </Text>
                        <Text style={[trustStyles.statsBold, tts.statsBold]}>{totalCredOut}</Text>
                        <Text> cred out</Text>
                        <Text>  |  </Text>
                        <Text style={[trustStyles.statsBold, tts.statsAccent]}>{activeReceived.length}</Text>
                        <Text> Received</Text>
                        <Text> · </Text>
                        <Text style={[trustStyles.statsBold, tts.statsBold]}>{totalCredIn}</Text>
                        <Text> cred in</Text>
                        <Text>  |  </Text>
                        <Text>Trust: </Text>
                        <Text style={[trustStyles.statsBold, tts.statsAccent]}>{trustScore}</Text>
                    </Text>
                </View>

                {/* Filter pills */}
                <View style={trustStyles.filterRow}>
                    {VOUCH_FILTERS.map(f => {
                        const isActive = filter === f.id;
                        return (
                            <Pressable
                                key={f.id}
                                style={[
                                    trustStyles.filterPill,
                                    isActive ? tts.filterPillActive : tts.filterPillInactive,
                                ]}
                                onPress={() => setFilter(f.id)}
                            >
                                <Text
                                    style={[
                                        trustStyles.filterPillLabel,
                                        isActive ? tts.filterPillLabelActive : tts.filterPillLabelInactive,
                                    ]}
                                >
                                    {f.label}
                                </Text>
                                <Text
                                    style={[
                                        trustStyles.filterPillCount,
                                        isActive ? tts.filterPillCountActive : tts.filterPillCountInactive,
                                    ]}
                                >
                                    {filterCounts[f.id]}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Vouch list */}
                {filteredVouches.length === 0 ? (
                    <View style={[trustStyles.centered, { minHeight: 120 }]}>
                        <Globe size={28} color={theme.muted} />
                        <Text style={[trustStyles.emptyTitle, tts.emptyTitle]}>No vouches</Text>
                        <Text style={[trustStyles.emptySubtitle, tts.emptySubtitle]}>
                            {filter === 'all'
                                ? 'No active vouches yet'
                                : `No ${filter} vouches`}
                        </Text>
                    </View>
                ) : (
                    filteredVouches.map((vouch) => {
                        const given = isGivenVouch(vouch);
                        const otherUser = given ? vouch.vouchee : vouch.voucher;
                        const username = otherUser?.username ?? 'unknown';
                        const avatarUrl = otherUser?.avatar;
                        const isRevoked = !vouch.active;

                        return (
                            <Pressable
                                key={vouch.id}
                                style={[
                                    trustStyles.vouchRow,
                                    tts.vouchRow,
                                    isRevoked && trustStyles.vouchRowRevoked,
                                ]}
                                onPress={() => otherUser?.id && onUserClick?.(otherUser.id)}
                            >
                                {/* Avatar */}
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={trustStyles.vouchAvatar} />
                                ) : (
                                    <View style={[trustStyles.vouchAvatarFallback, { backgroundColor: theme.accent }]}>
                                        <Text style={trustStyles.vouchAvatarInitial}>
                                            {username.slice(0, 1).toUpperCase()}
                                        </Text>
                                    </View>
                                )}

                                {/* Info */}
                                <View style={trustStyles.vouchInfo}>
                                    <Text style={[trustStyles.vouchUsername, tts.vouchUsername]} numberOfLines={1}>
                                        @{username}
                                    </Text>
                                    <Text style={[trustStyles.vouchDetail, tts.vouchDetail]} numberOfLines={1}>
                                        {given ? `You vouched ${vouch.stake} cred` : `Vouched you ${vouch.stake} cred`}
                                        {' · '}
                                        {formatTimeAgo(vouch.createdAt)}
                                    </Text>
                                    {isRevoked && vouch.penaltyPaid != null && (
                                        <Text style={trustStyles.vouchPenalty}>
                                            Revoked · {vouch.penaltyPaid} cred penalty
                                        </Text>
                                    )}
                                </View>

                                {/* Revoke button — only for active given vouches */}
                                {given && vouch.active && otherUser && (
                                    <Pressable
                                        style={trustStyles.revokeBtn}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            setRevokeTarget({
                                                userId: otherUser.id,
                                                username: otherUser.username,
                                                stake: vouch.stake,
                                            });
                                        }}
                                    >
                                        <Text style={trustStyles.revokeBtnText}>Revoke</Text>
                                    </Pressable>
                                )}
                            </Pressable>
                        );
                    })
                )}

                {/* ── Section 2: Trust Graph ── */}
                <Text style={[trustStyles.sectionTitle, tts.sectionTitle]}>Trust Network</Text>

                {graphNodes.length === 0 ? (
                    <View style={[trustStyles.centered, { minHeight: 160 }]}>
                        <Globe size={36} color={theme.muted} />
                        <Text style={[trustStyles.emptyTitle, tts.emptyTitle]}>No connections yet</Text>
                        <Text style={[trustStyles.emptySubtitle, tts.emptySubtitle]}>
                            Vouch for users you trust to build your web of trust
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* SVG Graph */}
                        <View style={[trustStyles.graphContainer, tts.graphContainer]}>
                            <View style={trustStyles.graphWrapper}>
                                {renderGraph}
                            </View>
                        </View>

                        {/* Compact legend */}
                        <View style={trustStyles.legendRow}>
                            <View style={trustStyles.legendItem}>
                                <View style={[trustStyles.legendDot, { backgroundColor: theme.accent }]} />
                                <Text style={[trustStyles.legendText, tts.legendText]}>You</Text>
                            </View>
                            <View style={trustStyles.legendItem}>
                                <View style={[trustStyles.legendDot, { backgroundColor: '#10b981' }]} />
                                <Text style={[trustStyles.legendText, tts.legendText]}>Vouched</Text>
                            </View>
                            <View style={trustStyles.legendItem}>
                                <View style={[trustStyles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                                <Text style={[trustStyles.legendText, tts.legendText]}>Vouchers</Text>
                            </View>
                            <View style={trustStyles.legendItem}>
                                <View style={[trustStyles.legendDot, { backgroundColor: '#f59e0b' }]} />
                                <Text style={[trustStyles.legendText, tts.legendText]}>Mutual</Text>
                            </View>
                        </View>

                        {/* Selected node detail */}
                        {selectedNode && selectedNode.type !== 'self' && (
                            <Pressable
                                style={[trustStyles.selectedCard, tts.selectedCard]}
                                onPress={() => onUserClick?.(selectedNode.id)}
                            >
                                <View style={[trustStyles.selectedAvatar, { backgroundColor: selectedNode.color }]}>
                                    <Text style={trustStyles.selectedAvatarText}>
                                        {selectedNode.username[0]?.toUpperCase() ?? '?'}
                                    </Text>
                                </View>
                                <View style={trustStyles.selectedInfo}>
                                    <Text style={[trustStyles.selectedUsername, tts.selectedUsername]}>
                                        @{selectedNode.username}
                                    </Text>
                                    <Text style={[trustStyles.selectedMeta, tts.selectedMeta]}>
                                        {selectedNode.cred} cred · {selectedNode.type === 'vouched'
                                            ? 'You vouched for this user'
                                            : selectedNode.color === '#f59e0b'
                                                ? 'Mutual trust'
                                                : 'This user vouched for you'}
                                    </Text>
                                </View>
                            </Pressable>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Revoke modal */}
            {revokeTarget && (
                <RevokeVouchModal
                    visible={revokeTarget !== null}
                    onClose={() => setRevokeTarget(null)}
                    onSuccess={handleRevokeSuccess}
                    userId={revokeTarget.userId}
                    username={revokeTarget.username}
                    stake={revokeTarget.stake}
                />
            )}
        </View>
    );
});

// ── Appeals static styles ─────────────────────────────────────

const STATUS_COLORS: Record<AppealStatus, string> = {
    pending: '#f59e0b',
    voting: '#3b82f6',
    upheld: '#10b981',
    overturned: '#ef4444',
    expired: '#6b7280',
};

const STATUS_ICONS: Record<AppealStatus, React.ComponentType<{ size?: number; color?: string }>> = {
    pending: Clock,
    voting: Scale,
    upheld: CheckCircle,
    overturned: XCircle,
    expired: AlertCircle,
};

const APPEAL_TARGET_LABELS: Record<string, string> = {
    post: 'Appeal against post removal',
    comment: 'Appeal against comment removal',
    mod_action: 'Appeal against moderation action',
};

type AppealsSubTab = 'all' | 'jury' | 'mine';

const APPEALS_SUB_TABS: { id: AppealsSubTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'jury', label: 'Jury' },
    { id: 'mine', label: 'Mine' },
];

const appealStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    subTabRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    subTabPill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    subTabLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 32,
    },
    // Appeal card
    card: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    cardStripe: {
        width: 3,
    },
    cardBody: {
        flex: 1,
        padding: 12,
        gap: 6,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    appealTypeText: {
        fontSize: 12,
        flex: 1,
    },
    dateText: {
        fontSize: 11,
    },
    reasonText: {
        fontSize: 13,
        lineHeight: 18,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    stakeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    timeRemainingText: {
        fontSize: 11,
        marginLeft: 12,
    },
    chevronContainer: {
        marginLeft: 'auto',
    },
    // Jury duty card
    juryCard: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 10,
        borderWidth: 2,
        overflow: 'hidden',
    },
    juryBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    juryBannerText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    juryCardBody: {
        padding: 12,
        gap: 6,
    },
    juryButtonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    juryButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    juryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    // Vote modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 14,
        padding: 20,
        gap: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    modalCancelBtn: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 14,
    },
    // Empty / loading
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

// ── AppealsTab ──────────────────────────────────────────────────

function formatTimeRemaining(deadline: string): string {
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h left`;
    }
    return `${hours}h ${minutes}m left`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const AppealsTab = React.memo(function AppealsTab() {
    const theme = useAppTheme();
    const [subTab, setSubTab] = useState<AppealsSubTab>('all');
    const [loading, setLoading] = useState(true);
    const [appeals, setAppeals] = useState<Appeal[]>([]);
    const [juryDuties, setJuryDuties] = useState<Array<AppealJuror & { appeal: Appeal }>>([]);
    const [myAppeals, setMyAppeals] = useState<Appeal[]>([]);

    // Vote modal state
    const [voteModalVisible, setVoteModalVisible] = useState(false);
    const [voteAppealId, setVoteAppealId] = useState<string | null>(null);
    const [voteReason, setVoteReason] = useState('');
    const [voteSubmitting, setVoteSubmitting] = useState(false);

    // Themed styles
    const ats = useMemo(() => StyleSheet.create({
        subTabPillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
        subTabPillInactive: { backgroundColor: 'transparent', borderColor: theme.border },
        subTabLabelActive: { color: '#fff' },
        subTabLabelInactive: { color: theme.muted },
        card: { backgroundColor: theme.panel, borderColor: theme.border },
        appealTypeText: { color: theme.textSecondary },
        dateText: { color: theme.muted },
        reasonText: { color: theme.text },
        stakeText: { color: theme.accent },
        timeRemainingText: { color: theme.muted },
        juryCard: { borderColor: theme.accent },
        juryBanner: { backgroundColor: theme.accent },
        juryCardBody: { backgroundColor: theme.panel },
        modalCard: { backgroundColor: theme.panel },
        modalTitle: { color: theme.text },
        modalInput: { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
        modalCancelText: { color: theme.muted },
        emptyTitle: { color: theme.text },
        emptySubtitle: { color: theme.muted },
    }), [theme]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (subTab === 'all') {
                const result = await listAppeals();
                setAppeals(result.appeals);
            } else if (subTab === 'jury') {
                const result = await getMyJuryDuties();
                setJuryDuties(result.pending);
            } else {
                const result = await getMyAppeals();
                setMyAppeals(result);
            }
        } catch (err) {
            showAlert('Error', 'Failed to load appeals data.');
        } finally {
            setLoading(false);
        }
    }, [subTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Vote handlers
    const openVoteModal = useCallback((appealId: string) => {
        setVoteAppealId(appealId);
        setVoteReason('');
        setVoteModalVisible(true);
    }, []);

    const closeVoteModal = useCallback(() => {
        setVoteModalVisible(false);
        setVoteAppealId(null);
        setVoteReason('');
    }, []);

    const handleVote = useCallback(async (vote: 'uphold' | 'overturn') => {
        if (!voteAppealId) return;
        setVoteSubmitting(true);
        try {
            await voteOnAppeal(voteAppealId, vote, voteReason || undefined);
            showToast('Vote cast successfully');
            closeVoteModal();
            fetchData();
        } catch (err) {
            showAlert('Error', 'Failed to cast vote. Please try again.');
        } finally {
            setVoteSubmitting(false);
        }
    }, [voteAppealId, voteReason, closeVoteModal, fetchData]);

    // Render an appeal card (for "all" and "mine" sub-tabs)
    const renderAppealCard = useCallback(({ item }: { item: Appeal }) => {
        const statusColor = STATUS_COLORS[item.status];
        const StatusIcon = STATUS_ICONS[item.status];
        const targetLabel = APPEAL_TARGET_LABELS[item.targetType] ?? 'Appeal';
        const isVoting = item.status === 'voting';

        return (
            <View style={[appealStyles.card, ats.card]}>
                <View style={[appealStyles.cardStripe, { backgroundColor: statusColor }]} />
                <View style={appealStyles.cardBody}>
                    {/* Header: status badge + type + date */}
                    <View style={appealStyles.cardHeaderRow}>
                        <View style={[appealStyles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <StatusIcon size={12} color={statusColor} />
                            <Text style={[appealStyles.statusBadgeText, { color: statusColor }]}>
                                {item.status}
                            </Text>
                        </View>
                        <Text style={[appealStyles.appealTypeText, ats.appealTypeText]} numberOfLines={1}>
                            {targetLabel}
                        </Text>
                        <Text style={[appealStyles.dateText, ats.dateText]}>
                            {formatDate(item.createdAt)}
                        </Text>
                    </View>

                    {/* Reason (truncated to 2 lines) */}
                    <Text style={[appealStyles.reasonText, ats.reasonText]} numberOfLines={2}>
                        {item.reason}
                    </Text>

                    {/* Footer: stake + time remaining + chevron */}
                    <View style={appealStyles.cardFooter}>
                        <Text style={[appealStyles.stakeText, ats.stakeText]}>
                            {item.stake} cred staked
                        </Text>
                        {isVoting && item.juryDeadline && (
                            <Text style={[appealStyles.timeRemainingText, ats.timeRemainingText]}>
                                {formatTimeRemaining(item.juryDeadline)}
                            </Text>
                        )}
                        <View style={appealStyles.chevronContainer}>
                            <ChevronRight size={16} color={theme.muted} />
                        </View>
                    </View>
                </View>
            </View>
        );
    }, [ats, theme.muted]);

    // Render a jury duty card
    const renderJuryCard = useCallback(({ item }: { item: AppealJuror & { appeal: Appeal } }) => {
        const appeal = item.appeal;
        const statusColor = STATUS_COLORS[appeal.status];
        const StatusIcon = STATUS_ICONS[appeal.status];
        const targetLabel = APPEAL_TARGET_LABELS[appeal.targetType] ?? 'Appeal';

        return (
            <View style={[appealStyles.juryCard, ats.juryCard]}>
                {/* "Your Vote Needed" banner */}
                <View style={[appealStyles.juryBanner, ats.juryBanner]}>
                    <Scale size={14} color="#fff" />
                    <Text style={appealStyles.juryBannerText}>Your Vote Needed</Text>
                </View>

                <View style={[appealStyles.juryCardBody, ats.juryCardBody]}>
                    {/* Header */}
                    <View style={appealStyles.cardHeaderRow}>
                        <View style={[appealStyles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <StatusIcon size={12} color={statusColor} />
                            <Text style={[appealStyles.statusBadgeText, { color: statusColor }]}>
                                {appeal.status}
                            </Text>
                        </View>
                        <Text style={[appealStyles.appealTypeText, ats.appealTypeText]} numberOfLines={1}>
                            {targetLabel}
                        </Text>
                        <Text style={[appealStyles.dateText, ats.dateText]}>
                            {formatDate(appeal.createdAt)}
                        </Text>
                    </View>

                    {/* Reason */}
                    <Text style={[appealStyles.reasonText, ats.reasonText]} numberOfLines={2}>
                        {appeal.reason}
                    </Text>

                    {/* Footer: stake + time remaining */}
                    <View style={appealStyles.cardFooter}>
                        <Text style={[appealStyles.stakeText, ats.stakeText]}>
                            {appeal.stake} cred staked
                        </Text>
                        {appeal.juryDeadline && (
                            <Text style={[appealStyles.timeRemainingText, ats.timeRemainingText]}>
                                {formatTimeRemaining(appeal.juryDeadline)}
                            </Text>
                        )}
                    </View>

                    {/* Vote buttons */}
                    <View style={appealStyles.juryButtonRow}>
                        <Pressable
                            style={[appealStyles.juryButton, { backgroundColor: '#10b981' }]}
                            onPress={() => openVoteModal(appeal.id)}
                        >
                            <Text style={appealStyles.juryButtonText}>Uphold</Text>
                        </Pressable>
                        <Pressable
                            style={[appealStyles.juryButton, { backgroundColor: '#ef4444' }]}
                            onPress={() => openVoteModal(appeal.id)}
                        >
                            <Text style={appealStyles.juryButtonText}>Overturn</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }, [ats, openVoteModal]);

    // Key extractors
    const appealKeyExtractor = useCallback((item: Appeal) => item.id, []);
    const juryKeyExtractor = useCallback((item: AppealJuror & { appeal: Appeal }) => item.id, []);

    // Current data and renderer based on sub-tab
    const listData = subTab === 'all' ? appeals : subTab === 'jury' ? juryDuties : myAppeals;
    const isEmpty = !loading && listData.length === 0;

    const emptyMessages: Record<AppealsSubTab, { title: string; subtitle: string }> = {
        all: { title: 'No Appeals', subtitle: 'No appeals have been filed yet.' },
        jury: { title: 'No Jury Duties', subtitle: 'You have no pending jury duties.' },
        mine: { title: 'No Appeals Filed', subtitle: 'You haven\'t filed any appeals.' },
    };

    return (
        <View style={appealStyles.container}>
            {/* Sub-tab pills */}
            <View style={appealStyles.subTabRow}>
                {APPEALS_SUB_TABS.map((tab) => {
                    const isActive = tab.id === subTab;
                    return (
                        <Pressable
                            key={tab.id}
                            style={[
                                appealStyles.subTabPill,
                                isActive ? ats.subTabPillActive : ats.subTabPillInactive,
                            ]}
                            onPress={() => setSubTab(tab.id)}
                        >
                            <Text
                                style={[
                                    appealStyles.subTabLabel,
                                    isActive ? ats.subTabLabelActive : ats.subTabLabelInactive,
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Loading state */}
            {loading ? (
                <View style={appealStyles.centered}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : isEmpty ? (
                <View style={appealStyles.centered}>
                    <Scale size={40} color={theme.muted} />
                    <Text style={[appealStyles.emptyTitle, ats.emptyTitle]}>
                        {emptyMessages[subTab].title}
                    </Text>
                    <Text style={[appealStyles.emptySubtitle, ats.emptySubtitle]}>
                        {emptyMessages[subTab].subtitle}
                    </Text>
                </View>
            ) : subTab === 'jury' ? (
                <FlatList
                    data={juryDuties}
                    keyExtractor={juryKeyExtractor}
                    renderItem={renderJuryCard}
                    contentContainerStyle={appealStyles.listContent}
                />
            ) : (
                <FlatList
                    data={subTab === 'all' ? appeals : myAppeals}
                    keyExtractor={appealKeyExtractor}
                    renderItem={renderAppealCard}
                    contentContainerStyle={appealStyles.listContent}
                />
            )}

            {/* Vote modal (lazy) */}
            {voteModalVisible && (
                <Modal
                    transparent
                    animationType="fade"
                    visible={voteModalVisible}
                    onRequestClose={closeVoteModal}
                >
                    <Pressable style={appealStyles.modalOverlay} onPress={closeVoteModal}>
                        <Pressable style={[appealStyles.modalCard, ats.modalCard]} onPress={(e) => e.stopPropagation()}>
                            <Text style={[appealStyles.modalTitle, ats.modalTitle]}>Cast Your Vote</Text>

                            <TextInput
                                style={[appealStyles.modalInput, ats.modalInput]}
                                placeholder="Reason for your vote (optional)"
                                placeholderTextColor={theme.muted}
                                value={voteReason}
                                onChangeText={setVoteReason}
                                multiline
                                numberOfLines={3}
                            />

                            <View style={appealStyles.modalButtonRow}>
                                <Pressable
                                    style={[appealStyles.modalButton, { backgroundColor: '#10b981' }]}
                                    onPress={() => handleVote('uphold')}
                                    disabled={voteSubmitting}
                                >
                                    <Text style={appealStyles.modalButtonText}>
                                        {voteSubmitting ? 'Submitting...' : 'Uphold'}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[appealStyles.modalButton, { backgroundColor: '#ef4444' }]}
                                    onPress={() => handleVote('overturn')}
                                    disabled={voteSubmitting}
                                >
                                    <Text style={appealStyles.modalButtonText}>
                                        {voteSubmitting ? 'Submitting...' : 'Overturn'}
                                    </Text>
                                </Pressable>
                            </View>

                            <Pressable style={appealStyles.modalCancelBtn} onPress={closeVoteModal}>
                                <Text style={[appealStyles.modalCancelText, ats.modalCancelText]}>Cancel</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
        </View>
    );
});

// ── Component ──────────────────────────────────────────────────

export const GovernanceScreen = ({
    onBack,
    initialTab = 'moderation',
    nodeId,
    nodeName,
    userId,
    onUserClick,
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
            ) : activeTab === 'trust' ? (
                <TrustTab userId={userId} onUserClick={onUserClick} />
            ) : activeTab === 'appeals' ? (
                <AppealsTab />
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
