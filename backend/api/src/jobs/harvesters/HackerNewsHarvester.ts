import { PrismaClient } from '@prisma/client';
import { BaseHarvester, type HarvestResult, type HarvestCursor } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  time: number;
  type: string;
  by: string;
}

export class HackerNewsHarvester extends BaseHarvester {
  constructor(prisma: PrismaClient) {
    super(prisma, 'hackernews');
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }> {
    const items: HarvestResult[] = [];
    const { minPoints, maxAgeHours } = THRESHOLDS.hackernews;
    const cutoffTime = Date.now() / 1000 - maxAgeHours * 60 * 60;

    try {
      // Fetch top stories
      const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const topStoryIds: number[] = await topStoriesRes.json();

      // Fetch details for top 50 stories
      const storiesToFetch = topStoryIds.slice(0, 50);

      for (const storyId of storiesToFetch) {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
          const item: HNItem = await itemRes.json();

          if (!item || item.type !== 'story') continue;
          if (item.time < cutoffTime) continue;
          if (item.score < minPoints) continue;

          // Categorize based on title
          const suggestedNode = categorizeContent(item.title, item.text);

          items.push({
            sourceType: 'hackernews',
            sourceId: String(item.id),
            sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
            sourceScore: item.score,
            title: item.title,
            content: item.text || undefined,
            linkUrl: item.url || undefined,
            suggestedNode: suggestedNode || 'technology', // Default to tech
          });

        } catch (err) {
          // Skip individual story errors
          continue;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`  → Hacker News: ${items.length} candidates`);

      // Use highest story ID as cursor
      const newCursor = storiesToFetch.length > 0 ? String(Math.max(...storiesToFetch)) : undefined;

      return { items, newCursor };

    } catch (err) {
      console.error('  ✗ Hacker News:', err);
      return { items };
    }
  }
}
