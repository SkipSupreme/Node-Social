import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, G, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ArrowLeft, Users, Shield, Zap, RefreshCw } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

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

interface WebOfTrustScreenProps {
    onBack: () => void;
    userId?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_SIZE = Math.min(SCREEN_WIDTH - 40, 400);
const CENTER = GRAPH_SIZE / 2;

export const WebOfTrustScreen: React.FC<WebOfTrustScreenProps> = ({ onBack, userId }) => {
    const { user: authUser } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [nodes, setNodes] = useState<TrustNode[]>([]);
    const [edges, setEdges] = useState<TrustEdge[]>([]);
    const [stats, setStats] = useState({
        totalVouchedOut: 0,
        totalVouchedIn: 0,
        vouchCount: 0,
        voucherCount: 0,
    });
    const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);

    const targetUserId = userId || authUser?.id;
    const targetUsername = authUser?.username || 'User';

    useEffect(() => {
        fetchTrustData();
    }, [targetUserId]);

    const fetchTrustData = async () => {
        if (!targetUserId) return;

        setLoading(true);
        try {
            // Fetch vouches given and received
            const [vouchesGiven, vouchesReceived] = await Promise.all([
                api.get<{ vouches: any[] }>(`/vouches/given/${targetUserId}`),
                api.get<{ vouches: any[] }>(`/vouches/received/${targetUserId}`),
            ]);

            const givenVouches = vouchesGiven.vouches || [];
            const receivedVouches = vouchesReceived.vouches || [];

            // Create nodes and edges
            const nodeMap = new Map<string, TrustNode>();
            const edgeList: TrustEdge[] = [];

            // Add self node at center
            nodeMap.set(targetUserId, {
                id: targetUserId,
                username: targetUsername,
                avatar: authUser?.avatar,
                cred: authUser?.cred || 0,
                x: CENTER,
                y: CENTER,
                radius: 35,
                color: COLORS.node.accent,
                type: 'self',
            });

            // Calculate positions for vouched users (inner ring)
            const vouchedCount = givenVouches.length;
            givenVouches.forEach((vouch, index) => {
                const angle = (2 * Math.PI * index) / Math.max(vouchedCount, 1) - Math.PI / 2;
                const distance = 100;
                const x = CENTER + Math.cos(angle) * distance;
                const y = CENTER + Math.sin(angle) * distance;

                nodeMap.set(vouch.vouchee.id, {
                    id: vouch.vouchee.id,
                    username: vouch.vouchee.username,
                    avatar: vouch.vouchee.avatar,
                    cred: vouch.vouchee.cred || 0,
                    x,
                    y,
                    radius: Math.max(15, Math.min(25, 15 + vouch.amount / 20)),
                    color: '#10b981',
                    type: 'vouched',
                });

                edgeList.push({
                    from: targetUserId,
                    to: vouch.vouchee.id,
                    amount: vouch.amount,
                    color: '#10b981',
                });
            });

            // Calculate positions for vouchers (outer ring)
            const voucherCount = receivedVouches.length;
            receivedVouches.forEach((vouch, index) => {
                if (nodeMap.has(vouch.voucher.id)) {
                    // Already in the graph, update type to show bidirectional
                    const existing = nodeMap.get(vouch.voucher.id)!;
                    existing.color = '#f59e0b'; // Gold for bidirectional
                } else {
                    const angle = (2 * Math.PI * index) / Math.max(voucherCount, 1);
                    const distance = 150;
                    const x = CENTER + Math.cos(angle) * distance;
                    const y = CENTER + Math.sin(angle) * distance;

                    nodeMap.set(vouch.voucher.id, {
                        id: vouch.voucher.id,
                        username: vouch.voucher.username,
                        avatar: vouch.voucher.avatar,
                        cred: vouch.voucher.cred || 0,
                        x,
                        y,
                        radius: Math.max(15, Math.min(25, 15 + vouch.amount / 20)),
                        color: '#8b5cf6',
                        type: 'voucher',
                    });
                }

                edgeList.push({
                    from: vouch.voucher.id,
                    to: targetUserId,
                    amount: vouch.amount,
                    color: '#8b5cf6',
                });
            });

            setNodes(Array.from(nodeMap.values()));
            setEdges(edgeList);
            setStats({
                totalVouchedOut: givenVouches.reduce((sum, v) => sum + v.amount, 0),
                totalVouchedIn: receivedVouches.reduce((sum, v) => sum + v.amount, 0),
                vouchCount: givenVouches.length,
                voucherCount: receivedVouches.length,
            });
        } catch (error) {
            console.error('Failed to fetch trust data:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderGraph = useMemo(() => {
        if (nodes.length === 0) return null;

        return (
            <Svg width={GRAPH_SIZE} height={GRAPH_SIZE} viewBox={`0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}`}>
                <Defs>
                    <RadialGradient id="selfGlow" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor={COLORS.node.accent} stopOpacity="0.4" />
                        <Stop offset="100%" stopColor={COLORS.node.accent} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Draw edges */}
                <G>
                    {edges.map((edge, index) => {
                        const fromNode = nodes.find(n => n.id === edge.from);
                        const toNode = nodes.find(n => n.id === edge.to);
                        if (!fromNode || !toNode) return null;

                        return (
                            <Line
                                key={`edge-${index}`}
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

                {/* Self glow effect */}
                <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={60}
                    fill="url(#selfGlow)"
                />

                {/* Draw nodes */}
                <G>
                    {nodes.map((node) => (
                        <G key={node.id}>
                            {/* Node circle */}
                            <Circle
                                cx={node.x}
                                cy={node.y}
                                r={node.radius}
                                fill={node.color}
                                stroke={selectedNode?.id === node.id ? '#fff' : COLORS.node.border}
                                strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                                onPress={() => setSelectedNode(node)}
                            />
                            {/* Username label */}
                            <SvgText
                                x={node.x}
                                y={node.y + node.radius + 14}
                                fontSize={node.type === 'self' ? 12 : 10}
                                fill={COLORS.node.text}
                                textAnchor="middle"
                                fontWeight={node.type === 'self' ? 'bold' : 'normal'}
                            >
                                {node.type === 'self' ? 'You' : `@${node.username.slice(0, 8)}`}
                            </SvgText>
                            {/* Initial letter in node */}
                            <SvgText
                                x={node.x}
                                y={node.y + 5}
                                fontSize={node.radius * 0.8}
                                fill="#fff"
                                textAnchor="middle"
                                fontWeight="bold"
                            >
                                {node.username[0]?.toUpperCase() || '?'}
                            </SvgText>
                        </G>
                    ))}
                </G>
            </Svg>
        );
    }, [nodes, edges, selectedNode]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft color={COLORS.node.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Web of Trust</Text>
                <TouchableOpacity onPress={fetchTrustData} style={styles.refreshButton}>
                    <RefreshCw color={COLORS.node.accent} size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderColor: '#10b981' }]}>
                        <Shield size={20} color="#10b981" />
                        <Text style={styles.statValue}>{stats.vouchCount}</Text>
                        <Text style={styles.statLabel}>Vouched</Text>
                        <Text style={styles.statAmount}>{stats.totalVouchedOut} cred</Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: '#8b5cf6' }]}>
                        <Users size={20} color="#8b5cf6" />
                        <Text style={styles.statValue}>{stats.voucherCount}</Text>
                        <Text style={styles.statLabel}>Vouchers</Text>
                        <Text style={styles.statAmount}>{stats.totalVouchedIn} cred</Text>
                    </View>
                </View>

