// Tier 4: Performance - Feed fetching with prefetching and caching
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { getFeed } from '../lib/api';
import { ColumnVibeSettings } from '../store/columns';

interface UseFeedQueryOptions {
  columnId: string;
  columnType: string;
  nodeId?: string;
  vibeSettings?: ColumnVibeSettings;
  followingOnly?: boolean;
  enabled?: boolean;
}

interface FeedPost {
  id: string;
  mediaUrl?: string | null;
  linkMeta?: {
    image?: string;
  } | null;
  author?: {
    avatar?: string | null;
  };
}

// Build query params from vibe settings
const buildFeedParams = (options: UseFeedQueryOptions, cursor?: string) => {
  const params: Record<string, any> = { limit: 20 };

  if (cursor) params.cursor = cursor;
  if (options.nodeId) params.nodeId = options.nodeId;
  if (options.followingOnly) params.followingOnly = true;

  const vibeSettings = options.vibeSettings;
  if (!vibeSettings) return params;

  // Preset
  if (vibeSettings.preset && vibeSettings.preset !== 'custom') {
    params.preset = vibeSettings.preset;
  }

  // Main weights
  if (vibeSettings.weights) {
    params.qualityWeight = vibeSettings.weights.quality;
    params.recencyWeight = vibeSettings.weights.recency;
    params.engagementWeight = vibeSettings.weights.engagement;
    params.personalizationWeight = vibeSettings.weights.personalization;
  }

  // Intermediate settings
  if (vibeSettings.intermediate) {
    const int = vibeSettings.intermediate;
    if (int.timeRange && int.timeRange !== 'all') params.timeRange = int.timeRange;
    if (int.textOnly) params.textOnly = true;
    if (int.mediaOnly) params.mediaOnly = true;
    if (int.linksOnly) params.linksOnly = true;
    if (int.hasDiscussion) params.hasDiscussion = true;
    if (int.textDensity && int.textDensity !== 'any') params.textDensity = int.textDensity;
    if (int.mediaType && int.mediaType !== 'any') params.mediaType = int.mediaType;
    if (int.showSeenPosts !== undefined) params.showSeenPosts = int.showSeenPosts;
    if (int.hideMutedWords !== undefined) params.hideMutedWords = int.hideMutedWords;
    if (int.discoveryRate !== undefined && int.discoveryRate > 0) params.discoveryRate = int.discoveryRate;
  }

  // Advanced settings
  if (vibeSettings.advanced) {
    const adv = vibeSettings.advanced as Record<string, any>;
    Object.entries(adv).forEach(([key, value]) => {
      if (key === 'vectorMultipliers' && value) {
        params.vectorMultipliers = JSON.stringify(value);
      } else if (value !== undefined) {
        params[key] = value;
      }
    });
  }

  // Expert settings
  if (vibeSettings.expert) {
    const exp = vibeSettings.expert as Record<string, any>;
    Object.entries(exp).forEach(([key, value]) => {
      if (value !== undefined && key !== 'moodToggle') {
        params[key] = value;
      } else if (key === 'moodToggle' && value !== 'normal') {
        params.moodToggle = value;
      }
    });
  }

  return params;
};

// Preload images for posts (improves scroll smoothness)
const preloadPostImages = (posts: FeedPost[]) => {
  const imageUrls: string[] = [];

  posts.forEach(post => {
    // Media images
    if (post.mediaUrl) imageUrls.push(post.mediaUrl);
    // Link preview images
    if (post.linkMeta?.image) imageUrls.push(post.linkMeta.image);
    // Author avatars
    if (post.author?.avatar) imageUrls.push(post.author.avatar);
  });

  // Prefetch images in background
  imageUrls.forEach(url => {
    Image.prefetch(url).catch(() => {
      // Silently ignore prefetch failures
    });
  });
};

export function useFeedQuery(options: UseFeedQueryOptions) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Build a stable query key from options
  const queryKey = [
    'feed',
    options.columnId,
    options.columnType,
    options.nodeId,
    options.followingOnly,
    JSON.stringify(options.vibeSettings),
  ];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const params = buildFeedParams(options, pageParam);
      const result = await getFeed(params);

      // Preload images for fetched posts
      if (result.posts) {
        preloadPostImages(result.posts);
      }

      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: options.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Prefetch next page when we're close to the end
  const prefetchNextPage = useCallback(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;

    const lastPage = query.data?.pages[query.data.pages.length - 1];
    const nextCursor = lastPage?.nextCursor;

    if (nextCursor && !prefetchedRef.current.has(nextCursor)) {
      prefetchedRef.current.add(nextCursor);

      queryClient.prefetchInfiniteQuery({
        queryKey,
        queryFn: async ({ pageParam }) => {
          const params = buildFeedParams(options, pageParam);
          const result = await getFeed(params);
          if (result.posts) preloadPostImages(result.posts);
          return result;
        },
        initialPageParam: nextCursor,
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        pages: 1,
      });
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.data, queryClient, queryKey, options]);

  // Flatten pages into single posts array
  const posts = query.data?.pages.flatMap(page => page.posts) ?? [];

  // Auto-prefetch when we have data
  useEffect(() => {
    if (posts.length > 0 && query.hasNextPage) {
      // Prefetch next page after initial load
      const timer = setTimeout(prefetchNextPage, 1000);
      return () => clearTimeout(timer);
    }
  }, [posts.length, query.hasNextPage, prefetchNextPage]);

  return {
    posts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    prefetchNextPage,
  };
}

// Hook for tracking post views (Tier 3 integration)
export function usePostViewTracker() {
  const viewedPostsRef = useRef<Set<string>>(new Set());
  const pendingViewsRef = useRef<string[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushViews = useCallback(async () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    const views = pendingViewsRef.current;
    if (views.length === 0) return;

    pendingViewsRef.current = [];

    try {
      const { trackPostViewsBatch } = await import('../lib/api');
      await trackPostViewsBatch(views);
    } catch (err) {
      // Silently fail - view tracking is non-critical
      console.debug('Failed to track post views:', err);
    }
  }, []);

  const trackView = useCallback((postId: string) => {
    if (viewedPostsRef.current.has(postId)) return;

    viewedPostsRef.current.add(postId);
    pendingViewsRef.current.push(postId);

    // Batch views and send every 5 seconds or when we have 10+ views
    if (pendingViewsRef.current.length >= 10) {
      flushViews();
    } else if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(flushViews, 5000);
    }
  }, [flushViews]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      // Fire-and-forget final flush
      if (pendingViewsRef.current.length > 0) {
        flushViews();
      }
    };
  }, [flushViews]);

  return { trackView };
}
