import { PrismaClient } from '@prisma/client';
import { BaseHarvester, type HarvestResult, type HarvestCursor } from './BaseHarvester.js';
import { REDDIT_SOURCES, THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface RedditPost {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    subreddit: string;
    score: number;
    created_utc: number;
    is_self: boolean;
    stickied: boolean;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source: { url: string };
      }>;
    };
    media?: {
      reddit_video?: { fallback_url: string };
    };
  };
}

interface RedditResponse {
  kind: string;
  data: {
    children: RedditPost[];
    after?: string;
  };
}

export class RedditHarvester extends BaseHarvester {
  private targetNode: string;
  private subreddits: string[];

  constructor(prisma: PrismaClient, targetNode: string) {
    super(prisma, `reddit:${targetNode}`);
    this.targetNode = targetNode;
    this.subreddits = REDDIT_SOURCES[targetNode] || [];
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }> {
    const items: HarvestResult[] = [];
    const { minUpvotes, maxAgeHours } = THRESHOLDS.reddit;
    const cutoffTime = Date.now() / 1000 - maxAgeHours * 60 * 60;

    for (const subreddit of this.subreddits) {
      try {
        // Fetch hot posts from subreddit (no auth needed for public data)
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`  ✗ Reddit r/${subreddit}: ${response.status}`);
          continue;
        }

        const data: RedditResponse = await response.json();
        let subredditCount = 0;

        for (const post of data.data.children) {
          const p = post.data;

          // Skip stickied posts
          if (p.stickied) continue;

          // Skip if too old or not enough upvotes
          if (p.created_utc < cutoffTime) continue;
          if (p.score < minUpvotes) continue;

          // Determine the link URL
          let linkUrl: string | undefined;
          if (!p.is_self && p.url && !p.url.includes('reddit.com')) {
            linkUrl = p.url;
          }

          // Get media URL if available
          let mediaUrl: string | undefined;
          if (p.preview?.images?.[0]?.source?.url) {
            mediaUrl = p.preview.images[0].source.url.replace(/&amp;/g, '&');
          } else if (p.media?.reddit_video?.fallback_url) {
            mediaUrl = p.media.reddit_video.fallback_url;
          }

          // Use keyword matching or default to target node
          const suggestedNode = categorizeContent(p.title, p.selftext) || this.targetNode;

          items.push({
            sourceType: 'reddit',
            sourceId: p.id,
            sourceUrl: `https://reddit.com${p.permalink}`,
            sourceScore: p.score,
            subreddit: p.subreddit,
            title: p.title,
            content: p.selftext || undefined,
            linkUrl,
            mediaUrl,
            suggestedNode,
          });
          subredditCount++;
        }

        console.log(`  → r/${subreddit}: ${subredditCount} candidates`);

        // Be nice to Reddit API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`  ✗ Reddit r/${subreddit}:`, err);
      }
    }

    return { items };
  }
}

// Factory function to create harvesters for all configured nodes
export function createRedditHarvesters(prisma: PrismaClient): RedditHarvester[] {
  return Object.keys(REDDIT_SOURCES)
    .filter(node => REDDIT_SOURCES[node].length > 0)
    .map(node => new RedditHarvester(prisma, node));
}
