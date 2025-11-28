// Phase 3.2 - Right Sidebar Bottom Component
// Node community information panel

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { NodeInfoCard } from '../NodeInfo/NodeInfoCard';
import type { Node } from '../../../lib/api';

interface RightSidebarBottomProps {
  node?: Node | null;
  style?: StyleProp<ViewStyle>;
}

export const RightSidebarBottom: React.FC<RightSidebarBottomProps> = ({ node, style }) => {
  if (!node) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Text style={styles.title}>Node Info</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Select a node to see information</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>About n/{node.slug}</Text>
      </View>
      <NodeInfoCard node={node} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#181a20',
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
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

