import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { MessageSquare, BarChart2, Hexagon, Zap } from "lucide-react-native";
import { Post, votePoll } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { COLORS, ERAS, SPACING, RADIUS } from "../constants/theme";
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

    const hasVoted = (post.poll?.votes?.length ?? 0) > 0;
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

  // Get era styling
  const authorEra = post.author.era || 'Default';
  const eraStyle = ERAS[authorEra] || ERAS['Default'];

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(post)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.authorSection} onPress={() => onAuthorClick?.(post.author.id)}>
          {/* Avatar with purple border */}
          <View style={[styles.avatarContainer, { borderColor: COLORS.node.accent }]}>
            {post.author.avatar ? (
              <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: eraStyle.bg }]}>
                <Text style={[styles.avatarText, { color: eraStyle.text }]}>
                  {(post.author.username || post.author.email)?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Author info */}
          <View style={styles.authorInfo}>
            <View style={styles.authorRow}>
              <Text style={styles.author}>@{post.author.username || post.author.email.split("@")[0]}</Text>
              {/* Cred badge */}
              {post.author.cred !== undefined && post.author.cred > 0 && (
                <View style={styles.credBadge}>
                  <Zap size={10} color="#fbbf24" />
                  <Text style={styles.credText}>{post.author.cred}</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              {/* Era badge */}
              <View style={[styles.eraBadge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border }]}>
                <Hexagon size={8} color={eraStyle.text} fill={eraStyle.text} />
                <Text style={[styles.eraText, { color: eraStyle.text }]}>{authorEra.replace(' Era', '')}</Text>
              </View>
              {post.node && (
                <Text style={styles.nodeName}>n/{post.node.slug}</Text>
              )}
            </View>
          </View>
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
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: SPACING.sm,
    width: 44,
    height: 44,
    borderRadius: RADIUS.md + 2,
    borderWidth: 2,
    padding: 1,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  authorInfo: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  author: {
    fontWeight: "600",
    fontSize: 14,
    color: COLORS.node.text,
  },
  credBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  credText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
  },
  eraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  eraText: {
    fontSize: 10,
    fontWeight: '600',
  },
  nodeName: {
    fontSize: 12,
    color: COLORS.node.accent,
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

