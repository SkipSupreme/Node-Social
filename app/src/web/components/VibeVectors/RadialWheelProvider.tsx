// Radial Wheel Provider - Renders the radial wheel menu at App root level
// This ensures it's not clipped by parent containers

import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { RadialWheelMenuImproved } from './RadialWheelMenuImproved';
import type { VibeVector, VibeIntensities } from '../../../lib/api';

interface RadialWheelState {
  isVisible: boolean;
  vectors: VibeVector[];
  centerX: number;
  centerY: number;
  intensities: { [slug: string]: number };
  hoveredVector: string | null;
  onMouseMove: (x: number, y: number) => void;
  onMouseUp: () => void;
  onComplete?: (intensities: VibeIntensities) => void;
}

interface RadialWheelContextType {
  showRadialWheel: (
    vectors: VibeVector[],
    centerX: number,
    centerY: number,
    onComplete: (intensities: VibeIntensities) => void
  ) => void;
  hideRadialWheel: () => void;
}

const RadialWheelContext = createContext<RadialWheelContextType | null>(null);

export const useRadialWheelGlobal = () => {
  const context = useContext(RadialWheelContext);
  if (!context) {
    throw new Error('useRadialWheelGlobal must be used within RadialWheelProvider');
  }
  return context;
};

export const RadialWheelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<RadialWheelState | null>(null);
  // Use refs to track mouse/interaction state across renders
  const intensitiesRef = useRef<{ [slug: string]: number }>({});
  const hoveredVectorRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intensityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStateRef = useRef<RadialWheelState | null>(null);
  const isInitialPressRef = useRef<boolean>(true); // Track if this is the initial button press

  // Update ref when state changes
  useEffect(() => {
    currentStateRef.current = state;
  }, [state]);

  const showRadialWheel = (
    vectors: VibeVector[],
    centerX: number,
    centerY: number,
    onComplete: (intensities: VibeIntensities) => void
  ) => {
    // Reset refs
    intensitiesRef.current = {};
    hoveredVectorRef.current = null;
    startTimeRef.current = null;
    isInitialPressRef.current = true; // Mark as initial press
    if (intensityIntervalRef.current) {
      clearInterval(intensityIntervalRef.current);
      intensityIntervalRef.current = null;
    }
    
    // After a short delay, allow mouseup to close
    setTimeout(() => {
      isInitialPressRef.current = false;
    }, 100);

    const handleMouseMove = (x: number, y: number) => {
      // Calculate angle from center
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radius = 140; // Half of 280 size

      if (distance > radius) {
        hoveredVectorRef.current = null;
        if (intensityIntervalRef.current) {
          clearInterval(intensityIntervalRef.current);
          intensityIntervalRef.current = null;
        }
        setState((prev) => (prev ? { ...prev, hoveredVector: null } : null));
        return;
      }

      // Calculate angle
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;

      // Adjust for top = 0°
      const normalizedAngle = (angle + 90) % 360;

      // Find which vector slice
      const sliceAngle = 360 / vectors.length;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);
      const vector = vectors[sliceIndex];

      if (vector && vector.slug !== hoveredVectorRef.current) {
        hoveredVectorRef.current = vector.slug;
        startTimeRef.current = Date.now();

        // Clear existing interval
        if (intensityIntervalRef.current) {
          clearInterval(intensityIntervalRef.current);
        }

        // Build intensity over time
        intensityIntervalRef.current = setInterval(() => {
          if (!startTimeRef.current || !currentStateRef.current) return;

          const elapsed = Date.now() - startTimeRef.current;
          const intensityIncrease = Math.min(1.0, elapsed / 1000); // 1 second to max

          intensitiesRef.current[vector.slug] = intensityIncrease;

          setState((prev) =>
            prev
              ? {
                  ...prev,
                  intensities: { ...intensitiesRef.current },
                  hoveredVector: vector.slug,
                }
              : null
          );
        }, 50);
      }
    };

    const handleMouseUp = () => {
      // Ignore the initial mouseup from the button press
      if (isInitialPressRef.current) {
        isInitialPressRef.current = false;
        return;
      }

      if (intensityIntervalRef.current) {
        clearInterval(intensityIntervalRef.current);
        intensityIntervalRef.current = null;
      }

      // Filter out zero intensities and call onComplete
      const nonZeroIntensities: VibeIntensities = {};
      for (const [slug, intensity] of Object.entries(intensitiesRef.current)) {
        if (intensity > 0) {
          nonZeroIntensities[slug] = intensity;
        }
      }

      if (Object.keys(nonZeroIntensities).length > 0 && onComplete) {
        onComplete(nonZeroIntensities);
      }

      // Reset state
      intensitiesRef.current = {};
      hoveredVectorRef.current = null;
      startTimeRef.current = null;
      setState(null);
    };

    setState({
      isVisible: true,
      vectors,
      centerX,
      centerY,
      intensities: {},
      hoveredVector: null,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onComplete,
    });
  };

  const hideRadialWheel = () => {
    setState(null);
  };

  return (
    <RadialWheelContext.Provider value={{ showRadialWheel, hideRadialWheel }}>
      {children}
      {/* Render radial wheel at root level using Modal - ensures it's on top */}
      {state && (
        <Modal
          transparent
          visible={state.isVisible}
          animationType="none"
          onRequestClose={hideRadialWheel}
          presentationStyle="overFullScreen"
        >
          <View style={styles.modalContainer} pointerEvents="box-none">
            <RadialWheelMenuImproved
              vectors={state.vectors}
              centerX={state.centerX}
              centerY={state.centerY}
              size={280}
              intensities={state.intensities}
              hoveredVector={state.hoveredVector}
              onMouseMove={state.onMouseMove}
              onMouseUp={state.onMouseUp}
              visible={state.isVisible}
            />
          </View>
        </Modal>
      )}
    </RadialWheelContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

