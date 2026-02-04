// NodeInfoSheet - Mobile node info modal/bottom sheet
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Users, Shield, UserPlus, LogOut } from './Icons';
import { COLORS } from '../../constants/theme';
import { getNodeDetails, joinNode, leaveNode, NodeDetails } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { useAuthPrompt } from '../../context/AuthPromptContext';

interface NodeInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  nodeId: string | null;
  onViewPosts?: () => void;
}

export const NodeInfoSheet: React.FC<NodeInfoSheetProps> = ({
  visible,
  onClose,
  nodeId,
  onViewPosts,
}) => {
  const { user } = useAuthStore();
  const { requireAuth } = useAuthPrompt();
  const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (visible && nodeId) {
      fetchNodeDetails();
    }
  }, [visible, nodeId]);

  const fetchNodeDetails = async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const details = await getNodeDetails(nodeId);
      setNodeDetails(details);
      setIsMember(details.currentUserMembership?.isMember || false);
    } catch (error) {
      console.error('Failed to fetch node details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!nodeId) return;
    if (!user) {
      requireAuth('Sign in to join communities');
      return;
    }

    setJoining(true);
    try {
      if (isMember) {
        await leaveNode(nodeId);
        setIsMember(false);
      } else {
        await joinNode(nodeId);
        setIsMember(true);
      }
    } catch (error) {
      console.error('Failed to join/leave node:', error);
    } finally {
      setJoining(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Community Info</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.node.accent} />
            </View>
          ) : nodeDetails ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Banner */}
              {nodeDetails.banner && (
                <Image
                  source={{ uri: nodeDetails.banner }}
                  style={styles.banner}
                  resizeMode="cover"
                />
              )}

              {/* Node Info */}
              <View style={styles.nodeInfo}>
                {/* Avatar + Name */}
                <View style={styles.avatarRow}>
                  {nodeDetails.avatar ? (
                    <Image
                      source={{ uri: nodeDetails.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {nodeDetails.name?.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.nameContainer}>
                    <Text style={styles.nodeName}>{nodeDetails.name}</Text>
                    <Text style={styles.nodeSlug}>/{nodeDetails.slug}</Text>
                  </View>
                </View>

                {/* Description */}
                {nodeDetails.description && (
                  <Text style={styles.description}>{nodeDetails.description}</Text>
                )}

                {/* Stats */}
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Users size={16} color={COLORS.node.muted} />
                    <Text style={styles.statValue}>{nodeDetails.stats?.memberCount || 0}</Text>
                    <Text style={styles.statLabel}>members</Text>
                  </View>
                  <View style={styles.stat}>
                    <Shield size={16} color={COLORS.node.muted} />
                    <Text style={styles.statValue}>{nodeDetails.council?.length || 0}</Text>
                    <Text style={styles.statLabel}>council</Text>
                  </View>
                </View>

                {/* Join/Leave Button */}
                <TouchableOpacity
                  style={[styles.joinButton, isMember && styles.leaveButton]}
                  onPress={handleJoinLeave}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color={isMember ? COLORS.node.text : '#fff'} />
                  ) : (
                    <>
                      {isMember ? (
                        <LogOut size={18} color={COLORS.node.text} />
                      ) : (
                        <UserPlus size={18} color="#fff" />
                      )}
                      <Text style={[styles.joinButtonText, isMember && styles.leaveButtonText]}>
                        {isMember ? 'Leave Community' : 'Join Community'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* View Posts Button */}
                {onViewPosts && (
                  <TouchableOpacity
                    style={styles.viewPostsButton}
                    onPress={() => {
                      onViewPosts();
                      onClose();
                    }}
                  >
                    <Text style={styles.viewPostsText}>View Posts</Text>
                  </TouchableOpacity>
                )}

                {/* Rules */}
                {nodeDetails.rules && nodeDetails.rules.length > 0 && (
                  <View style={styles.rulesSection}>
                    <Text style={styles.sectionTitle}>Community Rules</Text>
                    {nodeDetails.rules.map((rule, index) => (
                      <View key={index} style={styles.rule}>
                        <Text style={styles.ruleNumber}>{index + 1}.</Text>
                        <Text style={styles.ruleText}>{rule}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Council Members */}
                {nodeDetails.council && nodeDetails.council.length > 0 && (
                  <View style={styles.councilSection}>
                    <Text style={styles.sectionTitle}>Council Members</Text>
                    <View style={styles.councilList}>
                      {nodeDetails.council.slice(0, 5).map((member) => (
                        <View key={member.userId} style={styles.councilMember}>
                          {member.avatar ? (
                            <Image
                              source={{ uri: member.avatar }}
                              style={styles.councilAvatar}
                            />
                          ) : (
                            <View style={[styles.councilAvatar, styles.avatarPlaceholder]}>
                              <Text style={styles.councilAvatarText}>
                                {member.username?.charAt(0) || '?'}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.councilUsername}>@{member.username}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load community info</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.node.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  banner: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.node.bgAlt,
  },
  nodeInfo: {
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.node.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  nodeName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  nodeSlug: {
    fontSize: 14,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.node.textSecondary,
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.node.accent,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  leaveButton: {
    backgroundColor: COLORS.node.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  leaveButtonText: {
    color: COLORS.node.text,
  },
  viewPostsButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
    marginBottom: 20,
  },
  viewPostsText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.accent,
  },
  rulesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.muted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rule: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  ruleNumber: {
    fontSize: 14,
    color: COLORS.node.accent,
    fontWeight: '600',
    marginRight: 8,
    width: 20,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.node.textSecondary,
  },
  councilSection: {
    marginBottom: 20,
  },
  councilList: {
    gap: 8,
  },
  councilMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
  },
  councilAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  councilAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  councilUsername: {
    fontSize: 14,
    color: COLORS.node.text,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
});

export default NodeInfoSheet;
