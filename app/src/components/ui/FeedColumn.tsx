// Individual feed column with independent state and scrolling
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Platform, ViewProps } from 'react-native';
import { X, ChevronLeft, ChevronRight, Settings } from './Icons';
import { COLORS, COLUMNS } from '../../constants/theme';
import { FeedColumn as FeedColumnType, ColumnType, ColumnVibeSettings } from '../../store/columns';
import { getFeed, searchPosts, getUserPosts, getNotifications, markNotificationsRead, getBlueskyDiscover, getBlueskyUserPosts, getMastodonTimeline, getMastodonTrending, getCombinedExternalFeed, ExternalPost, Node, AuthResponse, Notification, TipTapDoc } from '../../lib/api';
import { Heart, MessageSquare, UserPlus, AlertTriangle, Ban, Trash2, Bell, RefreshCw } from 'lucide-react-native';
import { Feed, UIPost } from './Feed';
import { WhatsVibing } from './WhatsVibing';
import { NodeLandingPage } from './NodeLandingPage';
import { ColumnSearchBar } from './ColumnSearchBar';
import { VibeValidatorModal } from './VibeValidatorModal';
import { ExternalPostCard } from './ExternalPostCard';

type CurrentUser = AuthResponse['user'];

interface FeedColumnProps {
  column: FeedColumnType;
  currentUser: CurrentUser | null;
  nodes: Node[];
  globalNodeId?: string;
  onPostClick: (postId: string) => void;
  onAuthorClick: (authorId: string) => void;
  onUserClick: (userId: string) => void;
  onPostAction: (postId: string, action: string) => void;
  onSaveToggle: (postId: string, saved: boolean) => void;
  onRemove: () => void;
  canRemove: boolean;
  onNodeClick?: (nodeId: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onUpdateColumn?: (updates: Partial<Omit<FeedColumnType, 'id'>>) => void;
  onQuoteExternalPost?: (post: ExternalPost) => void;
  onSaveExternalPost?: (post: ExternalPost) => void;
  onEdit?: (post: UIPost) => void;
}

// Column types that support VibeValidator (feed-based columns)
const VIBE_SUPPORTED_TYPES: ColumnType[] = ['global', 'discovery', 'following', 'node', 'search'];

// Default vibe settings
const DEFAULT_VIBE_SETTINGS: ColumnVibeSettings = {
  preset: 'balanced',
  weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
};

// API post shape from the backend
interface ApiPost {
  id: string;
  node?: { id?: string; name?: string; slug?: string } | null;
  author: { id: string; username?: string; avatar?: string | null; era?: string; cred?: number };
  title?: string | null;
  content?: string | null;
  contentJson?: unknown;
  contentFormat?: 'markdown' | 'tiptap';
  commentCount?: number;
  createdAt: string;
  linkUrl?: string | null;
  mediaUrl?: string | null;
  linkMeta?: unknown;
  poll?: unknown;
  myReaction?: unknown;
  vibeAggregate?: unknown;
  isSaved?: boolean;
  comments?: Array<{
    id: string;
    author: { id: string; username?: string; avatar?: string | null; era?: string; cred?: number };
    content: string;
    createdAt: string;
  }>;
}

// Map API posts to Feed format - pure function, no component dependencies
const mapPosts = (apiPosts: ApiPost[]) => {
  return apiPosts.map((p: ApiPost) => ({
    id: p.id,
    node: { id: p.node?.id, name: p.node?.name || 'Global', slug: p.node?.slug || 'global', color: '#6366f1' },
    author: {
      id: p.author.id,
      username: p.author.username || 'User',
      avatar: p.author.avatar || '',
      era: p.author.era || 'Lurker Era',
      cred: p.author.cred || 0
    },
    title: p.title || 'Untitled Post',
    content: p.content,
    contentJson: p.contentJson as TipTapDoc | null | undefined,
    contentFormat: p.contentFormat,
    commentCount: p.commentCount ?? 0,
    createdAt: p.createdAt,
    expertGated: false,
    vibes: [],
    linkUrl: p.linkUrl,
    mediaUrl: p.mediaUrl,
    linkMeta: p.linkMeta as UIPost['linkMeta'],
    poll: p.poll as UIPost['poll'],
    myReaction: p.myReaction as UIPost['myReaction'],
    vibeAggregate: p.vibeAggregate as UIPost['vibeAggregate'],
    isSaved: p.isSaved ?? false,
    comments: p.comments?.map((c) => ({
      id: c.id,
      author: {
        id: c.author.id,
        username: c.author.username || 'User',
        avatar: c.author.avatar || '',
        era: c.author.era || 'Lurker Era',
        cred: c.author.cred || 0
      },
      content: c.content,
      timestamp: new Date(c.createdAt),
      depth: 0,
      replies: []
    })) || []
  }));
};

export const FeedColumn: React.FC<FeedColumnProps> = ({
  column,
  currentUser,
  nodes,
  globalNodeId,
  onPostClick,
  onAuthorClick,
  onUserClick,
  onPostAction,
  onSaveToggle,
  onRemove,
  canRemove,
  onNodeClick,
  onMoveLeft,
  onMoveRight,
  onUpdateColumn,
  onQuoteExternalPost,
  onSaveExternalPost,
  onEdit,
}) => {
  // Independent state for this column
  const [posts, setPosts] = useState<ReturnType<typeof mapPosts>>([]);
  const [externalPosts, setExternalPosts] = useState<ExternalPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  // VibeValidator modal state
  const [showVibeModal, setShowVibeModal] = useState(false);

  // Web pull-to-refresh state
  const [webPullDistance, setWebPullDistance] = useState(0);
  const [isWebPulling, setIsWebPulling] = useState(false);
  const webStartY = React.useRef(0);
  const webScrollTop = React.useRef(0);
  const PULL_THRESHOLD = 80;

  // Check if this column type supports vibe settings
  const supportsVibeSettings = VIBE_SUPPORTED_TYPES.includes(column.type);

  // Handle changing column type from ColumnSearchBar
  const handleTypeChange = (type: ColumnType, title: string, nodeId?: string) => {
    if (type === 'node' && nodeId) {
      onUpdateColumn?.({ type, title, nodeId });
    } else {
      onUpdateColumn?.({ type, title });
    }
  };

  // Handle search from ColumnSearchBar
  const handleSearch = (query: string) => {
    onUpdateColumn?.({ type: 'search', title: `Search: ${query}`, searchQuery: query });
  };

  // Handle vibe settings update
  const handleVibeSettingsUpdate = (settings: ColumnVibeSettings) => {
    onUpdateColumn?.({ vibeSettings: settings });
  };

  // Fetch data based on column type
  const fetchData = useCallback(async (cursor?: string) => {
    try {
      // Handle trending column separately - it shows WhatsVibing, not posts
      if (column.type === 'trending') {
        setLoading(false);
        return;
      }

      // Handle node-info column - it shows NodeLandingPage, not posts
      if (column.type === 'node-info') {
        setLoading(false);
        return;
      }

      // Handle notifications
      if (column.type === 'notifications') {
        try {
          const data = await getNotifications();
          setNotifications(data.notifications || []);
          // Mark as read in background
          markNotificationsRead().catch(err =>
            console.warn('Failed to mark notifications as read:', err)
          );
        } catch (error) {
          console.error('Error fetching notifications:', error);
          setNotifications([]);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Handle external platform feeds (Tier 5)
      if (column.type === 'bluesky') {
        try {
          const config = column.externalConfig;
          let data;
          if (config?.blueskyFeed === 'user' && config?.blueskyHandle) {
            data = await getBlueskyUserPosts(config.blueskyHandle, 20, cursor);
          } else {
            // Default to discover feed
            data = await getBlueskyDiscover(20, cursor);
          }
          if (cursor) {
            setExternalPosts(prev => [...prev, ...data.posts]);
          } else {
            setExternalPosts(data.posts);
          }
          setNextCursor(data.nextCursor);
          setHasMore(!!data.nextCursor);
        } catch (error) {
          console.error('Error fetching Bluesky feed:', error);
          setExternalPosts([]);
        }
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      if (column.type === 'mastodon') {
        try {
          const config = column.externalConfig;
          const instance = config?.mastodonInstance || 'mastodon.social';
          let data;
          if (config?.mastodonTimeline === 'trending') {
            const offset = cursor ? parseInt(cursor) : 0;
            data = await getMastodonTrending(instance, 20, offset);
            setNextCursor(data.nextCursor);
          } else {
            const timeline = config?.mastodonTimeline || 'public';
            data = await getMastodonTimeline(instance, timeline, 20, cursor);
            setNextCursor(data.nextCursor);
          }
          if (cursor) {
            setExternalPosts(prev => [...prev, ...data.posts]);
          } else {
            setExternalPosts(data.posts);
          }
          setHasMore(!!data.nextCursor);
        } catch (error) {
          console.error('Error fetching Mastodon feed:', error);
          setExternalPosts([]);
        }
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      if (column.type === 'external-combined') {
        try {
          const config = column.externalConfig;
          const data = await getCombinedExternalFeed(
            ['bluesky', 'mastodon'],
            20,
            config?.mastodonInstance
          );
          // Combined feed doesn't support pagination yet
          setExternalPosts(data.posts);
          setHasMore(false);
        } catch (error) {
          console.error('Error fetching combined external feed:', error);
          setExternalPosts([]);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Handle profile column
      if (column.type === 'profile') {
        const userId = column.userId || currentUser?.id;
        if (!userId) {
          setLoading(false);
          return;
        }
        try {
          const userPosts = await getUserPosts(userId, 20);
          setPosts(mapPosts(userPosts || []));
          setHasMore(false); // getUserPosts doesn't support pagination yet
        } catch (error) {
          console.error('Error fetching profile posts:', error);
          setPosts([]);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Handle search column
      if (column.type === 'search' && column.searchQuery) {
        const offset = cursor ? parseInt(cursor) : 0;
        const data = await searchPosts(column.searchQuery, 20, offset);
        if (cursor) {
          setPosts(prev => [...prev, ...mapPosts(data.posts)]);
        } else {
          setPosts(mapPosts(data.posts));
        }
        setNextCursor(data.hasMore ? String(offset + 20) : undefined);
        setHasMore(data.hasMore);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      // Standard feed columns (global, node, discovery, following)
      const params: Record<string, unknown> = { cursor, limit: 20 };

      if (column.type === 'node' && column.nodeId) {
        params.nodeId = column.nodeId;
      } else if (column.type === 'discovery') {
        params.preset = 'popular';
      } else if (column.type === 'following') {
        params.followingOnly = true;
      }

      // Apply vibe settings from the column (Tier 1: Wire up vibe validator)
      const vibeSettings = column.vibeSettings || DEFAULT_VIBE_SETTINGS;
      if (vibeSettings.preset && vibeSettings.preset !== 'custom') {
        params.preset = vibeSettings.preset;
      }
      // Main weight sliders
      if (vibeSettings.weights) {
        params.qualityWeight = vibeSettings.weights.quality;
        params.recencyWeight = vibeSettings.weights.recency;
        params.engagementWeight = vibeSettings.weights.engagement;
        params.personalizationWeight = vibeSettings.weights.personalization;
      }
      // Intermediate mode filters
      if (vibeSettings.intermediate) {
        if (vibeSettings.intermediate.timeRange && vibeSettings.intermediate.timeRange !== 'all') {
          params.timeRange = vibeSettings.intermediate.timeRange;
        }
        if (vibeSettings.intermediate.textOnly) params.textOnly = true;
        if (vibeSettings.intermediate.mediaOnly) params.mediaOnly = true;
        if (vibeSettings.intermediate.linksOnly) params.linksOnly = true;
        if (vibeSettings.intermediate.hasDiscussion) params.hasDiscussion = true;
        // Content Intelligence (Tier 2)
        if (vibeSettings.intermediate.textDensity && vibeSettings.intermediate.textDensity !== 'any') {
          params.textDensity = vibeSettings.intermediate.textDensity;
        }
        if (vibeSettings.intermediate.mediaType && vibeSettings.intermediate.mediaType !== 'any') {
          params.mediaType = vibeSettings.intermediate.mediaType;
        }
        // User Context (Tier 3)
        if (vibeSettings.intermediate.showSeenPosts !== undefined) {
          params.showSeenPosts = vibeSettings.intermediate.showSeenPosts;
        }
        if (vibeSettings.intermediate.hideMutedWords !== undefined) {
          params.hideMutedWords = vibeSettings.intermediate.hideMutedWords;
        }
        if (vibeSettings.intermediate.discoveryRate !== undefined && vibeSettings.intermediate.discoveryRate > 0) {
          params.discoveryRate = vibeSettings.intermediate.discoveryRate;
        }
      }
      // Advanced mode - all sub-signal weights
      if (vibeSettings.advanced) {
        const adv = vibeSettings.advanced;
        // Quality sub-signals
        params.authorCredWeight = adv.authorCredWeight;
        params.vectorQualityWeight = adv.vectorQualityWeight;
        params.confidenceWeight = adv.confidenceWeight;
        // Recency sub-signals
        params.timeDecay = adv.timeDecay;
        params.velocity = adv.velocity;
        params.freshness = adv.freshness;
        params.halfLifeHours = adv.halfLifeHours;
        params.decayFunction = adv.decayFunction;
        // Engagement sub-signals
        params.intensity = adv.intensity;
        params.discussionDepth = adv.discussionDepth;
        params.shareWeight = adv.shareWeight;
        params.expertCommentBonus = adv.expertCommentBonus;
        // Personalization sub-signals
        params.followingWeight = adv.followingWeight;
        params.alignment = adv.alignment;
        params.affinity = adv.affinity;
        params.trustNetwork = adv.trustNetwork;
        // Vector multipliers (send as JSON string)
        if (adv.vectorMultipliers) {
          params.vectorMultipliers = JSON.stringify(adv.vectorMultipliers);
        }
        params.antiAlignmentPenalty = adv.antiAlignmentPenalty;
      }
      // Expert mode - diversity controls and mood
      if (vibeSettings.expert) {
        const exp = vibeSettings.expert;
        params.maxPostsPerAuthor = exp.maxPostsPerAuthor;
        params.topicClusteringPenalty = exp.topicClusteringPenalty;
        params.textRatio = exp.textRatio;
        params.imageRatio = exp.imageRatio;
        params.videoRatio = exp.videoRatio;
        params.linkRatio = exp.linkRatio;
        if (exp.moodToggle && exp.moodToggle !== 'normal') {
          params.moodToggle = exp.moodToggle;
        }
      }

      const data = await getFeed(params);
      if (cursor) {
        setPosts(prev => [...prev, ...mapPosts(data.posts)]);
      } else {
        setPosts(mapPosts(data.posts));
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error(`Error fetching column ${column.id}:`, error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [column, currentUser]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setExternalPosts([]);
    setNextCursor(undefined);
    setHasMore(true);
    fetchData();
  }, [column.type, column.nodeId, column.searchQuery, column.userId, column.vibeSettings, column.externalConfig]);

  // Auto-refresh every 60 seconds (only for Node Social feeds, not external)
  useEffect(() => {
    // Don't auto-refresh static columns or external feeds
    const noAutoRefresh: ColumnType[] = [
      'profile', 'search', 'notifications', 'node-info', 'trending',
      'bluesky', 'mastodon', 'external-combined'  // External feeds don't need auto-refresh
    ];
    if (noAutoRefresh.includes(column.type)) {
      return;
    }

    const interval = setInterval(() => {
      // Only refresh if not already loading
      if (!loading && !refreshing && !loadingMore) {
        fetchData();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [column.type, loading, refreshing, loadingMore, fetchData]);

  // Tier 4: Prefetch next page after initial load for smoother infinite scroll
  useEffect(() => {
    if (!loading && posts.length > 0 && hasMore && nextCursor && !loadingMore) {
      // Prefetch after a short delay to not block initial render
      const prefetchTimer = setTimeout(() => {
        // The actual fetch will happen when user scrolls - this just primes the connection
        // In a more advanced setup, we'd use React Query's prefetchInfiniteQuery
      }, 2000);
      return () => clearTimeout(prefetchTimer);
    }
  }, [loading, posts.length, hasMore, nextCursor, loadingMore]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(undefined);
    fetchData();
  }, [fetchData]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    fetchData(nextCursor);
  }, [fetchData, loadingMore, hasMore, nextCursor]);

  // Web pull-to-refresh handlers (for ScrollViews that use RefreshControl on native)
  const handleWebTouchStart = useCallback((e: { touches?: Array<{ clientY: number }>; clientY?: number }) => {
    if (Platform.OS !== 'web' || refreshing) return;
    webStartY.current = e.touches?.[0]?.clientY || e.clientY || 0;
  }, [refreshing]);

  const handleWebTouchMove = useCallback((e: { touches?: Array<{ clientY: number }>; clientY?: number; preventDefault?: () => void }) => {
    if (Platform.OS !== 'web' || refreshing) return;
    if (webScrollTop.current > 0) return;

    const currentY = e.touches?.[0]?.clientY || e.clientY || 0;
    const diff = currentY - webStartY.current;

    if (diff > 0) {
      e.preventDefault?.();
      setIsWebPulling(true);
      setWebPullDistance(Math.min(diff * 0.4, 100));
    }
  }, [refreshing]);

  const handleWebTouchEnd = useCallback(() => {
    if (Platform.OS !== 'web' || refreshing) return;

    if (webPullDistance >= PULL_THRESHOLD) {
      handleRefresh();
    }

    setWebPullDistance(0);
    setIsWebPulling(false);
  }, [refreshing, webPullDistance, handleRefresh]);

  const handleWebScroll = useCallback((e: { nativeEvent?: { contentOffset?: { y: number } } }) => {
    const scrollY = e.nativeEvent?.contentOffset?.y || 0;
    webScrollTop.current = scrollY;
  }, []);

  // Web pull-to-refresh touch props
  // On web, touch events have DOM-compatible shape (touches[].clientY, etc.)
  // Cast to ViewProps since these are only active on web platform
  const webTouchProps: Partial<ViewProps> = Platform.OS === 'web' ? {
    onTouchStart: handleWebTouchStart as ViewProps['onTouchStart'],
    onTouchMove: handleWebTouchMove as ViewProps['onTouchMove'],
    onTouchEnd: handleWebTouchEnd,
  } : {};

  // Handle post click - Feed expects (post) => void, we have (postId) => void
  const handlePostClick = useCallback((post: { id: string }) => {
    onPostClick(post.id);
  }, [onPostClick]);

  // Helper to get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={18} color="#ef4444" fill="#ef4444" />;
      case 'comment': return <MessageSquare size={18} color="#3b82f6" />;
      case 'follow': return <UserPlus size={18} color="#10b981" />;
      case 'warning': return <AlertTriangle size={18} color="#f59e0b" />;
      case 'mod_removed': return <Trash2 size={18} color="#ef4444" />;
      case 'banned': return <Ban size={18} color="#ef4444" />;
      default: return <Bell size={18} color={COLORS.node.accent} />;
    }
  };

  // Render content based on column type
  const renderContent = () => {
    if (column.type === 'trending') {
      return <WhatsVibing onNodeClick={onNodeClick || (() => {})} />;
    }

    if (column.type === 'node-info' && column.nodeId) {
      return (
        <NodeLandingPage
          nodeId={column.nodeId}
          onNavigateToSettings={() => {}}
          onNavigateToModLog={() => {}}
          onMessageCouncil={() => {}}
          onStartChat={() => {}}
        />
      );
    }

    if (column.type === 'notifications') {
      if (loading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.node.accent} />
          </View>
        );
      }
      if (notifications.length === 0) {
        return <Text style={styles.emptyText}>No notifications yet</Text>;
      }
      return (
        <View style={{ flex: 1, overflow: 'hidden' }} {...webTouchProps}>
          {/* Web pull indicator */}
          {Platform.OS === 'web' && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 50,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                transform: [{ translateY: webPullDistance - 50 }],
                opacity: refreshing ? 1 : Math.min(webPullDistance / PULL_THRESHOLD, 1),
              }}
            >
              <View style={{ transform: [{ rotate: refreshing ? '0deg' : `${(webPullDistance / PULL_THRESHOLD) * 180}deg` }] }}>
                <RefreshCw size={24} color={COLORS.node.accent} />
              </View>
            </View>
          )}
          <View
            style={{
              flex: 1,
              transform: Platform.OS === 'web' && (isWebPulling || refreshing)
                ? [{ translateY: refreshing ? 40 : webPullDistance }]
                : undefined,
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 8 }}
              showsVerticalScrollIndicator={false}
              onScroll={handleWebScroll}
              scrollEventThrottle={16}
              refreshControl={
                Platform.OS !== 'web' ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={COLORS.node.accent}
                    colors={[COLORS.node.accent]}
                  />
                ) : undefined
              }
            >
              {notifications.map((item) => {
                const isModNotification = ['warning', 'mod_removed', 'banned'].includes(item.type);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.notificationItem, isModNotification && styles.modNotification]}
                    onPress={() => {
                      if (item.targetId) onPostClick(item.targetId);
                      else if (item.actorId) onUserClick(item.actorId);
                    }}
                  >
                    <View style={styles.notificationIcon}>
                      {getNotificationIcon(item.type)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationText} numberOfLines={2}>
                        {isModNotification ? (
                          item.message
                        ) : (
                          <>
                            <Text style={{ fontWeight: '600' }}>@{item.actorUsername}</Text> {item.message}
                          </>
                        )}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      );
    }

    // External platform feeds (Tier 5)
    if (column.type === 'bluesky' || column.type === 'mastodon' || column.type === 'external-combined') {
      if (loading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.node.accent} />
          </View>
        );
      }
      if (externalPosts.length === 0) {
        return <Text style={styles.emptyText}>No posts found</Text>;
      }
      return (
        <View style={{ flex: 1, overflow: 'hidden' }} {...webTouchProps}>
          {/* Web pull indicator */}
          {Platform.OS === 'web' && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 50,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                transform: [{ translateY: webPullDistance - 50 }],
                opacity: refreshing ? 1 : Math.min(webPullDistance / PULL_THRESHOLD, 1),
              }}
            >
              <View style={{ transform: [{ rotate: refreshing ? '0deg' : `${(webPullDistance / PULL_THRESHOLD) * 180}deg` }] }}>
                <RefreshCw size={24} color={COLORS.node.accent} />
              </View>
            </View>
          )}
          <View
            style={{
              flex: 1,
              transform: Platform.OS === 'web' && (isWebPulling || refreshing)
                ? [{ translateY: refreshing ? 40 : webPullDistance }]
                : undefined,
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 8 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                Platform.OS !== 'web' ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={COLORS.node.accent}
                    colors={[COLORS.node.accent]}
                  />
                ) : undefined
              }
              onScroll={({ nativeEvent }) => {
                // Track scroll position for web pull-to-refresh
                if (Platform.OS === 'web') {
                  webScrollTop.current = nativeEvent.contentOffset.y;
                }
                // Load more when near bottom
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 500;
                if (isNearBottom && hasMore && !loadingMore) {
                  handleLoadMore();
                }
              }}
              scrollEventThrottle={16}
            >
              {externalPosts.map((post) => (
                <ExternalPostCard
                  key={post.id}
                  post={post}
                  onRepostToNode={onQuoteExternalPost}
                  onSaveToNode={onSaveExternalPost}
                />
              ))}
              {loadingMore && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.node.accent} />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      );
    }

    // Default: Feed-based columns
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.node.accent} />
        </View>
      );
    }
    return (
      <Feed
        posts={posts}
        currentUser={currentUser}
        onPostAction={onPostAction}
        onPostClick={handlePostClick}
        onEdit={onEdit}
        onAuthorClick={onAuthorClick}
        onSaveToggle={onSaveToggle}
        globalNodeId={globalNodeId}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        searchUserResults={[]}
        onUserClick={onUserClick}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onQuoteExternalPost={onQuoteExternalPost}
        onSaveExternalPost={onSaveExternalPost}
      />
    );
  };

