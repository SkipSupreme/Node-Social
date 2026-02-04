/**
 * Curation patterns and categorization utilities
 * Extracted from curateNow.ts for better organization
 */

// ============================================================================
// TEXT CLEANING
// ============================================================================

/**
 * Clean text by stripping HTML, fixing entities, and normalizing whitespace
 */
export function cleanText(text: string): string {
  let result = text
    // Strip HTML tags (handles newlines inside tags)
    .replace(/<[^>]*>/gs, '')
    // Remove broken dev.to image URLs
    .replace(/https?:\/\/media2\.dev\.to[^\s)>\]]+/gi, '')
    .replace(/https?:\/\/dev-to-uploads\.s3\.amazonaws\.com[^\s)>\]]+/gi, '')
    // Numeric HTML entities
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Named HTML entities
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
    // Remove markdown title prefix
    .replace(/^\*{0,2}Title:\*{0,2}\s*/i, '')
    // Remove stray unmatched quotes
    .replace(/([^"])"$/, '$1')
    .replace(/^"([^"]+)$/, '$1')
    // Normalize whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();

  // Safety: strip any remaining HTML tags
  while (/<[^>]+>/.test(result)) {
    result = result.replace(/<[^>]*>/gs, '');
  }

  return result;
}

// ============================================================================
// REJECTION PATTERNS - Content that should never be posted
// ============================================================================

export const REJECT_PATTERNS: RegExp[] = [
  // Clickbait / rage-bait
  /you won't believe/i,
  /this is why/i,
  /everyone needs to know/i,
  /shocked/i,
  /mind.?blow/i,

  // Personal / greeting posts
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
  /day\s*-?\s*\d+\s+of\s+(learning|coding|studying)/i,
  /join our.*course/i,
  /start your.*journey/i,
  /link\.guvi/i,
  /flipkart/i,
  /jiomart/i,
  /#shorts/i,
  /subscribe.*channel/i,
  /like.*subscribe/i,
  /hai friends/i,
  /how to learn.*for beginners.*how to learn/i,
];

// AI-specific spam patterns
export const AI_SPAM_PATTERNS: RegExp[] = [
  /#tech\s*#/i,
  /#api\s*#/i,
  /#programmer/i,
  /#coding/i,
  /#ai\s*#/i,
  /#ml\s*#/i,
  /#shorts/i,
  /single api call/i,
  /simplilearn/i,
  /intellipaat/i,
  /edureka/i,
  /full course/i,
  /tutorial for beginners/i,
  /5 things you need/i,
  /game.?changer/i,
  /revolutionary/i,
  /🔥.*🔥/,
  /💰.*💰/,
  /🚀.*🚀.*🚀/,
];

// Clickbait headline patterns (penalty, not rejection)
export const CLICKBAIT_PATTERNS: RegExp[] = [
  /too little.*too late/i,
  /finally realizes/i,
  /illegally/i,
  /corrupt/i,
  /quietly killed/i,
  /slammed/i,
  /destroyed/i,
  /epic fail/i,
];

// ============================================================================
// QUALITY SIGNALS - Content that indicates higher value
// ============================================================================

export interface QualitySignal {
  pattern: RegExp;
  scoreBoost: number;
  reason: string;
}

export const QUALITY_SIGNALS: QualitySignal[] = [
  {
    pattern: /algorithm|architecture|implementation|technical|framework|api|database|compiler|parser|rust|golang|typescript|infrastructure/,
    scoreBoost: 2,
    reason: 'technical depth',
  },
  {
    pattern: /discover|breakthrough|research|study|scientists|experiment|evidence|findings|protein|dna|gene|cell|brain/,
    scoreBoost: 1.5,
    reason: 'scientific content',
  },
  {
    pattern: /machine learning|ai model|neural|training|llm|gpt|claude|inference|embedding|openai|anthropic/,
    scoreBoost: 1.5,
    reason: 'AI/ML relevance',
  },
  {
    pattern: /proof|theorem|mathematical|equation|calculus|algebra|geometry/,
    scoreBoost: 2,
    reason: 'mathematical content',
  },
  {
    pattern: /godot|gdscript|game dev.*godot/,
    scoreBoost: 2,
    reason: 'Godot/gamedev',
  },
  {
    pattern: /space|asteroid|telescope|nasa|esa|orbit|planet|star|galaxy|cosmic|webb|rocket|satellite/,
    scoreBoost: 1.5,
    reason: 'space/astronomy',
  },
  {
    pattern: /blender|3d model|render|sculpt|geometry nodes|shader/,
    scoreBoost: 1.5,
    reason: 'Blender/3D',
  },
];

