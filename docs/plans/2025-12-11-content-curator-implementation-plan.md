# Content Curator Implementation Plan

**Created:** December 11, 2025
**Design Doc:** `docs/plans/2025-12-11-content-curator-design.md`
**Status:** Ready for implementation

---

## Executive Summary

This plan implements a two-stage content curation pipeline:
1. **Harvester** (cron every 15 min): Pulls from Reddit, HN, Bluesky, RSS, YouTube
2. **Curator** (Claude Code every 1 hour): AI evaluates and posts as themed bot personas

The system creates 14 bot accounts that post curated content to 14 matching nodes.

---

## Phase 1: Database Schema & Foundation

### Task 1.1: Add Schema Changes to Prisma

**File:** `backend/api/prisma/schema.prisma`

Add the following after the `Appeal` model (around line 896):

```prisma
// ============================================
// CONTENT CURATOR SYSTEM
// ============================================

// Add isBot and botConfig to User model
// IMPORTANT: Add these fields to the existing User model, around line 68

// Staging area for harvested content
model CurationQueue {
  id            String   @id @default(uuid())

  // Source info
  sourceType    String   // "reddit" | "hackernews" | "bluesky" | "rss" | "youtube"
  sourceId      String   // Original post ID from source (for dedup)
  sourceUrl     String   // Link back to original
  sourceScore   Int?     // Upvotes/points from source platform
  subreddit     String?  // For Reddit: which subreddit

  // Content
  title         String
  content       String?  @db.Text // Body text or description
  linkUrl       String?  // External link if it's a link post
  mediaUrl      String?  // Image/video URL if applicable

  // Curation
  suggestedNode String?  // Which node slug this might belong to
  aiScore       Int?     // 1-10 score from Claude
  aiReason      String?  @db.Text // Why Claude scored it this way
  status        String   @default("pending") // "pending" | "approved" | "rejected" | "posted"

  // Hybrid mode
  confidence    Float?   // How confident Claude is (0-1)
  needsReview   Boolean  @default(false)

  // Metadata
  createdAt     DateTime @default(now())
  curatedAt     DateTime?
  postedAt      DateTime?
  postedById    String?  // Which bot user posted it
  postId        String?  // Resulting Post ID if posted

  feedback      CurationFeedback[]

  @@unique([sourceType, sourceId])
  @@index([status, createdAt])
  @@index([needsReview, status])
  @@index([suggestedNode])
  @@map("curation_queue")
}

// Track pagination cursors per source
model HarvestCursor {
  id          String   @id @default(uuid())
  sourceType  String   @unique // "reddit:r/technology" | "hackernews" | etc
  lastSeenId  String?  // Last item ID we processed
  lastRunAt   DateTime @default(now())
  metadata    Json?    // Additional cursor data (e.g., after tokens)

  @@map("harvest_cursors")
}

// Track Q's feedback for learning
model CurationFeedback {
  id            String   @id @default(uuid())
  queueItemId   String
  queueItem     CurationQueue @relation(fields: [queueItemId], references: [id], onDelete: Cascade)
  decision      String   // "approved" | "rejected"
  reason        String?  // "clickbait" | "boring" | "wrong-node" | "duplicate" | "valuable"
  createdAt     DateTime @default(now())

  @@index([queueItemId])
  @@index([createdAt])
  @@map("curation_feedback")
}
```

**Also add these fields to the existing `User` model (around line 68, after `lastActiveAt`):**

```prisma
  // Bot Configuration
  isBot         Boolean  @default(false)
  botConfig     Json?    // { persona: "TechDigest", nodeSlug: "technology" }
```

### Task 1.2: Run Prisma Migration

**Commands:**
```bash
cd /Users/joshhd/Documents/node-social/backend/api
npx prisma migrate dev --name add_content_curator_system
```

**Expected output:** Migration creates 3 new tables + 2 new columns on User.

### Task 1.3: Create Bot Seed Script

