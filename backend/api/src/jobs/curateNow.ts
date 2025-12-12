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

function getSourceAttribution(item: any): string {
  if (item.sourceType === 'reddit') {
    return '📡 via r/' + (item.subreddit || 'reddit');
  } else if (item.sourceType === 'hackernews') {
    return '📡 via Hacker News';
  } else if (item.sourceType === 'bluesky') {
    return '📡 via Bluesky';
  } else if (item.sourceType === 'rss') {
    return '📡 via RSS';
  }
  return '📡 curated';
}

function cleanTitle(title: string): string {
  return title
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/🤯/g, '')
    .replace(/&#x27;/g, "'")
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

  // Fix miscategorized items
  let correctNode = item.suggestedNode;

  // MTG content
  if (/magic.*gathering|mtg|commander|edh|mana|spell|creature type|magictcg/.test(combined) || item.subreddit === 'magicTCG') {
    correctNode = 'mtg';
  }
  // Blender
  if ((/blender|geometry nodes|sculpting/.test(combined) && item.subreddit === 'blender') || item.subreddit === 'blender') {
    correctNode = 'blender';
  }
  // Art
  if (/digital art|painting|watercolour|watercolor|illustration|sketch|drawing|digitalart/.test(combined) || item.subreddit === 'DigitalArt' || item.subreddit === 'Art') {
    correctNode = 'art';
  }
  // Science
  if ((/study|research|scientists|experiment|protein|cell|brain|physics|chemistry|biology/.test(combined) && !/ai|machine learning/.test(combined)) || item.subreddit === 'science') {
    correctNode = 'science';
  }
  // Programming
  if (/code|programming|developer|typescript|javascript|python|rust|golang|api|backend|frontend|nextjs|react/.test(combined)) {
    correctNode = 'programming';
  }
  // AI (override programming if AI-related)
  if (/\bai\b|machine learning|llm|gpt|claude|model|training data|neural|chatgpt|openai|singularity/.test(combined) || item.subreddit === 'singularity' || item.subreddit === 'ChatGPT') {
    correctNode = 'ai';
  }
  // Technology
  if (/google|apple|microsoft|meta|android|ios|windows|steamos|startup|tech company/.test(combined) && !correctNode) {
    correctNode = 'technology';
  }
  // Godot
  if (/godot/.test(combined) || item.subreddit === 'godot') {
    correctNode = 'godot';
  }
  // Astronomy
  if (/space|astronomy|nasa|telescope|planet|star|galaxy|cosmic/.test(combined) || item.subreddit === 'space' || item.subreddit === 'Astronomy') {
    correctNode = 'astronomy';
  }

  const shouldPost = score >= 7;
  const needsReview = score >= 5 && score < 7;

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

    const title = cleanTitle(item.title);
    const attribution = getSourceAttribution(item);
    let content = item.content ? cleanTitle(item.content.slice(0, 300)) : '';
    content = (content + '\n\n---\n' + attribution).trim();

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