                {/* Trust Score */}
                <View style={styles.trustScoreCard}>
                    <Zap size={24} color="#fbbf24" />
                    <View style={styles.trustScoreContent}>
                        <Text style={styles.trustScoreLabel}>Trust Score</Text>
                        <Text style={styles.trustScoreValue}>
                            {Math.round((stats.totalVouchedIn + stats.totalVouchedOut) / 2)}
                        </Text>
                    </View>
                    <Text style={styles.trustScoreHint}>
                        Based on vouch activity
                    </Text>
                </View>

                {/* Graph Visualization */}
                <View style={styles.graphContainer}>
                    <Text style={styles.graphTitle}>Trust Network</Text>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.node.accent} />
                            <Text style={styles.loadingText}>Loading trust network...</Text>
                        </View>
                    ) : nodes.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Users size={48} color={COLORS.node.muted} />
                            <Text style={styles.emptyTitle}>No Trust Connections Yet</Text>
                            <Text style={styles.emptyText}>
                                Vouch for users you trust to start building your web of trust.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.graphWrapper}>
                            {renderGraph}
                        </View>
                    )}
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                    <Text style={styles.legendTitle}>Legend</Text>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.node.accent }]} />
                        <Text style={styles.legendText}>You</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                        <Text style={styles.legendText}>Users you've vouched for</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                        <Text style={styles.legendText}>Users who vouched for you</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                        <Text style={styles.legendText}>Mutual trust (both ways)</Text>
                    </View>
                </View>

                {/* Selected Node Info */}
                {selectedNode && selectedNode.type !== 'self' && (
                    <View style={styles.selectedInfo}>
                        <View style={styles.selectedHeader}>
                            <View style={[styles.selectedAvatar, { backgroundColor: selectedNode.color }]}>
                                <Text style={styles.selectedAvatarText}>
                                    {selectedNode.username[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.selectedUsername}>@{selectedNode.username}</Text>
                                <Text style={styles.selectedCred}>{selectedNode.cred} cred</Text>
                            </View>
                        </View>
                        <Text style={styles.selectedType}>
                            {selectedNode.type === 'vouched'
                                ? 'You vouched for this user'
                                : 'This user vouched for you'}
                        </Text>
                    </View>
                )}
            </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    refreshButton: {
        padding: 4,
    },
    content: {
        padding: 16,
        paddingBottom: 100,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        gap: 4,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.node.text,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statAmount: {
        fontSize: 12,
        color: COLORS.node.accent,
        fontWeight: '500',
    },
    trustScoreCard: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    trustScoreContent: {
        flex: 1,
    },
    trustScoreLabel: {
        fontSize: 12,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    trustScoreValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fbbf24',
    },
    trustScoreHint: {
        fontSize: 11,
        color: COLORS.node.muted,
        maxWidth: 80,
        textAlign: 'right',
    },
    graphContainer: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    graphTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    graphWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        height: GRAPH_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
    emptyState: {
        height: GRAPH_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.node.muted,
        textAlign: 'center',
        maxWidth: 250,
    },
    legend: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    legendTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 12,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 13,
        color: COLORS.node.muted,
    },
    selectedInfo: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    selectedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    selectedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    selectedUsername: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    selectedCred: {
        fontSize: 13,
        color: COLORS.node.muted,
    },
    selectedType: {
        fontSize: 13,
        color: COLORS.node.accent,
    },
});
