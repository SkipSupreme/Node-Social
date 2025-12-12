import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Bot mapping
const BOT_MAP: Record<string, string> = {
  'technology': 'TechDigest',
  'science': 'ScienceDaily',
  'programming': 'CodeCurator',
  'astronomy': 'CosmicNews',
  'math': 'MathMind',
  'ai': 'AIInsider',
  'godot': 'GodotGuru',
  'graphic-design': 'DesignDaily',
  'ui-ux': 'UXCurator',
  'art': 'ArtStream',
  'mtg': 'MTGDigest',
  'blender': 'BlenderBot',
  'spirituality': 'SoulSeeker',
  'youtube': 'TubeWatch'
};

function cleanText(text: string): string {
  return text
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Fix HTML entities
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    // Remove emojis that don't render well
    .replace(/🤯/g, '')
    // Clean up CDATA
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    // Clean up multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Q's taste profile evaluation
function evaluateItem(item: any): { score: number; reason: string; shouldPost: boolean; needsReview: boolean; correctNode: string | null } {
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const combined = title + ' ' + content;

  // Immediate rejection patterns (clickbait, rage-bait, personal posts)
  const rejectPatterns = [
    /you won't believe/i,
    /this is why/i,
    /everyone needs to know/i,
    /shocked/i,
    /mind.?blow/i,
    /just said goodbye/i,
    /for the love of god/i,
    /best wishes to you/i,
    /i would like to be adopted/i,
    /won't be streaming/i,
    /season's greetings/i,
    /exam tomorrow/i,
    /it's over$/i,
    /good morning/i,
    /good night/i,
    /happy.*day/i,
    /merry christmas/i,
    /fluffy.*thursday/i,
    /fluffy.*fursday/i,
    /hey folks/i,
    /peace offering/i,
  ];

  for (const pattern of rejectPatterns) {
    if (pattern.test(combined)) {
      return { score: 2, reason: 'Personal/greeting/low-effort content', shouldPost: false, needsReview: false, correctNode: null };
    }
  }

  let score = 5; // baseline
  const reasons: string[] = [];

  // Deep technical content
  if (/algorithm|architecture|implementation|technical|framework|api|database|compiler|parser|rust|golang|typescript|infrastructure/.test(combined)) {
    score += 2;
    reasons.push('technical depth');
  }

  // Science breakthroughs
  if (/discover|breakthrough|research|study|scientists|experiment|evidence|findings|protein|dna|gene|cell|brain/.test(combined)) {
    score += 1.5;
    reasons.push('scientific content');
  }

  // AI/ML practical applications
  if (/machine learning|ai model|neural|training|llm|gpt|claude|inference|embedding|openai|anthropic/.test(combined)) {
    score += 1.5;
    reasons.push('AI/ML relevance');
  }

  // Mathematics
  if (/proof|theorem|mathematical|equation|calculus|algebra|geometry/.test(combined)) {
    score += 2;
    reasons.push('mathematical content');
  }

  // Godot game dev
  if (/godot|gdscript|game dev.*godot/.test(combined)) {
    score += 2;
    reasons.push('Godot/gamedev');
  }

  // Space/astronomy
  if (/space|asteroid|telescope|nasa|esa|orbit|planet|star|galaxy|cosmic|webb|rocket|satellite/.test(combined)) {
    score += 1.5;
    reasons.push('space/astronomy');
  }

  // Blender
  if (/blender|3d model|render|sculpt|geometry nodes|shader/.test(combined)) {
    score += 1.5;
    reasons.push('Blender/3D');
  }

  // Original sources bonus
  if (item.linkUrl && /(arxiv|nature\.com|science\.org|github\.com|fly\.io|sqlite|rust-lang|golang)/.test(item.linkUrl)) {
    score += 1;
    reasons.push('quality source');
  }

  // High engagement from community is a signal
  if (item.sourceScore && item.sourceScore > 500) {
    score += 0.5;
  }
  if (item.sourceScore && item.sourceScore > 2000) {
    score += 0.5;
  }

  // Penalties
  // Clickbait-ish titles
  if (/too little.*too late|finally realizes|illegally|corrupt|quietly killed|slammed|destroyed|epic fail/.test(title)) {
    score -= 2;
    reasons.push('editorialized headline (penalty)');
  }

  // Bluesky noise (personal posts without substance)
  if (item.sourceType === 'bluesky' && !item.linkUrl && combined.length < 100) {
    score -= 2;
    reasons.push('short social post without link');
  }

  // Gaming news that's just announcements (unless Godot)
  if (/game awards|announces|trailer|release date|coming soon/.test(combined) && !/godot|blender/.test(combined)) {
    score -= 1;
    reasons.push('gaming announcement');
  }

  // Gift guides and shopping content
  if (/best.*gift|under \$|christmas gift|holiday gift/.test(combined)) {
    score -= 3;
    reasons.push('shopping/gift content');
  }

  // Fix miscategorized items - USE SUBREDDIT AS PRIMARY SOURCE OF TRUTH
  let correctNode = item.suggestedNode;
  const subreddit = item.subreddit?.toLowerCase();

  // Subreddit-based categorization (most reliable)
  if (subreddit === 'magictcg' || subreddit === 'magicarena' || subreddit === 'edh' || subreddit === 'modernmagic' || subreddit === 'competitiveedh') {
    correctNode = 'mtg';
  } else if (subreddit === 'blender' || subreddit === 'blenderhelp' || subreddit === '3dmodeling') {
    correctNode = 'blender';
  } else if (subreddit === 'digitalart' || subreddit === 'art' || subreddit === 'artporn' || subreddit === 'imaginarylandscapes' || subreddit === 'conceptart') {
    correctNode = 'art';
  } else if (subreddit === 'science' || subreddit === 'everythingscience') {
    correctNode = 'science';
  } else if (subreddit === 'programming' || subreddit === 'learnprogramming' || subreddit === 'webdev' || subreddit === 'javascript' || subreddit === 'typescript' || subreddit === 'rust' || subreddit === 'python') {
    correctNode = 'programming';
  } else if (subreddit === 'machinelearning' || subreddit === 'localllama' || subreddit === 'artificial' || subreddit === 'chatgpt' || subreddit === 'claudeai' || subreddit === 'singularity') {
    correctNode = 'ai';
  } else if (subreddit === 'technology' || subreddit === 'tech' || subreddit === 'gadgets' || subreddit === 'futurology') {
    correctNode = 'technology';
  } else if (subreddit === 'godot' || subreddit === 'gamedev' || subreddit === 'indiegaming' || subreddit === 'indiedev') {
    correctNode = 'godot';
  } else if (subreddit === 'astronomy' || subreddit === 'space' || subreddit === 'astrophotography' || subreddit === 'spacex' || subreddit === 'nasa') {
    correctNode = 'astronomy';
  } else if (subreddit === 'graphic_design' || subreddit === 'design' || subreddit === 'typography' || subreddit === 'logodesign') {
    correctNode = 'graphic-design';
  } else if (subreddit === 'userexperience' || subreddit === 'ui_design' || subreddit === 'uxdesign' || subreddit === 'web_design') {
    correctNode = 'ui-ux';
  } else if (subreddit === 'spirituality' || subreddit === 'meditation' || subreddit === 'philosophy' || subreddit === 'stoicism' || subreddit === 'buddhism') {
    correctNode = 'spirituality';
  } else if (subreddit === 'math' || subreddit === 'learnmath' || subreddit === 'mathematics' || subreddit === 'matheducation') {
    correctNode = 'math';
  }

  // Keyword-based fallback only for non-reddit sources (RSS, Bluesky, HN)
  if (!subreddit && item.sourceType !== 'reddit') {
    if (/\bgpt|chatgpt|openai|claude|llm|machine learning|\bai\b|neural|anthropic/.test(combined)) {
      correctNode = 'ai';
    } else if (/\bgodot\b|gdscript/.test(combined)) {
      correctNode = 'godot';
    } else if (/\bblender\b|geometry nodes/.test(combined)) {
      correctNode = 'blender';
    } else if (/programming|typescript|javascript|python|rust|golang|developer|coding/.test(combined)) {
      correctNode = 'programming';
    } else if (/nasa|telescope|james webb|jwst|asteroid|galaxy|cosmic|astronomy/.test(combined)) {
      correctNode = 'astronomy';
    }
  }

  const shouldPost = score >= 6;
  const needsReview = score >= 4 && score < 6;

  return {
    score: Math.min(10, Math.max(1, Math.round(score))),
    reason: reasons.join(', ') || 'baseline content',
    shouldPost,
    needsReview,
    correctNode
  };
}

async function postItem(item: any, targetNode: string, score: number, reason: string): Promise<boolean> {
  try {
    const botUsername = BOT_MAP[targetNode];
    if (!botUsername) {
      console.log('  No bot for node: ' + targetNode);
      return false;
    }

    const bot = await prisma.user.findFirst({
      where: { username: botUsername, isBot: true }
    });

    if (!bot) {
      console.log('  Bot not found: ' + botUsername);
      return false;
    }

    const botConfig = bot.botConfig as { nodeId: string };
    if (!botConfig?.nodeId) {
      console.log('  Bot missing nodeId: ' + botUsername);
      return false;
    }

    const title = cleanText(item.title);
    // Clean content - strip HTML, no attribution (node is already shown in UI)
    let content = item.content ? cleanText(item.content.slice(0, 500)) : '';

    const isVideo = item.linkUrl?.includes('youtube.com') ||
                   item.linkUrl?.includes('youtu.be') ||
                   item.linkUrl?.includes('v.redd.it');

    const postType = isVideo ? 'video' : (item.linkUrl ? 'link' : 'text');

    const post = await prisma.post.create({
      data: {
        title: title.slice(0, 200),
        content,
        linkUrl: item.linkUrl || item.sourceUrl,
        postType,
        authorId: bot.id,
        nodeId: botConfig.nodeId,
      }
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
      }
    });

    console.log('✅ Posted: "' + title.slice(0, 40) + '..." → ' + botUsername);
    return true;
  } catch (err: any) {
    console.error('❌ Failed: ' + item.title?.slice(0, 40), err.message);
    return false;
  }
}

