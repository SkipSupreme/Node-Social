import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';

interface ScoringParams {
    qualityWeight: number;
    recencyWeight: number;
    engagementWeight: number;
    personalizationWeight: number;
}

const DEFAULT_PARAMS: ScoringParams = {
    qualityWeight: 35,
    recencyWeight: 30,
    engagementWeight: 20,
    personalizationWeight: 15,
};

export default function VibeValidatorAdvanced() {
    const { theme } = useTheme();
    const [params, setParams] = useState<ScoringParams>(DEFAULT_PARAMS);
    const [loading, setLoading] = useState(false);

    // Fetch current config
    useEffect(() => {
        // TODO: Fetch from API
        // api.get('/vibe-config').then(...)
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            // Normalize to 100%
            const total = params.qualityWeight + params.recencyWeight + params.engagementWeight + params.personalizationWeight;
            const normalized = {
                qualityWeight: (params.qualityWeight / total) * 100,
                recencyWeight: (params.recencyWeight / total) * 100,
                engagementWeight: (params.engagementWeight / total) * 100,
                personalizationWeight: (params.personalizationWeight / total) * 100,
            };

            await api.put('/vibe-config', { config: normalized });
            Alert.alert('Success', 'Vibe configuration saved!');
        } catch (error) {
            console.error('Failed to save config:', error);
            Alert.alert('Error', 'Failed to save configuration');
        } finally {
            setLoading(false);
        }
    };

    const renderSlider = (label: string, key: keyof ScoringParams, color: string) => (
        <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: theme.colors.text }]}>{label}</Text>
                <Text style={[styles.sliderValue, { color }]}>{Math.round(params[key])}%</Text>
            </View>
            <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={params[key]}
                onValueChange={(val) => setParams(prev => ({ ...prev, [key]: val }))}
                minimumTrackTintColor={color}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={color}
            />
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Advanced Vibe Validator</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Fine-tune your feed algorithm. Weights are normalized to 100%.
                </Text>
            </View>

            <View style={styles.sliders}>
                {renderSlider('Quality (Cred & Vibe)', 'qualityWeight', '#4CAF50')}
                {renderSlider('Recency (Freshness)', 'recencyWeight', '#2196F3')}
                {renderSlider('Engagement (Activity)', 'engagementWeight', '#FF9800')}
                {renderSlider('Personalization (Network)', 'personalizationWeight', '#E91E63')}
            </View>

            <View style={styles.chartPreview}>
                {/* Placeholder for a pie chart or visualizer */}
                <View style={{ height: 20, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', marginTop: 20 }}>
                    <View style={{ flex: params.qualityWeight, backgroundColor: '#4CAF50' }} />
                    <View style={{ flex: params.recencyWeight, backgroundColor: '#2196F3' }} />
                    <View style={{ flex: params.engagementWeight, backgroundColor: '#FF9800' }} />
                    <View style={{ flex: params.personalizationWeight, backgroundColor: '#E91E63' }} />
                </View>
            </View>

            <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={loading}
            >
                <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Apply Configuration'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
    },
    sliders: {
        gap: 20,
    },
    sliderContainer: {
        marginBottom: 10,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    sliderLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    sliderValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    chartPreview: {
        marginVertical: 30,
    },
    saveButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
