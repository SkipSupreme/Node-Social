import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

// Vibe colors matching the radial wheel
const VIBE_COLORS = {
    insightful: '#3b82f6',  // Blue
    joy: '#eab308',         // Yellow
    fire: '#f97316',        // Orange
    support: '#ec4899',     // Pink
    shock: '#8b5cf6',       // Violet
    questionable: '#64748b', // Slate
};

// Order for consistent display
const VIBE_ORDER = ['insightful', 'joy', 'fire', 'support', 'shock', 'questionable'] as const;

export interface VibeAggregateData {
    insightfulSum?: number;
    joySum?: number;
    fireSum?: number;
    supportSum?: number;
    shockSum?: number;
    questionableSum?: number;
    totalReactions?: number;
}

interface VibeBarProps {
    vibeAggregate?: VibeAggregateData | null;
    height?: number;
    showLabels?: boolean;
}

export const VibeBar = ({ vibeAggregate, height = 6, showLabels = false }: VibeBarProps) => {
    // Calculate total from all sums
    const values = {
        insightful: vibeAggregate?.insightfulSum || 0,
        joy: vibeAggregate?.joySum || 0,
        fire: vibeAggregate?.fireSum || 0,
        support: vibeAggregate?.supportSum || 0,
        shock: vibeAggregate?.shockSum || 0,
        questionable: vibeAggregate?.questionableSum || 0,
    };

    const total = Object.values(values).reduce((sum, val) => sum + val, 0);

    // If no reactions yet, show even distribution (16.67% each)
    const isEven = total === 0;
    const evenPercentage = 100 / VIBE_ORDER.length; // ~16.67%

    // Calculate percentages
    const percentages = VIBE_ORDER.map(key => ({
        key,
        value: isEven ? evenPercentage : values[key],
        percentage: isEven ? evenPercentage : (values[key] / total) * 100,
        color: VIBE_COLORS[key],
    })).filter(v => v.percentage > 0); // Only show vibes with values

    return (
        <View style={[styles.bar, { height }]}>
            {percentages.map((vibe) => (
                <View
                    key={vibe.key}
                    style={[
                        styles.segment,
                        {
                            flex: vibe.percentage,
                            backgroundColor: vibe.color,
                        }
                    ]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        width: '100%',
    },
    segment: {
        height: '100%',
    },
});
