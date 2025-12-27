// One-time script to fix misclassified posts
// Run with: npx tsx src/jobs/fixMisclassifiedPosts.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Re-classify content using improved logic
function determineCorrectNode(title: string, content: string, subreddit?: string): string | null {
  const combined = `${title} ${content}`.toLowerCase();

  // Reddit sources - subreddit is most reliable
  if (subreddit) {
    const sub = subreddit.toLowerCase();
    if (['magictcg', 'magicarena', 'edh', 'modernmagic', 'competitiveedh'].includes(sub)) return 'mtg';
    if (['blender', 'blenderhelp', '3dmodeling'].includes(sub)) return 'blender';
    if (['digitalart', 'art', 'artporn', 'imaginarylandscapes', 'conceptart'].includes(sub)) return 'art';
    if (['science', 'everythingscience'].includes(sub)) return 'science';
    if (['programming', 'learnprogramming', 'webdev', 'javascript', 'typescript', 'rust', 'python'].includes(sub)) return 'programming';
    if (['machinelearning', 'localllama', 'artificial', 'chatgpt', 'claudeai', 'singularity'].includes(sub)) return 'ai';
    if (['technology', 'tech', 'gadgets', 'futurology'].includes(sub)) return 'technology';
    if (['godot', 'gamedev', 'indiegaming', 'indiedev'].includes(sub)) return 'godot';
    if (['astronomy', 'space', 'astrophotography', 'spacex', 'nasa'].includes(sub)) return 'astronomy';
    if (['graphic_design', 'design', 'typography', 'logodesign'].includes(sub)) return 'graphic-design';
    if (['userexperience', 'ui_design', 'uxdesign', 'web_design'].includes(sub)) return 'ui-ux';
    if (['spirituality', 'meditation', 'philosophy', 'stoicism', 'buddhism'].includes(sub)) return 'spirituality';
    if (['math', 'learnmath', 'mathematics', 'matheducation'].includes(sub)) return 'math';
  }

  // SPECIFIC TOOLS/GAMES FIRST (highest priority)
  if (/\bgodot\b|gdscript/i.test(combined)) return 'godot';
  if (/\bblender\b|geometry nodes/i.test(combined)) return 'blender';

  // MTG detection - very specific patterns
  if (/\bmagic.*(gathering|arena)|mtg\b|commander deck|magic story|\bwotc\b|wizards of the coast|planeswalker|mana (dork|base|flood|screw)|sideboard|\bedh\b|sorcery speed|instant speed|\[\[.*\]\]/i.test(combined)) {
    return 'mtg';
  }

  if (/\bfigma\b|ui\s*\/?\s*ux|user experience|interface design/i.test(combined)) return 'ui-ux';

  // SCIENCE TOPICS
  if (/nasa|telescope|james webb|jwst|asteroid|galaxy|cosmic|astronomy|hubble|exoplanet|astrophoto/i.test(combined)) return 'astronomy';
  if (/scientific|research paper|peer.?review|journal|biology|physics|chemistry|neuroscience|psilocybin|compound|receptor/i.test(combined)) return 'science';
  if (/theorem|proof|calculus|algebra|geometry|mathematics|mathematical/i.test(combined)) return 'math';

  // CREATIVE
  if (/graphic design|typography|logo design|visual design|brand design/i.test(combined)) return 'graphic-design';
  if (/digital art|illustration|concept art|character design|artstation/i.test(combined)) return 'art';
  if (/meditation|mindfulness|spiritual|consciousness|enlightenment/i.test(combined)) return 'spirituality';

  // YOUTUBE NODE - only for content specifically about YouTube platform
  if (/\byoutube\s+(algorithm|monetization|studio|analytics|partner|adsense)|how to (grow|start|run) (a|your) (youtube |)channel|\byoutuber\b|youtube creator|youtube shorts/i.test(combined)) {
    return 'youtube';
  }

  // TECH/PROGRAMMING
  if (/\bgpt|chatgpt|openai|claude|llm|machine learning|deep learning|neural network|anthropic|gemini|llama/i.test(combined)) {
    // Only AI if not a tutorial for another tool
    if (!/\bgodot\b|\bblender\b|\bunity\b|\bunreal\b/i.test(combined)) {
      return 'ai';
    }
  }

  if (/programming|typescript|javascript|python|rust|golang|developer|coding|software engineer|flutter|react|angular|vue|nextjs|node\.?js/i.test(combined)) {
    return 'programming';
  }

  if (/tech news|gadget|startup|silicon valley|apple|google|microsoft|amazon|meta/i.test(combined)) {
    return 'technology';
  }

  return null;
}

async function main() {
  console.log('🔧 Fixing misclassified posts...\n');

  // Get all nodes for lookup
  const nodes = await prisma.node.findMany();
  const nodeMap = new Map(nodes.map(n => [n.slug, n.id]));

  // Find all bot posts
  const botPosts = await prisma.post.findMany({
    where: {
      author: { isBot: true },
      deletedAt: null,
    },
    include: {
      node: true,
      author: true,
    },
  });

  console.log(`Found ${botPosts.length} bot posts to analyze\n`);

  // Get curation queue data for subreddit info
  const queueMap = new Map<string, any>();
  const queueItems = await prisma.curationQueue.findMany({
    where: { postId: { not: null } },
    select: { postId: true, subreddit: true, sourceType: true },
  });
  for (const q of queueItems) {
    if (q.postId) queueMap.set(q.postId, q);
  }

  let fixed = 0;
  let reviewed = 0;
  const changes: { title: string; from: string; to: string }[] = [];

  for (const post of botPosts) {
    const queueItem = queueMap.get(post.id);
    const correctNodeSlug = determineCorrectNode(
      post.title || '',
      post.content || '',
      queueItem?.subreddit
    );

    if (!correctNodeSlug) {
      reviewed++;
      continue;
    }

    const correctNodeId = nodeMap.get(correctNodeSlug);
    if (!correctNodeId) {
      console.log(`⚠️  Node not found: ${correctNodeSlug}`);
      continue;
    }

    // If current node is different from correct node, fix it
    if (post.node.slug !== correctNodeSlug) {
      changes.push({
        title: post.title?.slice(0, 50) || 'Untitled',
        from: post.node.slug,
        to: correctNodeSlug,
      });

      await prisma.post.update({
        where: { id: post.id },
        data: { nodeId: correctNodeId },
      });

      fixed++;
    }
  }

  console.log('\n========================================');
  console.log('         RECLASSIFICATION COMPLETE       ');
  console.log('========================================');
  console.log(`✅ Fixed:    ${fixed} posts`);
  console.log(`📋 Reviewed: ${reviewed} posts (no change needed or no match)`);
  console.log('========================================\n');

  if (changes.length > 0) {
    console.log('Changes made:');
    for (const c of changes) {
      console.log(`  ${c.from} → ${c.to}: "${c.title}..."`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
