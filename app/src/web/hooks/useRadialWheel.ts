// Phase 0.2 - Radial Wheel Menu hook
// Core feature: Track mouse/touch interactions for intensity-based reactions

import { useState, useCallback, useRef, useEffect } from 'react';
import type { VibeIntensities } from '../lib/vibeVectors';
import type { VibeVector } from '../../lib/api';

interface RadialWheelState {
  isOpen: boolean;
  intensities: VibeIntensities;
  hoveredVector: string | null;
  startTime: number | null;
}

interface UseRadialWheelOptions {
  vectors: VibeVector[];
  onComplete: (intensities: VibeIntensities) => void;
  intensityBuildRate?: number; // Intensity increase per 100ms (default: 0.1 = 1 second to max)
}

export function useRadialWheel({
  vectors,
  onComplete,
  intensityBuildRate = 0.1, // 10% per 100ms = 1s to 100%
}: UseRadialWheelOptions) {
  const [state, setState] = useState<RadialWheelState>({
    isOpen: false,
    intensities: {},
    hoveredVector: null,
    startTime: null,
  });

  const hoverTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const intensityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize intensities for all vectors to 0
  useEffect(() => {
    const initialIntensities: VibeIntensities = {};
    for (const vector of vectors) {
      initialIntensities[vector.slug] = 0;
    }
    setState((prev) => ({
      ...prev,
      intensities: initialIntensities,
    }));
  }, [vectors]);

  // Calculate angle from center point to a given point
  const getAngle = useCallback((centerX: number, centerY: number, x: number, y: number): number => {
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);

  // Normalize angle to 0-360
  const normalizeAngle = useCallback((angle: number): number => {
    let normalized = angle;
    while (normalized < 0) normalized += 360;
    while (normalized >= 360) normalized -= 360;
    return normalized;
  }, []);

  // Find which vector slice the cursor is over based on angle
  const getVectorAtAngle = useCallback(
    (angle: number): string | null => {
      const normalizedAngle = normalizeAngle(angle + 90); // Adjust for top = 0°
      const sliceAngle = 360 / vectors.length;
      
      for (let i = 0; i < vectors.length; i++) {
        const startAngle = i * sliceAngle;
        const endAngle = (i + 1) * sliceAngle;
        
        // Handle wrap-around (last slice)
        if (i === vectors.length - 1) {
          if (normalizedAngle >= startAngle || normalizedAngle < endAngle) {
            return vectors[i].slug;
          }
        } else {
          if (normalizedAngle >= startAngle && normalizedAngle < endAngle) {
            return vectors[i].slug;
          }
        }
      }
      
      return null;
    },
    [vectors, normalizeAngle]
  );

  // Open the radial wheel
  const open = useCallback((centerX: number, centerY: number) => {
    setState({
      isOpen: true,
      intensities: {},
      hoveredVector: null,
      startTime: Date.now(),
    });
  }, []);

  // Handle mouse/touch move
  const handleMove = useCallback(
    (x: number, y: number, centerX: number, centerY: number) => {
      if (!state.isOpen) return;

      const angle = getAngle(centerX, centerY, x, y);
      const vectorSlug = getVectorAtAngle(angle);

      // Clear existing timers
      hoverTimersRef.current.forEach((timer) => clearInterval(timer));
      hoverTimersRef.current.clear();

      if (intensityIntervalRef.current) {
        clearInterval(intensityIntervalRef.current);
        intensityIntervalRef.current = null;
      }

      if (vectorSlug && vectorSlug !== state.hoveredVector) {
        // New vector hovered - start building intensity
        setState((prev) => ({
          ...prev,
          hoveredVector: vectorSlug,
          startTime: Date.now(),
        }));

        // Build intensity over time while hovering
        intensityIntervalRef.current = setInterval(() => {
          setState((prev) => {
            if (prev.hoveredVector !== vectorSlug) return prev;

            const elapsed = Date.now() - (prev.startTime || Date.now());
            const intensityIncrease = (elapsed / 100) * intensityBuildRate;
            const newIntensity = Math.min(1.0, intensityIncrease);

            return {
              ...prev,
              intensities: {
                ...prev.intensities,
                [vectorSlug]: newIntensity,
              },
            };
          });
        }, 50); // Update every 50ms for smooth animation
      } else if (!vectorSlug) {
        // Not over any vector - stop building intensity
        setState((prev) => ({
          ...prev,
          hoveredVector: null,
          startTime: null,
        }));
      }
    },
    [state.isOpen, state.hoveredVector, getAngle, getVectorAtAngle, intensityBuildRate]
  );

  // Close the radial wheel and complete the reaction
  const close = useCallback(() => {
    if (!state.isOpen) return;

    // Clear all timers
    hoverTimersRef.current.forEach((timer) => clearInterval(timer));
    hoverTimersRef.current.clear();
    if (intensityIntervalRef.current) {
      clearInterval(intensityIntervalRef.current);
      intensityIntervalRef.current = null;
    }

    // Filter out zero intensities and call onComplete
    const nonZeroIntensities: VibeIntensities = {};
    for (const [slug, intensity] of Object.entries(state.intensities)) {
      if (intensity > 0) {
        nonZeroIntensities[slug] = intensity;
      }
    }

    setState({
      isOpen: false,
      intensities: {},
      hoveredVector: null,
      startTime: null,
    });

    // Only call onComplete if there are non-zero intensities
    if (Object.keys(nonZeroIntensities).length > 0) {
      onComplete(nonZeroIntensities);
    }
  }, [state.isOpen, state.intensities, onComplete]);

  // Cancel the radial wheel without completing
  const cancel = useCallback(() => {
    hoverTimersRef.current.forEach((timer) => clearInterval(timer));
    hoverTimersRef.current.clear();
    if (intensityIntervalRef.current) {
      clearInterval(intensityIntervalRef.current);
      intensityIntervalRef.current = null;
    }

    setState({
      isOpen: false,
      intensities: {},
      hoveredVector: null,
      startTime: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hoverTimersRef.current.forEach((timer) => clearInterval(timer));
      if (intensityIntervalRef.current) {
        clearInterval(intensityIntervalRef.current);
      }
    };
  }, []);

  return {
    isOpen: state.isOpen,
    intensities: state.intensities,
    hoveredVector: state.hoveredVector,
    open,
    handleMove,
    close,
    cancel,
  };
}

