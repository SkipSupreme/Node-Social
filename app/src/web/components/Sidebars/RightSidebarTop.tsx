
// Phase 3.1 - Right Sidebar Top Component
// Vibe Validator panel (feed algorithm controls)

import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { VibeValidator } from '../../../components/ui/VibeValidator';

interface RightSidebarTopProps {
  style?: StyleProp<ViewStyle>;
}

export const RightSidebarTop: React.FC<RightSidebarTopProps> = ({ style }) => {
  const [settings, setSettings] = useState({
    preset: 'balanced',
    weights: { quality: 35, recency: 25, engagement: 20, personalization: 20 }
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
});

