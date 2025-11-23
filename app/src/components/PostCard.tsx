import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MessageSquare } from "lucide-react-native";
import { Post } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { COLORS } from "../constants/theme";
import { LinkPreviewCard } from "./LinkPreviewCard";

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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(post)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.author}>{post.author.email.split("@")[0]}</Text>
          {post.node && (
            <Text style={styles.nodeName}>n/{post.node.slug}</Text>
          )}
        </View>
        <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
      </View>

      <Text style={styles.content} numberOfLines={5}>
        {post.content}
      </Text>

      {post.linkMeta && (
        <View style={styles.linkPreview}>
          <LinkPreviewCard metadata={post.linkMeta} onPress={() => onPress?.(post)} />
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.stats}>
          <MessageSquare size={20} color={COLORS.node.muted} />
          <Text style={styles.statText}>{post.commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.node.panel,
    padding: 16,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  author: {
    fontWeight: "600",
    fontSize: 14,
    color: COLORS.node.text,
  },
  nodeName: {
    fontSize: 12,
    color: COLORS.node.accent,
    marginTop: 2,
  },
  time: {
    color: COLORS.node.muted,
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: COLORS.node.text,
  },
  linkPreview: {
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    paddingTop: 12,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: COLORS.node.muted,
    fontSize: 14,
  },
});

