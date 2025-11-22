// Phase 0.2 - Improved Radial Wheel Menu Component
// Better visual radial wheel with proper slice rendering and intensity display

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { RadialWheelSliceImproved } from './RadialWheelSliceImproved';
import type { VibeVector } from '../../../lib/api';

interface RadialWheelMenuImprovedProps {
  vectors: VibeVector[];
  centerX: number;
  centerY: number;
  size: number;
  intensities: { [slug: string]: number };
  hoveredVector: string | null;
  onMouseMove: (x: number, y: number) => void;
  onMouseUp: () => void;
  visible: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SIZE = 280;
const CENTER_BUTTON_SIZE = 50;

// Vector colors
const VECTOR_COLORS: { [key: string]: string } = {
  funny: '#F59E0B', // Amber
  insightful: '#3B82F6', // Blue
  angry: '#EF4444', // Red
  novel: '#10B981', // Green
  cursed: '#8B5CF6', // Purple
};

export const RadialWheelMenuImproved: React.FC<RadialWheelMenuImprovedProps> = ({
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

  // Web-specific: Set fixed positioning and z-index via DOM manipulation
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      // Use nativeID to find element and set fixed positioning
      const element = document.getElementById('radial-wheel-menu');
      if (element) {
        (element as HTMLElement).style.position = 'fixed';
        (element as HTMLElement).style.zIndex = '999999';
      }
    }
  }, [visible]);

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
        onMouseMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      onMouseUp();
    };

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

  if (!visible || vectors.length === 0) return null;

  const radius = size / 2;
  const innerRadius = CENTER_BUTTON_SIZE / 2 + 10;

  // Position to keep wheel on screen - use viewport coordinates for fixed positioning
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
      pointerEvents="box-none"
      nativeID={Platform.OS === 'web' ? 'radial-wheel-menu' : undefined}
    >
      {/* Dark overlay */}
      <View style={styles.overlay} />
      
      {/* Wheel container with slices */}
      <View style={[styles.wheelContainer, { borderRadius: radius }]}>
        {vectors.map((vector, index) => {
          const color = VECTOR_COLORS[vector.slug] || '#64748B';
          const intensity = intensities[vector.slug] || 0;
          const isHovered = hoveredVector === vector.slug;
          
          return (
            <RadialWheelSliceImproved
              key={vector.id}
              vector={vector}
              index={index}
              totalSlices={vectors.length}
              radius={radius}
              innerRadius={innerRadius}
              intensity={intensity}
              isHovered={isHovered}
              color={color}
            />
          );
        })}
        
        {/* Center button */}
        <View style={styles.centerButton}>
          <Text style={styles.centerButtonText}>React</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', // Will be 'fixed' on web via inline style override
    zIndex: 999999, // Extremely high z-index to be above everything (increased)
    elevation: 99999, // For Android
    // Web-specific: ensure it's above all other elements
    ...(Platform.OS === 'web' ? {
      // @ts-ignore
      position: 'fixed',
    } : {}),
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Darker overlay for better visibility
    borderRadius: 999,
    zIndex: 1, // Ensure overlay is above background
  },
  wheelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: DEFAULT_SIZE / 2, // Will be overridden by inline styles if needed
    zIndex: 2, // Above overlay
  },
  centerButton: {
    position: 'absolute',
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

