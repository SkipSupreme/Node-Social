import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { MessageSquare, BarChart2 } from "lucide-react-native";
import { Post, votePoll } from "../lib/api";
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
  onAuthorClick?: (authorId: string) => void;
};

export const PostCard = ({ post: initialPost, onPress, onAuthorClick }: PostCardProps) => {
  const { user } = useAuthStore();
  const [post, setPost] = useState(initialPost);
  const [voting, setVoting] = useState(false);

  // Sync local state when initialPost prop changes (e.g., from socket updates or refetch)
  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  const handleVote = async (optionId: string) => {
    if (voting || !post.poll) return;

    const hasVoted = post.poll.votes && post.poll.votes.length > 0;
    if (hasVoted) return; // Already voted

    // Save current state for revert (deep copy to avoid mutation)
    const previousPost = {
      ...post,
      poll: post.poll ? {
        ...post.poll,
        options: post.poll.options.map(opt => ({
          ...opt,
          _count: opt._count ? { ...opt._count } : undefined
        })),
        votes: [...(post.poll.votes || [])]
      } : undefined
    };

    setVoting(true);

    // Optimistic update with deep copy
    const newPoll = {
      ...post.poll,
      votes: [{ optionId }],
      options: post.poll.options.map(opt => {
        if (opt.id === optionId) {
          return {
            ...opt,
            _count: { votes: (opt._count?.votes || 0) + 1 }
          };
        }
        return { ...opt, _count: opt._count ? { ...opt._count } : undefined };
      })
    };

    setPost({ ...post, poll: newPoll });

    try {
      await votePoll(post.id, optionId);
    } catch (error) {
      console.error('Failed to vote:', error);
      // Revert to previous state (not initialPost which could be stale)
      setPost(previousPost);
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = post.poll?.options.reduce((acc, opt) => acc + (opt._count?.votes || 0), 0) || 0;
  const hasVoted = post.poll?.votes && post.poll.votes.length > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(post)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onAuthorClick?.(post.author.id)}>
          <Text style={styles.author}>@{post.author.username || post.author.email.split("@")[0]}</Text>
          {post.node && (
            <Text style={styles.nodeName}>n/{post.node.slug}</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
      </View>

      {post.title && (
        <Text style={styles.title}>{post.title}</Text>
      )}

      {post.content && (
        <Text style={styles.content} numberOfLines={5}>
          {post.content}
        </Text>
      )}

      {post.poll && (
        <View style={styles.pollContainer}>
          {post.poll.question && post.poll.question !== post.title && (
            <Text style={styles.pollQuestion}>{post.poll.question}</Text>
          )}

          {post.poll.options.map(option => {
            const votes = option._count?.votes || 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isSelected = post.poll?.votes?.[0]?.optionId === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.pollOption,
                  hasVoted && styles.pollOptionResult,
                  isSelected && styles.pollOptionSelected
                ]}
                onPress={() => !hasVoted && handleVote(option.id)}
                disabled={hasVoted || voting}
              >
                {hasVoted && (
                  <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                )}
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected
                  ]}>
                    {option.text}
                  </Text>
                  {hasVoted && (
                    <Text style={styles.percentageText}>{percentage}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.totalVotes}>{totalVotes} votes</Text>
        </View>
      )}

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
        {post.poll && (
          <View style={styles.stats}>
            <BarChart2 size={20} color={COLORS.node.muted} />
            <Text style={styles.statText}>Poll</Text>
          </View>
        )}
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.node.text,
    marginBottom: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: COLORS.node.text,
  },
  pollContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.node.text,
    marginBottom: 12,
  },
  pollOption: {
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderRadius: 8,
    marginBottom: 8,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.node.bg,
  },
  pollOptionResult: {
    borderColor: 'transparent',
    backgroundColor: COLORS.node.bg,
  },
  pollOptionSelected: {
    borderColor: COLORS.node.accent,
  },
  progressBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // Accent color with opacity
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  optionText: {
    color: COLORS.node.text,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: COLORS.node.accent,
    fontWeight: 'bold',
  },
  percentageText: {
    color: COLORS.node.muted,
    fontSize: 12,
  },
  totalVotes: {
    color: COLORS.node.muted,
    fontSize: 12,
    marginTop: 4,
  },
  linkPreview: {
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    paddingTop: 12,
    gap: 16,
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

