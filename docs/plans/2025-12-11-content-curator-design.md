# Content Curator System Design

**Created:** December 11, 2025
**Status:** Ready for implementation

---

## Overview

A two-stage content curation pipeline that aggregates quality content from across the web and posts it to Node Social via themed bot personas. Replaces doomscrolling through ad-infested, engagement-optimized platforms with a curated feed tailored to Q's interests.

### Core Thesis

Engagement metrics optimized for time-on-platform create toxic content. By curating content through an AI that optimizes for *value* rather than *engagement*, we break that cycle.

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        MAC (always on)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Harvester  │───▶│  Curation   │───▶│  Claude Code        │  │
│  │  (cron 15m) │    │  Queue (DB) │    │  (launchd 1hr)      │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        │                                        │                │
│        │ Pull from:                             │ Creates posts  │
│        │ • Reddit API                           │ as bot users   │
│        │ • HN API                               ▼                │
│        │ • Bluesky API              ┌─────────────────────┐     │
│        │ • RSS feeds                │   Node Social API    │     │
│        │ • YouTube API              │   (Fastify/Prisma)   │     │
│        │                            └─────────────────────┘     │
│        ▼                                                         │
│  Basic filters:                                                  │
│  • Upvote thresholds                                            │
│  • Keyword matching                                              │
│  • Deduplication                                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Harvester

**Location:** `backend/api/src/jobs/harvester.ts`
**Schedule:** Every 15 minutes via cron
**Purpose:** Mechanically pull content from sources and apply basic filters

### Sources & Thresholds

| Source | API | Filter Criteria |
|--------|-----|-----------------|
| Reddit | JSON API (no auth for public) | >50 upvotes, <24hr old |
| Hacker News | Official API | >30 points, <24hr old |
| Bluesky | AT Protocol API | >20 likes, <24hr old |
| RSS | Standard RSS parsing | Everything (pre-curated by feed choice) |
| YouTube | YouTube Data API | >10k views or from target channels |

### Keyword Matching by Node

```typescript
const NODE_KEYWORDS: Record<string, string[]> = {
  'technology': ['tech', 'software', 'hardware', 'startup', 'apple', 'google', 'microsoft', 'innovation'],
  'science': ['science', 'research', 'study', 'discovery', 'physics', 'chemistry', 'biology'],
  'programming': ['programming', 'coding', 'developer', 'javascript', 'typescript', 'rust', 'python', 'api'],
  'astronomy': ['astronomy', 'space', 'nasa', 'telescope', 'planet', 'star', 'galaxy', 'cosmos', 'rocket'],
  'math': ['mathematics', 'math', 'theorem', 'proof', 'algebra', 'geometry', 'calculus'],
  'ai': ['ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'machine learning', 'neural network', 'deep learning'],
  'godot': ['godot', 'gdscript', 'game engine', 'indie game', 'game dev'],
  'graphic-design': ['graphic design', 'typography', 'branding', 'logo', 'visual design', 'illustrator', 'photoshop'],
  'ui-ux': ['ui', 'ux', 'user experience', 'user interface', 'usability', 'interaction design', 'figma'],
  'art': ['art', 'digital art', 'illustration', 'painting', 'drawing', 'artist', 'artwork'],
  'mtg': ['magic the gathering', 'mtg', 'commander', 'standard', 'draft', 'wizards of the coast', 'edh'],
  'blender': ['blender', '3d modeling', '3d art', 'render', 'sculpting', 'animation'],
  'spirituality': ['spirituality', 'meditation', 'mindfulness', 'consciousness', 'philosophy', 'wisdom'],
  'youtube': [], // Special: curates based on channel subscriptions, not keywords
};
```

### Cron Setup

```bash
# Add to crontab: crontab -e
*/15 * * * * cd /Users/joshhd/Documents/node-social/backend/api && /opt/homebrew/bin/npx tsx src/jobs/harvester.ts >> /Users/joshhd/Documents/node-social/logs/harvester.log 2>&1
```

---

## Stage 2: Claude Code Curator

**Location:** `.claude/commands/curate.md` (slash command)
**Schedule:** Every hour via launchd
**Purpose:** AI evaluation of candidates, posting approved content as bots

### Launchd Configuration

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
        <string>--project-dir</string>
        <string>/Users/joshhd/Documents/node-social</string>
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
    </dict>
</dict>
</plist>
```

### Curation Logic

For each pending queue item, evaluate:

1. **Quality (1-10):** Is this insightful, interesting, or valuable?
2. **Relevance:** Does it fit Q's interests?
3. **Clickbait check:** Is the title sensationalized garbage?

**Decision thresholds:**
- Score 7+, confidence >0.8 → Auto-approve and post
- Score 5-7 or confidence 0.5-0.8 → Flag `needsReview=true`
- Score <5 or confidence <0.5 → Auto-reject

### Q's Taste Profile

**Loves:**
- Deep technical content
- Science breakthroughs
- Mathematical elegance
- Game dev insights
- Original sources

**Hates:**
- Engagement bait
- Rage content
- Clickbait titles
- Shallow hot takes
- Comment section cancer

---

## Data Model

### Schema Additions

```prisma
// Add to User model
model User {
  // ... existing fields
  isBot        Boolean  @default(false)
  botConfig    Json?    // { persona: "TechDigest", nodeSlug: "technology" }
}

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
  suggestedNode String?  // Which node this might belong to
  aiScore       Int?     // 1-10 score from Claude
  aiReason      String?  // Why Claude scored it this way
  status        String   @default("pending") // "pending" | "approved" | "rejected" | "posted"

  // Hybrid mode
  confidence    Float?   // How confident Claude is (0-1)
  needsReview   Boolean  @default(false)

  // Metadata
  createdAt     DateTime @default(now())
  curatedAt     DateTime?
  postedAt      DateTime?
  postedById    String?  // Which bot posted it
  postId        String?  // Resulting Post ID if posted

  @@unique([sourceType, sourceId])
  @@index([status, createdAt])
  @@index([needsReview, status])
}

