import { PrismaClient, Prisma } from '@prisma/client';

type CurationQueue = Prisma.CurationQueueGetPayload<{}>;
export type HarvestCursor = Prisma.HarvestCursorGetPayload<{}>;

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
        metadata: metadata || undefined,
      },
      create: {
        sourceType: sourceKey,
        lastSeenId,
        lastRunAt: new Date(),
        metadata: metadata || undefined,
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

    return this.prisma.curationQueue.create({
      data: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        sourceScore: item.sourceScore,
        subreddit: item.subreddit,
        title: item.title,
        content: item.content,
        linkUrl: item.linkUrl,
        mediaUrl: item.mediaUrl,
        suggestedNode: item.suggestedNode,
        status: 'pending',
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
