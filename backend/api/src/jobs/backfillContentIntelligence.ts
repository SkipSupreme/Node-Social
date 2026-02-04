/**
 * Backfill Content Intelligence fields for existing posts
 * Tier 2: Add textLength, textDensity, and mediaType to all posts
 *
 * Run with: npx tsx src/jobs/backfillContentIntelligence.ts
 */

import { PrismaClient } from '@prisma/client';
import { analyzePost } from '../lib/contentIntelligence.js';

const prisma = new PrismaClient();

async function backfillContentIntelligence() {
  console.log('Starting content intelligence backfill...');

  // Count posts that need updating
  const totalPosts = await prisma.post.count({
    where: {
      OR: [
        { textLength: null },
        { textDensity: null },
      ],
    },
  });

  console.log(`Found ${totalPosts} posts that need content intelligence fields`);

  if (totalPosts === 0) {
    console.log('All posts already have content intelligence fields!');
    return;
  }

  const batchSize = 100;
  let processed = 0;
  let cursor: string | undefined;

  while (processed < totalPosts) {
    // Fetch batch of posts
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { textLength: null },
          { textDensity: null },
        ],
      },
      select: {
        id: true,
        content: true,
        mediaUrl: true,
        postType: true,
      },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (posts.length === 0) break;

    // Update each post
    for (const post of posts) {
      const { textLength, textDensity, mediaType } = analyzePost({
        content: post.content,
        mediaUrl: post.mediaUrl,
        postType: post.postType,
      });

      await prisma.post.update({
        where: { id: post.id },
        data: {
          textLength,
          textDensity,
          mediaType,
        },
      });

      processed++;
    }

    cursor = posts[posts.length - 1].id;
    console.log(`Processed ${processed}/${totalPosts} posts (${Math.round(processed / totalPosts * 100)}%)`);
  }

  console.log(`\nBackfill complete! Processed ${processed} posts.`);

  // Summary stats
  const stats = await prisma.post.groupBy({
    by: ['textDensity'],
    _count: true,
  });

  console.log('\nText density distribution:');
  stats.forEach(s => {
    console.log(`  ${s.textDensity || 'null'}: ${s._count}`);
  });

  const mediaStats = await prisma.post.groupBy({
    by: ['mediaType'],
    _count: true,
  });

  console.log('\nMedia type distribution:');
  mediaStats.forEach(s => {
    console.log(`  ${s.mediaType || 'null'}: ${s._count}`);
  });
}

backfillContentIntelligence()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