// Quality source domains
export const QUALITY_SOURCES = /(arxiv|nature\.com|science\.org|github\.com|fly\.io|sqlite|rust-lang|golang)/;

// ============================================================================
// PENALTY PATTERNS
// ============================================================================

export interface PenaltyPattern {
  pattern: RegExp;
  penalty: number;
  reason: string;
  excludePatterns?: RegExp[];
}

export const PENALTY_PATTERNS: PenaltyPattern[] = [
  {
    pattern: /game awards|announces|trailer|release date|coming soon/,
    penalty: 1,
    reason: 'gaming announcement',
    excludePatterns: [/godot/i, /blender/i],
  },
  {
    pattern: /best.*gift|under \$|christmas gift|holiday gift/,
    penalty: 3,
    reason: 'shopping/gift content',
  },
];

// ============================================================================
// NODE CATEGORIZATION - Subreddit to Node mapping
// ============================================================================

export const SUBREDDIT_TO_NODE: Record<string, string> = {
  // MTG
  magictcg: 'mtg',
  magicarena: 'mtg',
  edh: 'mtg',
  modernmagic: 'mtg',
  competitiveedh: 'mtg',

  // Blender
  blender: 'blender',
  blenderhelp: 'blender',
  '3dmodeling': 'blender',

  // Art
  digitalart: 'art',
  art: 'art',
  artporn: 'art',
  imaginarylandscapes: 'art',
  conceptart: 'art',

  // Science
  science: 'science',
  everythingscience: 'science',

  // Programming
  programming: 'programming',
  learnprogramming: 'programming',
  webdev: 'programming',
  javascript: 'programming',
  typescript: 'programming',
  rust: 'programming',
  python: 'programming',

  // AI
  machinelearning: 'ai',
  localllama: 'ai',
  artificial: 'ai',
  chatgpt: 'ai',
  claudeai: 'ai',
  singularity: 'ai',

  // Technology
  technology: 'technology',
  tech: 'technology',
  gadgets: 'technology',
  futurology: 'technology',

  // Godot
  godot: 'godot',
  gamedev: 'godot',
  indiegaming: 'godot',
  indiedev: 'godot',

  // Astronomy
  astronomy: 'astronomy',
  space: 'astronomy',
  astrophotography: 'astronomy',
  spacex: 'astronomy',
  nasa: 'astronomy',

  // Design
  graphic_design: 'graphic-design',
  design: 'graphic-design',
  typography: 'graphic-design',
  logodesign: 'graphic-design',

  // UI/UX
  userexperience: 'ui-ux',
  ui_design: 'ui-ux',
  uxdesign: 'ui-ux',
  web_design: 'ui-ux',

  // Spirituality
  spirituality: 'spirituality',
  meditation: 'spirituality',
  philosophy: 'spirituality',
  stoicism: 'spirituality',
  buddhism: 'spirituality',

  // Math
  math: 'math',
  learnmath: 'math',
  mathematics: 'math',
  matheducation: 'math',
};

// ============================================================================
// KEYWORD-BASED CATEGORIZATION (for non-Reddit sources)
// Order matters: specific topics first, then generic
// ============================================================================

interface KeywordRule {
  pattern: RegExp;
  node: string;
  excludePatterns?: RegExp[];
}

