import { PrismaClient } from '@prisma/client';
import { scrapeArticle, isScrapeable } from './articleScraper.js';

const prisma = new PrismaClient();

// Article domains that we want to rescrape for full formatted content
const ARTICLE_DOMAINS = [
  'techcrunch.com',
  'arstechnica.com',
  'theverge.com',
  'wired.com',
  'engadget.com',
  'medium.com',
  'dev.to',
  'bbc.com',
  'reuters.com',
  'nytimes.com',
  'nature.com',
  'sciencedaily.com',
  'arxiv.org',
];

function isArticleDomain(url: string): boolean {
  return ARTICLE_DOMAINS.some(d => url.includes(d));
}

async function main() {
  console.log('🔄 Re-scraping all article posts for proper formatting...\n');

  // Find all posts from article domains
  const posts = await prisma.post.findMany({
    where: {
      linkUrl: { not: null },
      deletedAt: null,
    },
    select: { id: true, title: true, content: true, linkUrl: true, mediaUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  // Filter to only article domains
  const articlePosts = posts.filter(p => p.linkUrl && isArticleDomain(p.linkUrl));

  console.log(`Found ${articlePosts.length} posts from article domains\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of articlePosts) {
    if (!post.linkUrl || !isScrapeable(post.linkUrl)) {
      skipped++;
      continue;
    }

    // Check if content needs formatting (no newlines = wall of text)
    const hasFormatting = post.content && post.content.includes('\n\n');
    const isShort = !post.content || post.content.length < 1000;

    if (hasFormatting && !isShort) {
      console.log(`✓ OK: ${post.title?.slice(0, 50)}`);
      skipped++;
      continue;
    }

    console.log(`\n🔄 Scraping: ${post.title?.slice(0, 50)}`);
    console.log(`   URL: ${post.linkUrl.slice(0, 60)}...`);
    console.log(`   Current: ${post.content?.length || 0} chars, ${(post.content?.match(/\n\n/g) || []).length} paragraphs`);

    try {
      const article = await scrapeArticle(post.linkUrl);

      if (!article || !article.content) {
        console.log(`   ❌ No content scraped`);
        failed++;
        continue;
      }

      const updates: any = {};

      // Always update if scraped content is longer or has better formatting
      const scrapedParagraphs = (article.content.match(/\n\n/g) || []).length;
      const currentParagraphs = (post.content?.match(/\n\n/g) || []).length;

      if (article.content.length > (post.content?.length || 0) || scrapedParagraphs > currentParagraphs) {
        updates.content = article.content;
        console.log(`   📝 New: ${article.content.length} chars, ${scrapedParagraphs} paragraphs`);
      }

      if (article.leadImage && !post.mediaUrl) {
        updates.mediaUrl = article.leadImage;
        console.log(`   🖼️ New image: ${article.leadImage.slice(0, 60)}...`);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: updates,
        });
        console.log(`   ✅ Fixed!`);
        fixed++;
      } else {
        console.log(`   ⚠️ No improvement`);
        skipped++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300));
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
