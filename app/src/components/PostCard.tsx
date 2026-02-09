import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { MessageSquare, BarChart2, Hexagon, Zap, ExternalLink } from "lucide-react-native";
import { Post, votePoll } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { ERAS, SPACING, RADIUS } from "../constants/theme";
import { useAppTheme } from "../hooks/useTheme";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { formatTimeAgo } from '../lib/formatTime';

type PostCardProps = {
  post: Post;
  onPress?: (post: Post) => void;
  onAuthorClick?: (authorId: string) => void;
};

const PostCardInner = ({ post: initialPost, onPress, onAuthorClick }: PostCardProps) => {
  const theme = useAppTheme();
  const { user } = useAuthStore();

  // Memoize themed style overrides — stable identity unless theme changes
  const ts = useMemo(() => StyleSheet.create({
    container: { backgroundColor: theme.panel, borderBottomColor: theme.border },
    avatarBorder: { borderColor: theme.accent },
    textColor: { color: theme.text },
    mutedColor: { color: theme.muted },
    accentColor: { color: theme.accent },
    pollOption: { borderColor: theme.border, backgroundColor: theme.bg },
    pollOptionVoted: { borderColor: 'transparent', backgroundColor: theme.bg },
    pollOptionSelected: { borderColor: theme.accent },
    optionSelected: { color: theme.accent, fontWeight: 'bold' as const },
  }), [theme]);
  const [post, setPost] = useState(initialPost);
  const [voting, setVoting] = useState(false);

  // Track voting state and any pending prop updates that arrived during voting
  const votingRef = useRef(false);
  const pendingUpdateRef = useRef<typeof initialPost | null>(null);

  useEffect(() => {
    // Skip sync while voting to preserve optimistic update during API call
    // Store the update so we can apply it after voting completes
    if (votingRef.current) {
      pendingUpdateRef.current = initialPost;
      return;
    }
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
    votingRef.current = true; // Block prop syncs during vote
    pendingUpdateRef.current = null; // Clear any stale pending update

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
      votingRef.current = false; // Re-enable prop syncs
      // Apply any parent updates that arrived during voting
      if (pendingUpdateRef.current) {
        setPost(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }
  };

  const totalVotes = useMemo(
    () => post.poll?.options.reduce((acc, opt) => acc + (opt._count?.votes || 0), 0) || 0,
    [post.poll?.options]
  );
  const hasVoted = post.poll?.votes && post.poll.votes.length > 0;

  // Get era styling
  const authorEra = post.author.era || 'Default';
  const eraStyle = ERAS[authorEra] || ERAS['Default'];

  const handlePress = useCallback(() => {
    onPress?.(post);
  }, [onPress, post]);

  const handleAuthorPress = useCallback(() => {
    onAuthorClick?.(post.author.id);
  }, [onAuthorClick, post.author.id]);

  return (
    <TouchableOpacity
      style={[styles.container, ts.container]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.authorSection} onPress={handleAuthorPress}>
          {/* Avatar with purple border */}
          <View style={[styles.avatarContainer, ts.avatarBorder]}>
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
              <Text style={[styles.author, ts.textColor]}>@{post.author.username || 'User'}</Text>
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
                <Text style={[styles.nodeName, ts.accentColor]}>n/{post.node.slug}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <Text style={[styles.time, ts.mutedColor]}>{formatTimeAgo(post.createdAt)}</Text>
      </View>

      {post.title && (
        <Text style={[styles.title, ts.textColor]}>{post.title}</Text>
      )}

      {post.content && (
        <Text style={styles.content} numberOfLines={post.content.length > 6000 ? 20 : undefined}>
          {post.content}
        </Text>
      )}

      {post.poll && (
        <View style={styles.pollContainer}>
          {post.poll.question && post.poll.question !== post.title && (
            <Text style={[styles.pollQuestion, ts.textColor]}>{post.poll.question}</Text>
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
                  ts.pollOption,
                  hasVoted && ts.pollOptionVoted,
                  isSelected && ts.pollOptionSelected,
                ]}
                onPress={() => handleVote(option.id)}
                disabled={hasVoted || voting || !option.id}
              >
                {hasVoted && (
                  <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                )}
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionText,
                    ts.textColor,
                    isSelected && ts.optionSelected,
                  ]}>
                    {option.text}
                  </Text>
                  {hasVoted && (
                    <Text style={[styles.percentageText, ts.mutedColor]}>{percentage}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.totalVotes, ts.mutedColor]}>{totalVotes} votes</Text>
        </View>
      )}

      {post.linkMeta ? (
        <View style={styles.linkPreview}>
          <LinkPreviewCard metadata={post.linkMeta} onPress={() => onPress?.(post)} />
        </View>
      ) : post.linkUrl ? (
        <TouchableOpacity
          style={[styles.linkFallback, { borderColor: theme.border, backgroundColor: theme.bg }]}
          onPress={() => {
            const Linking = require('react-native').Linking;
            Linking.openURL(post.linkUrl);
          }}
        >
          <ExternalLink size={14} color={theme.muted} />
          <Text style={[styles.linkText, ts.accentColor]} numberOfLines={1}>
            {new URL(post.linkUrl).hostname}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.stats}>
          <MessageSquare size={20} color={theme.muted} />
          <Text style={[styles.statText, ts.mutedColor]}>{post.commentCount}</Text>
        </View>
        {post.poll && (
          <View style={styles.stats}>
            <BarChart2 size={20} color={theme.muted} />
            <Text style={[styles.statText, ts.mutedColor]}>Poll</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 1,
    borderBottomWidth: 1,
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
  },
  time: {
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: '#e2e8f0', // Brighter than muted, good contrast on dark bg
  },
  pollContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
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
    fontWeight: '500',
  },
  percentageText: {
    fontSize: 12,
  },
  totalVotes: {
    fontSize: 12,
    marginTop: 4,
  },
  linkPreview: {
    marginBottom: 12,
  },
  linkFallback: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
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
    fontSize: 14,
  },
  linkText: {
    fontSize: 13,
  },
});

export const PostCard = memo(PostCardInner, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.post.commentCount === next.post.commentCount &&
    prev.post.poll?.votes?.length === next.post.poll?.votes?.length
  );
});
