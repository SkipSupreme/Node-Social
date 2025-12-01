import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Users, Calendar, TrendingUp, BookOpen, Crown, FileText, Settings, ChevronRight, CheckCircle, MoreHorizontal, MessageSquare } from './Icons';
import { COLORS } from '../../constants/theme';
import { getNodeDetails, joinNode, leaveNode, NodeDetails } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { NodeOverflowMenu } from './NodeOverflowMenu';
import { ModLogPreview } from './ModLogPreview';

interface NodeLandingPageProps {
  nodeId: string;
  onNavigateToSettings?: () => void;
  onNavigateToModLog?: () => void;
  onMessageCouncil?: () => void;
  onStartChat?: (userId: string) => void;
}

// Generate gradient from color
function generateGradient(baseColor: string): string[] {
  // Simple gradient: base color to slightly darker
  return [baseColor, baseColor];
}

// Format date to "Month Year"
function formatEstDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const NodeLandingPage: React.FC<NodeLandingPageProps> = ({
  nodeId,
  onNavigateToSettings,
  onNavigateToModLog,
  onMessageCouncil,
  onStartChat,
}) => {
  const { user } = useAuthStore();
  const [nodeData, setNodeData] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showAllRules, setShowAllRules] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetchNodeData();
  }, [nodeId]);

  const fetchNodeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNodeDetails(nodeId);
      setNodeData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load node');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!nodeData || joining) return;

    setJoining(true);
    try {
      if (nodeData.currentUserMembership?.isMember) {
        await leaveNode(nodeData.id);
      } else {
        await joinNode(nodeData.id);
      }
      // Refresh data
      await fetchNodeData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.node.accent} />
      </View>
    );
  }

  if (error || !nodeData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Node not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchNodeData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMember = nodeData.currentUserMembership?.isMember ?? false;
  const isAdmin = nodeData.currentUserMembership?.role === 'admin';
  const nodeColor = nodeData.color || '#6366f1';
  const displayRules = showAllRules ? nodeData.rules : nodeData.rules.slice(0, 3);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: nodeColor }]}>
        {nodeData.banner ? (
          <Image source={{ uri: nodeData.banner }} style={styles.bannerImage} />
        ) : null}
      </View>

      {/* Avatar + Basic Info */}
      <View style={styles.infoSection}>
        <View style={[styles.avatarContainer, { borderColor: COLORS.node.panel }]}>
          {nodeData.avatar ? (
            <Image source={{ uri: nodeData.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: nodeColor }]}>
              <Text style={styles.avatarText}>
                {nodeData.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.nodeName}>n/{nodeData.slug}</Text>
        {nodeData.description && (
          <Text style={styles.nodeDescription}>{nodeData.description}</Text>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Users size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>{nodeData.stats.memberCount.toLocaleString()} members</Text>
          </View>
          <View style={styles.stat}>
            <Calendar size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>Est. {formatEstDate(nodeData.createdAt)}</Text>
          </View>
          {nodeData.stats.growthThisWeek > 0 && (
            <View style={styles.stat}>
              <TrendingUp size={14} color={COLORS.node.accent} />
              <Text style={[styles.statText, { color: COLORS.node.accent }]}>
                +{nodeData.stats.growthThisWeek} this week
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {isMember ? (
            <View style={styles.joinedBadge}>
              <CheckCircle size={16} color="#10b981" />
              <Text style={styles.joinedText}>
                Joined {nodeData.currentUserMembership?.joinedAt
                  ? new Date(nodeData.currentUserMembership.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : ''}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, joining && styles.buttonDisabled]}
              onPress={handleJoinLeave}
              disabled={joining}
            >
              <Text style={styles.joinButtonText}>
                {joining ? 'Joining...' : 'Join Node'}
              </Text>
            </TouchableOpacity>
          )}
          {isAdmin && onNavigateToSettings && (
            <TouchableOpacity style={styles.settingsButton} onPress={onNavigateToSettings}>
              <Settings size={18} color={COLORS.node.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
            <MoreHorizontal size={18} color={COLORS.node.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overflow Menu */}
      <NodeOverflowMenu
        nodeId={nodeData.id}
        nodeName={nodeData.name}
        nodeSlug={nodeData.slug}
        isMember={isMember}
        isMuted={nodeData.currentUserMembership?.isMuted || false}
        isAdmin={isAdmin}
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onMuteChange={(muted) => {
          if (nodeData.currentUserMembership) {
            setNodeData({
              ...nodeData,
              currentUserMembership: {
                ...nodeData.currentUserMembership,
                isMuted: muted,
              },
            });
          }
        }}
        onLeave={() => {
          fetchNodeData();
        }}
      />

      {/* Rules Section */}
      {nodeData.rules.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BookOpen size={16} color={COLORS.node.accent} />
            <Text style={styles.sectionTitle}>Rules</Text>
          </View>
          <View style={styles.rulesList}>
            {displayRules.map((rule, index) => (
              <View key={index} style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
          {nodeData.rules.length > 3 && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllRules(!showAllRules)}
            >
              <Text style={styles.showMoreText}>
                {showAllRules ? 'Show less' : `Show all ${nodeData.rules.length} rules`}
              </Text>
              <ChevronRight
                size={14}
                color={COLORS.node.accent}
                style={{ transform: [{ rotate: showAllRules ? '-90deg' : '90deg' }] }}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Council Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Crown size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Node Council</Text>
        </View>
        {nodeData.council.length > 0 ? (
          <View style={styles.councilList}>
            {nodeData.council.map((member) => (
              <View key={member.userId} style={styles.councilMember}>
                {member.avatar ? (
                  <Image source={{ uri: member.avatar }} style={styles.councilAvatar} />
                ) : (
                  <View style={styles.councilAvatarPlaceholder}>
                    <Text style={styles.councilAvatarText}>
                      {member.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.councilInfo}>
                  <Text style={styles.councilUsername}>@{member.username}</Text>
                  <Text style={styles.councilRole}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)} · {member.tenure}
                  </Text>
                </View>
                {onStartChat && member.userId !== user?.id && (
                  <TouchableOpacity
                    style={styles.councilMessageButton}
                    onPress={() => onStartChat(member.userId)}
                  >
                    <MessageSquare size={16} color={COLORS.node.accent} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No council members yet</Text>
        )}
        {onMessageCouncil && nodeData.council.length > 0 && (
          <TouchableOpacity style={styles.messageCouncilButton} onPress={onMessageCouncil}>
            <MessageSquare size={14} color={COLORS.node.accent} style={{ marginRight: 6 }} />
            <Text style={styles.messageCouncilText}>Message Council</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mod Log Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Recent Mod Actions</Text>
        </View>
        <ModLogPreview
          actions={nodeData.recentModActions}
          onViewFullLog={onNavigateToModLog}
        />
      </View>

      {/* Bottom padding */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
    padding: 20,
  },
  errorText: {
    color: COLORS.node.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.node.accent,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  banner: {
    height: 100,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    alignItems: 'center',
  },
  avatarContainer: {
    marginTop: -48,
    borderWidth: 3,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 13,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 8,
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
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  joinedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  joinedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  leaveButtonText: {
    color: COLORS.node.text,
  },
  settingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    justifyContent: 'center',
    alignItems: 'center',
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
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 8,
  },
  ruleNumber: {
    color: COLORS.node.muted,
    fontSize: 14,
    width: 20,
  },
  ruleText: {
    flex: 1,
    color: COLORS.node.text,
    fontSize: 14,
    lineHeight: 20,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  showMoreText: {
    color: COLORS.node.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  councilList: {
    gap: 12,
  },
  councilMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  councilAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  councilAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  councilAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  councilInfo: {
    flex: 1,
  },
  councilUsername: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '600',
  },
  councilRole: {
    color: COLORS.node.muted,
    fontSize: 12,
    marginTop: 2,
  },
  councilMessageButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
  },
  emptyText: {
    color: COLORS.node.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageCouncilButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageCouncilText: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '500',
  },
  modLogList: {
    gap: 12,
  },
  modLogItem: {
    padding: 12,
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  modLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modLogAction: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modLogTime: {
    color: COLORS.node.muted,
    fontSize: 12,
  },
  modLogReason: {
    color: COLORS.node.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  modLogMod: {
    color: COLORS.node.muted,
    fontSize: 12,
  },
  viewFullLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  viewFullLogText: {
    color: COLORS.node.accent,
    fontSize: 13,
    fontWeight: '500',
  },
});
