// Tier 5: External Platform Integration
// Fetch posts from Bluesky and Mastodon for cross-platform feeds

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
}

export interface ExternalFeedResult {
  posts: ExternalPost[];
  nextCursor?: string;
  platform: 'bluesky' | 'mastodon';
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
  limit: number = 20,
  cursor?: string
): Promise<ExternalFeedResult> {
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
        content: post.record.text,
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
      };
    });

    return {
      posts,
      nextCursor: data.cursor,
      platform: 'bluesky',
    };
  } catch (error) {
    console.error('Error fetching Bluesky feed:', error);
    return { posts: [], platform: 'bluesky' };
  }
}

// Fetch Bluesky "Discover" feed (popular posts)
export async function fetchBlueskyDiscover(limit: number = 20, cursor?: string): Promise<ExternalFeedResult> {
  return fetchBlueskyFeed(
    'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
    limit,
    cursor
  );
}

// Fetch posts from a specific Bluesky user
export async function fetchBlueskyUserPosts(
  handle: string,
  limit: number = 20,
  cursor?: string
): Promise<ExternalFeedResult> {
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
        content: post.record.text,
        createdAt: post.record.createdAt,
        mediaUrls,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        likeCount: post.likeCount || 0,
        isRepost: false,
      };
    });

    return {
      posts,
      nextCursor: data.cursor,
      platform: 'bluesky',
    };
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
  limit: number = 20,
  maxId?: string
): Promise<ExternalFeedResult> {
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
      };
    });

    // Use the last post's ID as cursor for pagination
    const nextCursor = data.length > 0 ? data[data.length - 1].id : undefined;

    return {
      posts,
      nextCursor,
      platform: 'mastodon',
    };
  } catch (error) {
    console.error('Error fetching Mastodon feed:', error);
    return { posts: [], platform: 'mastodon' };
  }
}

// Fetch trending posts from Mastodon
export async function fetchMastodonTrending(
  instance: string = 'mastodon.social',
  limit: number = 20,
  offset: number = 0
): Promise<ExternalFeedResult> {
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
      return fetchMastodonFeed(instance, 'public', limit);
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
      };
    });

    return {
      posts,
      nextCursor: offset + limit > 0 ? String(offset + limit) : undefined,
      platform: 'mastodon',
    };
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
  limit: number = 20
): Promise<ExternalPost[]> {
  const results = await Promise.all(
    sources.map(async source => {
      if (source.platform === 'bluesky') {
        return fetchBlueskyDiscover(limit);
      } else {
        return fetchMastodonFeed(source.config?.instance || 'mastodon.social', 'public', limit);
      }
    })
  );

  // Combine and sort by date
  const allPosts = results.flatMap(r => r.posts);
  allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return allPosts.slice(0, limit);
}
