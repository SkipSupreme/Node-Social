import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, Zap, Users } from './Icons';
import { COLORS } from '../../constants/theme';

interface WhatsVibingProps {
  onNodeClick?: (nodeId: string) => void;
}

export const WhatsVibing: React.FC<WhatsVibingProps> = ({ onNodeClick }) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TrendingUp size={20} color={COLORS.node.accent} />
        <Text style={styles.headerTitle}>What's Vibing</Text>
      </View>

      {/* Velocity Spikes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Zap size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Velocity Spikes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Vibes accelerating now</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Real-time vibe velocity tracking
          </Text>
        </View>
      </View>

      {/* Rising Nodes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Rising Nodes</Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Fastest growing communities
          </Text>
        </View>
      </View>

      {/* Discover Nodes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Discover Nodes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Based on your vibes</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Personalized node recommendations
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginBottom: 12,
  },
  placeholder: {
    padding: 20,
    backgroundColor: COLORS.node.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.node.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
