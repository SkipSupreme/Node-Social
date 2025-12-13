/**
 * Helper functions for the Claude Code curator
 * These can be called from the /curate command via npx tsx
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BotInfo {
  userId: string;
  username: string;
  nodeId: string;
  nodeSlug: string;
}

// Get all bots and their target nodes
export async function getBots(): Promise<Record<string, BotInfo>> {
  const bots = await prisma.user.findMany({
    where: { isBot: true },
    select: {
      id: true,
      username: true,
      botConfig: true,
    },
  });

  const botMap: Record<string, BotInfo> = {};

  for (const bot of bots) {
    const config = bot.botConfig as { nodeSlug: string; nodeId: string } | null;
    if (config?.nodeSlug) {
      botMap[config.nodeSlug] = {
        userId: bot.id,
        username: bot.username,
        nodeId: config.nodeId,
        nodeSlug: config.nodeSlug,
      };
    }
  }

  return botMap;
}

// Get pending items from queue
export async function getPendingItems(limit = 20) {
  return prisma.curationQueue.findMany({
    where: { status: 'pending', needsReview: false },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

// Get items needing review
export async function getReviewItems(limit = 20) {
  return prisma.curationQueue.findMany({
    where: {
      status: 'pending',
      needsReview: true,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

// Post as bot
export async function postAsBot(
  nodeSlug: string,
  title: string,
  content: string,
  linkUrl: string,
  sourceAttribution: string
): Promise<string | null> {
  const bots = await getBots();
  const bot = bots[nodeSlug];

  if (!bot) {
    console.error(`No bot found for node: ${nodeSlug}`);
    return null;
  }

  // Don't add source attribution - clean posts only
  const post = await prisma.post.create({
    data: {
      title,
      content,
      linkUrl,
      postType: linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be') ? 'video' : 'link',
      authorId: bot.userId,
      nodeId: bot.nodeId,
    },
  });

  console.log(`✓ Posted "${title.slice(0, 40)}..." as @${bot.username}`);
  return post.id;
}

// Update queue item status
export async function updateQueueItem(
  id: string,
  status: 'pending' | 'approved' | 'rejected' | 'posted',
  data: {
    aiScore?: number;
    aiReason?: string;
    confidence?: number;
    needsReview?: boolean;
    postId?: string;
  }
): Promise<void> {
  await prisma.curationQueue.update({
    where: { id },
    data: {
      status,
      aiScore: data.aiScore,
      aiReason: data.aiReason,
      confidence: data.confidence,
      needsReview: data.needsReview,
      postId: data.postId,
      curatedAt: new Date(),
      postedAt: status === 'posted' ? new Date() : undefined,
    },
  });
}

// Get queue stats
export async function getQueueStats() {
  const stats = await prisma.curationQueue.groupBy({
    by: ['status'],
    _count: true,
  });

  const needsReview = await prisma.curationQueue.count({
    where: { needsReview: true, status: 'pending' },
  });

  const byNode = await prisma.curationQueue.groupBy({
    by: ['suggestedNode'],
    where: { status: 'pending' },
    _count: true,
  });

  return {
    byStatus: Object.fromEntries(stats.map(s => [s.status, s._count])),
    needsReview,
    byNode: Object.fromEntries(byNode.map(n => [n.suggestedNode || 'uncategorized', n._count])),
  };
}

// CLI interface
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'bots':
      console.log(JSON.stringify(await getBots(), null, 2));
      break;
    case 'pending':
      console.log(JSON.stringify(await getPendingItems(), null, 2));
      break;
    case 'review':
      console.log(JSON.stringify(await getReviewItems(), null, 2));
      break;
    case 'stats':
      console.log(JSON.stringify(await getQueueStats(), null, 2));
      break;
    case 'post': {
      // Usage: npx tsx src/jobs/curatorHelpers.ts post <nodeSlug> <title> <content> <linkUrl> <sourceAttribution>
      const [, , , nodeSlug, title, content, linkUrl, sourceAttribution] = process.argv;
      const postId = await postAsBot(nodeSlug, title, content, linkUrl, sourceAttribution);
      console.log(JSON.stringify({ postId }));
      break;
    }
    case 'update': {
      // Usage: npx tsx src/jobs/curatorHelpers.ts update <id> <status> <aiScore> <aiReason>
      const [, , , id, status, aiScore, aiReason] = process.argv;
      await updateQueueItem(id, status as 'pending' | 'approved' | 'rejected' | 'posted', {
        aiScore: aiScore ? parseInt(aiScore) : undefined,
        aiReason,
      });
      console.log('Updated');
      break;
    }
    default:
      console.log('Usage: npx tsx src/jobs/curatorHelpers.ts <bots|pending|review|stats|post|update>');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