async function main() {
  console.log('🤖 Starting automated curation...\n');

  // Get ALL pending items
  const allItems = await prisma.curationQueue.findMany({
    where: { status: 'pending' },
    orderBy: [{ sourceScore: 'desc' }],
  });

  console.log(`Found ${allItems.length} pending items to evaluate\n`);

  let posted = 0;
  let rejected = 0;
  let flagged = 0;
  let skipped = 0;

  for (const item of allItems) {
    const evaluation = evaluateItem(item);

    if (evaluation.shouldPost && evaluation.correctNode) {
      // Post high-quality items
      const success = await postItem(item, evaluation.correctNode, evaluation.score, evaluation.reason);
      if (success) {
        posted++;
      } else {
        skipped++;
      }
      // Small delay between posts
      await new Promise(r => setTimeout(r, 50));
    } else if (evaluation.needsReview) {
      // Flag for review
      await prisma.curationQueue.update({
        where: { id: item.id },
        data: {
          needsReview: true,
          aiScore: evaluation.score,
          aiReason: evaluation.reason,
          confidence: 0.5,
          curatedAt: new Date(),
        }
      });
      flagged++;
    } else {
      // Reject low-quality items
      await prisma.curationQueue.update({
        where: { id: item.id },
        data: {
          status: 'rejected',
          aiScore: evaluation.score,
          aiReason: evaluation.reason,
          curatedAt: new Date(),
        }
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

  // Final stats
  const stats = await prisma.curationQueue.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('Queue status:', stats);
}

main().finally(() => prisma.$disconnect());
