import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { getCredHistory } from '../lib/api';
import { useAuthStore } from '../store/auth';

/** A single cred transaction from the API */
interface CredTransaction {
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
}

interface CredHistoryScreenProps {
    onBack: () => void;
}

export const CredHistoryScreen = ({ onBack }: CredHistoryScreenProps) => {
    const { user } = useAuthStore();
    const [transactions, setTransactions] = useState<CredTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await getCredHistory();
            setTransactions(data.transactions);
        } catch (error) {
            console.error('Failed to load cred history:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: CredTransaction }) => (
        <View style={styles.transactionItem}>
            <View style={styles.iconContainer}>
                <TrendingUp size={20} color={COLORS.node.accent} />
            </View>
            <View style={styles.details}>
                <Text style={styles.reason}>{formatReason(item.reason)}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.amount, item.amount > 0 ? styles.positive : styles.negative]}>
                {item.amount > 0 ? '+' : ''}{item.amount}
            </Text>
        </View>
    );

    const formatReason = (reason: string) => {
        return reason.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.node.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cred History</Text>
            </View>

            <View style={styles.summary}>
                <Text style={styles.totalLabel}>Total Cred</Text>
                <Text style={styles.totalValue}>{user?.cred || 0}</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.node.accent} />
                </View>
            ) : transactions.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No history yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
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
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
        gap: 16
    },
    backBtn: {
        padding: 4
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text
    },
    summary: {
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
        backgroundColor: COLORS.node.panel
    },
    totalLabel: {
        fontSize: 14,
        color: COLORS.node.muted,
        marginBottom: 4
    },
    totalValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.node.accent
    },
    listContent: {
        padding: 16
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    details: {
        flex: 1
    },
    reason: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.node.text,
        marginBottom: 4
    },
    date: {
        fontSize: 12,
        color: COLORS.node.muted
    },
    amount: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    positive: {
        color: '#10b981'
    },
    negative: {
        color: '#ef4444'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        color: COLORS.node.muted,
        fontSize: 16
    }
});