**File:** `backend/api/prisma/seedBots.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Bot definitions with their target nodes
const BOTS = [
  {
    username: 'TechDigest',
    displayName: 'Tech Digest',
    nodeSlug: 'technology',
    bio: 'Curating the best in tech. AI-powered, human-approved.',
    avatar: null, // Can add later
  },
  {
    username: 'ScienceDaily',
    displayName: 'Science Daily',
    nodeSlug: 'science',
    bio: 'Your daily dose of scientific discovery.',
    avatar: null,
  },
  {
    username: 'CodeCurator',
    displayName: 'Code Curator',
    nodeSlug: 'programming',
    bio: 'Quality code content, zero fluff.',
    avatar: null,
  },
  {
    username: 'CosmicNews',
    displayName: 'Cosmic News',
    nodeSlug: 'astronomy',
    bio: 'Eyes on the universe.',
    avatar: null,
  },
  {
    username: 'MathMind',
    displayName: 'Math Mind',
    nodeSlug: 'math',
    bio: 'Beautiful mathematics, elegantly explained.',
    avatar: null,
  },
  {
    username: 'AIInsider',
    displayName: 'AI Insider',
    nodeSlug: 'ai',
    bio: 'Tracking the AI revolution.',
    avatar: null,
  },
  {
    username: 'GodotGuru',
    displayName: 'Godot Guru',
    nodeSlug: 'godot',
    bio: 'Game dev with Godot, tutorials and news.',
    avatar: null,
  },
  {
    username: 'DesignDaily',
    displayName: 'Design Daily',
    nodeSlug: 'graphic-design',
    bio: 'Inspiration for visual creators.',
    avatar: null,
  },
  {
    username: 'UXCurator',
    displayName: 'UX Curator',
    nodeSlug: 'ui-ux',
    bio: 'Better interfaces, better experiences.',
    avatar: null,
  },
  {
    username: 'ArtStream',
    displayName: 'Art Stream',
    nodeSlug: 'art',
    bio: 'Digital and traditional art that inspires.',
    avatar: null,
  },
  {
    username: 'MTGDigest',
    displayName: 'MTG Digest',
    nodeSlug: 'mtg',
    bio: 'Magic: The Gathering news and strategy.',
    avatar: null,
  },
  {
    username: 'BlenderBot',
    displayName: 'Blender Bot',
    nodeSlug: 'blender',
    bio: '3D art and Blender tutorials.',
    avatar: null,
  },
  {
    username: 'SoulSeeker',
    displayName: 'Soul Seeker',
    nodeSlug: 'spirituality',
    bio: 'Mindfulness, meditation, and meaning.',
    avatar: null,
  },
  {
    username: 'TubeWatch',
    displayName: 'Tube Watch',
    nodeSlug: 'youtube',
    bio: 'The best of YouTube, curated.',
    avatar: null,
  },
];

// Node definitions to create
const NODES = [
  { slug: 'technology', name: 'Technology', description: 'Tech news, gadgets, and innovation', color: '#3B82F6' },
  { slug: 'science', name: 'Science', description: 'Scientific discoveries and research', color: '#10B981' },
  { slug: 'programming', name: 'Programming', description: 'Code, tutorials, and developer news', color: '#8B5CF6' },
  { slug: 'astronomy', name: 'Astronomy', description: 'Space, stars, and the cosmos', color: '#1E3A5F' },
  { slug: 'math', name: 'Mathematics', description: 'Beautiful proofs and mathematical insights', color: '#F59E0B' },
  { slug: 'ai', name: 'Artificial Intelligence', description: 'AI, ML, and the future of intelligence', color: '#EC4899' },
  { slug: 'godot', name: 'Godot', description: 'Godot game engine tutorials and news', color: '#478CBF' },
  { slug: 'graphic-design', name: 'Graphic Design', description: 'Visual design inspiration and techniques', color: '#F97316' },
  { slug: 'ui-ux', name: 'UI/UX Design', description: 'User experience and interface design', color: '#06B6D4' },
  { slug: 'art', name: 'Art', description: 'Digital and traditional art', color: '#EF4444' },
  { slug: 'mtg', name: 'Magic: The Gathering', description: 'MTG news, strategy, and community', color: '#854D0E' },
  { slug: 'blender', name: 'Blender', description: '3D modeling and animation with Blender', color: '#EA7600' },
  { slug: 'spirituality', name: 'Spirituality', description: 'Mindfulness, meditation, and meaning', color: '#7C3AED' },
  { slug: 'youtube', name: 'YouTube', description: 'The best of YouTube, curated', color: '#FF0000' },
];

async function main() {
  console.log('Seeding curator nodes and bots...');

  // Get all vectors for node weight initialization
  const allVectors = await prisma.vibeVector.findMany();

  // Create nodes first
  console.log('\n--- Creating Nodes ---');
  for (const nodeData of NODES) {
    const node = await prisma.node.upsert({
      where: { slug: nodeData.slug },
      update: {
        name: nodeData.name,
        description: nodeData.description,
        color: nodeData.color,
      },
      create: nodeData,
    });
    console.log(`✓ Node: ${node.name} (${node.slug})`);

    // Initialize default vibe weights for this node
    for (const vector of allVectors) {
      await prisma.nodeVibeWeight.upsert({
        where: {
          nodeId_vectorId: {
            nodeId: node.id,
            vectorId: vector.id,
          },
        },
        update: {},
        create: {
          nodeId: node.id,
          vectorId: vector.id,
          weight: 1.0,
        },
      });
    }
  }

  // Create bot users
  console.log('\n--- Creating Bot Users ---');

  // Generate a secure random password for bots (they won't use it)
  const botPassword = await argon2.hash('bot-account-no-login-' + Date.now());

  for (const botData of BOTS) {
    // Find the target node
    const node = await prisma.node.findUnique({ where: { slug: botData.nodeSlug } });
    if (!node) {
      console.error(`✗ Node not found for bot ${botData.username}: ${botData.nodeSlug}`);
      continue;
    }

    const bot = await prisma.user.upsert({
      where: { username: botData.username },
      update: {
        bio: botData.bio,
        isBot: true,
        botConfig: {
          persona: botData.displayName,
          nodeSlug: botData.nodeSlug,
          nodeId: node.id,
        },
      },
      create: {
        email: `${botData.username.toLowerCase()}@node.bot`,
        password: botPassword,
        username: botData.username,
        firstName: botData.displayName.split(' ')[0],
        lastName: botData.displayName.split(' ').slice(1).join(' ') || null,
        bio: botData.bio,
        avatar: botData.avatar,
        emailVerified: true, // Bots don't need verification
        isBot: true,
        botConfig: {
          persona: botData.displayName,
          nodeSlug: botData.nodeSlug,
          nodeId: node.id,
        },
      },
    });
    console.log(`✓ Bot: @${bot.username} → ${botData.nodeSlug}`);

    // Subscribe bot to its own node
    await prisma.nodeSubscription.upsert({
      where: {
        userId_nodeId: {
          userId: bot.id,
          nodeId: node.id,
        },
      },
      update: {},
      create: {
        userId: bot.id,
        nodeId: node.id,
        role: 'member',
      },
    });
  }

  console.log('\n✓ Seeding complete!');
  console.log(`  - ${NODES.length} nodes created/updated`);
  console.log(`  - ${BOTS.length} bots created/updated`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Run with:**
```bash
cd /Users/joshhd/Documents/node-social/backend/api
npx tsx prisma/seedBots.ts
```

### Task 1.4: Create Logs Directory

**Commands:**
```bash
mkdir -p /Users/joshhd/Documents/node-social/logs
touch /Users/joshhd/Documents/node-social/logs/.gitkeep
echo "logs/*.log" >> /Users/joshhd/Documents/node-social/.gitignore
```

### Task 1.5: Add package.json scripts

**File:** `backend/api/package.json`

Add to scripts section:
```json
{
  "scripts": {
    "seed:bots": "tsx prisma/seedBots.ts",
    "harvest": "tsx src/jobs/harvester.ts",
    "curate:test": "tsx src/jobs/testCurator.ts"
  }
}
```

---

## Phase 2: Harvester Implementation

### Task 2.1: Create Jobs Directory Structure

**Commands:**
```bash
mkdir -p /Users/joshhd/Documents/node-social/backend/api/src/jobs
mkdir -p /Users/joshhd/Documents/node-social/backend/api/src/jobs/harvesters
```

### Task 2.2: Create Harvester Configuration

**File:** `backend/api/src/jobs/harvesterConfig.ts`

```typescript
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
    'https://openai.com/blog/rss/',
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
```

### Task 2.3: Create Base Harvester Class

**File:** `backend/api/src/jobs/harvesters/BaseHarvester.ts`

```typescript
import { PrismaClient, CurationQueue, HarvestCursor } from '@prisma/client';

