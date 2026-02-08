import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useTheme';
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
    const theme = useAppTheme();
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
        <View style={[styles.row, { backgroundColor: theme.panel }]}>
            <View style={styles.labelContainer}>
                <Text style={styles.icon}>{icon}</Text>
                <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
            <View style={styles.values}>
                <View style={styles.valueBox}>
                    <Text style={[styles.valueLabel, { color: theme.muted }]}>Raw</Text>
                    <Text style={[styles.value, { color: theme.text }]}>{data.raw.toFixed(1)}</Text>
                </View>
                <Text style={[styles.x, { color: theme.muted }]}>×</Text>
                <View style={styles.valueBox}>
                    <Text style={[styles.valueLabel, { color: theme.muted }]}>Weight</Text>
                    <Text style={[styles.value, { color: theme.text }]}>{data.weight.toFixed(1)}</Text>
                </View>
                <Text style={[styles.equals, { color: theme.muted }]}>=</Text>
                <View style={[styles.valueBox, styles.contributionBox]}>
                    <Text style={[styles.valueLabel, { color: theme.muted }]}>Score</Text>
                    <Text style={[styles.value, { color }]}>{data.contribution.toFixed(1)}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>Score Breakdown</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={theme.accent} style={{ margin: 20 }} />
                    ) : breakdown ? (
                        <ScrollView contentContainerStyle={styles.content}>
                            {renderRow('Recency', breakdown.components.recency, '⏰', '#60a5fa')}
                            {renderRow('Quality', breakdown.components.quality, '💎', '#a78bfa')}
                            {renderRow('Engagement', breakdown.components.engagement, '🔥', '#f87171')}
                            {renderRow('Personal', breakdown.components.personalization, '👤', '#34d399')}

                            <View style={[styles.divider, { backgroundColor: theme.border }]} />

                            <View style={styles.totalRow}>
                                <Text style={[styles.totalLabel, { color: theme.muted }]}>Raw Score</Text>
                                <Text style={[styles.totalValue, { color: theme.text }]}>{breakdown.rawScore.toFixed(1)}</Text>
                            </View>

                            {breakdown.boostMultiplier !== 1 && (
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, { color: theme.muted }]}>Boost Multiplier</Text>
                                    <Text style={[styles.totalValue, { color: '#fbbf24' }]}>x{breakdown.boostMultiplier.toFixed(2)}</Text>
                                </View>
                            )}

                            <View style={[styles.totalRow, styles.finalRow, { backgroundColor: theme.panel, borderColor: theme.accent }]}>
                                <Text style={[styles.finalLabel, { color: theme.accent }]}>Final Score</Text>
                                <Text style={[styles.finalValue, { color: theme.accent }]}>{breakdown.finalScore.toFixed(1)}</Text>
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
        borderRadius: 16,
        borderWidth: 1,
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
    },
    content: {
        gap: 16,
    },
    row: {
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
        marginBottom: 2,
    },
    value: {
        fontWeight: '600',
        fontSize: 14,
    },
    x: {
        fontSize: 12,
    },
    equals: {
        fontSize: 12,
    },
    contributionBox: {
        minWidth: 50,
        alignItems: 'flex-end',
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 14,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    finalRow: {
        marginTop: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    finalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    finalValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    error: {
        color: 'red',
        textAlign: 'center',
    },
});
