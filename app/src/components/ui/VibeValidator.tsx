
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Polygon, Line, G, Text as SvgText } from 'react-native-svg';
import { Settings, TrendingUp, Clock, UserCheck, Sparkles } from './Icons';
import { COLORS } from '../../constants/theme';

const CHART_SIZE = 160;
const CENTER = CHART_SIZE / 2;
const RADIUS = (CHART_SIZE / 2) - 20;

// Preset configurations
const PRESETS = [
    { id: 'latest', name: '⏰ Latest', weights: { quality: 15, recency: 65, engagement: 10, personalization: 10 } },
    { id: 'balanced', name: '⚖️ Balanced', weights: { quality: 35, recency: 25, engagement: 20, personalization: 20 } },
    { id: 'hot', name: '🔥 Hot', weights: { quality: 20, recency: 25, engagement: 45, personalization: 10 } },
    { id: 'expert', name: '💡 Expert', weights: { quality: 55, recency: 15, engagement: 15, personalization: 15 } },
    { id: 'network', name: '👥 Network', weights: { quality: 20, recency: 25, engagement: 10, personalization: 45 } },
];

// Helper to calculate polygon points
const getPoints = (data: number[]) => {
    const angleStep = (Math.PI * 2) / 4;
    return data.map((value, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const r = (value / 100) * RADIUS;
        const x = CENTER + r * Math.cos(angle);
        const y = CENTER + r * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');
};

interface SliderRowProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    color: string;
    icon: React.ComponentType<{ size: number; color: string }>;
}

const SliderRow = ({ label, value, onChange, color, icon: Icon }: SliderRowProps) => (
    <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon size={16} color={color} />
                <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>{label}</Text>
            </View>
            <Text style={{ color: color, fontSize: 12, fontFamily: 'monospace' }}>{value}%</Text>
        </View>
        <Slider
            style={{ width: '100%', height: 32 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={value}
            onValueChange={onChange}
            minimumTrackTintColor={color}
            maximumTrackTintColor={COLORS.node.bg}
            thumbTintColor={color}
        />
    </View>
);

export interface VibeValidatorProps {
    settings: {
        preset?: string;
        weights: {
            quality: number;
            recency: number;
            engagement: number;
            personalization: number;
        };
    };
    onUpdate: (settings: any) => void;
}

export const VibeValidator = ({ settings, onUpdate }: VibeValidatorProps) => {
    const [activePreset, setActivePreset] = useState<string | null>(settings.preset || 'balanced');
    const weights = settings.weights;

    const updateWeight = (key: string, val: number) => {
        setActivePreset(null); // Clear preset when manually adjusting
        onUpdate({
            ...settings,
            preset: null,
            weights: { ...weights, [key]: val }
        });
    };

    const selectPreset = (preset: typeof PRESETS[0]) => {
        setActivePreset(preset.id);
        onUpdate({
            ...settings,
            preset: preset.id,
            weights: preset.weights
        });
    };

    // Radar Grid Points
    const fullPoints = getPoints([100, 100, 100, 100]);
    const midPoints = getPoints([50, 50, 50, 50]);
    const activePoints = getPoints([
        weights.quality,
        weights.engagement,
        weights.personalization,
        weights.recency
    ]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Settings size={20} color={COLORS.node.accent} />
                    <Text style={styles.title}>Vibe Validator</Text>
                </View>
                <Text style={styles.subtitle}>Tune your feed algorithm in real-time</Text>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Presets */}
                <View style={styles.presetsSection}>
                    <Text style={styles.sectionLabel}>Quick Presets</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                        {PRESETS.map((preset) => (
                            <TouchableOpacity
                                key={preset.id}
                                style={[
                                    styles.presetBtn,
                                    activePreset === preset.id && styles.presetBtnActive
                                ]}
                                onPress={() => selectPreset(preset)}
                            >
                                <Text style={[
                                    styles.presetText,
                                    activePreset === preset.id && styles.presetTextActive
                                ]}>
                                    {preset.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Chart Area */}
                <View style={styles.chartContainer}>
                    <Svg height={CHART_SIZE} width={CHART_SIZE}>
                        <G>
                            {/* Axis Lines */}
                            <Line x1={CENTER} y1={0} x2={CENTER} y2={CHART_SIZE} stroke="#2a2d35" strokeWidth="1" />
                            <Line x1={0} y1={CENTER} x2={CHART_SIZE} y2={CENTER} stroke="#2a2d35" strokeWidth="1" />

                            {/* Grid Polygons */}
                            <Polygon points={fullPoints} stroke="#2a2d35" strokeWidth="1" fill="none" />
                            <Polygon points={midPoints} stroke="#2a2d35" strokeWidth="1" fill="none" />

                            {/* Labels */}
                            <SvgText x={CENTER} y={10} fontSize="10" fill="#94a3b8" textAnchor="middle">Quality</SvgText>
                            <SvgText x={CHART_SIZE - 5} y={CENTER + 4} fontSize="10" fill="#94a3b8" textAnchor="end">Engage</SvgText>
                            <SvgText x={CENTER} y={CHART_SIZE - 5} fontSize="10" fill="#94a3b8" textAnchor="middle">Personal</SvgText>
                            <SvgText x={5} y={CENTER + 4} fontSize="10" fill="#94a3b8" textAnchor="start">Recency</SvgText>

                            {/* Data Radar */}
                            <Polygon
                                points={activePoints}
                                fill={COLORS.node.accent}
                                fillOpacity={0.3}
                                stroke={COLORS.node.accent}
                                strokeWidth="2"
                            />
                        </G>
                    </Svg>
                </View>

                {/* Fine-tune Section */}
                <View style={styles.controls}>
                    <Text style={styles.sectionLabel}>Fine-tune</Text>
                    <SliderRow
                        label="Quality"
                        icon={Sparkles}
                        color={COLORS.vibe.insightful}
                        value={weights.quality}
                        onChange={(v) => updateWeight('quality', v)}
                    />
                    <SliderRow
                        label="Recency"
                        icon={Clock}
                        color={COLORS.vibe.novel}
                        value={weights.recency}
                        onChange={(v) => updateWeight('recency', v)}
                    />
                    <SliderRow
                        label="Engagement"
                        icon={TrendingUp}
                        color={COLORS.vibe.funny}
                        value={weights.engagement}
                        onChange={(v) => updateWeight('engagement', v)}
                    />
                    <SliderRow
                        label="Personalization"
                        icon={UserCheck}
                        color={COLORS.vibe.cursed}
                        value={weights.personalization}
                        onChange={(v) => updateWeight('personalization', v)}
                    />
                </View>

                {/* Current Mix Display */}
                <View style={styles.mixDisplay}>
                    <Text style={styles.mixLabel}>Current Mix</Text>
                    <View style={styles.mixBar}>
                        <View style={[styles.mixSegment, { flex: weights.quality, backgroundColor: COLORS.vibe.insightful }]} />
                        <View style={[styles.mixSegment, { flex: weights.recency, backgroundColor: COLORS.vibe.novel }]} />
                        <View style={[styles.mixSegment, { flex: weights.engagement, backgroundColor: COLORS.vibe.funny }]} />
                        <View style={[styles.mixSegment, { flex: weights.personalization, backgroundColor: COLORS.vibe.cursed }]} />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
        borderLeftWidth: 1,
        borderLeftColor: COLORS.node.border,
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    subtitle: {
        color: COLORS.node.muted,
        fontSize: 12,
        marginTop: 4
    },
    presetsSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border
    },
    sectionLabel: {
        color: COLORS.node.muted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 0.5
    },
    presetsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    presetBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: COLORS.node.bg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    presetBtnActive: {
        borderColor: COLORS.node.accent,
        backgroundColor: `${COLORS.node.accent}20`,
    },
    presetText: {
        color: COLORS.node.muted,
        fontSize: 13,
        fontWeight: '500',
    },
    presetTextActive: {
        color: COLORS.node.accent,
    },
    chartContainer: {
        height: 180,
        backgroundColor: 'rgba(15, 17, 21, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controls: {
        padding: 20,
    },
    mixDisplay: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    mixLabel: {
        color: COLORS.node.muted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5
    },
    mixBar: {
        height: 8,
        flexDirection: 'row',
        borderRadius: 4,
        overflow: 'hidden',
    },
    mixSegment: {
        height: '100%',
    }
});
