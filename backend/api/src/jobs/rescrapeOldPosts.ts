import { PrismaClient } from '@prisma/client';
import { scrapeArticle, isScrapeable } from './articleScraper.js';

const prisma = new PrismaClient();

function cleanText(text: string): string {
  return text
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/<\/?(?:p|br|div|span|h[1-6]|ul|ol|li|a|strong|em|b|i|blockquote|pre|code|img|figure|figcaption|article|section|header|footer|nav|aside|main)[^>]*>/gi, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/!\[CDATA\[|\]\]>/g, '')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function main() {
  console.log('🔄 Re-scraping old posts with short content...\n');

  // Find posts with short content that have a link URL
  const posts = await prisma.post.findMany({
    where: {
      linkUrl: { not: null },
      OR: [
        { content: null },
        { content: '' },
        // Posts with less than 300 chars are likely snippets
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Process in batches
  });

  // Also get posts with short content
  const shortPosts = await prisma.post.findMany({
    where: {
      linkUrl: { not: null },
      content: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter to only posts with short content
  const allPosts = [
    ...posts,
    ...shortPosts.filter(p => p.content && p.content.length < 400)
  ];

  // Remove duplicates
  const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());

  console.log(`Found ${uniquePosts.length} posts to potentially enrich\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of uniquePosts) {
    if (!post.linkUrl || !isScrapeable(post.linkUrl)) {
      skipped++;
      continue;
    }

    // Skip if content is already good
    if (post.content && post.content.length > 500) {
      skipped++;
      continue;
    }

    console.log(`📰 Scraping: ${post.title?.slice(0, 50)}...`);
    console.log(`   URL: ${post.linkUrl.slice(0, 60)}...`);

    try {
      const article = await scrapeArticle(post.linkUrl);

      if (article?.content && article.content.length > (post.content?.length || 0)) {
        // No truncation - store full article content
        const newContent = cleanText(article.content);

        await prisma.post.update({
          where: { id: post.id },
          data: { content: newContent }
        });

        console.log(`   ✅ Updated: ${post.content?.length || 0} → ${newContent.length} chars\n`);
        updated++;
      } else {
        console.log(`   ⏭️ No better content found\n`);
        skipped++;
      }

      // Rate limit - don't hammer sites
      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('        RE-SCRAPE COMPLETE             ');
  console.log('========================================');
  console.log(`✅ Updated:  ${updated}`);
  console.log(`⏭️ Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log('========================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
