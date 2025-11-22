// Phase 0.2 - Radial Wheel Menu Component
// Core feature: Procedural wheel that fans out for multi-vector intensity reactions

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import type { VibeVector } from '../../../lib/api';
import { RadialWheelSlice } from './RadialWheelSlice';

interface RadialWheelMenuProps {
  vectors: VibeVector[];
  centerX: number;
  centerY: number;
  size: number; // Diameter of the wheel
  intensities: { [slug: string]: number };
  hoveredVector: string | null;
  onMouseMove: (x: number, y: number) => void;
  onMouseUp: () => void;
  visible: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SIZE = 300;
const ANIMATION_DURATION = 300; // ms

export const RadialWheelMenu: React.FC<RadialWheelMenuProps> = ({
  vectors,
  centerX,
  centerY,
  size = DEFAULT_SIZE,
  intensities,
  hoveredVector,
  onMouseMove,
  onMouseUp,
  visible,
}) => {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;

    const handleMouseMove = (e: MouseEvent) => {
      onMouseMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      onMouseUp();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        onMouseMove(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      onMouseUp();
    };

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [visible, onMouseMove, onMouseUp]);

  if (!visible) return null;

  const radius = size / 2;
  const sliceAngle = (360 / vectors.length) * (Math.PI / 180); // Convert to radians

  // Calculate position to keep wheel on screen
  const left = Math.max(0, Math.min(centerX - radius, SCREEN_WIDTH - size));
  const top = Math.max(0, Math.min(centerY - radius, SCREEN_HEIGHT - size));

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        {
          left,
          top,
          width: size,
          height: size,
        },
      ]}
      pointerEvents="box-none" // Allow clicks through transparent areas
    >
      {/* Background overlay */}
      <View style={styles.overlay} />

      {/* Radial wheel slices */}
      <View style={styles.wheelContainer}>
        {vectors.map((vector, index) => {
          const angle = index * sliceAngle - Math.PI / 2; // Start from top
          const intensity = intensities[vector.slug] || 0;
          const isHovered = hoveredVector === vector.slug;

          return (
            <RadialWheelSlice
              key={vector.id}
              vector={vector}
              angle={angle}
              sliceAngle={sliceAngle}
              radius={radius}
              intensity={intensity}
              isHovered={isHovered}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Subtle overlay
    borderRadius: 999,
  },
  wheelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

