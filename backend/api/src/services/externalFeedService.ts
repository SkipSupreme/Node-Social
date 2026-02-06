// Tier 5: External Platform Integration
// Fetch posts from Bluesky and Mastodon for cross-platform feeds

import { franc } from 'franc-min';
import type { FastifyRedis } from '@fastify/redis';

// ============================================
// LANGUAGE DETECTION
// ============================================

// Map franc ISO 639-3 codes to ISO 639-1 codes
const LANG_MAP: Record<string, string> = {
  eng: 'en', spa: 'es', fra: 'fr', deu: 'de', ita: 'it',
  por: 'pt', nld: 'nl', rus: 'ru', jpn: 'ja', kor: 'ko',
  zho: 'zh', ara: 'ar', hin: 'hi', tur: 'tr', pol: 'pl',
  swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', ces: 'cs',
  ukr: 'uk', ell: 'el', heb: 'he', tha: 'th', vie: 'vi',
  ind: 'id', msa: 'ms', fil: 'tl', cat: 'ca', ron: 'ro',
  hun: 'hu', bul: 'bg', hrv: 'hr', slk: 'sk', slv: 'sl',
};

function detectLanguage(text: string): string | null {
  if (!text || text.length < 20) return null; // Too short to detect reliably

  // Clean text: remove URLs, mentions, hashtags
  const cleanText = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[\w.-]+/g, '')
    .replace(/#\w+/g, '')
    .trim();

  if (cleanText.length < 15) return null;

  const detected = franc(cleanText);
  if (detected === 'und') return null; // Undetermined

  return LANG_MAP[detected] || null;
}

// ============================================
// CACHING
// ============================================

const CACHE_TTL = {
  discover: 300,    // 5 minutes for "What's Hot" / trending
  timeline: 120,    // 2 minutes for public timelines
  combined: 180,    // 3 minutes for combined feeds
};

interface CacheOptions {
  redis?: FastifyRedis;
  ttl?: number;
}

async function getCached<T>(
  redis: FastifyRedis | undefined,
  key: string
): Promise<T | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Cache get error:', e);
  }
  return null;
}

async function setCache(
  redis: FastifyRedis | undefined,
  key: string,
  data: unknown,
  ttl: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (e) {
    console.warn('Cache set error:', e);
  }
}

// ============================================
// TYPES
// ============================================

export interface ExternalPost {
  id: string;
  platform: 'bluesky' | 'mastodon';
  externalId: string;
  externalUrl: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    profileUrl: string;
  };
  content: string;
  contentHtml?: string;
  createdAt: string;
  mediaUrls: string[];
  replyCount: number;
  repostCount: number;
  likeCount: number;
  isRepost: boolean;
  repostedBy?: {
    username: string;
    displayName: string;
  };
  language?: string | null; // Detected language code (e.g., 'en', 'es', 'ja')
}

export interface ExternalFeedResult {
  posts: ExternalPost[];
  nextCursor?: string;
  platform: 'bluesky' | 'mastodon';
  cached?: boolean; // Whether result was from cache
}

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  language?: string; // Filter to specific language (e.g., 'en')
  redis?: FastifyRedis;
}

// ============================================
// BLUESKY SERVICE
// ============================================

const BSKY_PUBLIC_API = 'https://public.api.bsky.app/xrpc';

interface BskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: any;
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  embed?: {
    images?: Array<{ thumb: string; fullsize: string; alt?: string }>;
    external?: { uri: string; title: string; description: string; thumb?: string };
  };
}

interface BskyFeedResponse {
  feed: Array<{
    post: BskyPost;
    reason?: { $type: string; by: { handle: string; displayName?: string } };
  }>;
  cursor?: string;
}

