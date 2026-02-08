// app/src/hooks/useFeed.ts
// Infinite-query hook that unifies node API, Bluesky, Mastodon, and mixed feeds.
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getFeed,
  getBlueskyDiscover,
  getMastodonTrending,
  getCombinedExternalFeed,
} from '../lib/api';
import type { ExternalPost } from '../lib/api';
import { useFeedSourceStore } from '../store/feedSource';
import { mapPost } from '../lib/mappers';

type FeedMode = 'global' | 'discovery' | 'following';

interface UseFeedOptions {
  nodeId?: string | null;
  feedMode: FeedMode;
  algoSettings?: Record<string, any>;
  enabled?: boolean;
}

// Each page can carry mapped node posts, external posts, or both (mixed mode).
interface FeedPage {
  posts: any[]; // Mapped UI posts from node API
  externalPosts: ExternalPost[]; // External platform posts
  nextCursor?: string;
  hasMore: boolean;
}

export function useFeed({ nodeId, feedMode, algoSettings, enabled = true }: UseFeedOptions) {
  const feedSource = useFeedSourceStore(s => s.feedSource);

  return useInfiniteQuery({
    queryKey: ['feed', { nodeId, feedMode, feedSource, algoSettings }],
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      // External-only feeds (bluesky or mastodon solo)
      if (feedSource === 'bluesky') {
        const result = await getBlueskyDiscover(20, pageParam);
        return {
          posts: [],
          externalPosts: result.posts,
          nextCursor: result.nextCursor,
          hasMore: result.posts.length === 20,
        };
      }

      if (feedSource === 'mastodon') {
        const result = await getMastodonTrending(
          'mastodon.social',
          20,
          pageParam ? parseInt(pageParam, 10) : 0,
        );
        return {
          posts: [],
          externalPosts: result.posts,
          nextCursor: result.nextCursor,
          hasMore: result.posts.length === 20,
        };
      }

      if (feedSource === 'mixed') {
        // Mixed: get both node posts and external posts
        const [nodeResult, externalResult] = await Promise.all([
          getFeed({
            cursor: pageParam,
            limit: 15,
            nodeId: nodeId ?? undefined,
            followingOnly: feedMode === 'following' ? true : undefined,
            ...algoSettings,
          }),
          getCombinedExternalFeed(['bluesky', 'mastodon'], 10),
        ]);

        return {
          posts: (nodeResult.posts || []).map(mapPost),
          externalPosts: externalResult.posts || [],
          nextCursor: nodeResult.nextCursor,
          hasMore: nodeResult.hasMore,
        };
      }

      // Default: node-only feed
      const result = await getFeed({
        cursor: pageParam,
        limit: 20,
        nodeId: nodeId ?? undefined,
        followingOnly: feedMode === 'following' ? true : undefined,
        ...algoSettings,
      });

      return {
        posts: (result.posts || []).map(mapPost),
        externalPosts: [],
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000, // 30s
    enabled,
  });
}
