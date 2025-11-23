
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { Settings, TrendingUp, Clock, UserCheck, Sparkles } from './Icons';
import { COLORS } from '../../constants/theme';

const CHART_SIZE = 160;
const CENTER = CHART_SIZE / 2;
const RADIUS = (CHART_SIZE / 2) - 20;

// Helper to calculate polygon points
const getPoints = (data: number[]) => {
    const angleStep = (Math.PI * 2) / 4;
    return data.map((value, i) => {
        // Rotate by -90deg ( -Math.PI/2 ) so first point is top
        const angle = i * angleStep - Math.PI / 2;
        const r = (value / 100) * RADIUS;
        const x = CENTER + r * Math.cos(angle);
        const y = CENTER + r * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');
};

const CustomSlider = ({ value, onChange, color, label, icon: Icon }: any) => {
    const [width, setWidth] = useState(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => updateValue(evt.nativeEvent.locationX),
            onPanResponderMove: (evt) => updateValue(evt.nativeEvent.locationX),
        })
    ).current;

    const updateValue = (x: number) => {
        if (width === 0) return;
        const newValue = Math.max(0, Math.min(100, (x / width) * 100));
        onChange(Math.round(newValue));
    };

    return (
        <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} color={color} />
                    <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>{label}</Text>
                </View>
                <Text style={{ color: color, fontSize: 12, fontFamily: 'monospace' }}>{value}%</Text>
            </View>

            <View
                style={{ height: 24, justifyContent: 'center' }}
                onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
            >
                {/* Track Background */}
                <View style={{ height: 6, backgroundColor: COLORS.node.bg, borderRadius: 3, width: '100%', position: 'absolute' }} />

                {/* Fill */}
                {/* Note: React Native views don't support partial width fills easily without layout, 
            so we use the thumb position to imply fill or a generic absolute view */}

                {/* Thumb */}
                <View
                    style={{
                        width: 16, height: 16, borderRadius: 8, backgroundColor: color,
                        position: 'absolute',
                        left: `${value}%`,
                        marginLeft: -8 // Center thumb
                    }}
                />
            </View>
        </View>
    );
};

export const VibeValidator = ({ settings = { weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 } }, onUpdate }: any) => {

    const updateWeight = (key: string, val: number) => {
        onUpdate({
            ...settings,
            weights: { ...settings.weights, [key]: val }
        });
    };

    const dataValues = [
        settings.weights.quality,
        settings.weights.engagement, // Swapped to match visual rotation
        settings.weights.personalization,
        settings.weights.recency
    ];

    // Radar Grid Points (Diamond shape)
    const fullPoints = getPoints([100, 100, 100, 100]);
    const midPoints = getPoints([50, 50, 50, 50]);
    const activePoints = getPoints([
        settings.weights.quality,
        settings.weights.engagement,
        settings.weights.personalization, // Bottom
        settings.weights.recency // Left
    ]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Settings size={20} color={COLORS.node.accent} />
                    <Text style={styles.title}>Vibe Validator</Text>
                </View>
                <Text style={styles.subtitle}>Tune your reality. Adjusting the algorithm directly impacts your feed.</Text>
            </View>

            <ScrollView style={{ flex: 1 }}>
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

                            {/* Dots */}
                            {/* Can iterate points to add circles if desired */}
                        </G>
                    </Svg>
                </View>

                {/* Sliders */}
                <View style={styles.controls}>
                    <CustomSlider
                        label="Quality Weight"
                        icon={Sparkles}
                        color={COLORS.vibe.insightful}
                        value={settings.weights.quality}
                        onChange={(v: number) => updateWeight('quality', v)}
                    />
                    <CustomSlider
                        label="Recency Weight"
                        icon={Clock}
                        color={COLORS.vibe.novel}
                        value={settings.weights.recency}
                        onChange={(v: number) => updateWeight('recency', v)}
                    />
                    <CustomSlider
                        label="Engagement Weight"
                        icon={TrendingUp}
                        color={COLORS.vibe.funny}
                        value={settings.weights.engagement}
                        onChange={(v: number) => updateWeight('engagement', v)}
                    />
                    <CustomSlider
                        label="Personalization"
                        icon={UserCheck}
                        color={COLORS.vibe.cursed}
                        value={settings.weights.personalization}
                        onChange={(v: number) => updateWeight('personalization', v)}
                    />
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
        padding: 24,
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
        fontSize: 12
    },
    chartContainer: {
        height: 200,
        backgroundColor: 'rgba(15, 17, 21, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },
    controls: {
        paddingHorizontal: 24,
        paddingBottom: 24
    }
});
