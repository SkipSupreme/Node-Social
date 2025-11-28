
// Phase 3.1 - Right Sidebar Top Component
// Vibe Validator panel (feed algorithm controls)

import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { VibeValidator, VibeValidatorSettings } from '../../../components/ui/VibeValidator';

interface RightSidebarTopProps {
  style?: StyleProp<ViewStyle>;
}

export const RightSidebarTop: React.FC<RightSidebarTopProps> = ({ style }) => {
  const [settings, setSettings] = useState<VibeValidatorSettings>({
    preset: 'balanced',
    weights: { quality: 35, recency: 25, engagement: 20, personalization: 20 },
    mode: 'simple',
  });

  return (
    <View style={[styles.container, style]}>
      <VibeValidator settings={settings} onUpdate={setSettings} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#181a20',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d35',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d35',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
});