export async function fetchBlueskyFeed(
  feed: string = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
  options: FeedOptions = {}
): Promise<ExternalFeedResult> {
  const { limit = 20, cursor, language, redis } = options;

  // Try cache first (only for first page)
  const cacheKey = `external:bsky:${feed}:${limit}:${cursor || 'first'}`;
  if (!cursor) {
    const cached = await getCached<ExternalFeedResult>(redis, cacheKey);
    if (cached) {
      // Apply language filter to cached results
      let posts = cached.posts;
      if (language) {
        posts = posts.filter(p => p.language === language || !p.language);
      }
      return { ...cached, posts, cached: true };
    }
  }

  try {
    const params = new URLSearchParams({
      feed,
      limit: limit.toString(),
    });
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getFeed?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Bluesky API error:', response.status, await response.text());
      return { posts: [], platform: 'bluesky' };
    }

    const data: BskyFeedResponse = await response.json();

    const posts: ExternalPost[] = data.feed.map(item => {
      const post = item.post;
      const isRepost = item.reason?.$type === 'app.bsky.feed.defs#reasonRepost';

      // Extract media URLs from embeds
      const mediaUrls: string[] = [];
      if (post.embed?.images) {
        post.embed.images.forEach(img => mediaUrls.push(img.fullsize || img.thumb));
      }

      const content = post.record.text;

      return {
        id: `bsky_${post.cid}`,
        platform: 'bluesky' as const,
        externalId: post.uri,
        externalUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
        author: {
          id: post.author.did,
          username: post.author.handle,
          displayName: post.author.displayName || post.author.handle,
          avatar: post.author.avatar || null,
          profileUrl: `https://bsky.app/profile/${post.author.handle}`,
        },
        content,
        createdAt: post.record.createdAt,
        mediaUrls,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        likeCount: post.likeCount || 0,
        isRepost,
        repostedBy: isRepost && item.reason ? {
          username: (item.reason as any).by?.handle || '',
          displayName: (item.reason as any).by?.displayName || '',
        } : undefined,
        language: detectLanguage(content),
      };
    });

    const result: ExternalFeedResult = {
      posts,
      nextCursor: data.cursor,
      platform: 'bluesky',
    };

    // Cache the unfiltered result
    if (!cursor) {
      await setCache(redis, cacheKey, result, CACHE_TTL.discover);
    }

    // Apply language filter
    if (language) {
      result.posts = posts.filter(p => p.language === language || !p.language);
    }

    return result;
  } catch (error) {
    console.error('Error fetching Bluesky feed:', error);
    return { posts: [], platform: 'bluesky' };
  }
}

// Fetch Bluesky "Discover" feed (popular posts)
export async function fetchBlueskyDiscover(options: FeedOptions = {}): Promise<ExternalFeedResult> {
  return fetchBlueskyFeed(
    'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
    options
  );
}

// Fetch posts from a specific Bluesky user
export async function fetchBlueskyUserPosts(
  handle: string,
  options: FeedOptions = {}
): Promise<ExternalFeedResult> {
  const { limit = 20, cursor, language, redis } = options;

  // Cache for user feeds (shorter TTL)
  const cacheKey = `external:bsky:user:${handle}:${limit}:${cursor || 'first'}`;
  if (!cursor) {
    const cached = await getCached<ExternalFeedResult>(redis, cacheKey);
    if (cached) {
      let posts = cached.posts;
      if (language) {
        posts = posts.filter(p => p.language === language || !p.language);
      }
      return { ...cached, posts, cached: true };
    }
  }

  try {
    const params = new URLSearchParams({
      actor: handle,
      limit: limit.toString(),
    });
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getAuthorFeed?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Bluesky user feed error:', response.status);
      return { posts: [], platform: 'bluesky' };
    }

    const data: BskyFeedResponse = await response.json();

    const posts: ExternalPost[] = data.feed.map(item => {
      const post = item.post;
      const mediaUrls: string[] = [];
      if (post.embed?.images) {
        post.embed.images.forEach(img => mediaUrls.push(img.fullsize || img.thumb));
      }

      const content = post.record.text;

      return {
        id: `bsky_${post.cid}`,
        platform: 'bluesky' as const,
        externalId: post.uri,
        externalUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
        author: {
          id: post.author.did,
          username: post.author.handle,
          displayName: post.author.displayName || post.author.handle,
          avatar: post.author.avatar || null,
          profileUrl: `https://bsky.app/profile/${post.author.handle}`,
        },
        content,
        createdAt: post.record.createdAt,
        mediaUrls,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        likeCount: post.likeCount || 0,
        isRepost: false,
        language: detectLanguage(content),
      };
    });

    const result: ExternalFeedResult = {
      posts,
      nextCursor: data.cursor,
      platform: 'bluesky',
    };

    // Cache result
    if (!cursor) {
      await setCache(redis, cacheKey, result, CACHE_TTL.timeline);
    }

    // Apply language filter
    if (language) {
      result.posts = posts.filter(p => p.language === language || !p.language);
    }

    return result;
  } catch (error) {
    console.error('Error fetching Bluesky user posts:', error);
    return { posts: [], platform: 'bluesky' };
  }
}

// ============================================
// MASTODON SERVICE
// ============================================

interface MastodonPost {
  id: string;
  uri: string;
  url: string;
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
    url: string;
  };
  content: string;
  created_at: string;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  media_attachments: Array<{
    type: string;
    url: string;
    preview_url: string;
  }>;
  reblog?: MastodonPost;
}

