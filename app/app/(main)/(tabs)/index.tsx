import { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthStore } from '../../../src/store/auth';
import { useModalStore } from '../../../src/store/modal';
import { useFeedSourceStore } from '../../../src/store/feedSource';
import { useColumnsStore } from '../../../src/store/columns';
import { useFeed } from '../../../src/hooks/useFeed';
import { useNodes } from '../../../src/hooks/useNodes';
import { Feed } from '../../../src/components/ui/Feed';
import { MultiColumnContainer } from '../../../src/components/ui/MultiColumnContainer';
import type { ExternalPost } from '../../../src/lib/api';

export default function FeedScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const user = useAuthStore((s) => s.user);
  const openCreatePost = useModalStore((s) => s.openCreatePost);
  const openEditPost = useModalStore((s) => s.openEditPost);
  const selectedNodeId = useFeedSourceStore((s) => s.selectedNodeId);
  const isMultiColumnEnabled = useColumnsStore((s) => s.isMultiColumnEnabled);

  const { data: nodes } = useNodes();
  const globalNodeId = useMemo(
    () => nodes?.find((n) => n.slug === 'global')?.id,
    [nodes]
  );

  const feedQuery = useFeed({
    nodeId: selectedNodeId,
    feedMode: 'global',
  });

  // Flatten pages into a single posts array
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.posts) ?? [],
    [feedQuery.data]
  );

  const externalPosts = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.externalPosts) ?? [],
    [feedQuery.data]
  );

  // Determine hasMore from the last page
  const lastPage = feedQuery.data?.pages[feedQuery.data.pages.length - 1];
  const hasMore = lastPage?.hasMore ?? true;

  // Navigation callbacks
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

  // Modal callbacks
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

  // Feed action callbacks
  const handlePostAction = useCallback(
    (_postId: string, _action: string) => {
      // Post actions will trigger cache invalidation via mutations
      // For now, refetch the feed
      feedQuery.refetch();
    },
    [feedQuery]
  );

  const handleSaveToggle = useCallback(
    (_postId: string, _saved: boolean) => {
      // Save toggle is handled by the PostCard internally via useToggleSave
      // The cache invalidation in the hook will update the feed
    },
    []
  );

  if (feedQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Desktop multi-column mode
  if (isDesktop && isMultiColumnEnabled) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <MultiColumnContainer
          currentUser={user}
          nodes={nodes ?? []}
          globalNodeId={globalNodeId}
          onPostClick={handlePostClick}
          onAuthorClick={handleAuthorClick}
          onUserClick={handleUserClick}
          onPostAction={handlePostAction}
          onSaveToggle={handleSaveToggle}
          onNodeClick={(nodeId) => useFeedSourceStore.getState().setSelectedNodeId(nodeId)}
          showAddModal={useModalStore.getState().isAddColumnOpen}
          onCloseAddModal={useModalStore.getState().closeAddColumn}
          onQuoteExternalPost={handleQuoteExternalPost}
          onEdit={handleEdit}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
        onLoadMore={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
          }
        }}
        hasMore={hasMore}
        loadingMore={feedQuery.isFetchingNextPage}
        onUserClick={handleUserClick}
        onRefresh={() => feedQuery.refetch()}
        refreshing={feedQuery.isRefetching}
        onQuoteExternalPost={handleQuoteExternalPost}
      />
    </View>
  );
}
