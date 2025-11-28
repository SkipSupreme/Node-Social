import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hexagon } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

interface NodeLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export const NodeLogo: React.FC<NodeLogoProps> = ({ size = 'medium', showText = true }) => {
  const dimensions = {
    small: { icon: 20, text: 14 },
    medium: { icon: 28, text: 18 },
    large: { icon: 36, text: 24 },
  };

  const { icon, text } = dimensions[size];

  return (
    <View style={styles.container}>
      <View style={styles.hexagonContainer}>
        <Hexagon
          size={icon}
          color={COLORS.node.accent}
          fill={COLORS.node.accent}
          strokeWidth={0}
        />
        {/* Inner pulse effect */}
        <View style={[styles.pulse, { width: icon * 0.5, height: icon * 0.5 }]} />
      </View>
      {showText && (
        <Text style={[styles.text, { fontSize: text }]}>Node</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hexagonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 100,
  },
  text: {
    fontWeight: '800',
    color: COLORS.node.text,
    letterSpacing: -0.5,
  },
});
