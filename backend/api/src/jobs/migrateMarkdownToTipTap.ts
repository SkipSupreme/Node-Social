/**
 * Migration script to convert existing markdown posts to TipTap JSON format.
 *
 * Run with: npx tsx src/jobs/migrateMarkdownToTipTap.ts
 *
 * Options:
 *   --dry-run    Preview changes without writing to database
 *   --limit N    Process only N posts
 *   --verbose    Show detailed progress
 */

import { PrismaClient } from '@prisma/client';
import { markdownToTipTap, tipTapToPlainText } from '../lib/markdownToTipTap.js';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ postId: string; error: string }>;
}

async function migrateMarkdownToTipTap(options: {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
} = {}) {
  const { dryRun = false, limit, verbose = false } = options;

  console.log('🚀 Starting markdown to TipTap migration');
  if (dryRun) {
    console.log('  (DRY RUN - no changes will be written)');
  }

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get total count
  const totalCount = await prisma.post.count({
    where: {
      contentFormat: 'markdown',
      content: { not: null },
    },
  });
  console.log(`📊 Found ${totalCount} posts with markdown content`);

  if (limit) {
    console.log(`  (Processing limited to ${limit} posts)`);
  }

  const batchSize = 100;
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    // Fetch batch of posts
    const posts = await prisma.post.findMany({
      where: {
        contentFormat: 'markdown',
        content: { not: null },
      },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        content: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (posts.length === 0) break;

    for (const post of posts) {
      stats.total++;
      processed++;

      // Check limit
      if (limit && processed > limit) {
        console.log(`\n⏹️  Reached limit of ${limit} posts`);
        break;
      }

      try {
        if (!post.content) {
          stats.skipped++;
          continue;
        }

        // Convert markdown to TipTap JSON
        const tiptapJson = markdownToTipTap(post.content);

        // Verify conversion by extracting text back
        const extractedText = tipTapToPlainText(tiptapJson);

        if (verbose) {
          console.log(`\n📝 Post ${post.id}:`);
          console.log(`   Title: ${post.title?.substring(0, 50) || '(no title)'}...`);
          console.log(`   Original length: ${post.content.length} chars`);
          console.log(`   Extracted length: ${extractedText.length} chars`);
          console.log(`   JSON nodes: ${tiptapJson.content.length}`);
        }

        if (!dryRun) {
          // Update post with TipTap JSON
          // Cast to any to satisfy Prisma's InputJsonValue type constraint
          await prisma.post.update({
            where: { id: post.id },
            data: {
              contentJson: tiptapJson as any,
              contentFormat: 'tiptap',
              // Keep original content as fallback
            },
          });
        }

        stats.migrated++;

        // Progress indicator
        if (processed % 100 === 0) {
          console.log(`  ✅ Processed ${processed}/${totalCount} posts...`);
        }
      } catch (err) {
        stats.failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        stats.errors.push({ postId: post.id, error: errorMessage });

        if (verbose) {
          console.error(`  ❌ Failed to migrate post ${post.id}: ${errorMessage}`);
        }
      }
    }

    // Check if we've reached the limit
    if (limit && processed >= limit) break;

    const lastPost = posts[posts.length - 1];
    if (!lastPost) break;
    cursor = lastPost.id;
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 Migration Summary');
  console.log('='.repeat(50));
  console.log(`Total posts processed: ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped (no content): ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const { postId, error } of stats.errors.slice(0, 10)) {
      console.log(`  - Post ${postId}: ${error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }

  return stats;
}

// Parse command line arguments
function parseArgs(): { dryRun: boolean; limit?: number; verbose: boolean } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--verbose') {
      verbose = true;
    } else if (args[i] === '--limit') {
      const limitArg = args[i + 1];
      if (limitArg != null) {
        limit = parseInt(limitArg, 10);
      }
      i++;
    }
  }

  return { dryRun, ...(limit != null && { limit }), verbose };
}

// Main entry point
async function main() {
  const options = parseArgs();

  try {
    await migrateMarkdownToTipTap(options);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
