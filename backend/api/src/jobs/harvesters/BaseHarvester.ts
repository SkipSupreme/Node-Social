import { PrismaClient, Prisma } from '@prisma/client';

type CurationQueue = Prisma.CurationQueueGetPayload<{}>;
export type HarvestCursor = Prisma.HarvestCursorGetPayload<{}>;

// Simple heuristic to detect if text is likely English
// Checks for common English words and character patterns
export function isLikelyEnglish(text: string): boolean {
  if (!text || text.length < 10) return true; // Too short to detect

  const lower = text.toLowerCase();

  // Common English words that appear frequently
  const englishMarkers = [
    ' the ', ' a ', ' is ', ' are ', ' was ', ' were ', ' to ', ' in ', ' on ',
    ' for ', ' with ', ' that ', ' this ', ' it ', ' and ', ' or ', ' of ',
    ' how ', ' what ', ' when ', ' where ', ' why ', ' who ', ' you ', ' your ',
    ' can ', ' will ', ' would ', ' could ', ' should ', ' have ', ' has ', ' had ',
  ];

  // Count how many English markers appear
  let markerCount = 0;
  for (const marker of englishMarkers) {
    if (lower.includes(marker)) markerCount++;
  }

  // If at least 3 markers found, likely English
  if (markerCount >= 3) return true;

  // Check for non-Latin scripts (Cyrillic, CJK, Arabic, etc.)
  const nonLatinPattern = /[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF\u0980-\u09FF\u0900-\u097F\u3040-\u30FF\uAC00-\uD7AF]/;
  if (nonLatinPattern.test(text)) {
    // Has non-Latin characters - check if substantial portion
    const nonLatinMatches = text.match(nonLatinPattern);
    if (nonLatinMatches && nonLatinMatches.length > 5) return false;
  }

  // Default to true if we can't determine
  return true;
}

export interface HarvestResult {
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  sourceScore?: number;
  subreddit?: string;
  title: string;
  content?: string;
  linkUrl?: string;
  mediaUrl?: string;
  galleryUrls?: string[]; // For Reddit galleries and multi-image posts
  suggestedNode?: string;
}

export abstract class BaseHarvester {
  protected prisma: PrismaClient;
  protected sourceType: string;

  constructor(prisma: PrismaClient, sourceType: string) {
    this.prisma = prisma;
    this.sourceType = sourceType;
  }

  // Abstract method - each harvester implements its own fetch logic
  abstract fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }>;

  // Get or create cursor for this source
  async getCursor(sourceKey: string): Promise<HarvestCursor | null> {
    return this.prisma.harvestCursor.findUnique({
      where: { sourceType: sourceKey },
    });
  }

  // Update cursor after successful fetch
  async updateCursor(sourceKey: string, lastSeenId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.prisma.harvestCursor.upsert({
      where: { sourceType: sourceKey },
      update: {
        lastSeenId,
        lastRunAt: new Date(),
        ...(metadata != null && { metadata: metadata as Prisma.InputJsonValue }),
      },
      create: {
        sourceType: sourceKey,
        lastSeenId,
        lastRunAt: new Date(),
        ...(metadata != null && { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  }

  // Check if item already exists in queue
  async isDuplicate(sourceType: string, sourceId: string): Promise<boolean> {
    const existing = await this.prisma.curationQueue.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType,
          sourceId,
        },
      },
    });
    return existing !== null;
  }

  // Add item to curation queue
  async queueItem(item: HarvestResult): Promise<CurationQueue | null> {
    // Check for duplicate
    if (await this.isDuplicate(item.sourceType, item.sourceId)) {
      return null;
    }

    // Filter out non-English content
    const textToCheck = `${item.title} ${item.content || ''}`;
    if (!isLikelyEnglish(textToCheck)) {
      console.log(`  ⊘ Skipped (non-English): ${item.title.slice(0, 40)}...`);
      return null;
    }

    return this.prisma.curationQueue.create({
      data: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        galleryUrls: item.galleryUrls || [],
        status: 'pending',
        ...(item.sourceScore != null && { sourceScore: item.sourceScore }),
        ...(item.subreddit != null && { subreddit: item.subreddit }),
        ...(item.content != null && { content: item.content }),
        ...(item.linkUrl != null && { linkUrl: item.linkUrl }),
        ...(item.mediaUrl != null && { mediaUrl: item.mediaUrl }),
        ...(item.suggestedNode != null && { suggestedNode: item.suggestedNode }),
      },
    });
  }

  // Main harvest loop
  async harvest(): Promise<{ queued: number; skipped: number; errors: string[] }> {
    const stats = { queued: 0, skipped: 0, errors: [] as string[] };

    try {
      const cursor = await this.getCursor(this.sourceType);
      const { items, newCursor, metadata } = await this.fetchItems(cursor);

      for (const item of items) {
        try {
          const result = await this.queueItem(item);
          if (result) {
            stats.queued++;
            console.log(`  ✓ Queued: ${item.title.slice(0, 60)}...`);
          } else {
            stats.skipped++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.errors.push(`Failed to queue "${item.title.slice(0, 30)}...": ${msg}`);
        }
      }

      // Update cursor if we got new items
      if (newCursor) {
        await this.updateCursor(this.sourceType, newCursor, metadata);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`Harvest failed: ${msg}`);
    }

    return stats;
  }
}