// Track pagination cursors per source
model HarvestCursor {
  id          String   @id @default(uuid())
  sourceType  String   @unique // "reddit:r/technology" | "hackernews" | etc
  lastSeenId  String?  // Last item ID we processed
  lastRunAt   DateTime @default(now())
}

// Track Q's feedback for learning
model CurationFeedback {
  id            String   @id @default(uuid())
  queueItemId   String
  decision      String   // "approved" | "rejected"
  reason        String?  // "clickbait" | "boring" | "wrong-node" | "duplicate"
  createdAt     DateTime @default(now())

  queueItem     CurationQueue @relation(fields: [queueItemId], references: [id])
}
```

---

## Bot Personas

14 themed curator accounts, each posting to their respective node:

| Username | Display Name | Node | Bio |
|----------|--------------|------|-----|
| TechDigest | Tech Digest | technology | Curating the best in tech. AI-powered, human-approved. |
| ScienceDaily | Science Daily | science | Your daily dose of scientific discovery. |
| CodeCurator | Code Curator | programming | Quality code content, zero fluff. |
| CosmicNews | Cosmic News | astronomy | Eyes on the universe. |
| MathMind | Math Mind | math | Beautiful mathematics, elegantly explained. |
| AIInsider | AI Insider | ai | Tracking the AI revolution. |
| GodotGuru | Godot Guru | godot | Game dev with Godot, tutorials and news. |
| DesignDaily | Design Daily | graphic-design | Inspiration for visual creators. |
| UXCurator | UX Curator | ui-ux | Better interfaces, better experiences. |
| ArtStream | Art Stream | art | Digital and traditional art that inspires. |
| MTGDigest | MTG Digest | mtg | Magic: The Gathering news and strategy. |
| BlenderBot | Blender Bot | blender | 3D art and Blender tutorials. |
| SoulSeeker | Soul Seeker | spirituality | Mindfulness, meditation, and meaning. |
| TubeWatch | Tube Watch | youtube | The best of YouTube, curated. |

### Post Format

Posts include:
- Clean, non-clickbait title (rewritten if original is garbage)
- Brief summary or key quote
- Link to original source (`linkUrl`)
- Attribution footer: `via r/technology` or `via Hacker News`
- `postType`: `'link'` for articles, `'video'` for YouTube, `'text'` for discussions

---

## Review Queue UI

Simple admin page at `/curate` showing:
- Items where `needsReview: true` and `status: 'pending'`
- Claude's reasoning for why it's borderline
- Approve / Reject buttons
- Optional rejection reason dropdown

### Dashboard Stats

- Posts curated today (approved / rejected / pending review)
- Top performing sources by approval rate
- Queue depth

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Add Prisma schema changes
- [ ] Create bot seed script
- [ ] Create nodes seed script
- [ ] Set up logs directory

### Phase 2: Harvester
- [ ] Reddit harvester
- [ ] Hacker News harvester
- [ ] RSS harvester
- [ ] Bluesky harvester
- [ ] YouTube harvester
- [ ] Cron setup

### Phase 3: Curator
- [ ] `/curate` slash command
- [ ] Posting logic (create posts as bots)
- [ ] launchd setup
- [ ] Test end-to-end

### Phase 4: Review UI
- [ ] Review queue API endpoints
- [ ] Review queue UI
- [ ] Feedback tracking
- [ ] Dashboard stats

---

## Configuration

### Environment Variables

```bash
# Add to .env
YOUTUBE_API_KEY=xxx        # For YouTube Data API
BLUESKY_HANDLE=xxx         # Optional: for authenticated Bluesky access
BLUESKY_APP_PASSWORD=xxx   # Optional: for authenticated Bluesky access
```

### Reddit Subreddits to Monitor

```
r/technology, r/programming, r/science, r/space, r/astronomy,
r/math, r/MachineLearning, r/LocalLLaMA, r/artificial,
r/godot, r/gamedev, r/graphic_design, r/Design,
r/userexperience, r/UI_Design, r/Art, r/DigitalArt,
r/magicTCG, r/MagicArena, r/EDH, r/blender,
r/spirituality, r/meditation, r/philosophy
```

### RSS Feeds

```
Hacker News: https://news.ycombinator.com/rss
Quanta Magazine: https://www.quantamagazine.org/feed/
Ars Technica: https://feeds.arstechnica.com/arstechnica/index
The Verge: https://www.theverge.com/rss/index.xml
```

---

## Success Criteria

1. Wake up to fresh, quality content in Node
2. No clickbait, no engagement bait, no rage content
3. Diverse topics across all 14 nodes
4. Steady drip of ~1 post per bot every few hours
5. Borderline content flagged for review, not auto-posted
6. Feedback loop improves curation over time
