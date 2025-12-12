#!/usr/bin/env npx tsx

/*
 * Content Harvester
 *
 * Runs every 15 minutes via cron to pull content from various sources
 * and add candidates to the CurationQueue for Claude to evaluate.
 *
 * Usage:
 *   npx tsx src/jobs/harvester.ts
 *   npm run harvest
 *
 * Cron (add to crontab -e):
 *   Every 15 min: cd /Users/joshhd/Documents/node-social/backend/api && npx tsx src/jobs/harvester.ts
 */

import { PrismaClient } from '@prisma/client';
import { createRedditHarvesters } from './harvesters/RedditHarvester.js';
import { HackerNewsHarvester } from './harvesters/HackerNewsHarvester.js';
import { createRSSHarvesters } from './harvesters/RSSHarvester.js';
import { BlueskyHarvester } from './harvesters/BlueskyHarvester.js';
import { YouTubeHarvester } from './harvesters/YouTubeHarvester.js';

const prisma = new PrismaClient();

interface HarvestStats {
  source: string;
  queued: number;
  skipped: number;
  errors: string[];
}

async function runHarvest(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HARVEST STARTED: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const allStats: HarvestStats[] = [];

  // Create all harvesters
  const harvesters = [
    ...createRedditHarvesters(prisma),
    new HackerNewsHarvester(prisma),
    ...createRSSHarvesters(prisma),
    new BlueskyHarvester(prisma),
    new YouTubeHarvester(prisma),
  ];

  // Run each harvester
  for (const harvester of harvesters) {
    const sourceType = (harvester as any).sourceType;
    console.log(`\n--- ${sourceType} ---`);

    try {
      const stats = await harvester.harvest();
      allStats.push({
        source: sourceType,
        queued: stats.queued,
        skipped: stats.skipped,
        errors: stats.errors,
      });

      if (stats.errors.length > 0) {
        console.log(`  ⚠ Errors: ${stats.errors.length}`);
        for (const err of stats.errors.slice(0, 3)) {
          console.log(`    - ${err}`);
        }
      }

    } catch (err) {
      console.error(`  ✗ FATAL:`, err);
      allStats.push({
        source: sourceType,
        queued: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalQueued = allStats.reduce((sum, s) => sum + s.queued, 0);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = allStats.reduce((sum, s) => sum + s.errors.length, 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`HARVEST COMPLETE: ${elapsed}s`);
  console.log(`  Queued: ${totalQueued} | Skipped (dupes): ${totalSkipped} | Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get queue stats
  const queueStats = await prisma.curationQueue.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log('Queue Status:');
  for (const stat of queueStats) {
    console.log(`  ${stat.status}: ${stat._count}`);
  }
}

// Run and exit
runHarvest()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Harvest failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
