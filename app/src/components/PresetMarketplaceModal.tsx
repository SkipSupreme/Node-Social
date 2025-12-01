import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '../lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';

interface Preset {
    id: string;
    name: string;
    description: string;
    creator: {
        username: string;
        cred: number;
    };
    downloads: number;
    config: any;
}

interface PresetMarketplaceModalProps {
    visible: boolean;
    onClose: () => void;
    onInstall: (preset: Preset) => void;
}

export const PresetMarketplaceModal: React.FC<PresetMarketplaceModalProps> = ({ visible, onClose, onInstall }) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            fetchMarketplace();
        }
    }, [visible]);

    const fetchMarketplace = async () => {
        setLoading(true);
        try {
            const response = await api.get<{ presets: Preset[] }>('/presets/marketplace');
            setPresets(response.presets);
        } catch (error) {
            console.error('Failed to fetch marketplace:', error);
            showAlert('Error', 'Failed to load marketplace');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (preset: Preset) => {
        setInstalling(preset.id);
        try {
            await api.post(`/presets/${preset.id}/install`, {});
            showAlert('Success', `Installed "${preset.name}"`);
            onInstall(preset);
            onClose();
        } catch (error) {
            console.error('Failed to install preset:', error);
            showAlert('Error', 'Failed to install preset');
        } finally {
            setInstalling(null);
        }
    };

    const renderItem = ({ item }: { item: Preset }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.stats}>
                    <Ionicons name="download-outline" size={14} color={COLORS.node.muted} />
                    <Text style={styles.statsText}>{item.downloads}</Text>
                </View>
            </View>

            <Text style={styles.description} numberOfLines={2}>{item.description || 'No description'}</Text>

            <View style={styles.footer}>
                <Text style={styles.creator}>by @{item.creator.username} (Cred: {item.creator.cred})</Text>
                <TouchableOpacity
                    style={styles.installButton}
                    onPress={() => handleInstall(item)}
                    disabled={!!installing}
                >
                    {installing === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.installText}>Install</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Algorithm Marketplace</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={COLORS.node.text} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.node.accent} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={presets}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No presets found. Be the first to publish one!</Text>
                        }
                    />
                )}
            </View>
        </Modal>
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
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        color: COLORS.node.muted,
        fontSize: 12,
    },
    description: {
        color: COLORS.node.muted,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    creator: {
        color: COLORS.node.accent,
        fontSize: 12,
    },
    installButton: {
        backgroundColor: COLORS.node.accent,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    installText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyText: {
        color: COLORS.node.muted,
        textAlign: 'center',
        marginTop: 40,
    },
});
