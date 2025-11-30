import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Users, Calendar, TrendingUp, BookOpen, Crown, FileText } from './Icons';
import { COLORS } from '../../constants/theme';

interface NodeLandingPageProps {
  nodeId: string;
  onJoin?: () => void;
  onLeave?: () => void;
  onMute?: () => void;
  onMessageCouncil?: () => void;
}

export const NodeLandingPage: React.FC<NodeLandingPageProps> = ({
  nodeId,
  onJoin,
  onLeave,
  onMute,
  onMessageCouncil,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Banner Placeholder */}
      <View style={styles.bannerPlaceholder}>
        <Text style={styles.bannerPlaceholderText}>Node Banner</Text>
      </View>

      {/* Avatar + Basic Info */}
      <View style={styles.infoSection}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>N</Text>
        </View>

        <Text style={styles.nodeName}>n/{nodeId.substring(0, 8)}...</Text>
        <Text style={styles.nodeDescription}>Node description will appear here</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Users size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>-- members</Text>
          </View>
          <View style={styles.stat}>
            <Calendar size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>Est. --</Text>
          </View>
          <View style={styles.stat}>
            <TrendingUp size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>+-- this week</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinButtonText}>Join Node</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuButtonText}>•••</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rules Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <BookOpen size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Rules</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Community rules
          </Text>
        </View>
      </View>

      {/* Council Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Crown size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Node Council</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Moderator list
          </Text>
        </View>
        <TouchableOpacity style={styles.messageCouncilButton} onPress={onMessageCouncil}>
          <Text style={styles.messageCouncilText}>Message Council</Text>
        </TouchableOpacity>
      </View>

      {/* Mod Log Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Recent Mod Actions</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Moderation transparency log
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
  bannerPlaceholder: {
    height: 100,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -48, // Banner comes halfway down the avatar
    borderWidth: 3,
    borderColor: COLORS.node.panel,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  nodeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
    marginTop: 12,
  },
  nodeDescription: {
    fontSize: 14,
    color: COLORS.node.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  joinButton: {
    flex: 1,
    backgroundColor: COLORS.node.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  menuButtonText: {
    color: COLORS.node.text,
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  placeholder: {
    padding: 16,
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
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
  messageCouncilButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    alignItems: 'center',
  },
  messageCouncilText: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
