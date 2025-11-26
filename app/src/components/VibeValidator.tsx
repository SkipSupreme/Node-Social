import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { PresetMarketplaceModal } from './PresetMarketplaceModal';
import { SavePresetModal } from './SavePresetModal';
import { api } from '../lib/api';

export interface VibeWeights {
    qualityWeight: number;
    recencyWeight: number;
    engagementWeight: number;
    personalizationWeight: number;
}

export interface VibePreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    weights: VibeWeights;
}

export const VIBE_PRESETS: VibePreset[] = [
    {
        id: 'latest',
        name: 'Latest',
        icon: '⏰',
        description: 'Chronological',
        weights: { qualityWeight: 0.15, recencyWeight: 0.65, engagementWeight: 0.10, personalizationWeight: 0.10 },
    },
    {
        id: 'balanced',
        name: 'Balanced',
        icon: '⚖️',
        description: 'Best of everything',
        weights: { qualityWeight: 0.35, recencyWeight: 0.25, engagementWeight: 0.20, personalizationWeight: 0.20 },
    },
    {
        id: 'hot',
        name: 'Hot',
        icon: '🔥',
        description: 'Trending now',
        weights: { qualityWeight: 0.20, recencyWeight: 0.25, engagementWeight: 0.45, personalizationWeight: 0.10 },
    },
    {
        id: 'expert',
        name: 'Expert',
        icon: '💡',
        description: 'High Cred',
        weights: { qualityWeight: 0.55, recencyWeight: 0.15, engagementWeight: 0.15, personalizationWeight: 0.15 },
    },
    {
        id: 'network',
        name: 'Network',
        icon: '👥',
        description: 'Your circle',
        weights: { qualityWeight: 0.20, recencyWeight: 0.25, engagementWeight: 0.10, personalizationWeight: 0.45 },
    },
];

interface VibeValidatorProps {
    selectedPresetId: string;
    onSelectPreset: (preset: VibePreset) => void;
    currentConfig?: any; // For saving
}

export const VibeValidator: React.FC<VibeValidatorProps> = ({ selectedPresetId, onSelectPreset, currentConfig }) => {
    const [showMarketplace, setShowMarketplace] = useState(false);
    const [showSave, setShowSave] = useState(false);
    const [userPresets, setUserPresets] = useState<VibePreset[]>([]);

    useEffect(() => {
        fetchUserPresets();
    }, []);

    const fetchUserPresets = async () => {
        try {
            const response = await api.get<{ presets: any[] }>('/presets/mine');
            const mapped = response.presets.map(p => ({
                id: p.id,
                name: p.name,
                icon: '👤',
                description: p.description || 'Custom preset',
                weights: p.config, // Assuming config matches VibeWeights structure roughly
            }));
            setUserPresets(mapped);
        } catch (error) {
            console.error('Failed to fetch user presets:', error);
        }
    };

    const allPresets = [...VIBE_PRESETS, ...userPresets];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.actionButton} onPress={() => setShowMarketplace(true)}>
                    <Ionicons name="globe-outline" size={20} color={COLORS.node.accent} />
                    <Text style={styles.actionText}>Marketplace</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => setShowSave(true)}>
                    <Ionicons name="save-outline" size={20} color={COLORS.node.accent} />
                    <Text style={styles.actionText}>Save Current</Text>
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {allPresets.map((preset) => (
                    <TouchableOpacity
                        key={preset.id}
                        style={[styles.presetCard, selectedPresetId === preset.id && styles.presetCardSelected]}
                        onPress={() => onSelectPreset(preset)}
                    >
                        <Text style={styles.icon}>{preset.icon}</Text>
                        <Text style={[styles.name, selectedPresetId === preset.id && styles.nameSelected]}>{preset.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <PresetMarketplaceModal
                visible={showMarketplace}
                onClose={() => setShowMarketplace(false)}
                onInstall={(preset) => {
                    fetchUserPresets(); // Refresh list
                    // Optionally select it immediately
                }}
            />

            <SavePresetModal
                visible={showSave}
                onClose={() => setShowSave(false)}
                currentConfig={currentConfig || {}}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        backgroundColor: COLORS.node.bg,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        backgroundColor: COLORS.node.panel,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    actionText: {
        color: COLORS.node.accent,
        fontSize: 12,
        fontWeight: '600',
    },
    presetCard: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: COLORS.node.panel,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        minWidth: 80,
    },
    presetCardSelected: {
        borderColor: COLORS.node.accent,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    icon: {
        fontSize: 24,
        marginBottom: 4,
    },
    name: {
        fontSize: 12,
        color: COLORS.node.muted,
        fontWeight: '500',
    },
    nameSelected: {
        color: COLORS.node.accent,
        fontWeight: '700',
    },
});
