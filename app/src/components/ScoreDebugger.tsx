import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';

interface ScoreBreakdown {
    components: {
        recency: { raw: number; weight: number; contribution: number };
        quality: { raw: number; weight: number; contribution: number };
        engagement: { raw: number; weight: number; contribution: number };
        personalization: { raw: number; weight: number; contribution: number };
    };
    boostMultiplier: number;
    rawScore: number;
    finalScore: number;
}

interface ScoreDebuggerProps {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
}

export const ScoreDebugger: React.FC<ScoreDebuggerProps> = ({ visible, postId, onClose }) => {
    const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible && postId) {
            fetchBreakdown();
        }
    }, [visible, postId]);

    const fetchBreakdown = async () => {
        setLoading(true);
        try {
            const response = await api.get<{ breakdown: ScoreBreakdown }>(`/posts/${postId}/explain`);
            setBreakdown(response.breakdown);
        } catch (error) {
            console.error('Failed to fetch score breakdown:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    const renderRow = (label: string, data: { raw: number; weight: number; contribution: number }, icon: string, color: string) => (
        <View style={styles.row}>
            <View style={styles.labelContainer}>
                <Text style={styles.icon}>{icon}</Text>
                <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
            <View style={styles.values}>
                <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Raw</Text>
                    <Text style={styles.value}>{data.raw.toFixed(1)}</Text>
                </View>
                <Text style={styles.x}>×</Text>
                <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Weight</Text>
                    <Text style={styles.value}>{data.weight.toFixed(1)}</Text>
                </View>
                <Text style={styles.equals}>=</Text>
                <View style={[styles.valueBox, styles.contributionBox]}>
                    <Text style={styles.valueLabel}>Score</Text>
                    <Text style={[styles.value, { color }]}>{data.contribution.toFixed(1)}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Score Breakdown</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.node.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.node.accent} style={{ margin: 20 }} />
                    ) : breakdown ? (
                        <ScrollView contentContainerStyle={styles.content}>
                            {renderRow('Recency', breakdown.components.recency, '⏰', '#60a5fa')}
                            {renderRow('Quality', breakdown.components.quality, '💎', '#a78bfa')}
                            {renderRow('Engagement', breakdown.components.engagement, '🔥', '#f87171')}
                            {renderRow('Personal', breakdown.components.personalization, '👤', '#34d399')}

                            <View style={styles.divider} />

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Raw Score</Text>
                                <Text style={styles.totalValue}>{breakdown.rawScore.toFixed(1)}</Text>
                            </View>

                            {breakdown.boostMultiplier !== 1 && (
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>Boost Multiplier</Text>
                                    <Text style={[styles.totalValue, { color: '#fbbf24' }]}>x{breakdown.boostMultiplier.toFixed(2)}</Text>
                                </View>
                            )}

                            <View style={[styles.totalRow, styles.finalRow]}>
                                <Text style={styles.finalLabel}>Final Score</Text>
                                <Text style={styles.finalValue}>{breakdown.finalScore.toFixed(1)}</Text>
                            </View>
                        </ScrollView>
                    ) : (
                        <Text style={styles.error}>Failed to load data</Text>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: COLORS.node.bg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    content: {
        gap: 16,
    },
    row: {
        backgroundColor: COLORS.node.panel,
        padding: 12,
        borderRadius: 12,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    icon: {
        fontSize: 16,
    },
    label: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    values: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    valueBox: {
        alignItems: 'center',
    },
    valueLabel: {
        fontSize: 10,
        color: COLORS.node.muted,
        marginBottom: 2,
    },
    value: {
        color: COLORS.node.text,
        fontWeight: '600',
        fontSize: 14,
    },
    x: {
        color: COLORS.node.muted,
        fontSize: 12,
    },
    equals: {
        color: COLORS.node.muted,
        fontSize: 12,
    },
    contributionBox: {
        minWidth: 50,
        alignItems: 'flex-end',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.node.border,
        marginVertical: 8,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
    totalValue: {
        color: COLORS.node.text,
        fontSize: 16,
        fontWeight: '600',
    },
    finalRow: {
        marginTop: 8,
        backgroundColor: COLORS.node.panel,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    finalLabel: {
        color: COLORS.node.accent,
        fontSize: 18,
        fontWeight: 'bold',
    },
    finalValue: {
        color: COLORS.node.accent,
        fontSize: 24,
        fontWeight: 'bold',
    },
    error: {
        color: 'red',
        textAlign: 'center',
    },
});
