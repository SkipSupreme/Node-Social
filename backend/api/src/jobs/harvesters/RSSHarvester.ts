import { PrismaClient } from '@prisma/client';
import { BaseHarvester, type HarvestResult, type HarvestCursor } from './BaseHarvester.js';
import { RSS_FEEDS, THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

// Simple RSS/Atom parser without external dependencies
interface FeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  content?: string;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle both regular tags and CDATA
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
  const match = xml.match(regex);
  if (match) {
    return match[1].trim();
  }
  // Try self-closing or attribute-based (like Atom links)
  const attrRegex = new RegExp(`<${tag}[^>]*href="([^"]*)"[^>]*/?>`, 'i');
  const attrMatch = xml.match(attrRegex);
  return attrMatch ? attrMatch[1] : null;
}

function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // Try RSS format first
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');

    if (title && link) {
      items.push({
        title,
        link,
        description: extractTag(itemXml, 'description') || undefined,
        pubDate: extractTag(itemXml, 'pubDate') || undefined,
        guid: extractTag(itemXml, 'guid') || undefined,
        content: extractTag(itemXml, 'content:encoded') || undefined,
      });
    }
  }

  // Try Atom format if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const title = extractTag(entryXml, 'title');
      const link = extractTag(entryXml, 'link');

      if (title && link) {
        items.push({
          title,
          link,
          description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content') || undefined,
          pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || undefined,
          guid: extractTag(entryXml, 'id') || undefined,
        });
      }
    }
  }

  return items;
}

export class RSSHarvester extends BaseHarvester {
  private targetNode: string;
  private feeds: string[];

  constructor(prisma: PrismaClient, targetNode: string) {
    super(prisma, `rss:${targetNode}`);
    this.targetNode = targetNode;
    this.feeds = RSS_FEEDS[targetNode] || [];
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];
    const { maxAgeHours } = THRESHOLDS.rss;
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const feedUrl of this.feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'NodeSocial/1.0 (Content Curator)',
          },
        });

        if (!response.ok) {
          console.error(`  ✗ RSS ${feedUrl}: ${response.status}`);
          continue;
        }

        const xml = await response.text();
        const feedItems = parseRSSItems(xml);
        let feedCount = 0;

        for (const item of feedItems) {
          // Check age
          if (item.pubDate) {
            const pubDate = new Date(item.pubDate);
            if (pubDate < cutoffTime) continue;
          }

          // Generate a unique ID from the link or guid
          const sourceId = item.guid || item.link || `${feedUrl}:${item.title}`;

          // Extract content
          const content = item.content || item.description || undefined;

          // Categorize
          const suggestedNode = categorizeContent(item.title, content) || this.targetNode;

          items.push({
            sourceType: 'rss',
            sourceId: Buffer.from(sourceId).toString('base64').slice(0, 100),
            sourceUrl: item.link,
            title: item.title,
            content: content?.slice(0, 2000), // Truncate long content
            linkUrl: item.link,
            suggestedNode,
          });
          feedCount++;
        }

        const hostname = new URL(feedUrl).hostname;
        console.log(`  → RSS ${hostname}: ${feedCount} items`);

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`  ✗ RSS ${feedUrl}:`, err);
      }
    }

    return { items };
  }
}

// Factory function
export function createRSSHarvesters(prisma: PrismaClient): RSSHarvester[] {
  return Object.keys(RSS_FEEDS)
    .filter(node => RSS_FEEDS[node].length > 0)
    .map(node => new RSSHarvester(prisma, node));
}
