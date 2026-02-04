import { PrismaClient } from '@prisma/client';
import { enrichContent, isScrapeable } from './articleScraper.js';
import {
  cleanText,
  REJECT_PATTERNS,
  AI_SPAM_PATTERNS,
  CLICKBAIT_PATTERNS,
  QUALITY_SIGNALS,
  QUALITY_SOURCES,
  PENALTY_PATTERNS,
  THRESHOLDS,
  AI_DAILY_LIMIT,
  categorizeContent,
} from './curationPatterns.js';

const prisma = new PrismaClient();

// ============================================================================
// CONTENT EVALUATION
// ============================================================================

interface EvaluationResult {
  score: number;
  reason: string;
  shouldPost: boolean;
  needsReview: boolean;
  correctNode: string | null;
}

function evaluateItem(item: any): EvaluationResult {
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const combined = title + ' ' + content;

  // Check rejection patterns
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        score: 2,
        reason: 'Personal/greeting/low-effort content',
        shouldPost: false,
        needsReview: false,
        correctNode: null,
      };
    }
  }

  // Title too short
  if (title.length <= 4 && !/^(ai|ml|go|js|py|c\+\+|c#)$/i.test(title)) {
    return {
      score: 1,
      reason: 'Title too short/meaningless',
      shouldPost: false,
      needsReview: false,
      correctNode: null,
    };
  }

  // Content is mostly code
  const codeChars = (content.match(/[\$\{\}\[\]\(\)=;`\\\/\|<>]/g) || []).length;
  if (content.length > 50 && codeChars / content.length > 0.15) {
    return {
      score: 2,
      reason: 'Content is mostly code',
      shouldPost: false,
      needsReview: false,
      correctNode: null,
    };
  }

  // No meaningful content
  if (/^comments?$/i.test(content.trim()) || content.trim().length < 10) {
    return {
      score: 2,
      reason: 'No meaningful content',
      shouldPost: false,
      needsReview: false,
      correctNode: null,
    };
  }

  // Non-English content
  const nonAscii = (combined.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii > combined.length * 0.3 && combined.length > 50) {
    return {
      score: 2,
      reason: 'Non-English content',
      shouldPost: false,
      needsReview: false,
      correctNode: null,
    };
  }

  // Calculate score
  let score = 5;
  const reasons: string[] = [];

  // Apply quality signals
  for (const signal of QUALITY_SIGNALS) {
    if (signal.pattern.test(combined)) {
      score += signal.scoreBoost;
      reasons.push(signal.reason);
    }
  }

  // Quality source bonus
  if (item.linkUrl && QUALITY_SOURCES.test(item.linkUrl)) {
    score += 1;
    reasons.push('quality source');
  }

  // Engagement bonus
  if (item.sourceScore && item.sourceScore > 500) score += 0.5;
  if (item.sourceScore && item.sourceScore > 2000) score += 0.5;

  // Clickbait penalty
  for (const pattern of CLICKBAIT_PATTERNS) {
    if (pattern.test(title)) {
      score -= 2;
      reasons.push('editorialized headline (penalty)');
      break;
    }
  }

  // Short Bluesky posts without links
  if (item.sourceType === 'bluesky' && !item.linkUrl && combined.length < 100) {
    score -= 2;
    reasons.push('short social post without link');
  }

  // Apply penalty patterns
  for (const penalty of PENALTY_PATTERNS) {
    if (penalty.pattern.test(combined)) {
      const excluded = penalty.excludePatterns?.some(p => p.test(combined));
      if (!excluded) {
        score -= penalty.penalty;
        reasons.push(penalty.reason);
      }
    }
  }

  // Categorize content
  const correctNode = categorizeContent(
    item.subreddit,
    item.sourceType,
    combined,
    item.suggestedNode
  );

  // AI-specific spam check
  if (correctNode === 'ai') {
    for (const pattern of AI_SPAM_PATTERNS) {
      if (pattern.test(combined)) {
        score -= 3;
        reasons.push('AI spam pattern detected');
        break;
      }
    }
  }

  // Clamp score
  const finalScore = Math.min(10, Math.max(1, Math.round(score)));

  // Determine thresholds based on node
  const thresholds = correctNode === 'ai' ? THRESHOLDS.ai : THRESHOLDS.default;
  const shouldPost = finalScore >= thresholds.post;
  const needsReview = finalScore >= thresholds.review && finalScore < thresholds.post;

  return {
    score: finalScore,
    reason: reasons.join(', ') || 'baseline content',
    shouldPost,
    needsReview,
    correctNode,
  };
}

// ============================================================================
// BOT MANAGEMENT
// ============================================================================

interface BotInfo {
  id: string;
  username: string;
  nodeId: string;
}

async function getBotForNode(nodeSlug: string): Promise<BotInfo | null> {
  const bot = await prisma.user.findFirst({
    where: {
      isBot: true,
      botConfig: {
        path: ['nodeSlug'],
        equals: nodeSlug,
      },
    },
    select: {
      id: true,
      username: true,
      botConfig: true,
    },
  });

  if (!bot) return null;

  const config = bot.botConfig as { nodeId: string } | null;
  if (!config?.nodeId) return null;

  return {
    id: bot.id,
    username: bot.username,
    nodeId: config.nodeId,
  };
}

// ============================================================================
// POST CREATION
// ============================================================================

async function postItem(
  item: any,
  targetNode: string,
  score: number,
  reason: string
): Promise<boolean> {
  try {
    const bot = await getBotForNode(targetNode);
    if (!bot) {
      console.log(`  No bot for node: ${targetNode}`);
      return false;
    }

    const title = cleanText(item.title);

    // Try to scrape full article content
    let rawContent = item.content || '';
    let mediaUrl = item.mediaUrl;

    if (item.linkUrl && isScrapeable(item.linkUrl)) {
      const enriched = await enrichContent(rawContent, item.linkUrl, title, mediaUrl);
      if (enriched.content && enriched.content.length > rawContent.length) {
        rawContent = enriched.content;
      }
      if (enriched.mediaUrl && !mediaUrl) {
        mediaUrl = enriched.mediaUrl;
      }
    }

    // Clean content
    let content = rawContent ? cleanText(rawContent) : '';

    // Don't duplicate title as content
    if (content === title || content.trim() === title.trim()) {
      content = '';
    }

    // Determine post type
    const isVideo =
      item.linkUrl?.includes('youtube.com') ||
      item.linkUrl?.includes('youtu.be') ||
      item.linkUrl?.includes('v.redd.it');

    const isImage =
      mediaUrl?.includes('i.redd.it') ||
      mediaUrl?.includes('preview.redd.it') ||
      item.linkUrl?.includes('i.redd.it') ||
      item.linkUrl?.includes('i.imgur.com') ||
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(item.linkUrl || '') ||
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(mediaUrl || '');

    const postType = isVideo ? 'video' : isImage ? 'image' : item.linkUrl ? 'link' : 'text';

    // Use linkUrl if available, otherwise sourceUrl
    const finalLinkUrl = item.linkUrl?.trim() || item.sourceUrl;

    const post = await prisma.post.create({
      data: {
        title: title.slice(0, 200),
        content,
        linkUrl: finalLinkUrl,
        mediaUrl,
        galleryUrls: item.galleryUrls || [],
        postType,
        authorId: bot.id,
        nodeId: bot.nodeId,
      },
    });

    await prisma.curationQueue.update({
      where: { id: item.id },
      data: {
        status: 'posted',
        postId: post.id,
        postedAt: new Date(),
        postedById: bot.id,
        aiScore: score,
        aiReason: reason,
        curatedAt: new Date(),
      },
    });

    console.log(`✅ Posted: "${title.slice(0, 40)}..." → ${bot.username}`);
    return true;
  } catch (err: any) {
    console.error(`❌ Failed: ${item.title?.slice(0, 40)}`, err.message);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🤖 Starting automated curation...\n');

  // Check AI posts today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const aiNode = await prisma.node.findFirst({ where: { slug: 'ai' } });
  const aiPostsToday = aiNode
    ? await prisma.post.count({
        where: {
          nodeId: aiNode.id,
          createdAt: { gte: today },
          deletedAt: null,
        },
      })
    : 0;

  console.log(`📊 AI posts today: ${aiPostsToday}/${AI_DAILY_LIMIT}`);

  // Get items to process
  const pendingItems = await prisma.curationQueue.findMany({
    where: { status: 'pending', needsReview: false },
    orderBy: [{ sourceScore: 'desc' }],
  });

  const reviewItems = await prisma.curationQueue.findMany({
    where: { status: 'pending', needsReview: true },
    orderBy: [{ sourceScore: 'desc' }],
  });

  const itemsToProcess = [...pendingItems, ...reviewItems];
  console.log(
    `Found ${itemsToProcess.length} items to evaluate (${pendingItems.length} new, ${reviewItems.length} in review)\n`
  );

  let posted = 0;
  let rejected = 0;
  let flagged = 0;
  let skipped = 0;
  let aiPostedThisRun = 0;

  for (const item of itemsToProcess) {
    const evaluation = evaluateItem(item);

    // AI node daily limit
    if (evaluation.correctNode === 'ai') {
      if (aiPostsToday + aiPostedThisRun >= AI_DAILY_LIMIT) {
        if (evaluation.score >= 10) {
          // Perfect 10 - hold for review
          await prisma.curationQueue.update({
            where: { id: item.id },
            data: {
              needsReview: true,
              aiScore: evaluation.score,
              aiReason: `${evaluation.reason} (AI daily limit reached - held for review)`,
              confidence: 0.8,
              curatedAt: new Date(),
            },
          });
          flagged++;
        } else {
          // Reject
          await prisma.curationQueue.update({
            where: { id: item.id },
            data: {
              status: 'rejected',
              aiScore: evaluation.score,
              aiReason: `${evaluation.reason} (AI daily limit reached)`,
              curatedAt: new Date(),
            },
          });
          rejected++;
        }
        continue;
      }
    }

    if (evaluation.shouldPost && evaluation.correctNode) {
      const success = await postItem(item, evaluation.correctNode, evaluation.score, evaluation.reason);
      if (success) {
        posted++;
        if (evaluation.correctNode === 'ai') {
          aiPostedThisRun++;
        }
      } else {
        skipped++;
      }
      await new Promise(r => setTimeout(r, 50));
    } else if (evaluation.needsReview) {
      await prisma.curationQueue.update({
        where: { id: item.id },
        data: {
          needsReview: true,
          aiScore: evaluation.score,
          aiReason: evaluation.reason,
          confidence: 0.5,
          curatedAt: new Date(),
        },
      });
      flagged++;
    } else {
      await prisma.curationQueue.update({
        where: { id: item.id },
        data: {
          status: 'rejected',
          aiScore: evaluation.score,
          aiReason: evaluation.reason,
          curatedAt: new Date(),
        },
      });
      rejected++;
    }
  }

  console.log('\n========================================');
  console.log('           CURATION COMPLETE           ');
  console.log('========================================');
  console.log(`✅ Posted:   ${posted}`);
  console.log(`⏳ Review:   ${flagged}`);
  console.log(`❌ Rejected: ${rejected}`);
  console.log(`⚠️  Skipped:  ${skipped}`);
  console.log('========================================\n');

  const stats = await prisma.curationQueue.groupBy({
    by: ['status'],
    _count: { status: true },
  });
  console.log('Queue status:', stats);
}

main().finally(() => prisma.$disconnect());
