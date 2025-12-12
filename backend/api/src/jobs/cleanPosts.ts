import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany();

  let cleaned = 0;
  for (const post of posts) {
    let needsUpdate = false;
    let newContent = post.content;
    let newTitle = post.title;

    if (newContent) {
      const cleanedContent = newContent
        .replace(/\n*---\n*📡 via .*/gi, '')
        .replace(/📡 via .*/gi, '')
        .replace(/via r\/\w+/gi, '')
        .replace(/via RSS/gi, '')
        .replace(/via Hacker News/gi, '')
        .replace(/via Bluesky/gi, '')
        .replace(/via ChatGPT/gi, '')
        .replace(/via blender/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/&#8216;|&#8217;/g, "'")
        .replace(/&#8220;|&#8221;/g, '"')
        .trim();

      if (cleanedContent !== newContent) {
        newContent = cleanedContent;
        needsUpdate = true;
      }
    }

    if (newTitle) {
      const cleanedTitle = newTitle
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .trim();

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
