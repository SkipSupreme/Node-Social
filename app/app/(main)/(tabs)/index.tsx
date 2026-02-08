import { useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthStore } from '../../../src/store/auth';
import { useModalStore } from '../../../src/store/modal';
import { useFeed } from '../../../src/hooks/useFeed';
import { useNodes } from '../../../src/hooks/useNodes';
import { Feed } from '../../../src/components/ui/Feed';
import type { ExternalPost } from '../../../src/lib/api';

export default function FeedScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openCreatePost = useModalStore((s) => s.openCreatePost);
  const openEditPost = useModalStore((s) => s.openEditPost);

  const { data: nodes } = useNodes();
  const globalNodeId = useMemo(
    () => nodes?.find((n) => n.slug === 'global')?.id,
    [nodes]
  );

  const feedQuery = useFeed({
    nodeId: null,
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
    (_postId: string, _action: 'mute' | 'block' | 'delete') => {
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
