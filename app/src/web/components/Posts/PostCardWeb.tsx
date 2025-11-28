// Phase 6.1 - Reddit-style Post Card (Web)
// Web-specific post card with Vibe Vector reactions

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../../store/auth';
import {
  getNode,
  type Post,
  type Node,
} from '../../../lib/api';

interface PostCardWebProps {
  post: Post;
  node?: Node | null; // Optional: if not provided, will fetch from post.nodeId
  onPress?: (post: Post) => void;
}

export const PostCardWeb: React.FC<PostCardWebProps> = ({ post, node: nodeProp, onPress }) => {
  const { user } = useAuthStore();
  const [node, setNode] = useState<Node | null>(nodeProp || null);

  // Load node if post has nodeId but node prop not provided
  useEffect(() => {
    if (nodeProp) {
      setNode(nodeProp);
      return;
    }

    // Use node from post if available, or fetch if we only have nodeId
    if (post.node) {
      setNode(post.node);
    } else if (post.nodeId) {
      getNode(post.nodeId)
        .then((nodeData) => {
          setNode(nodeData);
        })
        .catch((error) => {
          console.error('Failed to load node:', error);
        });
    } else {
      setNode(null);
    }
  }, [post, nodeProp]);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(post)}
      activeOpacity={onPress ? 0.95 : 1}
    >
      {/* Post Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.author}>{post.author.email.split('@')[0]}</Text>
          {node && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.nodeName}>n/{node.slug}</Text>
            </>
          )}
          <Text style={styles.separator}>•</Text>
          <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Post Content */}
      {post.title && <Text style={styles.title}>{post.title}</Text>}
      {post.content && (
        <Text style={styles.content} numberOfLines={5}>
          {post.content}
        </Text>
      )}

      {/* Post Footer with Reactions */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {/* Reaction logic removed as PostVibeReactions is deleted */}
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.commentCount}>💬 {post.commentCount || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#181a20',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d35',
    cursor: 'pointer',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    fontWeight: '600',
    fontSize: 14,
    color: '#e2e8f0',
  },
  separator: {
    fontSize: 12,
    color: '#94a3b8',
  },
  nodeName: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentCount: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  // Development: Intensity display
  intensityDisplay: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2d35',
    gap: 6,
  },
  intensityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intensityEmoji: {
    fontSize: 16,
    width: 24,
  },
  intensityBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#0f1115',
    borderRadius: 4,
    overflow: 'hidden',
  },
  intensityBar: {
    height: '100%',
    borderRadius: 4,
  },
  intensityText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});

