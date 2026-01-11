// Individual feed column with independent state and scrolling
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { X, ChevronLeft, ChevronRight, Settings } from './Icons';
import { COLORS, COLUMNS } from '../../constants/theme';
import { FeedColumn as FeedColumnType, ColumnType, ColumnVibeSettings } from '../../store/columns';
import { getFeed, searchPosts, getUserPosts, getNotifications, markNotificationsRead } from '../../lib/api';
import { Heart, MessageSquare, UserPlus, AlertTriangle, Ban, Trash2, Bell } from 'lucide-react-native';
import { Feed } from './Feed';
import { WhatsVibing } from './WhatsVibing';
import { ColumnSearchBar } from './ColumnSearchBar';
import { VibeValidatorModal } from './VibeValidatorModal';

interface FeedColumnProps {
  column: FeedColumnType;
  currentUser: any;
  nodes: any[];
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
}

// Column types that support VibeValidator (feed-based columns)
const VIBE_SUPPORTED_TYPES: ColumnType[] = ['global', 'discovery', 'following', 'node', 'search'];

// Default vibe settings
const DEFAULT_VIBE_SETTINGS: ColumnVibeSettings = {
  preset: 'balanced',
  weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
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
}) => {
  // Independent state for this column
  const [posts, setPosts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  // VibeValidator modal state
  const [showVibeModal, setShowVibeModal] = useState(false);

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

  // Map API posts to Feed format
  const mapPosts = (apiPosts: any[]) => {
    return apiPosts.map((p: any) => ({
      id: p.id,
      node: { id: p.node?.id, name: p.node?.name || 'Global', slug: p.node?.slug || 'global', color: '#6366f1' },
      author: {
        id: p.author.id,
        username: p.author.username || 'User',
        avatar: p.author.avatar,
        era: p.author.era || 'Lurker Era',
        cred: p.author.cred || 0
      },
      title: p.title || 'Untitled Post',
      content: p.content,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      expertGated: false,
      vibes: [],
      linkUrl: p.linkUrl,
      mediaUrl: p.mediaUrl,
      linkMeta: p.linkMeta,
      poll: p.poll,
      myReaction: p.myReaction,
      vibeAggregate: p.vibeAggregate,
      isSaved: p.isSaved ?? false,
      comments: p.comments?.map((c: any) => ({
        id: c.id,
        author: {
          id: c.author.id,
          username: c.author.username || 'User',
          avatar: c.author.avatar,
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

  // Fetch data based on column type
  const fetchData = useCallback(async (cursor?: string) => {
    try {
      // Handle trending column separately - it shows WhatsVibing, not posts
      if (column.type === 'trending') {
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
      const params: any = { cursor, limit: 20 };

      if (column.type === 'node' && column.nodeId) {
        params.nodeId = column.nodeId;
      } else if (column.type === 'discovery') {
        params.preset = 'popular';
      } else if (column.type === 'following') {
        params.followingOnly = true;
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
    setNextCursor(undefined);
    setHasMore(true);
    fetchData();
  }, [column.type, column.nodeId, column.searchQuery, column.userId]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    // Don't auto-refresh profile or search columns
    if (column.type === 'profile' || column.type === 'search' || column.type === 'notifications') {
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

  // Handle post click - Feed expects (post) => void, we have (postId) => void
  const handlePostClick = useCallback((post: any) => {
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
          {notifications.map((item) => {
            const isModNotification = ['warning', 'mod_removed', 'banned'].includes(item.type);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationItem, isModNotification && styles.modNotification]}
                onPress={() => {
                  if (item.postId) onPostClick(item.postId);
                  else if (item.actor?.id) onUserClick(item.actor.id);
                }}
              >
                <View style={styles.notificationIcon}>
                  {getNotificationIcon(item.type)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notificationText} numberOfLines={2}>
                    {isModNotification ? (
                      item.content
                    ) : (
                      <>
                        <Text style={{ fontWeight: '600' }}>@{item.actor?.username}</Text> {item.content}
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
        onAuthorClick={onAuthorClick}
        onSaveToggle={onSaveToggle}
        globalNodeId={globalNodeId}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        searchUserResults={[]}
        onUserClick={onUserClick}
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
          nodes={nodes}
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: {
    padding: 6,
    borderRadius: 6,
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
    flex: 1,
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
  // Type dropdown
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  typeDropdown: {
    position: 'absolute',
    top: COLUMNS.headerHeight,
    left: 8,
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    padding: 4,
    zIndex: 100,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  typeOptionActive: {
    backgroundColor: `${COLORS.node.accent}15`,
  },
  typeOptionText: {
    fontSize: 13,
    color: COLORS.node.text,
  },
  typeOptionTextActive: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: COLORS.node.panel,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  nodeList: {
    maxHeight: 300,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  nodeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  nodeAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  nodeName: {
    fontSize: 14,
    color: COLORS.node.text,
    fontWeight: '500',
  },
  searchInput: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.node.text,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    marginBottom: 12,
  },
  searchButton: {
    backgroundColor: COLORS.node.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
