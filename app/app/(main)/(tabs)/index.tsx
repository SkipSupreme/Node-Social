import { useCallback, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, useWindowDimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthStore } from '../../../src/store/auth';
import { useModalStore } from '../../../src/store/modal';
import { useFeedSourceStore } from '../../../src/store/feedSource';
import { useColumnsStore, ColumnVibeSettings } from '../../../src/store/columns';
import { useFeed } from '../../../src/hooks/useFeed';
import { useNodes } from '../../../src/hooks/useNodes';
import { Feed } from '../../../src/components/ui/Feed';
import { FeedHeader } from '../../../src/components/ui/FeedHeader';
import { VibeValidatorModal } from '../../../src/components/ui/VibeValidatorModal';
import { MultiColumnContainer } from '../../../src/components/ui/MultiColumnContainer';
import type { FeedSourceType } from '../../../src/components/ui/FeedHeader';
import type { ExternalPost } from '../../../src/lib/api';

// Default vibe settings (matches FeedColumn.tsx)
const DEFAULT_VIBE_SETTINGS: ColumnVibeSettings = {
  preset: 'balanced',
  weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
};

export default function FeedScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const user = useAuthStore((s) => s.user);
  const openCreatePost = useModalStore((s) => s.openCreatePost);
  const openEditPost = useModalStore((s) => s.openEditPost);
  const openSidebar = useModalStore((s) => s.openSidebar);
  const isAddColumnOpen = useModalStore((s) => s.isAddColumnOpen);
  const closeAddColumn = useModalStore((s) => s.closeAddColumn);
  const selectedNodeId = useFeedSourceStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useFeedSourceStore((s) => s.setSelectedNodeId);
  const feedSource = useFeedSourceStore((s) => s.feedSource);
  const setFeedSource = useFeedSourceStore((s) => s.setFeedSource);
  const isMultiColumnEnabled = useColumnsStore((s) => s.isMultiColumnEnabled);

  // Mobile: local state for search, vibe settings, and vibe modal
  const [searchQuery, setSearchQuery] = useState('');
  const [vibeSettings, setVibeSettings] = useState<ColumnVibeSettings>(DEFAULT_VIBE_SETTINGS);
  const [showVibeModal, setShowVibeModal] = useState(false);

  const { data: nodes } = useNodes();
  const globalNodeId = useMemo(
    () => nodes?.find((n) => n.slug === 'global')?.id,
    [nodes]
  );

  // Build algo settings from vibe weights for the feed API
  const algoSettings = useMemo(() => ({
    qualityWeight: vibeSettings.weights.quality,
    recencyWeight: vibeSettings.weights.recency,
    engagementWeight: vibeSettings.weights.engagement,
    personalizationWeight: vibeSettings.weights.personalization,
  }), [vibeSettings.weights]);

  const feedQuery = useFeed({
    nodeId: selectedNodeId,
    feedMode: 'global',
    algoSettings,
  });

  // Use ref for feedQuery to avoid stale closures without causing re-renders
  const feedQueryRef = useRef(feedQuery);
  feedQueryRef.current = feedQuery;

  // Flatten pages into a single posts array
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.posts) ?? [],
    [feedQuery.data]
  );

  const externalPosts = useMemo(() => {
    const all = feedQuery.data?.pages.flatMap((p) => p.externalPosts) ?? [];
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [feedQuery.data]);

  // Memoize hasMore to avoid recalculation on every render
  const hasMore = useMemo(() => {
    const pages = feedQuery.data?.pages;
    if (!pages || pages.length === 0) return true;
    return pages[pages.length - 1]?.hasMore ?? true;
  }, [feedQuery.data]);

  // --- Stable navigation callbacks ---
  const handlePostClick = useCallback(
    (postOrId: any) => {
      const postId = typeof postOrId === 'string' ? postOrId : postOrId?.id;
      if (postId) router.push(`/post/${postId}` as any);
    },
    [router]
  );

  const handleAuthorClick = useCallback(
    (authorId: string) => {
      router.push(`/user/${authorId}` as any);
    },
    [router]
  );

  const handleUserClick = useCallback(
    (userId: string) => {
      router.push(`/user/${userId}` as any);
    },
    [router]
  );

  // --- Stable modal callbacks ---
  const handleEdit = useCallback(
    (post: any) => {
      openEditPost(post);
    },
    [openEditPost]
  );

  const handleQuoteExternalPost = useCallback(
    (post: ExternalPost) => {
      openCreatePost({ quotedExternalPost: post });
    },
    [openCreatePost]
  );

  // --- Stable feed action callbacks (use ref to avoid feedQuery in deps) ---
  const handlePostAction = useCallback(
    (_postId: string, _action: string) => {
      feedQueryRef.current.refetch();
    },
    []
  );

  const handleSaveToggle = useCallback(
    (_postId: string, _saved: boolean) => {
      // Save toggle is handled by the PostCard internally via useToggleSave
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    const q = feedQueryRef.current;
    if (q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, []);

  const handleRefresh = useCallback(() => {
    feedQueryRef.current.refetch();
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
    },
    [setSelectedNodeId]
  );

  // Mobile: search submit navigates to discovery tab with query
  const handleSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/discovery?q=${encodeURIComponent(trimmed)}` as any);
      setSearchQuery('');
    }
  }, [searchQuery, router]);

  // Mobile: feed source change
  const handleFeedSourceChange = useCallback(
    (source: FeedSourceType) => {
      setFeedSource(source as any);
    },
    [setFeedSource]
  );

  if (feedQuery.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Desktop multi-column mode
  if (isDesktop && isMultiColumnEnabled) {
    return (
      <View style={[styles.flex1, { backgroundColor: theme.bg }]}>
        <MultiColumnContainer
          currentUser={user}
          nodes={nodes ?? []}
          globalNodeId={globalNodeId}
          onPostClick={handlePostClick}
          onAuthorClick={handleAuthorClick}
          onUserClick={handleUserClick}
          onPostAction={handlePostAction}
          onSaveToggle={handleSaveToggle}
          onNodeClick={handleNodeClick}
          showAddModal={isAddColumnOpen}
          onCloseAddModal={closeAddColumn}
          onQuoteExternalPost={handleQuoteExternalPost}
          onEdit={handleEdit}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex1, { backgroundColor: theme.bg }]}>
      {/* Mobile: FeedHeader with hamburger menu, search, feed source picker, vibe validator */}
      {!isDesktop && (
        <FeedHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          algoSettings={vibeSettings as any}
          onVibeClick={() => setShowVibeModal(true)}
          feedSource={feedSource as FeedSourceType}
          onFeedSourceChange={handleFeedSourceChange}
          onMenuClick={openSidebar}
          isDesktop={false}
        />
      )}
      <Feed
        posts={posts}
        externalPosts={externalPosts}
        currentUser={user}
        onPostAction={handlePostAction}
        onPostClick={handlePostClick}
        onEdit={handleEdit}
        onAuthorClick={handleAuthorClick}
        onSaveToggle={handleSaveToggle}
        globalNodeId={globalNodeId}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        loadingMore={feedQuery.isFetchingNextPage}
        onUserClick={handleUserClick}
        onRefresh={handleRefresh}
        refreshing={feedQuery.isRefetching}
        onQuoteExternalPost={handleQuoteExternalPost}
      />
      {/* Mobile: VibeValidatorModal for algorithm tuning */}
      {!isDesktop && (
        <VibeValidatorModal
          visible={showVibeModal}
          settings={vibeSettings}
          onUpdate={setVibeSettings}
          onClose={() => setShowVibeModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
