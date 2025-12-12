import { PrismaClient } from '@prisma/client';
import { BaseHarvester, type HarvestResult, type HarvestCursor } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
}

// Search queries for nodes
const YOUTUBE_QUERIES: Record<string, string[]> = {
  'technology': ['tech news today', 'technology explained'],
  'science': ['science news', 'science explained'],
  'programming': ['programming tutorial', 'coding explained'],
  'ai': ['artificial intelligence news', 'machine learning tutorial'],
  'godot': ['godot tutorial', 'godot game dev'],
  'blender': ['blender tutorial', 'blender 3d'],
  'math': ['mathematics explained', 'math proof'],
  'astronomy': ['space news', 'astronomy explained'],
  'mtg': ['magic the gathering', 'mtg commander'],
  'graphic-design': ['graphic design tutorial'],
  'ui-ux': ['ui ux design tutorial', 'figma tutorial'],
  'art': ['digital art tutorial', 'digital painting'],
  'spirituality': ['meditation guide', 'mindfulness practice'],
};

export class YouTubeHarvester extends BaseHarvester {
  private apiKey: string | undefined;

  constructor(prisma: PrismaClient) {
    super(prisma, 'youtube');
    this.apiKey = process.env.YOUTUBE_API_KEY;
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];

    if (!this.apiKey) {
      console.log('  ⚠ YouTube: No API key configured (YOUTUBE_API_KEY)');
      return { items };
    }

    const { maxAgeHours } = THRESHOLDS.youtube;
    const publishedAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    // Search by queries
    for (const [nodeSlug, queries] of Object.entries(YOUTUBE_QUERIES)) {
      for (const query of queries) {
        try {
          const url = 'https://www.googleapis.com/youtube/v3/search?' +
            new URLSearchParams({
              part: 'snippet',
              q: query,
              type: 'video',
              maxResults: '10',
              order: 'viewCount',
              publishedAfter,
              key: this.apiKey,
            });

          const response = await fetch(url);
          if (!response.ok) {
            console.error(`  ✗ YouTube search "${query}": ${response.status}`);
            continue;
          }

          const data: YouTubeSearchResponse = await response.json();

          for (const video of data.items) {
            const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
            const thumbnail = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url;

            items.push({
              sourceType: 'youtube',
              sourceId: video.id.videoId,
              sourceUrl: videoUrl,
              title: video.snippet.title,
              content: video.snippet.description?.slice(0, 500),
              linkUrl: videoUrl,
              mediaUrl: thumbnail,
              suggestedNode: nodeSlug,
            });
          }

          console.log(`  → YouTube "${query}": ${data.items.length} videos`);

          // Rate limit (YouTube API has quotas)
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (err) {
          console.error(`  ✗ YouTube "${query}":`, err);
        }
      }
    }

    return { items };
  }
}
