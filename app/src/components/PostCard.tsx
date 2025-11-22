import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Post, getVibeVectors, createPostReaction, type VibeVector, type VibeIntensities } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { PostVibeReactions } from "../web/components/VibeVectors/PostVibeReactions";

// Helper to format relative time (e.g., "2h ago")
const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
};

type PostCardProps = {
  post: Post;
  onPress?: (post: Post) => void;
};

export const PostCard = ({ post, onPress }: PostCardProps) => {
  const { user } = useAuthStore();
  const [vectors, setVectors] = useState<VibeVector[]>([]);
  const [loadingVectors, setLoadingVectors] = useState(true);
  const [userReaction, setUserReaction] = useState<VibeIntensities | null>(null);

  // Load Vibe Vectors for reactions (mobile + web)
  useEffect(() => {
    getVibeVectors()
      .then((data) => {
        setVectors(data.vectors);
        setLoadingVectors(false);
      })
      .catch((error) => {
        console.error('Failed to load Vibe Vectors:', error);
        setLoadingVectors(false);
      });
  }, []);

  const handleReact = async (intensities: VibeIntensities) => {
    if (!user) return;
    
    // Use node ID from post, or 'global' if no node
    const nodeId = post.nodeId || 'global';

    try {
      await createPostReaction(post.id, {
        nodeId,
        intensities,
      });
      setUserReaction(intensities);
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => onPress?.(post)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <Text style={styles.author}>{post.author.email.split("@")[0]}</Text>
        <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
      </View>
      
      <Text style={styles.content} numberOfLines={5}>
        {post.content}
      </Text>
      
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {/* Vibe Vector Reaction Button - Same on mobile and web */}
          {!loadingVectors && vectors.length > 0 && (
            <PostVibeReactions
              vectors={vectors}
              postId={post.id}
              node={post.node || { id: post.nodeId || 'global', slug: 'global', name: 'Global' }}
              existingReaction={userReaction}
              onReact={handleReact}
              showCounts={false}
            />
          )}
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.stats}>
            💬 {post.commentCount} comments
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  author: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1E293B",
  },
  time: {
    fontSize: 12,
    color: "#64748B",
  },
  content: {
    fontSize: 16,
    color: "#334155",
    lineHeight: 24,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  stats: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
});