const KEYWORD_RULES: KeywordRule[] = [
  // SPECIFIC TOOLS/GAMES FIRST
  { pattern: /\bgodot\b|gdscript/i, node: 'godot' },
  { pattern: /\bblender\b|geometry nodes/i, node: 'blender' },
  { pattern: /\bmagic.*(gathering|arena)|mtg\b|commander deck|magic story|\bwotc\b|wizards of the coast|planeswalker|mana (dork|base|flood|screw)|sideboard|\bedh\b/i, node: 'mtg' },
  { pattern: /\bfigma\b|ui\s*\/?\s*ux|user experience|interface design/i, node: 'ui-ux' },

  // SCIENCE TOPICS
  { pattern: /nasa|telescope|james webb|jwst|asteroid|galaxy|cosmic|astronomy|hubble|exoplanet/i, node: 'astronomy' },
  { pattern: /scientific|research paper|peer.?review|journal|biology|physics|chemistry|neuroscience/i, node: 'science' },
  { pattern: /theorem|proof|calculus|algebra|geometry|mathematics|mathematical/i, node: 'math' },

  // CREATIVE
  { pattern: /graphic design|typography|logo design|visual design|brand design/i, node: 'graphic-design' },
  { pattern: /digital art|illustration|concept art|character design/i, node: 'art' },
  { pattern: /meditation|mindfulness|spiritual|consciousness|enlightenment/i, node: 'spirituality' },

  // YOUTUBE NODE - only for content about YouTube platform/being a YouTuber
  { pattern: /\byoutube\s+(algorithm|monetization|studio|analytics|partner|adsense)|how to (grow|start|run) (a|your) (youtube |)channel|\byoutuber\b|youtube creator|youtube shorts/i, node: 'youtube' },

  // TECH/PROGRAMMING (broader, check after specific tools)
  {
    pattern: /\bgpt|chatgpt|openai|claude|llm|machine learning|deep learning|neural network|anthropic|gemini|llama/i,
    node: 'ai',
    excludePatterns: [/\bgodot\b/i, /\bblender\b/i, /\bunity\b/i, /\bunreal\b/i],
  },
  { pattern: /programming|typescript|javascript|python|rust|golang|developer|coding|software engineer/i, node: 'programming' },
  { pattern: /tech news|gadget|startup|silicon valley|apple|google|microsoft|amazon|meta/i, node: 'technology' },
];

/**
 * Get node from subreddit name
 */
export function getNodeFromSubreddit(subreddit: string | null | undefined): string | null {
  if (!subreddit) return null;
  return SUBREDDIT_TO_NODE[subreddit.toLowerCase()] || null;
}

/**
 * Get node from content keywords (for non-Reddit sources)
 */
export function getNodeFromKeywords(text: string): string | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      // Check exclude patterns
      if (rule.excludePatterns?.some(p => p.test(text))) {
        continue;
      }
      return rule.node;
    }
  }
  return null;
}

/**
 * Categorize content into a node
 */
export function categorizeContent(
  subreddit: string | null | undefined,
  sourceType: string,
  combinedText: string,
  suggestedNode: string | null
): string | null {
  // Subreddit is most reliable for Reddit content
  const nodeFromSubreddit = getNodeFromSubreddit(subreddit);
  if (nodeFromSubreddit) {
    return nodeFromSubreddit;
  }

  // For non-Reddit sources, use keyword matching
  if (!subreddit && sourceType !== 'reddit') {
    const nodeFromKeywords = getNodeFromKeywords(combinedText);
    if (nodeFromKeywords) {
      return nodeFromKeywords;
    }
  }

  return suggestedNode;
}

// ============================================================================
// THRESHOLDS
// ============================================================================

export const THRESHOLDS = {
  // Score thresholds for auto-posting
  default: {
    post: 7,
    review: 5,
  },
  // AI node has stricter thresholds
  ai: {
    post: 10,
    review: 8,
  },
} as const;

// AI daily post limit
export const AI_DAILY_LIMIT = 1;
