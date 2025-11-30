import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap, TrendingUp, Sparkles, ChevronRight, Users, UserPlus } from './Icons';
import { COLORS } from '../../constants/theme';
import {
  getTrendingVibes,
  getTrendingNodes,
  getDiscoverNodes,
  joinNode,
  type VelocitySpike,
  type RisingNode,
  type NodeRecommendation,
} from '../../lib/api';

interface WhatsVibingProps {
  onNodeClick: (nodeId: string) => void;
}

export const WhatsVibing: React.FC<WhatsVibingProps> = ({ onNodeClick }) => {
  const queryClient = useQueryClient();

  // Fetch trending data
  const { data: vibesData, isLoading: vibesLoading } = useQuery({
    queryKey: ['trending-vibes'],
    queryFn: getTrendingVibes,
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
  });

  const { data: nodesData, isLoading: nodesLoading } = useQuery({
    queryKey: ['trending-nodes'],
    queryFn: getTrendingNodes,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: discoverData, isLoading: discoverLoading } = useQuery({
    queryKey: ['discover-nodes'],
    queryFn: getDiscoverNodes,
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000,
  });

  const handleJoinNode = async (nodeId: string) => {
    try {
      await joinNode(nodeId);
      // Refetch discover nodes after joining
      queryClient.invalidateQueries({ queryKey: ['discover-nodes'] });
    } catch (error) {
      console.error('Failed to join node:', error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Zap size={20} color="#f59e0b" />
        <Text style={styles.headerTitle}>What's Vibing</Text>
      </View>

      {/* Velocity Spikes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={16} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>Velocity Spikes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Vibes accelerating now</Text>

        {vibesLoading ? (
          <ActivityIndicator size="small" color="#8b5cf6" style={styles.loader} />
        ) : vibesData?.spikes && vibesData.spikes.length > 0 ? (
          vibesData.spikes.map((spike, index) => (
            <VelocitySpikeItem key={index} spike={spike} onNodeClick={onNodeClick} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No velocity spikes right now</Text>
            <Text style={styles.emptySubtext}>Check back when activity picks up!</Text>
          </View>
        )}
      </View>

      {/* Rising Nodes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={16} color="#10b981" />
          <Text style={styles.sectionTitle}>Rising Nodes</Text>
        </View>

        {nodesLoading ? (
          <ActivityIndicator size="small" color="#10b981" style={styles.loader} />
        ) : nodesData?.nodes && nodesData.nodes.length > 0 ? (
          nodesData.nodes.map((node) => (
            <RisingNodeItem key={node.id} node={node} onNodeClick={onNodeClick} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rising nodes today</Text>
          </View>
        )}
      </View>

      {/* Discover Nodes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={16} color="#f59e0b" />
          <Text style={styles.sectionTitle}>Discover Nodes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Based on your vibes</Text>

        {discoverLoading ? (
          <ActivityIndicator size="small" color="#f59e0b" style={styles.loader} />
        ) : discoverData?.recommendations && discoverData.recommendations.length > 0 ? (
          discoverData.recommendations.map((node) => (
            <DiscoverNodeItem
              key={node.id}
              node={node}
              onNodeClick={onNodeClick}
              onJoin={handleJoinNode}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recommendations yet</Text>
            <Text style={styles.emptySubtext}>React to some posts to get personalized suggestions!</Text>
          </View>
        )}
      </View>

      {/* See More Link */}
      <TouchableOpacity style={styles.seeMoreLink}>
        <Text style={styles.seeMoreText}>See more nodes</Text>
        <ChevronRight size={16} color="#8b5cf6" />
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

// ======== Sub-components ========

interface VelocitySpikeItemProps {
  spike: VelocitySpike;
  onNodeClick: (nodeId: string) => void;
}

function VelocitySpikeItem({ spike, onNodeClick }: VelocitySpikeItemProps) {
  return (
    <TouchableOpacity
      style={styles.spikeItem}
      onPress={() => onNodeClick(spike.nodeId)}
      activeOpacity={0.7}
    >
      <Text style={styles.spikeEmoji}>{spike.vibeEmoji}</Text>
      <View style={styles.spikeContent}>
        <Text style={styles.spikePercent}>+{spike.percentageChange}%</Text>
        <Text style={styles.spikeNode}>in n/{spike.nodeSlug}</Text>
        {spike.hashtags.length > 0 && (
          <Text style={styles.spikeHashtags}>
            {spike.hashtags.join(' ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface RisingNodeItemProps {
  node: RisingNode;
  onNodeClick: (nodeId: string) => void;
}

function RisingNodeItem({ node, onNodeClick }: RisingNodeItemProps) {
  return (
    <TouchableOpacity
      style={styles.risingItem}
      onPress={() => onNodeClick(node.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.nodeAvatar, { backgroundColor: node.color || '#6366f1' }]}>
        {node.avatar ? (
          <Image source={{ uri: node.avatar }} style={styles.nodeAvatarImage} />
        ) : (
          <Text style={styles.nodeAvatarText}>
            {node.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.risingContent}>
        <Text style={styles.risingName}>n/{node.slug}</Text>
        <Text style={styles.risingGrowth}>+{node.growthToday} members today</Text>
      </View>
    </TouchableOpacity>
  );
}

interface DiscoverNodeItemProps {
  node: NodeRecommendation;
  onNodeClick: (nodeId: string) => void;
  onJoin: (nodeId: string) => void;
}

function DiscoverNodeItem({ node, onNodeClick, onJoin }: DiscoverNodeItemProps) {
  return (
    <View style={styles.discoverItem}>
      <TouchableOpacity
        style={styles.discoverHeader}
        onPress={() => onNodeClick(node.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.nodeAvatar, { backgroundColor: node.color || '#6366f1' }]}>
          {node.avatar ? (
            <Image source={{ uri: node.avatar }} style={styles.nodeAvatarImage} />
          ) : (
            <Text style={styles.nodeAvatarText}>
              {node.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.discoverInfo}>
          <Text style={styles.discoverName}>n/{node.slug}</Text>
          <Text style={styles.discoverMembers}>{node.memberCount.toLocaleString()} members</Text>
        </View>
      </TouchableOpacity>

      {node.description && (
        <Text style={styles.discoverDescription} numberOfLines={2}>
          "{node.description}"
        </Text>
      )}

      <Text style={styles.discoverReason}>{node.matchReason}</Text>

      <View style={styles.discoverActions}>
        <TouchableOpacity
          style={styles.previewButton}
          onPress={() => onNodeClick(node.id)}
        >
          <Text style={styles.previewButtonText}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => onJoin(node.id)}
        >
          <UserPlus size={14} color="#fff" />
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Default export for compatibility
export default WhatsVibing;

// ======== Styles ========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginTop: 2,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.node.muted,
    fontStyle: 'italic',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#525252',
    marginTop: 4,
    textAlign: 'center',
  },

  // Velocity Spike styles
  spikeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  spikeEmoji: {
    fontSize: 20,
  },
  spikeContent: {
    flex: 1,
  },
  spikePercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  spikeNode: {
    fontSize: 13,
    color: '#a3a3a3',
  },
  spikeHashtags: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 2,
  },

  // Rising Node styles
  risingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  nodeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  nodeAvatarImage: {
    width: '100%',
    height: '100%',
  },
  nodeAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  risingContent: {
    flex: 1,
  },
  risingName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e5e5',
  },
  risingGrowth: {
    fontSize: 12,
    color: '#10b981',
  },

  // Discover Node styles
  discoverItem: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  discoverMembers: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  discoverDescription: {
    fontSize: 13,
    color: '#a3a3a3',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  discoverReason: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 8,
  },
  discoverActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    alignItems: 'center',
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // See more link
  seeMoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8b5cf6',
  },
  bottomPadding: {
    height: 20,
  },
});
