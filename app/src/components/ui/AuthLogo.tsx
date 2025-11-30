// src/components/ui/AuthLogo.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { Hexagon } from "lucide-react-native";
import { COLORS } from "../../constants/theme";

interface AuthLogoProps {
  size?: number;
}

export const AuthLogo: React.FC<AuthLogoProps> = ({ size = 48 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation - subtle breathing effect
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Glow animation - pulsating glow intensity
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Very slow rotation for inner hexagon
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    glowLoop.start();
    rotateLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
      rotateLoop.stop();
    };
  }, []);

  const innerSize = size * 0.58;
  const glowSize = size * 1.8;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: glowSize, height: glowSize }]}>
      {/* Outer glow layers */}
      <Animated.View
        style={[
          styles.glowLayer,
          styles.glowOuter,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glowLayer,
          styles.glowMiddle,
          {
            width: glowSize * 0.7,
            height: glowSize * 0.7,
            borderRadius: glowSize * 0.35,
            opacity: Animated.multiply(glowAnim, 1.2),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glowLayer,
          styles.glowInner,
          {
            width: glowSize * 0.5,
            height: glowSize * 0.5,
            borderRadius: glowSize * 0.25,
            opacity: Animated.multiply(glowAnim, 1.5),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main hexagon container */}
      <Animated.View
        style={[
          styles.hexagonWrapper,
          {
            width: size * 1.4,
            height: size * 1.4,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Outer hexagon - purple/accent */}
        <Hexagon
          size={size}
          color={COLORS.node.accent}
          strokeWidth={1.5}
        />

        {/* Inner rotating hexagon - white */}
        <Animated.View
          style={[
            styles.innerHexagon,
            { transform: [{ rotate: spin }] },
          ]}
        >
          <Hexagon
            size={innerSize}
            color="#ffffff"
            strokeWidth={2}
            fill="#ffffff"
            fillOpacity={0.15}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowLayer: {
    position: "absolute",
  },
  glowOuter: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
  glowMiddle: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  glowInner: {
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    shadowColor: COLORS.node.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  hexagonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerHexagon: {
    position: "absolute",
  },
});

export default AuthLogo;
