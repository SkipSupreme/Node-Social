// Phase 3.2 - Node Info Card Component
// Display node name, description, stats, etc.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Node } from '../../../lib/api';

interface NodeInfoCardProps {
  node: Node;
}

export const NodeInfoCard: React.FC<NodeInfoCardProps> = ({ node }) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {node.description && (
          <View style={styles.section}>
            <Text style={styles.description}>{node.description}</Text>
          </View>
        )}

        {/* Future: Subscriber count, rules, moderator list, etc. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <Text style={styles.statText}>Coming soon...</Text>
        </View>

        {/* Future: Join/Leave button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.joinButton} activeOpacity={0.7}>
            <Text style={styles.joinButtonText}>Join Node</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  statText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  joinButton: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

