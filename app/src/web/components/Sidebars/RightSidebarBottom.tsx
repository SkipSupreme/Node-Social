// Phase 3.2 - Right Sidebar Bottom Component
// Node community information panel

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NodeInfoCard } from '../NodeInfo/NodeInfoCard';
import type { Node } from '../../../lib/api';

interface RightSidebarBottomProps {
  node?: Node | null;
  className?: string;
}

export const RightSidebarBottom: React.FC<RightSidebarBottomProps> = ({ node, className }) => {
  if (!node) {
    return (
      <View style={[styles.container, className]}>
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
    <View style={[styles.container, className]}>
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
    backgroundColor: '#FFFFFF',
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
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