export interface HarvestResult {
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  sourceScore?: number;
  subreddit?: string;
  title: string;
  content?: string;
  linkUrl?: string;
  mediaUrl?: string;
  suggestedNode?: string;
}

export abstract class BaseHarvester {
  protected prisma: PrismaClient;
  protected sourceType: string;

  constructor(prisma: PrismaClient, sourceType: string) {
    this.prisma = prisma;
    this.sourceType = sourceType;
  }

  // Abstract method - each harvester implements its own fetch logic
  abstract fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }>;

  // Get or create cursor for this source
  async getCursor(sourceKey: string): Promise<HarvestCursor | null> {
    return this.prisma.harvestCursor.findUnique({
      where: { sourceType: sourceKey },
    });
  }

  // Update cursor after successful fetch
  async updateCursor(sourceKey: string, lastSeenId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.prisma.harvestCursor.upsert({
      where: { sourceType: sourceKey },
      update: {
        lastSeenId,
        lastRunAt: new Date(),
        metadata: metadata || undefined,
      },
      create: {
        sourceType: sourceKey,
        lastSeenId,
        lastRunAt: new Date(),
        metadata: metadata || undefined,
      },
    });
  }

  // Check if item already exists in queue
  async isDuplicate(sourceType: string, sourceId: string): Promise<boolean> {
    const existing = await this.prisma.curationQueue.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType,
          sourceId,
        },
      },
    });
    return existing !== null;
  }

  // Add item to curation queue
  async queueItem(item: HarvestResult): Promise<CurationQueue | null> {
    // Check for duplicate
    if (await this.isDuplicate(item.sourceType, item.sourceId)) {
      return null;
    }

    return this.prisma.curationQueue.create({
      data: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        sourceScore: item.sourceScore,
        subreddit: item.subreddit,
        title: item.title,
        content: item.content,
        linkUrl: item.linkUrl,
        mediaUrl: item.mediaUrl,
        suggestedNode: item.suggestedNode,
        status: 'pending',
      },
    });
  }

  // Main harvest loop
  async harvest(): Promise<{ queued: number; skipped: number; errors: string[] }> {
    const stats = { queued: 0, skipped: 0, errors: [] as string[] };

    try {
      const cursor = await this.getCursor(this.sourceType);
      const { items, newCursor, metadata } = await this.fetchItems(cursor);

      for (const item of items) {
        try {
          const result = await this.queueItem(item);
          if (result) {
            stats.queued++;
            console.log(`  ✓ Queued: ${item.title.slice(0, 60)}...`);
          } else {
            stats.skipped++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.errors.push(`Failed to queue "${item.title.slice(0, 30)}...": ${msg}`);
        }
      }

      // Update cursor if we got new items
      if (newCursor) {
        await this.updateCursor(this.sourceType, newCursor, metadata);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`Harvest failed: ${msg}`);
    }

    return stats;
  }
}
```

### Task 2.4: Create Reddit Harvester

**File:** `backend/api/src/jobs/harvesters/RedditHarvester.ts`

```typescript
import { PrismaClient, HarvestCursor } from '@prisma/client';
import { BaseHarvester, HarvestResult } from './BaseHarvester.js';
import { REDDIT_SOURCES, THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface RedditPost {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    subreddit: string;
    score: number;
    created_utc: number;
    is_self: boolean;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source: { url: string };
      }>;
    };
    media?: {
      reddit_video?: { fallback_url: string };
    };
  };
}

interface RedditResponse {
  kind: string;
  data: {
    children: RedditPost[];
    after?: string;
  };
}

export class RedditHarvester extends BaseHarvester {
  private targetNode: string;
  private subreddits: string[];

  constructor(prisma: PrismaClient, targetNode: string) {
    super(prisma, `reddit:${targetNode}`);
    this.targetNode = targetNode;
    this.subreddits = REDDIT_SOURCES[targetNode] || [];
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }> {
    const items: HarvestResult[] = [];
    const { minUpvotes, maxAgeHours } = THRESHOLDS.reddit;
    const cutoffTime = Date.now() / 1000 - maxAgeHours * 60 * 60;

    for (const subreddit of this.subreddits) {
      try {
        // Fetch hot posts from subreddit (no auth needed for public data)
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'NodeSocial/1.0 (Content Curator)',
          },
        });

        if (!response.ok) {
          console.error(`  ✗ Reddit r/${subreddit}: ${response.status}`);
          continue;
        }

        const data: RedditResponse = await response.json();

