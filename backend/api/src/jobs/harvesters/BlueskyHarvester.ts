import { PrismaClient } from '@prisma/client';
import { BaseHarvester, type HarvestResult, type HarvestCursor } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

// Bluesky AT Protocol types (simplified)
interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: {
      $type: string;
      external?: {
        uri: string;
        title: string;
        description?: string;
        thumb?: { ref: { $link: string } };
      };
      images?: Array<{
        alt?: string;
        image: { ref: { $link: string } };
      }>;
    };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

interface BlueskyFeedResponse {
  feed: Array<{
    post: BlueskyPost;
  }>;
  cursor?: string;
}

export class BlueskyHarvester extends BaseHarvester {
  constructor(prisma: PrismaClient) {
    super(prisma, 'bluesky');
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];
    const { minLikes, maxAgeHours } = THRESHOLDS.bluesky;
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    try {
      // Fetch from "What's Hot" feed (public, no auth needed)
      const url = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?' +
        new URLSearchParams({
          feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
          limit: '50',
        });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeSocial/1.0 (Content Curator)',
        },
      });

      if (!response.ok) {
        // Bluesky might require auth for some feeds
        console.error(`  ✗ Bluesky: ${response.status} - may need auth`);
        return { items };
      }

      const data: BlueskyFeedResponse = await response.json();

      for (const { post } of data.feed) {
        // Check age
        const createdAt = new Date(post.record.createdAt);
        if (createdAt < cutoffTime) continue;

        // Check engagement
        const likes = post.likeCount || 0;
        if (likes < minLikes) continue;

        // Extract link if present
        let linkUrl: string | undefined;
        const fullText = post.record.text;
        const firstLine = (fullText.split('\n')[0] ?? '').slice(0, 200);
        let title = firstLine;
        let content: string | undefined;

        if (post.record.embed?.external) {
          linkUrl = post.record.embed.external.uri;
          title = post.record.embed.external.title || title;
          // Use external description as content if available, otherwise use remaining text
          content = post.record.embed.external.description ||
            (fullText.length > firstLine.length ? fullText.slice(firstLine.length).trim() : undefined);
        } else {
          // For posts without external links, only set content if there's more than the title
          content = fullText.length > firstLine.length ? fullText.slice(firstLine.length).trim() : undefined;
        }

        // Extract media - use full size image, not thumbnail
        let mediaUrl: string | undefined;
        if (post.record.embed?.images?.[0]) {
          const img = post.record.embed.images[0];
          if (img.image?.ref?.$link) {
            // Use feed_fullsize for better quality
            mediaUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${post.author.did}/${img.image.ref.$link}@jpeg`;
          }
        }

        // Extract post ID from URI
        const postId = post.uri.split('/').pop() || post.cid;

        // Categorize
        const suggestedNode = categorizeContent(title, fullText);

        items.push({
          sourceType: 'bluesky',
          sourceId: postId,
          sourceUrl: `https://bsky.app/profile/${post.author.handle}/post/${postId}`,
          sourceScore: likes,
          title,
          ...(content != null && { content }),
          ...(linkUrl != null && { linkUrl }),
          ...(mediaUrl != null && { mediaUrl }),
          ...(suggestedNode != null && { suggestedNode }),
        });
      }

      console.log(`  → Bluesky: ${items.length} candidates`);

      return { items, ...(data.cursor != null && { newCursor: data.cursor }) };

    } catch (err) {
      console.error('  ✗ Bluesky:', err);
      return { items };
    }
  }
}
