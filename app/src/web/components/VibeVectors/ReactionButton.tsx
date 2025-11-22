// Phase 0.2 - Reaction Button Component
// "React" button that triggers Radial Wheel Menu

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRadialWheelGlobal } from './RadialWheelProvider';
import type { VibeVector, VibeIntensities } from '../../../lib/api';

interface ReactionButtonProps {
  vectors: VibeVector[];
  onReact: (intensities: VibeIntensities) => Promise<void>;
  existingReaction?: VibeIntensities | null; // User's existing reaction, if any
  disabled?: boolean;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  vectors,
  onReact,
  existingReaction = null,
  disabled = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<TouchableOpacity>(null);
  const { showRadialWheel, hideRadialWheel } = useRadialWheelGlobal();

  const handlePressIn = () => {
    if (disabled) return;

    setIsPressed(true);

    // Get button position for radial wheel center
    if (buttonRef.current) {
      buttonRef.current.measure((x, y, width, height, pageX, pageY) => {
        const centerX = pageX + width / 2;
        const centerY = pageY + height / 2;
        
        // Show radial wheel at root level
        showRadialWheel(
          vectors,
          centerX,
          centerY,
          async (intensities) => {
            try {
              await onReact(intensities);
            } catch (error) {
              console.error('Failed to submit reaction:', error);
            } finally {
              setIsPressed(false);
              hideRadialWheel();
            }
          }
        );
      });
    }
  };

  const hasReaction = existingReaction && Object.values(existingReaction).some((v) => v > 0);

  return (
    <TouchableOpacity
      ref={buttonRef}
      style={[
        styles.button,
        isPressed && styles.buttonPressed,
        hasReaction && styles.buttonHasReaction,
        disabled && styles.buttonDisabled,
      ]}
      onPressIn={handlePressIn}
      onPressOut={() => {
        // Don't close on pressOut - let the modal's mouseup event handle it
        // This prevents the modal from closing immediately when button is pressed
      }}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, hasReaction && styles.buttonTextHasReaction]}>
        {hasReaction ? 'Reacted' : 'React'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.95 }],
  },
  buttonHasReaction: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  buttonTextHasReaction: {
    color: '#2563EB',
  },
});

