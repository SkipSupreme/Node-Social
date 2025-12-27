import { PrismaClient } from '@prisma/client';
import { scrapeArticle, isScrapeable } from './articleScraper.js';

const prisma = new PrismaClient();

async function main() {
  // Find all dev.to posts that need fixing
  const devToPosts = await prisma.post.findMany({
    where: {
      linkUrl: { contains: 'dev.to' },
      deletedAt: null
    },
    select: { id: true, title: true, content: true, linkUrl: true, mediaUrl: true }
  });

  console.log(`Found ${devToPosts.length} dev.to posts to check\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of devToPosts) {
    // Fix if: no content, short content (<3000 chars likely truncated), HTML tags present, or no image
    const needsFix =
      !post.content ||
      post.content.length < 3000 ||
      post.content.includes('<img') ||
      post.content.includes('src=') ||
      post.content.includes('media2.dev.to') ||
      !post.mediaUrl;

    if (!needsFix) {
      console.log(`✓ OK: ${post.title?.slice(0, 50)}`);
      skipped++;
      continue;
    }

    console.log(`\n🔄 Fixing: ${post.title?.slice(0, 50)}`);
    console.log(`   Current content length: ${post.content?.length || 0}`);
    console.log(`   Current mediaUrl: ${post.mediaUrl || 'none'}`);

    if (!post.linkUrl || !isScrapeable(post.linkUrl)) {
      console.log(`   ⚠️ Not scrapeable, skipping`);
      skipped++;
      continue;
    }

    try {
      const article = await scrapeArticle(post.linkUrl);

      if (!article || !article.content) {
        console.log(`   ❌ Scrape returned no content`);
        failed++;
        continue;
      }

      const updates: any = {};

      if (article.content && article.content.length > (post.content?.length || 0)) {
        updates.content = article.content;
        console.log(`   �� New content length: ${article.content.length}`);
      }

      if (article.leadImage && !post.mediaUrl) {
        updates.mediaUrl = article.leadImage;
        console.log(`   🖼️ New mediaUrl: ${article.leadImage.slice(0, 60)}...`);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: updates
        });
        console.log(`   ✅ Fixed!`);
        fixed++;
      } else {
        console.log(`   ⚠️ No improvements found`);
        skipped++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Fixed:   ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
  console.log(`=============================`);
}

main().finally(() => prisma.$disconnect());
