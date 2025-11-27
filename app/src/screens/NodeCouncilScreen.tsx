import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Crown, TrendingUp, Users, Shield } from 'lucide-react-native';
import { getNodeCouncil, getCouncilEligibility, CouncilInfo, CouncilEligibility } from '../lib/api';
import { COLORS, ERAS } from '../constants/theme';

interface NodeCouncilScreenProps {
    nodeId: string;
    nodeName?: string;
    onBack: () => void;
}

export const NodeCouncilScreen = ({ nodeId, nodeName, onBack }: NodeCouncilScreenProps) => {
    const [council, setCouncil] = useState<CouncilInfo | null>(null);
    const [eligibility, setEligibility] = useState<CouncilEligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [councilData, eligibilityData] = await Promise.all([
                    getNodeCouncil(nodeId),
                    getCouncilEligibility(nodeId).catch(() => null), // May fail if not logged in
                ]);
                setCouncil(councilData);
                setEligibility(eligibilityData);
            } catch (err: any) {
                console.error('Failed to fetch council:', err);
                setError('Failed to load council data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [nodeId]);

    const renderMember = ({ item, index }: { item: CouncilInfo['members'][0]; index: number }) => {
        const eraStyle = ERAS[item.role || 'Default'] || ERAS['Default'];
        const isTopMember = index === 0;

        return (
            <View style={[styles.memberCard, isTopMember && styles.topMemberCard]}>
                <View style={styles.rankBadge}>
                    {isTopMember ? (
                        <Crown size={16} color="#fbbf24" />
                    ) : (
                        <Text style={styles.rankText}>#{index + 1}</Text>
                    )}
                </View>

                <View style={styles.memberInfo}>
                    <View style={styles.avatarContainer}>
                        {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                    {item.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>@{item.username}</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statBadge}>
                                <TrendingUp size={12} color={COLORS.node.accent} />
                                <Text style={styles.statText}>{item.nodeCred} Node Cred</Text>
                            </View>
                            <View style={styles.statBadge}>
                                <Shield size={12} color="#10b981" />
                                <Text style={styles.statText}>{item.governanceWeight} Weight</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.multiplierBadge}>
                    <Text style={styles.multiplierText}>
                        {(item.activityMultiplier * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.multiplierLabel}>Activity</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft size={24} color={COLORS.node.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Council of Node</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !council) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft size={24} color={COLORS.node.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Council of Node</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error || 'Failed to load'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Council of Node</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={council.members}
                keyExtractor={(item) => item.id}
                renderItem={renderMember}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View style={styles.infoSection}>
                        <Text style={styles.nodeName}>{nodeName || 'Node'}</Text>
                        <Text style={styles.infoText}>
                            The Council consists of the top {council.councilSize} members by governance weight.
                            Governance weight = Node Cred × Activity Multiplier
                        </Text>

                        <View style={styles.statsContainer}>
                            <View style={styles.statCard}>
                                <Users size={20} color={COLORS.node.accent} />
                                <Text style={styles.statValue}>{council.members.length}</Text>
                                <Text style={styles.statLabel}>Members</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Shield size={20} color="#10b981" />
                                <Text style={styles.statValue}>{council.totalGovernanceWeight}</Text>
                                <Text style={styles.statLabel}>Total Weight</Text>
                            </View>
                        </View>

                        {eligibility && (
                            <View style={styles.eligibilityCard}>
                                <Text style={styles.eligibilityTitle}>Your Status</Text>
                                {eligibility.isOnCouncil ? (
                                    <View style={styles.onCouncilBadge}>
                                        <Crown size={16} color="#fbbf24" />
                                        <Text style={styles.onCouncilText}>You're on the Council!</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.eligibilityText}>
                                            Your Governance Weight: {eligibility.governanceWeight}
                                        </Text>
                                        {eligibility.credNeededForCouncil > 0 && (
                                            <Text style={styles.eligibilityHint}>
                                                Need {eligibility.credNeededForCouncil} more weight to join
                                            </Text>
                                        )}
                                    </>
                                )}
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>Council Members</Text>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No council members yet</Text>
                    </View>
                }
            />
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
    },
    listContent: {
        padding: 16,
    },
    infoSection: {
        marginBottom: 16,
    },
    nodeName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.node.text,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: COLORS.node.muted,
        lineHeight: 20,
        marginBottom: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        gap: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    eligibilityCard: {
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    eligibilityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.muted,
        marginBottom: 8,
    },
    eligibilityText: {
        fontSize: 16,
        color: COLORS.node.text,
    },
    eligibilityHint: {
        fontSize: 14,
        color: COLORS.node.accent,
        marginTop: 4,
    },
    onCouncilBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    onCouncilText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fbbf24',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
        marginTop: 8,
    },
    memberCard: {
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    topMemberCard: {
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.node.bg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.node.muted,
    },
    memberInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        backgroundColor: COLORS.node.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    memberDetails: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.node.bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statText: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    multiplierBadge: {
        alignItems: 'center',
        padding: 8,
    },
    multiplierText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.node.accent,
    },
    multiplierLabel: {
        fontSize: 10,
        color: COLORS.node.muted,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.node.muted,
    },
});
