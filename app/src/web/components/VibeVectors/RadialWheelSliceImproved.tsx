// Phase 0.2 - Improved Radial Wheel Slice
// Individual pie slice with proper visual rendering

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VibeVector } from '../../../lib/api';

interface RadialWheelSliceImprovedProps {
  vector: VibeVector;
  index: number;
  totalSlices: number;
  radius: number;
  innerRadius: number;
  intensity: number;
  isHovered: boolean;
  color: string;
}

export const RadialWheelSliceImproved: React.FC<RadialWheelSliceImprovedProps> = ({
  vector,
  index,
  totalSlices,
  radius,
  innerRadius,
  intensity,
  isHovered,
  color,
}) => {
  const sliceAngle = 360 / totalSlices;
  const rotation = index * sliceAngle;
  const halfAngle = sliceAngle / 2;
  
  // Position for label (at 70% of radius)
  const labelRadius = radius * 0.7;
  const labelAngle = rotation + halfAngle - 90; // Adjust for top = 0°
  const labelX = radius + labelRadius * Math.cos((labelAngle * Math.PI) / 180);
  const labelY = radius + labelRadius * Math.sin((labelAngle * Math.PI) / 180);

  return (
    <View
      style={[
        styles.slice,
        {
          width: radius * 2,
          height: radius * 2,
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
    >
      {/* Slice segment - using conic gradient-like effect with rotation */}
      <View
        style={[
          styles.segment,
          {
            backgroundColor: color,
            opacity: intensity > 0 ? 0.9 : (isHovered ? 0.7 : 0.5),
            borderWidth: isHovered ? 3 : 1,
            borderColor: isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
            // Create pie slice using border-radius and clip
            borderRadius: sliceAngle > 180 ? radius : 0,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderBottomLeftRadius: sliceAngle > 180 ? radius : 0,
            borderBottomRightRadius: sliceAngle > 180 ? radius : 0,
            // Width represents the arc
            width: radius,
            height: radius * 2,
            // Clip to slice angle
            overflow: 'hidden',
          },
        ]}
      >
        {/* Intensity fill */}
        {intensity > 0 && (
          <View
            style={[
              styles.intensityFill,
              {
                backgroundColor: color,
                opacity: intensity,
                width: '100%',
                height: `${intensity * 100}%`,
              },
            ]}
          />
        )}
      </View>
      
      {/* Label positioned absolutely */}
      <View
        style={[
          styles.labelContainer,
          {
            left: labelX - 30,
            top: labelY - 25,
            transform: [{ rotate: `${-rotation}deg` }], // Counter-rotate text
          },
        ]}
      >
        <Text style={styles.emoji}>{vector.emoji || '•'}</Text>
        <Text style={[styles.label, isHovered && styles.labelHovered]}>
          {vector.name}
        </Text>
        {intensity > 0 && (
          <Text style={styles.intensityText}>{Math.round(intensity * 100)}%</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  slice: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  intensityFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    zIndex: 10,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  labelHovered: {
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  intensityText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
});

