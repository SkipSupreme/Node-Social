// Harvester configuration and keyword mappings

export interface HarvesterConfig {
  enabled: boolean;
  minScore: number;
  maxAgeHours: number;
  sources: string[];
}

// Node keyword mappings for categorization
export const NODE_KEYWORDS: Record<string, string[]> = {
  'technology': [
    'tech', 'software', 'hardware', 'startup', 'apple', 'google', 'microsoft',
    'innovation', 'gadget', 'smartphone', 'laptop', 'computer', 'digital',
    'cybersecurity', 'cloud', 'saas', 'fintech', 'biotech'
  ],
  'science': [
    'science', 'research', 'study', 'discovery', 'physics', 'chemistry',
    'biology', 'experiment', 'scientist', 'laboratory', 'journal', 'peer-reviewed',
    'hypothesis', 'theory', 'evidence', 'nature', 'scientific'
  ],
  'programming': [
    'programming', 'coding', 'developer', 'javascript', 'typescript', 'rust',
    'python', 'api', 'framework', 'library', 'github', 'git', 'code',
    'backend', 'frontend', 'fullstack', 'devops', 'algorithm', 'data structure'
  ],
  'astronomy': [
    'astronomy', 'space', 'nasa', 'telescope', 'planet', 'star', 'galaxy',
    'cosmos', 'rocket', 'satellite', 'mars', 'moon', 'solar', 'nebula',
    'black hole', 'exoplanet', 'spacecraft', 'spacex', 'astrophysics'
  ],
  'math': [
    'mathematics', 'math', 'theorem', 'proof', 'algebra', 'geometry',
    'calculus', 'statistics', 'equation', 'formula', 'prime', 'number theory',
    'topology', 'combinatorics', 'probability', 'graph theory'
  ],
  'ai': [
    'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'machine learning',
    'neural network', 'deep learning', 'nlp', 'transformer', 'chatgpt',
    'anthropic', 'openai', 'diffusion', 'stable diffusion', 'midjourney',
    'model', 'training', 'inference', 'agi', 'ml'
  ],
  'godot': [
    'godot', 'gdscript', 'game engine', 'indie game', 'game dev', 'gamedev',
    '2d game', '3d game', 'pixel art', 'sprite', 'tilemap', 'shader'
  ],
  'graphic-design': [
    'graphic design', 'typography', 'branding', 'logo', 'visual design',
    'illustrator', 'photoshop', 'figma', 'poster', 'print', 'layout',
    'color theory', 'composition', 'vector', 'adobe'
  ],
  'ui-ux': [
    'ui', 'ux', 'user experience', 'user interface', 'usability',
    'interaction design', 'figma', 'prototype', 'wireframe', 'user research',
    'accessibility', 'a11y', 'design system', 'component'
  ],
  'art': [
    'art', 'digital art', 'illustration', 'painting', 'drawing', 'artist',
    'artwork', 'sketch', 'portrait', 'landscape', 'abstract', 'realism',
    'concept art', 'character design', 'artstation', 'deviantart'
  ],
  'mtg': [
    'magic the gathering', 'mtg', 'commander', 'standard', 'draft', 'edh',
    'wizards of the coast', 'wotc', 'modern', 'legacy', 'vintage', 'pioneer',
    'deck', 'sideboard', 'meta', 'spoiler', 'set', 'arena'
  ],
  'blender': [
    'blender', '3d modeling', '3d art', 'render', 'sculpting', 'animation',
    'cycles', 'eevee', 'geometry nodes', 'texture', 'uv mapping', 'rigging',
    'blender3d', 'b3d', 'donut tutorial'
  ],
  'spirituality': [
    'spirituality', 'meditation', 'mindfulness', 'consciousness', 'philosophy',
    'wisdom', 'zen', 'buddhism', 'yoga', 'awareness', 'presence', 'soul',
    'enlightenment', 'self-improvement', 'inner peace', 'stoicism'
  ],
  'youtube': [], // Special case - curated by channel/category
};

// Reddit subreddits to monitor per node
export const REDDIT_SOURCES: Record<string, string[]> = {
  'technology': ['technology', 'tech', 'gadgets', 'Futurology'],
  'science': ['science', 'EverythingScience', 'Astronomy', 'Physics'],
  'programming': ['programming', 'learnprogramming', 'webdev', 'javascript', 'typescript', 'rust', 'python'],
  'astronomy': ['Astronomy', 'space', 'astrophotography', 'spacex', 'nasa'],
  'math': ['math', 'learnmath', 'mathematics', 'matheducation'],
  'ai': ['MachineLearning', 'LocalLLaMA', 'artificial', 'ChatGPT', 'ClaudeAI', 'singularity'],
  'godot': ['godot', 'gamedev', 'indiegaming', 'IndieDev'],
  'graphic-design': ['graphic_design', 'Design', 'typography', 'logodesign'],
  'ui-ux': ['userexperience', 'UI_Design', 'UXDesign', 'web_design'],
  'art': ['Art', 'DigitalArt', 'ArtPorn', 'ImaginaryLandscapes', 'conceptart'],
  'mtg': ['magicTCG', 'MagicArena', 'EDH', 'ModernMagic', 'CompetitiveEDH'],
  'blender': ['blender', 'blenderhelp', '3Dmodeling'],
  'spirituality': ['spirituality', 'Meditation', 'philosophy', 'Stoicism', 'Buddhism'],
  'youtube': [], // YouTube has its own API
};

// RSS feeds to monitor
export const RSS_FEEDS: Record<string, string[]> = {
  'technology': [
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.theverge.com/rss/index.xml',
    'https://techcrunch.com/feed/',
  ],
  'science': [
    'https://www.quantamagazine.org/feed/',
    'https://www.sciencedaily.com/rss/all.xml',
  ],
  'programming': [
    'https://news.ycombinator.com/rss',
    'https://dev.to/feed',
  ],
  'ai': [
    'https://www.anthropic.com/feed.xml',
  ],
};

// Harvester thresholds
export const THRESHOLDS = {
  reddit: {
    minUpvotes: 50,
    maxAgeHours: 24,
  },
  hackernews: {
    minPoints: 30,
    maxAgeHours: 24,
  },
  bluesky: {
    minLikes: 20,
    maxAgeHours: 24,
  },
  youtube: {
    minViews: 10000,
    maxAgeHours: 48,
  },
  rss: {
    maxAgeHours: 24,
  },
};

// Categorize content by matching keywords
export function categorizeContent(title: string, content?: string): string | null {
  const text = `${title} ${content || ''}`.toLowerCase();

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [nodeSlug, keywords] of Object.entries(NODE_KEYWORDS)) {
    if (keywords.length === 0) continue; // Skip nodes without keywords (e.g., youtube)

    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Longer keywords are more specific, worth more
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = nodeSlug;
    }
  }

  return bestMatch;
}
