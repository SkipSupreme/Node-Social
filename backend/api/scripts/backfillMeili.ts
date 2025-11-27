// scripts/backfillMeili.ts
// Backfill all posts to MeiliSearch index
// Usage: npx tsx scripts/backfillMeili.ts

import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import dotenv from 'dotenv';

// Load env from the correct path
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();
const meili = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || '',
});

const BATCH_SIZE = 100;

async function main() {
  console.log('🔍 Starting MeiliSearch backfill...\n');

  // Check MeiliSearch health
  try {
    const health = await meili.health();
    console.log('✅ MeiliSearch is healthy:', health.status);
  } catch (error) {
    console.error('❌ MeiliSearch is not available. Make sure it\'s running.');
    console.error('   Run: docker-compose up -d meilisearch');
    process.exit(1);
  }

  // Create/get index
  const index = meili.index('posts');

  // Ensure index exists
  try {
    await meili.createIndex('posts', { primaryKey: 'id' });
    console.log('📦 Created new posts index');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('📦 Using existing posts index');
    } else {
      throw e;
    }
  }

  // Configure index settings
  console.log('⚙️  Configuring index settings...');
  await index.updateSettings({
    searchableAttributes: ['searchableContent', 'title', 'content', 'authorUsername', 'nodeName'],
    filterableAttributes: ['authorId', 'nodeId', 'nodeSlug', 'postType', 'createdAt'],
    sortableAttributes: ['createdAt', 'updatedAt'],
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'createdAt:desc', // Prefer newer posts
    ],
  });

  // Wait for settings to apply
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Count total posts
  const totalCount = await prisma.post.count({
    where: { deletedAt: null },
  });
  console.log(`\n📊 Found ${totalCount} posts to index\n`);

  if (totalCount === 0) {
    console.log('No posts to index. Done!');
    return;
  }

  // Process in batches using offset pagination
  let processed = 0;

  while (processed < totalCount) {
    const posts = await prisma.post.findMany({
      where: { deletedAt: null },
      take: BATCH_SIZE,
      skip: processed,
      orderBy: { id: 'asc' },
      include: {
        author: { select: { id: true, username: true } },
        node: { select: { id: true, slug: true, name: true } },
      },
    });

    if (posts.length === 0) break;

    const documents = posts.map((post) => ({
      id: post.id,
      content: post.content,
      title: post.title || '',
      authorId: post.authorId,
      authorUsername: post.author?.username || '',
      nodeId: post.nodeId || '',
      nodeSlug: post.node?.slug || '',
      nodeName: post.node?.name || '',
      postType: post.postType,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      searchableContent: `${post.title || ''} ${post.content}`.toLowerCase(),
    }));

    const task = await index.addDocuments(documents);
    processed += posts.length;

    const percent = Math.round((processed / totalCount) * 100);
    console.log(`📝 Indexed ${processed}/${totalCount} posts (${percent}%) - Task: ${task.taskUid}`);
  }

  // Wait for tasks to complete
  console.log('\n⏳ Waiting for indexing to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify
  const stats = await index.getStats();
  console.log(`\n✅ Backfill complete!`);
  console.log(`   Documents indexed: ${stats.numberOfDocuments}`);
  console.log(`   Index is indexing: ${stats.isIndexing}`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