export async function fetchMastodonFeed(
  instance: string = 'mastodon.social',
  timeline: 'public' | 'local' = 'public',
  options: FeedOptions = {}
): Promise<ExternalFeedResult> {
  const { limit = 20, cursor: maxId, language, redis } = options;

  // Try cache first
  const cacheKey = `external:masto:${instance}:${timeline}:${limit}:${maxId || 'first'}`;
  if (!maxId) {
    const cached = await getCached<ExternalFeedResult>(redis, cacheKey);
    if (cached) {
      let posts = cached.posts;
      if (language) {
        posts = posts.filter(p => p.language === language || !p.language);
      }
      return { ...cached, posts, cached: true };
    }
  }

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    if (timeline === 'local') params.append('local', 'true');
    if (maxId) params.append('max_id', maxId);

    const response = await fetch(`https://${instance}/api/v1/timelines/public?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Mastodon API error:', response.status, await response.text());
      return { posts: [], platform: 'mastodon' };
    }

    const data: MastodonPost[] = await response.json();

    const posts: ExternalPost[] = data.map(post => {
      const actualPost = post.reblog || post;
      const isRepost = !!post.reblog;

      const mediaUrls = actualPost.media_attachments
        .filter(m => ['image', 'gifv', 'video'].includes(m.type))
        .map(m => m.url || m.preview_url);

      // Strip HTML tags from content for plain text
      const plainContent = actualPost.content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p><p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      return {
        id: `masto_${instance}_${post.id}`,
        platform: 'mastodon' as const,
        externalId: post.uri,
        externalUrl: post.url,
        author: {
          id: actualPost.account.id,
          username: actualPost.account.acct.includes('@')
            ? actualPost.account.acct
            : `${actualPost.account.username}@${instance}`,
          displayName: actualPost.account.display_name || actualPost.account.username,
          avatar: actualPost.account.avatar,
          profileUrl: actualPost.account.url,
        },
        content: plainContent,
        contentHtml: actualPost.content,
        createdAt: actualPost.created_at,
        mediaUrls,
        replyCount: actualPost.replies_count,
        repostCount: actualPost.reblogs_count,
        likeCount: actualPost.favourites_count,
        isRepost,
        repostedBy: isRepost ? {
          username: post.account.acct,
          displayName: post.account.display_name || post.account.username,
        } : undefined,
        language: detectLanguage(plainContent),
      };
    });

    // Use the last post's ID as cursor for pagination
    const nextCursor = data.length > 0 ? data[data.length - 1].id : undefined;

    const result: ExternalFeedResult = {
      posts,
      nextCursor,
      platform: 'mastodon',
    };

    // Cache result
    if (!maxId) {
      await setCache(redis, cacheKey, result, CACHE_TTL.timeline);
    }

    // Apply language filter
    if (language) {
      result.posts = posts.filter(p => p.language === language || !p.language);
    }

    return result;
  } catch (error) {
    console.error('Error fetching Mastodon feed:', error);
    return { posts: [], platform: 'mastodon' };
  }
}

// Fetch trending posts from Mastodon
export async function fetchMastodonTrending(
  instance: string = 'mastodon.social',
  options: FeedOptions & { offset?: number } = {}
): Promise<ExternalFeedResult> {
  const { limit = 20, offset = 0, language, redis } = options;

  // Try cache first
  const cacheKey = `external:masto:${instance}:trending:${limit}:${offset}`;
  if (offset === 0) {
    const cached = await getCached<ExternalFeedResult>(redis, cacheKey);
    if (cached) {
      let posts = cached.posts;
      if (language) {
        posts = posts.filter(p => p.language === language || !p.language);
      }
      return { ...cached, posts, cached: true };
    }
  }

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(`https://${instance}/api/v1/trends/statuses?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      // Fallback to public timeline if trending not available
      return fetchMastodonFeed(instance, 'public', options);
    }

    const data: MastodonPost[] = await response.json();

    const posts: ExternalPost[] = data.map(post => {
      const mediaUrls = post.media_attachments
        .filter(m => ['image', 'gifv', 'video'].includes(m.type))
        .map(m => m.url || m.preview_url);

      const plainContent = post.content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p><p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      return {
        id: `masto_${instance}_${post.id}`,
        platform: 'mastodon' as const,
        externalId: post.uri,
        externalUrl: post.url,
        author: {
          id: post.account.id,
          username: post.account.acct.includes('@')
            ? post.account.acct
            : `${post.account.username}@${instance}`,
          displayName: post.account.display_name || post.account.username,
          avatar: post.account.avatar,
          profileUrl: post.account.url,
        },
        content: plainContent,
        contentHtml: post.content,
        createdAt: post.created_at,
        mediaUrls,
        replyCount: post.replies_count,
        repostCount: post.reblogs_count,
        likeCount: post.favourites_count,
        isRepost: false,
        language: detectLanguage(plainContent),
      };
    });

    const result: ExternalFeedResult = {
      posts,
      nextCursor: offset + limit > 0 ? String(offset + limit) : undefined,
      platform: 'mastodon',
    };

    // Cache result
    if (offset === 0) {
      await setCache(redis, cacheKey, result, CACHE_TTL.discover);
    }

    // Apply language filter
    if (language) {
      result.posts = posts.filter(p => p.language === language || !p.language);
    }

    return result;
  } catch (error) {
    console.error('Error fetching Mastodon trending:', error);
    return { posts: [], platform: 'mastodon' };
  }
}