        for (const post of data.data.children) {
          const p = post.data;

          // Skip if too old or not enough upvotes
          if (p.created_utc < cutoffTime) continue;
          if (p.score < minUpvotes) continue;

          // Skip stickied posts, ads, etc.
          if (p.id.startsWith('t3_')) continue; // Skip if it's a crosspost reference

          // Determine the link URL
          let linkUrl: string | undefined;
          if (!p.is_self && p.url && !p.url.includes('reddit.com')) {
            linkUrl = p.url;
          }

          // Get media URL if available
          let mediaUrl: string | undefined;
          if (p.preview?.images?.[0]?.source?.url) {
            mediaUrl = p.preview.images[0].source.url.replace(/&amp;/g, '&');
          } else if (p.media?.reddit_video?.fallback_url) {
            mediaUrl = p.media.reddit_video.fallback_url;
          }

          // Use keyword matching or default to target node
          const suggestedNode = categorizeContent(p.title, p.selftext) || this.targetNode;

          items.push({
            sourceType: 'reddit',
            sourceId: p.id,
            sourceUrl: `https://reddit.com${p.permalink}`,
            sourceScore: p.score,
            subreddit: p.subreddit,
            title: p.title,
            content: p.selftext || undefined,
            linkUrl,
            mediaUrl,
            suggestedNode,
          });
        }

        console.log(`  → r/${subreddit}: ${items.length} candidates`);

        // Be nice to Reddit API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`  ✗ Reddit r/${subreddit}:`, err);
      }
    }

    return { items };
  }
}

// Factory function to create harvesters for all configured nodes
export function createRedditHarvesters(prisma: PrismaClient): RedditHarvester[] {
  return Object.keys(REDDIT_SOURCES)
    .filter(node => REDDIT_SOURCES[node].length > 0)
    .map(node => new RedditHarvester(prisma, node));
}
```

### Task 2.5: Create Hacker News Harvester

**File:** `backend/api/src/jobs/harvesters/HackerNewsHarvester.ts`

```typescript
import { PrismaClient, HarvestCursor } from '@prisma/client';
import { BaseHarvester, HarvestResult } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  time: number;
  type: string;
  by: string;
}

export class HackerNewsHarvester extends BaseHarvester {
  constructor(prisma: PrismaClient) {
    super(prisma, 'hackernews');
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
    metadata?: Record<string, unknown>;
  }> {
    const items: HarvestResult[] = [];
    const { minPoints, maxAgeHours } = THRESHOLDS.hackernews;
    const cutoffTime = Date.now() / 1000 - maxAgeHours * 60 * 60;

    try {
      // Fetch top stories
      const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const topStoryIds: number[] = await topStoriesRes.json();

      // Get last seen ID to avoid re-processing
      const lastSeenId = cursor?.lastSeenId ? parseInt(cursor.lastSeenId, 10) : 0;

      // Fetch details for top 50 stories
      const storiesToFetch = topStoryIds.slice(0, 50);

      for (const storyId of storiesToFetch) {
        // Skip if we've seen this before (but still check score/age)
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
          const item: HNItem = await itemRes.json();

          if (!item || item.type !== 'story') continue;
          if (item.time < cutoffTime) continue;
          if (item.score < minPoints) continue;

          // Categorize based on title
          const suggestedNode = categorizeContent(item.title, item.text);

          items.push({
            sourceType: 'hackernews',
            sourceId: String(item.id),
            sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
            sourceScore: item.score,
            title: item.title,
            content: item.text || undefined,
            linkUrl: item.url || undefined,
            suggestedNode: suggestedNode || 'technology', // Default to tech
          });

        } catch (err) {
          // Skip individual story errors
          continue;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`  → Hacker News: ${items.length} candidates`);

      // Use highest story ID as cursor
      const newCursor = storiesToFetch.length > 0 ? String(Math.max(...storiesToFetch)) : undefined;

      return { items, newCursor };

    } catch (err) {
      console.error('  ✗ Hacker News:', err);
      return { items };
    }
  }
}
```

### Task 2.6: Create RSS Harvester

**File:** `backend/api/src/jobs/harvesters/RSSHarvester.ts`

```typescript
import { PrismaClient, HarvestCursor } from '@prisma/client';
import { BaseHarvester, HarvestResult } from './BaseHarvester.js';
import { RSS_FEEDS, THRESHOLDS, categorizeContent } from '../harvesterConfig.js';
import { XMLParser } from 'fast-xml-parser';

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  'content:encoded'?: string;
}

interface RSSChannel {
  item: RSSItem | RSSItem[];
}

interface RSSFeed {
  rss?: { channel: RSSChannel };
  feed?: { entry: RSSItem | RSSItem[] }; // Atom format
}

export class RSSHarvester extends BaseHarvester {
  private targetNode: string;
  private feeds: string[];

  constructor(prisma: PrismaClient, targetNode: string) {
    super(prisma, `rss:${targetNode}`);
    this.targetNode = targetNode;
    this.feeds = RSS_FEEDS[targetNode] || [];
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];
    const { maxAgeHours } = THRESHOLDS.rss;
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const parser = new XMLParser({ ignoreAttributes: false });

    for (const feedUrl of this.feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'NodeSocial/1.0 (Content Curator)',
          },
        });

        if (!response.ok) {
          console.error(`  ✗ RSS ${feedUrl}: ${response.status}`);
          continue;
        }

        const xml = await response.text();
        const parsed: RSSFeed = parser.parse(xml);

        // Handle both RSS and Atom formats
        let feedItems: RSSItem[] = [];
        if (parsed.rss?.channel?.item) {
          feedItems = Array.isArray(parsed.rss.channel.item)
            ? parsed.rss.channel.item
            : [parsed.rss.channel.item];
        } else if (parsed.feed?.entry) {
          feedItems = Array.isArray(parsed.feed.entry)
            ? parsed.feed.entry
            : [parsed.feed.entry];
        }

        for (const item of feedItems) {
          // Check age
          if (item.pubDate) {
            const pubDate = new Date(item.pubDate);
            if (pubDate < cutoffTime) continue;
          }

          // Generate a unique ID from the link or guid
          const sourceId = item.guid || item.link || `${feedUrl}:${item.title}`;

          // Extract content
          const content = item['content:encoded'] || item.description || undefined;

          // Categorize
          const suggestedNode = categorizeContent(item.title, content) || this.targetNode;

          items.push({
            sourceType: 'rss',
            sourceId: Buffer.from(sourceId).toString('base64').slice(0, 100),
            sourceUrl: item.link,
            title: item.title,
            content: content?.slice(0, 2000), // Truncate long content
            linkUrl: item.link,
            suggestedNode,
          });
        }

        console.log(`  → RSS ${new URL(feedUrl).hostname}: ${feedItems.length} items`);

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`  ✗ RSS ${feedUrl}:`, err);
      }
    }

    return { items };
  }
}

