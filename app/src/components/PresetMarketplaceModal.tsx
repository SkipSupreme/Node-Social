import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '../lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import type { VibeValidatorSettings } from './ui/VibeValidator';

interface Preset {
    id: string;
    name: string;
    description: string;
    creator: {
        username: string;
        cred: number;
    };
    downloads: number;
    config: VibeValidatorSettings;
}

interface PresetMarketplaceModalProps {
    visible: boolean;
    onClose: () => void;
    onInstall: (preset: Preset) => void;
}

export const PresetMarketplaceModal: React.FC<PresetMarketplaceModalProps> = ({ visible, onClose, onInstall }) => {
    const theme = useAppTheme();
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
            const response = await api.get<{ presets: Preset[] }>('/api/v1/presets/marketplace');
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
            await api.post(`/api/v1/presets/${preset.id}/install`, {});
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
        <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                <View style={styles.stats}>
                    <Ionicons name="download-outline" size={14} color={theme.muted} />
                    <Text style={[styles.statsText, { color: theme.muted }]}>{item.downloads}</Text>
                </View>
            </View>

            <Text style={[styles.description, { color: theme.muted }]} numberOfLines={2}>{item.description || 'No description'}</Text>

            <View style={styles.footer}>
                <Text style={[styles.creator, { color: theme.accent }]}>by @{item.creator.username} (Cred: {item.creator.cred})</Text>
                <TouchableOpacity
                    style={[styles.installButton, { backgroundColor: theme.accent }]}
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
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.text }]}>Algorithm Marketplace</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={presets}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: theme.muted }]}>No presets found. Be the first to publish one!</Text>
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
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    list: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
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
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        fontSize: 12,
    },
    description: {
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    creator: {
        fontSize: 12,
    },
    installButton: {
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
        textAlign: 'center',
        marginTop: 40,
    },
});
