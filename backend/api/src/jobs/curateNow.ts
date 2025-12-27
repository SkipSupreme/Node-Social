import { PrismaClient } from '@prisma/client';
import { enrichContent, isScrapeable } from './articleScraper.js';
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
  let result = text
    // First pass: strip HTML tags with a more robust regex (handles newlines inside tags)
    .replace(/<[^>]*>/gs, '') // 's' flag makes . match newlines
    // Remove broken dev.to image URLs that leak into text
    .replace(/https?:\/\/media2\.dev\.to[^\s)>\]]+/gi, '')
    .replace(/https?:\/\/dev-to-uploads\.s3\.amazonaws\.com[^\s)>\]]+/gi, '')
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
    // Remove markdown prefixes like **Title:** or Title:
    .replace(/^\*{0,2}Title:\*{0,2}\s*/i, '')
    // Remove stray trailing quotes (unmatched)
    .replace(/([^"])"$/, '$1')
    .replace(/^"([^"]+)$/, '$1')
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

// Q's taste profile evaluation
function evaluateItem(item: any): { score: number; reason: string; shouldPost: boolean; needsReview: boolean; correctNode: string | null } {
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const combined = title + ' ' + content;

  // Immediate rejection patterns (clickbait, rage-bait, personal posts, spam)
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
    // Spam patterns
    /big loot/i,
    /big offer/i,
    /coupon.*😱/i,
    /day\s*-?\s*\d+\s+of\s+(learning|coding|studying)/i, // "Day 6 of learning..."
    /join our.*course/i,
    /start your.*journey/i,
    /link\.guvi/i,
    /flipkart/i,
    /jiomart/i,
    /#shorts/i, // YouTube shorts spam
    /subscribe.*channel/i,
    /like.*subscribe/i,
    /hai friends/i,
    /how to learn.*for beginners.*how to learn/i, // Keyword stuffing
  ];

  for (const pattern of rejectPatterns) {
    if (pattern.test(combined)) {
      return { score: 2, reason: 'Personal/greeting/low-effort content', shouldPost: false, needsReview: false, correctNode: null };
    }
  }

  // Reject code dumps and low-effort posts
  // Title is too short (1-3 chars) or just a word
  if (title.length <= 4 && !/^(ai|ml|go|js|py|c\+\+|c#)$/i.test(title)) {
    return { score: 1, reason: 'Title too short/meaningless', shouldPost: false, needsReview: false, correctNode: null };
  }

  // Content is mostly code (lots of special chars like $, {, }, =, etc.)
  const codeChars = (content.match(/[\$\{\}\[\]\(\)=;`\\\/\|<>]/g) || []).length;
  const contentLen = content.length;
  if (contentLen > 50 && codeChars / contentLen > 0.15) {
    return { score: 2, reason: 'Content is mostly code', shouldPost: false, needsReview: false, correctNode: null };
  }

  // Content is just "comments" or similar placeholder
  if (/^comments?$/i.test(content.trim()) || content.trim().length < 10) {
    return { score: 2, reason: 'No meaningful content', shouldPost: false, needsReview: false, correctNode: null };
  }

  // Non-English content detection (crude - lots of non-ASCII chars)
  const nonAscii = (combined.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii > combined.length * 0.3 && combined.length > 50) {
    return { score: 2, reason: 'Non-English content', shouldPost: false, needsReview: false, correctNode: null };
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

  // Keyword-based fallback for non-reddit sources (RSS, Bluesky, HN, YouTube)
  // Order matters: check SPECIFIC topics first (Godot, Blender, MTG), then generic (AI, programming)
  // This prevents "Godot AI tutorial" from going to AI instead of Godot
  if (!subreddit && item.sourceType !== 'reddit') {
    // SPECIFIC TOOLS/GAMES FIRST (highest priority)
    if (/\bgodot\b|gdscript/i.test(combined)) {
      correctNode = 'godot';
    } else if (/\bblender\b|geometry nodes/i.test(combined)) {
      correctNode = 'blender';
    } else if (/\bmagic.*(gathering|arena)|mtg\b|commander deck|magic story|\bwotc\b|wizards of the coast|planeswalker|mana (dork|base|flood|screw)|sideboard|\bedh\b/i.test(combined)) {
      correctNode = 'mtg';
    } else if (/\bfigma\b|ui\s*\/?\s*ux|user experience|interface design/i.test(combined)) {
      correctNode = 'ui-ux';
    // SCIENCE TOPICS
    } else if (/nasa|telescope|james webb|jwst|asteroid|galaxy|cosmic|astronomy|hubble|exoplanet/i.test(combined)) {
      correctNode = 'astronomy';
    } else if (/scientific|research paper|peer.?review|journal|biology|physics|chemistry|neuroscience/i.test(combined)) {
      correctNode = 'science';
    } else if (/theorem|proof|calculus|algebra|geometry|mathematics|mathematical/i.test(combined)) {
      correctNode = 'math';
    // CREATIVE
    } else if (/graphic design|typography|logo design|visual design|brand design/i.test(combined)) {
      correctNode = 'graphic-design';
    } else if (/digital art|illustration|concept art|character design/i.test(combined)) {
      correctNode = 'art';
    } else if (/meditation|mindfulness|spiritual|consciousness|enlightenment/i.test(combined)) {
      correctNode = 'spirituality';
    // YOUTUBE NODE - only for content specifically about YouTube platform/being a YouTuber
    // Must be very specific to avoid false positives (e.g., "AI content creation" shouldn't go here)
    } else if (/\byoutube\s+(algorithm|monetization|studio|analytics|partner|adsense)|how to (grow|start|run) (a|your) (youtube |)channel|\byoutuber\b|youtube creator|youtube shorts/i.test(combined)) {
      correctNode = 'youtube';
    // TECH/PROGRAMMING (broader, check after specific tools)
    } else if (/\bgpt|chatgpt|openai|claude|llm|machine learning|deep learning|neural network|anthropic|gemini|llama/i.test(combined)) {
      // Only AI if it's PRIMARILY about AI, not just mentioning it
      // Skip if it's a tutorial for another tool that uses AI
      if (!/\bgodot\b|\bblender\b|\bunity\b|\bunreal\b/i.test(combined)) {
        correctNode = 'ai';
      }
    } else if (/programming|typescript|javascript|python|rust|golang|developer|coding|software engineer/i.test(combined)) {
      correctNode = 'programming';
    } else if (/tech news|gadget|startup|silicon valley|apple|google|microsoft|amazon|meta/i.test(combined)) {
      correctNode = 'technology';
    }
  }

  // AI-specific spam patterns (additional filtering)
  if (correctNode === 'ai') {
    const aiSpamPatterns = [
      /#tech\s*#/i,           // Hashtag spam chains
      /#api\s*#/i,
      /#programmer/i,
      /#coding/i,
      /#ai\s*#/i,
      /#ml\s*#/i,
      /#shorts/i,             // YouTube shorts spam
      /single api call/i,     // Lazy content
      /simplilearn/i,         // Course spam
      /intellipaat/i,
      /edureka/i,
      /full course/i,
      /tutorial for beginners/i,
      /5 things you need/i,   // Clickbait listicles
      /game.?changer/i,       // Buzzword spam
      /revolutionary/i,
      /🔥.*🔥/,               // Emoji spam
      /💰.*💰/,
      /🚀.*🚀.*🚀/,
    ];
    for (const pattern of aiSpamPatterns) {
      if (pattern.test(combined)) {
        score -= 3;
        reasons.push('AI spam pattern detected');
        break;
      }
    }
  }

  // Three tiers with node-specific thresholds:
  // AI node: Score >= 10 to auto-post (only the absolute best - 1 per day max)
  // Other nodes: Score >= 7 to auto-post
  const finalScore = Math.min(10, Math.max(1, Math.round(score)));

  // AI node has VERY high threshold - only 10s auto-post, and we limit to 1/day
  const postThreshold = correctNode === 'ai' ? 10 : 7;
  const reviewThreshold = correctNode === 'ai' ? 8 : 5;

  const shouldPost = finalScore >= postThreshold;
  const needsReview = finalScore >= reviewThreshold && finalScore < postThreshold;

  return {
    score: finalScore,
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

    // Try to scrape full article content and images if we only have a snippet
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

    // Clean content - strip HTML, no attribution (node is already shown in UI)
    // NO content limit - store full articles, truncation happens in frontend
    let content = rawContent ? cleanText(rawContent) : '';

    // Don't duplicate title as content (common with short Bluesky posts)
    if (content === title || content.trim() === title.trim()) {
      content = '';
    }

    const isVideo = item.linkUrl?.includes('youtube.com') ||
                   item.linkUrl?.includes('youtu.be') ||
                   item.linkUrl?.includes('v.redd.it');

    const isImage = mediaUrl?.includes('i.redd.it') ||
                   mediaUrl?.includes('preview.redd.it') ||
                   item.linkUrl?.includes('i.redd.it') ||
                   item.linkUrl?.includes('i.imgur.com') ||
                   /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(item.linkUrl || '') ||
                   /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(mediaUrl || '');

    const postType = isVideo ? 'video' : isImage ? 'image' : (item.linkUrl ? 'link' : 'text');

    // Use linkUrl if available, otherwise fall back to sourceUrl
    const finalLinkUrl = (item.linkUrl && item.linkUrl.trim()) ? item.linkUrl : item.sourceUrl;

    const post = await prisma.post.create({
      data: {
        title: title.slice(0, 200),
        content,
        linkUrl: finalLinkUrl,
        mediaUrl, // Include the media URL (possibly scraped from article)
        galleryUrls: item.galleryUrls || [], // For Reddit galleries
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

  // Check how many AI posts we've made today (limit to 1 per day, only the best)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const aiNode = await prisma.node.findFirst({ where: { slug: 'ai' } });
  const aiPostsToday = aiNode ? await prisma.post.count({
    where: {
      nodeId: aiNode.id,
      createdAt: { gte: today },
      deletedAt: null,
    }
  }) : 0;
  const aiDailyLimit = 1; // Only 1 AI post per day, must be cream of the crop
  console.log(`📊 AI posts today: ${aiPostsToday}/${aiDailyLimit}`);

  // Get ALL pending items (including ones previously flagged for review)
  const allItems = await prisma.curationQueue.findMany({
    where: { status: 'pending', needsReview: false },
    orderBy: [{ sourceScore: 'desc' }],
  });

  // Also get items that were flagged for review and re-evaluate them
  const reviewItems = await prisma.curationQueue.findMany({
    where: { status: 'pending', needsReview: true },
    orderBy: [{ sourceScore: 'desc' }],
  });

  // Combine both lists
  const itemsToProcess = [...allItems, ...reviewItems];

  console.log(`Found ${itemsToProcess.length} items to evaluate (${allItems.length} new, ${reviewItems.length} in review)\n`);

  let posted = 0;
  let rejected = 0;
  let flagged = 0;
  let skipped = 0;
  let aiPostedThisRun = 0;

  for (const item of itemsToProcess) {
    const evaluation = evaluateItem(item);

    // Special handling for AI node - strict daily limit
    if (evaluation.correctNode === 'ai') {
      if (aiPostsToday + aiPostedThisRun >= aiDailyLimit) {
        // AI quota exhausted - reject or flag for review
        if (evaluation.score >= 10) {
          // Perfect 10? Flag for manual review, might be worth saving
          await prisma.curationQueue.update({
            where: { id: item.id },
            data: {
              needsReview: true,
              aiScore: evaluation.score,
              aiReason: `${evaluation.reason} (AI daily limit reached - held for review)`,
              confidence: 0.8,
              curatedAt: new Date(),
            }
          });
          flagged++;
        } else {
          // Not exceptional enough - reject
          await prisma.curationQueue.update({
            where: { id: item.id },
            data: {
              status: 'rejected',
              aiScore: evaluation.score,
              aiReason: `${evaluation.reason} (AI daily limit reached)`,
              curatedAt: new Date(),
            }
          });
          rejected++;
        }
        continue;
      }
    }

    if (evaluation.shouldPost && evaluation.correctNode) {
      // Post high-quality items
      const success = await postItem(item, evaluation.correctNode, evaluation.score, evaluation.reason);
      if (success) {
        posted++;
        if (evaluation.correctNode === 'ai') {
          aiPostedThisRun++;
        }
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
