// Phase 2.1 - Left Sidebar Component
// Reddit-style node/subreddit list (collapsible)

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { getNodes, type Node } from '../../../lib/api';
import { NodeListItem } from './NodeListItem';

interface LeftSidebarProps {
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  selectedNodeId,
  onNodeSelect,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const nodeList = await getNodes();
      setNodes(nodeList);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = nodes.filter((node) =>
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (collapsed) {
    return (
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={onToggleCollapse}
          activeOpacity={0.7}
        >
          <Text style={styles.collapseIcon}>☰</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Nodes</Text>
        {onToggleCollapse && (
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={onToggleCollapse}
            activeOpacity={0.7}
          >
            <Text style={styles.collapseIcon}>←</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search nodes..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Node List */}
      <ScrollView style={styles.nodeList} showsVerticalScrollIndicator={false}>
        {/* All Nodes option */}
        <NodeListItem
          node={{ id: '', slug: 'all', name: 'All Nodes', description: null }}
          isSelected={!selectedNodeId}
          onPress={() => onNodeSelect(undefined)}
        />

        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading nodes...</Text>
          </View>
        )}

        {/* Node list */}
        {!loading && filteredNodes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No nodes found' : 'No nodes yet'}
            </Text>
          </View>
        )}

        {!loading &&
          filteredNodes.map((node) => (
            <NodeListItem
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              onPress={() => onNodeSelect(node.id)}
            />
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
  },
  collapsedContainer: {
    width: 40,
    height: '100%',
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    alignItems: 'center',
    paddingTop: 12,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  collapseIcon: {
    fontSize: 18,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  nodeList: {
    flex: 1,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