// ============================================
// POST THREAD/REPLIES
// ============================================

export interface ExternalComment {
  id: string;
  author: {
    username: string;
    displayName: string;
    avatar: string | null;
  };
  content: string;
  createdAt: string;
  likeCount: number;
  replyCount: number;
}

export interface ExternalThreadResult {
  replies: ExternalComment[];
  platform: 'bluesky' | 'mastodon';
}

// Fetch replies to a Bluesky post
export async function fetchBlueskyThread(postUri: string): Promise<ExternalThreadResult> {
  try {
    const params = new URLSearchParams({
      uri: postUri,
      depth: '1', // Just direct replies
    });

    const response = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getPostThread?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Bluesky thread error:', response.status);
      return { replies: [], platform: 'bluesky' };
    }

    const data = await response.json();
    const replies: ExternalComment[] = [];

    // Extract replies from thread
    if (data.thread?.replies) {
      for (const reply of data.thread.replies) {
        if (reply.post) {
          replies.push({
            id: reply.post.cid,
            author: {
              username: reply.post.author.handle,
              displayName: reply.post.author.displayName || reply.post.author.handle,
              avatar: reply.post.author.avatar || null,
            },
            content: reply.post.record?.text || '',
            createdAt: reply.post.record?.createdAt || new Date().toISOString(),
            likeCount: reply.post.likeCount || 0,
            replyCount: reply.post.replyCount || 0,
          });
        }
      }
    }

    return { replies, platform: 'bluesky' };
  } catch (error) {
    console.error('Error fetching Bluesky thread:', error);
    return { replies: [], platform: 'bluesky' };
  }
}

// Fetch replies to a Mastodon post
export async function fetchMastodonContext(
  instance: string,
  statusId: string
): Promise<ExternalThreadResult> {
  try {
    const response = await fetch(`https://${instance}/api/v1/statuses/${statusId}/context`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Mastodon context error:', response.status);
      return { replies: [], platform: 'mastodon' };
    }

    const data = await response.json();
    const replies: ExternalComment[] = [];

    // Extract descendants (replies)
    if (data.descendants) {
      for (const post of data.descendants) {
        const plainContent = post.content
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p><p>/gi, '\n\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();

        replies.push({
          id: post.id,
          author: {
            username: post.account.acct,
            displayName: post.account.display_name || post.account.username,
            avatar: post.account.avatar || null,
          },
          content: plainContent,
          createdAt: post.created_at,
          likeCount: post.favourites_count || 0,
          replyCount: post.replies_count || 0,
        });
      }
    }

    return { replies, platform: 'mastodon' };
  } catch (error) {
    console.error('Error fetching Mastodon context:', error);
    return { replies: [], platform: 'mastodon' };
  }
}

// ============================================
// COMBINED FEED
// ============================================

export async function fetchCombinedFeed(
  sources: Array<{ platform: 'bluesky' | 'mastodon'; config?: any }>,
  options: FeedOptions = {}
): Promise<ExternalPost[]> {
  const { limit = 20, language, redis } = options;

  // Cache key for combined feed
  const sourceKey = sources.map(s => `${s.platform}:${s.config?.instance || 'default'}`).join('|');
  const cacheKey = `external:combined:${sourceKey}:${limit}`;

  const cached = await getCached<{ posts: ExternalPost[] }>(redis, cacheKey);
  if (cached) {
    let posts = cached.posts;
    if (language) {
      posts = posts.filter(p => p.language === language || !p.language);
    }
    return posts;
  }

  const results = await Promise.all(
    sources.map(async source => {
      if (source.platform === 'bluesky') {
        return fetchBlueskyDiscover({ limit, redis });
      } else {
        return fetchMastodonFeed(
          source.config?.instance || 'mastodon.social',
          'public',
          { limit, redis }
        );
      }
    })
  );

  // Combine and sort by date
  const allPosts = results.flatMap(r => r.posts);
  allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const posts = allPosts.slice(0, limit);

  // Cache result
  await setCache(redis, cacheKey, { posts }, CACHE_TTL.combined);

  // Apply language filter
  if (language) {
    return posts.filter(p => p.language === language || !p.language);
  }

  return posts;
}
