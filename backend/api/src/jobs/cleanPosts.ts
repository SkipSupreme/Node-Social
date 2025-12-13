import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function cleanText(text: string): string {
  let result = text
    // First pass: strip HTML tags with a more robust regex (handles newlines inside tags)
    .replace(/<[^>]*>/gs, '') // 's' flag makes . match newlines
    // Fix HTML entities - numeric
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Fix HTML entities - named
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
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&[a-z]+;/gi, '') // Remove any remaining HTML entities
    // Clean up CDATA
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    // Remove "via" attribution
    .replace(/\n*---\n*📡 via .*/gi, '')
    .replace(/📡 via .*/gi, '')
    .replace(/via r\/\w+/gi, '')
    .replace(/via RSS/gi, '')
    .replace(/via Hacker News/gi, '')
    .replace(/via Bluesky/gi, '')
    // Clean up multiple whitespace and newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();

  // Safety check: if any HTML tags remain, strip them again
  while (/<[^>]+>/.test(result)) {
    result = result.replace(/<[^>]*>/gs, '');
  }

  return result;
}

async function main() {
  const posts = await prisma.post.findMany();

  let cleaned = 0;
  for (const post of posts) {
    let needsUpdate = false;
    let newContent = post.content;
    let newTitle = post.title;

    if (newContent) {
      const cleanedContent = cleanText(newContent);
      if (cleanedContent !== newContent) {
        newContent = cleanedContent;
        needsUpdate = true;
      }
    }

    if (newTitle) {
      const cleanedTitle = cleanText(newTitle);
      if (cleanedTitle !== newTitle) {
        newTitle = cleanedTitle;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.post.update({
        where: { id: post.id },
        data: { content: newContent, title: newTitle }
      });
      cleaned++;
      console.log('Cleaned:', newTitle?.slice(0, 50));
    }
  }

  console.log('\nTotal cleaned:', cleaned);
}

main().finally(() => prisma.$disconnect());
