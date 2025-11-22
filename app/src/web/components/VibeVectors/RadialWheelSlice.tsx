// Phase 0.2 - Radial Wheel Slice Component
// Individual vector slice with intensity visualization

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VibeVector } from '../../../lib/api';
import { formatIntensity } from '../../lib/vibeVectors';

interface RadialWheelSliceProps {
  vector: VibeVector;
  angle: number; // Starting angle in radians
  sliceAngle: number; // Angle of this slice in radians
  radius: number; // Radius of the wheel
  intensity: number; // 0.0-1.0
  isHovered: boolean;
}

export const RadialWheelSlice: React.FC<RadialWheelSliceProps> = ({
  vector,
  angle,
  sliceAngle,
  radius,
  intensity,
  isHovered,
}) => {
  // Calculate slice path using SVG-like coordinates
  const startAngle = angle;
  const endAngle = angle + sliceAngle;
  
  // Calculate points for the slice (triangle-like shape from center)
  const centerX = radius;
  const centerY = radius;
  
  // Outer edge points
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY + radius * Math.sin(endAngle);

  // Midpoint of outer edge for label
  const midAngle = startAngle + sliceAngle / 2;
  const labelRadius = radius * 0.7; // Position label at 70% of radius
  const labelX = centerX + labelRadius * Math.cos(midAngle);
  const labelY = centerY + labelRadius * Math.sin(midAngle);

  // Intensity ring radius (grows from center as intensity increases)
  const intensityRadius = radius * 0.3 + (radius * 0.4 * intensity);

  return (
    <View style={styles.container}>
      {/* Slice background */}
      <View
        style={[
          styles.slice,
          {
            backgroundColor: isHovered ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isHovered ? '#2563EB' : '#E2E8F0',
            transform: [
              { translateX: centerX },
              { translateY: centerY },
              { rotate: `${(angle * 180) / Math.PI}deg` },
            ],
          },
        ]}
      >
        {/* Intensity visualization */}
        {intensity > 0 && (
          <View
            style={[
              styles.intensityRing,
              {
                width: intensityRadius * 2,
                height: intensityRadius * 2,
                borderRadius: intensityRadius,
                opacity: intensity * 0.8 + 0.2, // 0.2-1.0 opacity
              },
            ]}
          />
        )}

        {/* Vector label */}
        <View
          style={[
            styles.labelContainer,
            {
              left: labelX,
              top: labelY,
              transform: [{ translateX: -20 }, { translateY: -10 }],
            },
          ]}
        >
          <Text style={styles.emoji}>{vector.emoji || '•'}</Text>
          <Text style={[styles.label, isHovered && styles.labelHovered]}>
            {vector.name}
          </Text>
          {intensity > 0 && (
            <Text style={styles.intensityText}>{formatIntensity(intensity)}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    ...StyleSheet.absoluteFillObject,
  },
  slice: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 4,
  },
  intensityRing: {
    position: 'absolute',
    backgroundColor: '#2563EB',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  labelHovered: {
    color: '#2563EB',
    fontWeight: '700',
  },
  intensityText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
});