// Factory function
export function createRSSHarvesters(prisma: PrismaClient): RSSHarvester[] {
  return Object.keys(RSS_FEEDS)
    .filter(node => RSS_FEEDS[node].length > 0)
    .map(node => new RSSHarvester(prisma, node));
}
```

### Task 2.7: Create Bluesky Harvester

**File:** `backend/api/src/jobs/harvesters/BlueskyHarvester.ts`

```typescript
import { PrismaClient, HarvestCursor } from '@prisma/client';
import { BaseHarvester, HarvestResult } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

// Bluesky AT Protocol types (simplified)
interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: {
      $type: string;
      external?: {
        uri: string;
        title: string;
        description?: string;
        thumb?: { ref: { $link: string } };
      };
      images?: Array<{
        alt?: string;
        image: { ref: { $link: string } };
      }>;
    };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

interface BlueskyFeedResponse {
  feed: Array<{
    post: BlueskyPost;
  }>;
  cursor?: string;
}

export class BlueskyHarvester extends BaseHarvester {
  constructor(prisma: PrismaClient) {
    super(prisma, 'bluesky');
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];
    const { minLikes, maxAgeHours } = THRESHOLDS.bluesky;
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    try {
      // Fetch from "What's Hot" feed (public, no auth needed)
      // Note: Bluesky's public API is rate-limited
      const url = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?' +
        new URLSearchParams({
          feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
          limit: '50',
        });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeSocial/1.0 (Content Curator)',
        },
      });

      if (!response.ok) {
        // Bluesky might require auth for some feeds
        console.error(`  ✗ Bluesky: ${response.status} - may need auth`);
        return { items };
      }

      const data: BlueskyFeedResponse = await response.json();

      for (const { post } of data.feed) {
        // Check age
        const createdAt = new Date(post.record.createdAt);
        if (createdAt < cutoffTime) continue;

        // Check engagement
        const likes = post.likeCount || 0;
        if (likes < minLikes) continue;

        // Extract link if present
        let linkUrl: string | undefined;
        let title = post.record.text.split('\n')[0].slice(0, 200); // First line as title

        if (post.record.embed?.external) {
          linkUrl = post.record.embed.external.uri;
          title = post.record.embed.external.title || title;
        }

        // Extract media
        let mediaUrl: string | undefined;
        if (post.record.embed?.images?.[0]) {
          // Bluesky image CDN URL construction
          const img = post.record.embed.images[0];
          if (img.image?.ref?.$link) {
            mediaUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author.did}/${img.image.ref.$link}@jpeg`;
          }
        }

        // Categorize
        const suggestedNode = categorizeContent(title, post.record.text);

        items.push({
          sourceType: 'bluesky',
          sourceId: post.uri,
          sourceUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
          sourceScore: likes,
          title,
          content: post.record.text,
          linkUrl,
          mediaUrl,
          suggestedNode,
        });
      }

      console.log(`  → Bluesky: ${items.length} candidates`);

      return { items, newCursor: data.cursor };

    } catch (err) {
      console.error('  ✗ Bluesky:', err);
      return { items };
    }
  }
}
```

### Task 2.8: Create YouTube Harvester

**File:** `backend/api/src/jobs/harvesters/YouTubeHarvester.ts`

```typescript
import { PrismaClient, HarvestCursor } from '@prisma/client';
import { BaseHarvester, HarvestResult } from './BaseHarvester.js';
import { THRESHOLDS, categorizeContent } from '../harvesterConfig.js';

interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
}

// Channels to monitor for specific categories
const YOUTUBE_CHANNELS: Record<string, string[]> = {
  'technology': ['MKBHD', 'LinusTechTips', 'VergeScience'],
  'science': ['Kurzgesagt', 'Vsauce', 'Veritasium', 'SmarterEveryDay'],
  'programming': ['Fireship', 'ThePrimeagen', 'TraversyMedia'],
  'ai': ['TwoMinutePapers', 'YannicKilcher', 'AIExplained'],
  'godot': ['GDQuest', 'HeartBeast', 'KidsCanCode'],
  'blender': ['BlenderGuru', 'GrantAbbitt', 'CGMatter'],
  'math': ['3Blue1Brown', 'Numberphile', 'MathologerWS'],
  'astronomy': ['SpaceX', 'NASA', 'ScottManley', 'EverydayAstronaut'],
};

// Search queries for nodes without specific channels
const YOUTUBE_QUERIES: Record<string, string[]> = {
  'mtg': ['magic the gathering', 'mtg commander', 'mtg arena'],
  'graphic-design': ['graphic design tutorial', 'logo design'],
  'ui-ux': ['ui ux design', 'figma tutorial'],
  'art': ['digital art tutorial', 'digital painting'],
  'spirituality': ['meditation guide', 'mindfulness practice'],
};

export class YouTubeHarvester extends BaseHarvester {
  private apiKey: string | undefined;

  constructor(prisma: PrismaClient) {
    super(prisma, 'youtube');
    this.apiKey = process.env.YOUTUBE_API_KEY;
  }

  async fetchItems(cursor: HarvestCursor | null): Promise<{
    items: HarvestResult[];
    newCursor?: string;
  }> {
    const items: HarvestResult[] = [];

    if (!this.apiKey) {
      console.log('  ⚠ YouTube: No API key configured (YOUTUBE_API_KEY)');
      return { items };
    }

    const { minViews, maxAgeHours } = THRESHOLDS.youtube;
    const publishedAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    // Search by queries
    for (const [nodeSlug, queries] of Object.entries(YOUTUBE_QUERIES)) {
      for (const query of queries) {
        try {
          const url = 'https://www.googleapis.com/youtube/v3/search?' +
            new URLSearchParams({
              part: 'snippet',
              q: query,
              type: 'video',
              maxResults: '10',
              order: 'viewCount',
              publishedAfter,
              key: this.apiKey,
            });

          const response = await fetch(url);
          if (!response.ok) {
            console.error(`  ✗ YouTube search "${query}": ${response.status}`);
            continue;
          }

          const data: YouTubeSearchResponse = await response.json();

          for (const video of data.items) {
            const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
            const thumbnail = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url;

            items.push({
              sourceType: 'youtube',
              sourceId: video.id.videoId,
              sourceUrl: videoUrl,
              title: video.snippet.title,
              content: video.snippet.description?.slice(0, 500),
              linkUrl: videoUrl,
              mediaUrl: thumbnail,
              suggestedNode: nodeSlug,
            });
          }

          console.log(`  → YouTube "${query}": ${data.items.length} videos`);

          // Rate limit (YouTube API has quotas)
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (err) {
          console.error(`  ✗ YouTube "${query}":`, err);
        }
      }
    }

    return { items };
  }
}
```

### Task 2.9: Create Main Harvester Runner

**File:** `backend/api/src/jobs/harvester.ts`

```typescript
#!/usr/bin/env npx tsx

/**
 * Content Harvester
 *
 * Runs every 15 minutes via cron to pull content from various sources
 * and add candidates to the CurationQueue for Claude to evaluate.
 *
 * Usage:
 *   npx tsx src/jobs/harvester.ts
 *   npm run harvest
 *
 * Cron:
 *   */15 * * * * cd /Users/joshhd/Documents/node-social/backend/api && npx tsx src/jobs/harvester.ts >> /Users/joshhd/Documents/node-social/logs/harvester.log 2>&1
 */

import { PrismaClient } from '@prisma/client';
import { createRedditHarvesters } from './harvesters/RedditHarvester.js';
import { HackerNewsHarvester } from './harvesters/HackerNewsHarvester.js';
import { createRSSHarvesters } from './harvesters/RSSHarvester.js';
import { BlueskyHarvester } from './harvesters/BlueskyHarvester.js';
import { YouTubeHarvester } from './harvesters/YouTubeHarvester.js';

const prisma = new PrismaClient();

interface HarvestStats {
  source: string;
  queued: number;
  skipped: number;
  errors: string[];
}

async function runHarvest(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HARVEST STARTED: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const allStats: HarvestStats[] = [];

  // Create all harvesters
  const harvesters = [
    ...createRedditHarvesters(prisma),
    new HackerNewsHarvester(prisma),
    ...createRSSHarvesters(prisma),
    new BlueskyHarvester(prisma),
    new YouTubeHarvester(prisma),
  ];

  // Run each harvester
  for (const harvester of harvesters) {
    const sourceType = (harvester as any).sourceType;
    console.log(`\n--- ${sourceType} ---`);

    try {
      const stats = await harvester.harvest();
      allStats.push({
        source: sourceType,
        queued: stats.queued,
        skipped: stats.skipped,
        errors: stats.errors,
      });

      if (stats.errors.length > 0) {
        console.log(`  ⚠ Errors: ${stats.errors.length}`);
        for (const err of stats.errors.slice(0, 3)) {
          console.log(`    - ${err}`);
        }
      }

    } catch (err) {
      console.error(`  ✗ FATAL:`, err);
      allStats.push({
        source: sourceType,
        queued: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalQueued = allStats.reduce((sum, s) => sum + s.queued, 0);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = allStats.reduce((sum, s) => sum + s.errors.length, 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`HARVEST COMPLETE: ${elapsed}s`);
  console.log(`  Queued: ${totalQueued} | Skipped (dupes): ${totalSkipped} | Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get queue stats
  const queueStats = await prisma.curationQueue.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log('Queue Status:');
  for (const stat of queueStats) {
    console.log(`  ${stat.status}: ${stat._count}`);
  }
}

// Run and exit
runHarvest()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Harvest failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
```

### Task 2.10: Install Required Dependencies

**Command:**
```bash
cd /Users/joshhd/Documents/node-social/backend/api
npm install fast-xml-parser
```

### Task 2.11: Set Up Cron Job

**Command:**
```bash
# Edit crontab
crontab -e

# Add this line:
*/15 * * * * cd /Users/joshhd/Documents/node-social/backend/api && /opt/homebrew/bin/npx tsx src/jobs/harvester.ts >> /Users/joshhd/Documents/node-social/logs/harvester.log 2>&1
```

---

## Phase 3: Claude Code Curator

### Task 3.1: Create Claude Commands Directory

**Command:**
```bash
mkdir -p /Users/joshhd/Documents/node-social/.claude/commands
```

### Task 3.2: Create Curate Slash Command

**File:** `/Users/joshhd/Documents/node-social/.claude/commands/curate.md`

```markdown
---
description: Curate pending content from CurationQueue and post as bot accounts
---

You are Q's personal content curator for Node Social. Your job is to evaluate pending content and post the best stuff as themed bot accounts.

## Your Task

1. Query the database for pending items:
   ```bash
   cd /Users/joshhd/Documents/node-social/backend/api
   npx tsx -e "
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   async function main() {
     const items = await prisma.curationQueue.findMany({
       where: { status: 'pending' },
       orderBy: { createdAt: 'asc' },
       take: 20,
     });
     console.log(JSON.stringify(items, null, 2));
     await prisma.\$disconnect();
   }
   main();
   "
   ```

2. For each item, evaluate on a 1-10 scale:
   - **Quality (1-10)**: Is this insightful, interesting, or valuable?
   - **Relevance**: Does it fit Q's interests?
   - **Clickbait check**: Is the title sensationalized garbage?

3. Make decisions:
   - Score 7+, high confidence → **Auto-approve and post**
   - Score 5-7, medium confidence → **Flag for review** (needsReview=true)
   - Score <5 → **Reject with reason**

4. For approved items, post as the appropriate bot using the Node Social API or direct Prisma insert.

## Q's Taste Profile

**LOVES:**
- Deep technical content with substance
- Scientific breakthroughs and discoveries
- Mathematical elegance and proofs
- Game development insights (especially Godot)
- Original sources over aggregator rewrites
- AI/ML developments (especially practical applications)
- Space and astronomy news
- Thoughtful spirituality content (not woo-woo)

**HATES:**
- Engagement bait ("You won't believe...")
- Rage content designed to make you angry
- Clickbait titles that oversell
- Shallow hot takes
- Recycled content from other aggregators
- Anything that feels like an ad in disguise
- Comments from Reddit (source is fine, comments are cancer)

## Bot Persona Mapping

Post content using these bot accounts based on the `suggestedNode`:

| suggestedNode | Bot Username | Node to Post To |
|---------------|--------------|-----------------|
| technology | TechDigest | technology |
| science | ScienceDaily | science |
| programming | CodeCurator | programming |
| astronomy | CosmicNews | astronomy |
| math | MathMind | math |
| ai | AIInsider | ai |
| godot | GodotGuru | godot |
| graphic-design | DesignDaily | graphic-design |
| ui-ux | UXCurator | ui-ux |
| art | ArtStream | art |
| mtg | MTGDigest | mtg |
| blender | BlenderBot | blender |
| spirituality | SoulSeeker | spirituality |
| youtube | TubeWatch | youtube |

## Posting Format

When creating a post:
- **Title**: Clean, non-clickbait title (rewrite if needed)
- **Content**: Brief summary or key insight (2-3 sentences max)
- **linkUrl**: Original source URL
- **postType**: 'link' for articles, 'video' for YouTube
- **Attribution**: Add `\n\n---\n📡 via {source}` at the end

Example content:
```
New research shows that [key finding]. This could impact [why it matters].

---
📡 via r/science
```

## After Curating

Use Prisma to:
1. Update approved items: `status: 'posted'`, `postedAt: new Date()`, `postId: <created post id>`
2. Update rejected items: `status: 'rejected'`, `aiScore`, `aiReason`
3. Update borderline items: `status: 'pending'`, `needsReview: true`, `aiScore`, `aiReason`, `confidence`

## Output Summary

After processing, report:
- ✅ X items approved and posted
- ⏳ Y items flagged for review
- ❌ Z items rejected
- 📊 Queue depth remaining
```

### Task 3.3: Create Curator Helper Script

**File:** `backend/api/src/jobs/curatorHelpers.ts`

```typescript
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
    where: { status: 'pending' },
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

  const fullContent = content + `\n\n---\n📡 ${sourceAttribution}`;

  const post = await prisma.post.create({
    data: {
      title,
      content: fullContent,
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

  return {
    byStatus: Object.fromEntries(stats.map(s => [s.status, s._count])),
    needsReview,
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
    case 'post':
      // Usage: npx tsx src/jobs/curatorHelpers.ts post <nodeSlug> <title> <content> <linkUrl> <sourceAttribution>
      const [, , , nodeSlug, title, content, linkUrl, sourceAttribution] = process.argv;
      const postId = await postAsBot(nodeSlug, title, content, linkUrl, sourceAttribution);
      console.log(JSON.stringify({ postId }));
      break;
    case 'update':
      // Usage: npx tsx src/jobs/curatorHelpers.ts update <id> <status> <aiScore> <aiReason>
      const [, , , id, status, aiScore, aiReason] = process.argv;
      await updateQueueItem(id, status as any, {
        aiScore: aiScore ? parseInt(aiScore) : undefined,
        aiReason,
      });
      console.log('Updated');
      break;
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
```

### Task 3.4: Create launchd plist

**File:** `~/Library/LaunchAgents/com.node.curator.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.node.curator</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/claude</string>
        <string>--print</string>
        <string>/curate</string>
    </array>

    <key>StartInterval</key>
    <integer>3600</integer>

    <key>WorkingDirectory</key>
    <string>/Users/joshhd/Documents/node-social</string>

    <key>StandardOutPath</key>
    <string>/Users/joshhd/Documents/node-social/logs/curator.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/joshhd/Documents/node-social/logs/curator-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>/Users/joshhd</string>
    </dict>

    <key>RunAtLoad</key>
    <false/>

    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
```

### Task 3.5: Load launchd Job

**Commands:**
```bash
# Copy plist to LaunchAgents
cp ~/Library/LaunchAgents/com.node.curator.plist ~/Library/LaunchAgents/

# Load the job
launchctl load ~/Library/LaunchAgents/com.node.curator.plist

# Verify it's loaded
launchctl list | grep com.node.curator

# To manually trigger (for testing)
launchctl start com.node.curator

# To unload if needed
launchctl unload ~/Library/LaunchAgents/com.node.curator.plist
```

---

## Phase 4: Review Queue UI (Optional - Can be done later)

### Task 4.1: Add Curation API Routes

**File:** `backend/api/src/routes/curation.ts`

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const curationRoutes: FastifyPluginAsync = async (fastify) => {
  // Get items needing review
  fastify.get(
    '/review',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      // Only allow admin/Q to access
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const items = await fastify.prisma.curationQueue.findMany({
        where: {
          needsReview: true,
          status: 'pending',
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      return { items };
    }
  );

  // Approve/reject item
  fastify.post(
    '/review/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const schema = z.object({
        decision: z.enum(['approve', 'reject']),
        reason: z.string().optional(),
      });

      const { id } = request.params as { id: string };
      const parsed = schema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const userId = (request.user as { sub: string }).sub;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const { decision, reason } = parsed.data;

      // Record feedback
      await fastify.prisma.curationFeedback.create({
        data: {
          queueItemId: id,
          decision: decision === 'approve' ? 'approved' : 'rejected',
          reason,
        },
      });

      if (decision === 'reject') {
        await fastify.prisma.curationQueue.update({
          where: { id },
          data: {
            status: 'rejected',
            needsReview: false,
            curatedAt: new Date(),
          },
        });
        return { success: true, action: 'rejected' };
      }

      // Approve: create post as bot
      const item = await fastify.prisma.curationQueue.findUnique({
        where: { id },
      });

      if (!item) {
        return reply.status(404).send({ error: 'Item not found' });
      }

      // Find bot for this node
      const bot = await fastify.prisma.user.findFirst({
        where: {
          isBot: true,
          botConfig: { path: ['nodeSlug'], equals: item.suggestedNode },
        },
      });

      if (!bot) {
        return reply.status(400).send({ error: `No bot for node: ${item.suggestedNode}` });
      }

      const botConfig = bot.botConfig as { nodeId: string };

      // Create post
      const post = await fastify.prisma.post.create({
        data: {
          title: item.title,
          content: item.content ? `${item.content}\n\n---\n📡 via ${item.sourceType}` : null,
          linkUrl: item.linkUrl,
          postType: item.linkUrl?.includes('youtube') ? 'video' : 'link',
          authorId: bot.id,
          nodeId: botConfig.nodeId,
        },
      });

      // Update queue item
      await fastify.prisma.curationQueue.update({
        where: { id },
        data: {
          status: 'posted',
          postId: post.id,
          postedAt: new Date(),
          postedById: bot.id,
          needsReview: false,
        },
      });

      return { success: true, action: 'posted', postId: post.id };
    }
  );

  // Get queue stats
  fastify.get(
    '/stats',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const [byStatus, needsReview, today] = await Promise.all([
        fastify.prisma.curationQueue.groupBy({
          by: ['status'],
          _count: true,
        }),
        fastify.prisma.curationQueue.count({
          where: { needsReview: true, status: 'pending' },
        }),
        fastify.prisma.curationQueue.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      return {
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        needsReview,
        addedToday: today,
      };
    }
  );
};

export default curationRoutes;
```

### Task 4.2: Register Curation Routes

**File:** `backend/api/src/index.ts`

Add import and register:
```typescript
import curationRoutes from './routes/curation.js';

// In the routes registration section:
fastify.register(curationRoutes, { prefix: '/api/v1/curation' });
```

---

## Verification Checklist

After implementing each phase, verify:

### Phase 1 Verification
```bash
# 1. Schema migrated successfully
cd /Users/joshhd/Documents/node-social/backend/api
npx prisma migrate status

# 2. Bots and nodes created
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count({ where: { isBot: true } }).then(c => console.log('Bots:', c));
p.node.count().then(c => console.log('Nodes:', c));
p.\$disconnect();
"

# 3. Logs directory exists
ls -la /Users/joshhd/Documents/node-social/logs/
```

### Phase 2 Verification
```bash
# 1. Run harvester manually
cd /Users/joshhd/Documents/node-social/backend/api
npm run harvest

# 2. Check queue has items
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.curationQueue.count().then(c => console.log('Queue items:', c));
p.\$disconnect();
"

# 3. Verify cron is set
crontab -l | grep harvester
```

### Phase 3 Verification
```bash
# 1. Slash command exists
cat /Users/joshhd/Documents/node-social/.claude/commands/curate.md

# 2. Test curator helpers
cd /Users/joshhd/Documents/node-social/backend/api
npx tsx src/jobs/curatorHelpers.ts stats

# 3. launchd job loaded
launchctl list | grep curator

# 4. Manual test
cd /Users/joshhd/Documents/node-social
claude /curate
```

---

## Environment Variables Required

Add to `backend/api/.env`:
```bash
# YouTube API (optional but recommended)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Bluesky (optional - for authenticated access)
# BLUESKY_HANDLE=your.handle
# BLUESKY_APP_PASSWORD=your_app_password
```

---

## Troubleshooting

### Harvester not running
```bash
# Check cron logs
cat /Users/joshhd/Documents/node-social/logs/harvester.log

# Test npx tsx path
which npx
/opt/homebrew/bin/npx tsx --version
```

### Curator not posting
```bash
# Check launchd logs
cat /Users/joshhd/Documents/node-social/logs/curator.log
cat /Users/joshhd/Documents/node-social/logs/curator-error.log

# Test Claude path
which claude
claude --version
```

### Reddit API issues
- Reddit's public JSON API is rate-limited
- If getting 429 errors, increase delay between requests
- Consider using Reddit API credentials for higher limits

### YouTube API quota
- YouTube Data API has daily quotas
- Monitor usage at https://console.cloud.google.com
- Consider caching results

---

## Future Improvements

1. **Learning from feedback**: Train Claude's taste based on approve/reject decisions
2. **Source quality scores**: Track which sources produce the best content
3. **Automatic node detection**: Better categorization using embeddings
4. **Duplicate detection**: Semantic similarity to catch reposts
5. **Scheduling optimization**: Post at optimal times for engagement
6. **Image/video thumbnails**: Download and serve media locally
7. **RSS feed discovery**: Automatically find RSS feeds for new topics