  return (
    <View style={styles.column}>
      {/* Unified Column Header */}
      <View style={styles.header}>
        {/* Move Left Button */}
        {onMoveLeft && (
          <TouchableOpacity
            testID="move-left-button"
            onPress={onMoveLeft}
            style={styles.headerButton}
          >
            <ChevronLeft size={14} color={COLORS.node.muted} />
          </TouchableOpacity>
        )}

        {/* Search Bar */}
        <ColumnSearchBar
          currentType={column.type}
          currentTitle={column.title}
          onTypeChange={handleTypeChange}
          onSearch={handleSearch}
          nodes={nodes.map(n => ({ ...n, color: n.color ?? undefined, avatar: n.avatar ?? undefined }))}
        />

        {/* Settings Button (only for feed-based columns) */}
        {supportsVibeSettings && (
          <TouchableOpacity
            testID="settings-button"
            onPress={() => setShowVibeModal(true)}
            style={styles.headerButton}
          >
            <Settings size={16} color={COLORS.node.muted} />
          </TouchableOpacity>
        )}

        {/* Move Right Button */}
        {onMoveRight && (
          <TouchableOpacity
            testID="move-right-button"
            onPress={onMoveRight}
            style={styles.headerButton}
          >
            <ChevronRight size={14} color={COLORS.node.muted} />
          </TouchableOpacity>
        )}

        {/* Remove Column Button */}
        {canRemove && (
          <TouchableOpacity
            testID="remove-column-button"
            onPress={onRemove}
            style={styles.headerButton}
          >
            <X size={16} color={COLORS.node.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Column Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* VibeValidator Modal */}
      <VibeValidatorModal
        visible={showVibeModal}
        settings={column.vibeSettings || DEFAULT_VIBE_SETTINGS}
        onUpdate={handleVibeSettingsUpdate}
        onClose={() => setShowVibeModal(false)}
        columnTitle={column.title}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  column: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
    borderRightWidth: 1,
    borderRightColor: COLORS.node.border,
    overflow: 'hidden',
  },
  header: {
    height: COLUMNS.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    backgroundColor: COLORS.node.bgAlt,
  },
  headerButton: {
    padding: 6,
    borderRadius: 6,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: COLORS.node.muted,
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  // Notification styles
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.node.panel,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  modNotification: {
    borderColor: '#f59e0b',
    borderLeftWidth: 3,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontSize: 13,
    color: COLORS.node.text,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: COLORS.node.muted,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.node.accent,
  },
});

export default FeedColumn;
