// Phase 0.3 - Post Vibe Reactions Component
// Display reactions on post (compact, counts hidden by default per master plan)

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ReactionButton } from './ReactionButton';
import type { VibeVector, VibeIntensities, Node } from '../../../lib/api';

interface PostVibeReactionsProps {
  vectors: VibeVector[];
  postId: string;
  node: Node;
  existingReaction?: VibeIntensities | null;
  onReact: (intensities: VibeIntensities) => Promise<void>;
  aggregated?: Array<{
    slug: string;
    name: string;
    emoji: string | null;
    totalIntensity: number;
    reactionCount: number;
  }>;
  showCounts?: boolean; // Hidden by default per master plan
}

export const PostVibeReactions: React.FC<PostVibeReactionsProps> = ({
  vectors,
  postId,
  node,
  existingReaction = null,
  onReact,
  aggregated = [],
  showCounts = false, // Default: don't show counts (reduces bias)
}) => {
  const [expanded, setExpanded] = React.useState(false);

  // Filter aggregated to only show vectors with reactions
  const activeVectors = aggregated.filter((a) => a.reactionCount > 0);

  return (
    <View style={styles.container}>
      {/* Main Reaction Button */}
      <ReactionButton
        vectors={vectors}
        onReact={onReact}
        existingReaction={existingReaction}
      />

      {/* Subtle indicator if post has reactions (optional, minimal) */}
      {!showCounts && activeVectors.length > 0 && (
        <View style={styles.indicators}>
          {activeVectors.slice(0, 3).map((ag) => (
            <Text key={ag.slug} style={styles.indicator}>
              {ag.emoji || '•'}
            </Text>
          ))}
        </View>
      )}

      {/* Expandable counts (on hover or click, per master plan) */}
      {showCounts && activeVectors.length > 0 && (
        <TouchableOpacity
          style={styles.countsContainer}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          {expanded ? (
            <View style={styles.expandedCounts}>
              {activeVectors.map((ag) => (
                <View key={ag.slug} style={styles.countItem}>
                  <Text style={styles.countEmoji}>{ag.emoji || '•'}</Text>
                  <Text style={styles.countText}>{ag.reactionCount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.countsSummary}>
              {activeVectors.length} reaction{activeVectors.length !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6, // Subtle
  },
  indicator: {
    fontSize: 12,
  },
  countsContainer: {
    marginLeft: 8,
  },
  expandedCounts: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countEmoji: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  countsSummary: {
    fontSize: 12,
    color: '#64748B',
  },
});

