import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Hexagon } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

interface NodeLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export const NodeLogo: React.FC<NodeLogoProps> = ({ size = 'medium', showText = true }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  const dimensions = {
    small: { box: 28, icon: 16, nodeText: 14, socialText: 14 },
    medium: { box: 32, icon: 20, nodeText: 18, socialText: 18 },
    large: { box: 40, icon: 24, nodeText: 24, socialText: 24 },
  };

  const { box, icon, nodeText, socialText } = dimensions[size];

  useEffect(() => {
    // Pulse animation (scale up and down)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Glow animation (opacity pulse)
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.logoBox, { width: box, height: box, borderRadius: box * 0.25 }]}>
        {/* Glow effect layer */}
        <Animated.View
          style={[
            styles.logoGlow,
            {
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Hexagon size={icon} color={COLORS.node.accent} />
        </Animated.View>
        {/* Main white hexagon */}
        <Animated.View
          style={[
            styles.logoIconInner,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Hexagon size={icon} color="#fff" />
        </Animated.View>
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.nodeText, { fontSize: nodeText }]}>NODE</Text>
          <Text style={[styles.socialText, { fontSize: socialText }]}>social</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlow: {
    position: 'absolute',
    shadowColor: COLORS.node.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },
  logoIconInner: {
    position: 'absolute',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  nodeText: {
    fontWeight: '800',
    color: COLORS.node.text,
    letterSpacing: -0.5,
  },
  socialText: {
    fontWeight: '400',
    color: COLORS.node.muted,
    letterSpacing: -0.3,
  },
});
