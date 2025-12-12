// src/components/ui/AuthLogo.tsx
// White hexagon with subtle breathing pulse - our North Star
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { Hexagon } from "lucide-react-native";

interface AuthLogoProps {
  size?: number;
}

export const AuthLogo: React.FC<AuthLogoProps> = ({ size = 48 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle breathing pulse - matches the top-left logo behavior
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

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, []);

  return (
    <View style={[styles.container, { width: size * 2, height: size * 2 }]}>
      <Animated.View
        style={[
          styles.hexagonWrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Hexagon
          size={size}
          color="#ffffff"
          strokeWidth={2}
          fill="#ffffff"
          fillOpacity={0.15}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  hexagonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AuthLogo;
