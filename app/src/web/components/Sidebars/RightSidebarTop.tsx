
// Phase 3.1 - Right Sidebar Top Component
// Vibe Validator panel (feed algorithm controls)

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { VibeValidator } from '../FeedControls/VibeValidator';

interface RightSidebarTopProps {
  style?: StyleProp<ViewStyle>;
}

export const RightSidebarTop: React.FC<RightSidebarTopProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Vibe Validator</Text>
        <Text style={styles.subtitle}>Control your feed</Text>
      </View>
      <VibeValidator />
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

