// Phase 2.1 - Node List Item Component
// Individual node in the sidebar list

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Node } from '../../../lib/api';

interface NodeListItemProps {
  node: Node & { id?: string }; // Allow id to be optional for "All Nodes"
  isSelected: boolean;
  onPress: () => void;
}

export const NodeListItem: React.FC<NodeListItemProps> = ({ node, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.name, isSelected && styles.nameSelected]}>n/{node.slug}</Text>
        {node.description && (
          <Text style={styles.description} numberOfLines={1}>
            {node.description}
          </Text>
        )}
      </View>
      {isSelected && <View style={styles.indicator} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d35',
    position: 'relative',
  },
  itemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 2,
  },
  nameSelected: {
    color: '#6366f1',
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    color: '#94a3b8',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#6366f1',
  },
});

