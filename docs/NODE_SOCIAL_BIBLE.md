# Node Social: The Design Bible

> Consolidated from ~75 planning documents. Last updated: February 2026.
> This is the single source of truth for Node Social's vision, architecture, and feature design.

---

## Table of Contents

1. [Vision & Philosophy](#1-vision--philosophy)
2. [Core Concepts](#2-core-concepts)
3. [Vibe Vectors & Radial Wheel](#3-vibe-vectors--radial-wheel)
4. [Vibe Validator (Feed Algorithm)](#4-vibe-validator-feed-algorithm)
5. [Eras System (Chronos Protocol)](#5-eras-system-chronos-protocol)
6. [Governance & Trust](#6-governance--trust)
7. [Vouching System](#7-vouching-system)
8. [Content Curation Pipeline](#8-content-curation-pipeline)
9. [Web Interface Design](#9-web-interface-design)
10. [Navigation Architecture](#10-navigation-architecture)
11. [Cross-Platform Aggregation](#11-cross-platform-aggregation)
12. [Architecture & Tech Stack](#12-architecture--tech-stack)
13. [Monetization](#13-monetization)
14. [Implementation Status](#14-implementation-status)
15. [Roadmap](#15-roadmap)

---

## 1. Vision & Philosophy

Node Social is a social network built on the thesis that **the algorithm should be the user's tool, not the platform's weapon**.

### Core Principles

- **Algorithmic transparency**: Users see and control exactly how their feed is ranked via the Vibe Validator
- **Quality over engagement**: Cred-weighted reactions prevent mob dynamics; expert voices carry more weight
- **Community sovereignty**: Nodes (communities) set their own vibe weights, governance rules, and moderation standards
- **Identity as journey**: The Eras system reflects where users are psychologically, not just demographically
- **No dark patterns**: Reaction counts hidden by default to reduce bias; no infinite scroll manipulation

### What Makes Node Social Different

1. **Vibe Vectors** -- Multi-dimensional reactions replacing binary likes. Users express intensity across multiple emotion axes in a single gesture via the Radial Wheel Menu.
2. **Vibe Validator** -- User-facing feed algorithm controls. Sliders for quality, recency, engagement, personalization. Progressive disclosure from presets to expert-mode granular tuning.
3. **Cred System** -- Reputation earned through quality contributions, weighted by community (Node) context. High-cred users' reactions carry more algorithmic weight.
4. **Web of Trust** -- Vouching system where users stake cred on people they trust. Bad vouches cost you.
5. **Eras** -- Dynamic identity system rooted in developmental psychology, not static demographics.

### The Tagline

**"Social media on your terms."**

---

## 2. Core Concepts

### Nodes

Nodes are communities (like subreddits). Each Node has:
- **Identity**: Name, slug, avatar, gradient banner with activity glow
- **Vibe Weights**: Per-node weighting of vibe vectors (e.g., /funny weights "Funny" at 1.5x, "Insightful" at 0.5x)
- **Governance**: Rules, council members, moderation log, Node Court for appeals
- **Cred Context**: Users earn NodeCred specific to each community

A Global Node exists as the default feed aggregating all content.

### Cred

Cred is earned reputation, not a currency to spend. It reflects quality contributions.
- Earned through: Quality posts, helpful comments, accurate moderation, community participation
- Weighted by: Reactor's own cred (expert reactions count more), Node context
- Used for: Feed ranking weight, governance eligibility, vouch capacity, Expert Gate access
- Cannot be: Bought, transferred, or inflated through volume alone

### Expert Gate

Posts can be marked "Expert Gated" -- only visible to users above a cred threshold in that Node. Creates space for high-signal discussion without excluding newcomers from the broader community.

### Active Seats

Governance participation model. Users earn "seats" through sustained quality contribution. Seat holders can participate in Node Court decisions, council votes, and moderation appeals.

---

## 3. Vibe Vectors & Radial Wheel

**Priority: HIGHEST.** This is Node Social's core differentiator.

### Vibe Vectors

Platform-wide set of reaction dimensions. Same vectors available everywhere; Nodes weight them differently for feed ranking.

**Current Vectors** (finalized set TBD after community research):
- Insightful, Funny, Novel, Cursed, Angry (confirmed)
- Additional vectors under consideration based on Reddit community analysis

**Key Design Decisions:**
- Intensity-based: Each vector is 0.0-1.0 (not binary)
- Multi-vector: Users apply multiple vectors with different intensities in one reaction
- Hidden counts: Raw reaction counts NOT displayed prominently (reduces bias)
- Personal expression: Reactions feel like personal expression, not public voting
- Counts available on demand (hover/click to expand)

### Radial Wheel Menu

The signature interaction. Click-and-hold the "React" button, a procedural wheel fans out. Drag cursor over slices to set intensity per vector.

**Interaction Flow:**
1. Click-hold "React" button on post/comment
2. Radial wheel fans out (smooth CSS animation)
3. Each slice = one Vibe Vector arranged in circle
4. Drag cursor over slices; intensity builds based on hover duration
5. Visual feedback shows intensity buildup (0% to 100% per slice)
6. Release to submit: e.g., `{insightful: 0.7, funny: 0.2, angry: 0.0}`
7. Wheel collapses, button shows reaction state

**Technical Requirements:**
- Works with mouse (desktop) and touch (mobile/web)
- Smooth animations via CSS transforms + requestAnimationFrame
- Debounced/throttled updates for performance
- Accessibility: Keyboard navigation, screen reader support
- Patent-potential gesture -- investigate before launch

### Schema

```
PostVibeAggregate: Per-post aggregation of all vibe reactions
  - postId, avgInsightful, avgFunny, avgNovel, avgCursed, avgAngry
  - totalReactions, totalIntensity
  - Updated on each reaction via vibeService

VibeReaction: Individual user reactions
  - userId, postId/commentId, nodeId
  - intensities (JSON): {"funny": 0.8, "insightful": 0.2, ...}
  - One reaction per user per post per node context
```

### Node Weighting

Each Node sets custom weights for each vector (default 1.0 for all):
- Higher weight = reactions with that vector contribute more to post ranking in that Node
- Example: /funny sets `{funny: 1.5, insightful: 0.5, angry: 0.3}`
- Weighting affects feed algorithm, NOT which vectors are available
- Cached in Redis for performance

---

## 4. Vibe Validator (Feed Algorithm)

User-facing controls for the feed ranking algorithm. Progressive disclosure design.

### Tier 1: Presets (90% of users)

| Preset | Quality | Recency | Engagement | Personalization |
|--------|---------|---------|------------|-----------------|
| Latest First | 10% | 80% | 5% | 5% |
| **Balanced** (default) | 35% | 30% | 20% | 15% |
| Most Popular | 25% | 15% | 50% | 10% |
| Expert Voices | 60% | 5% | 15% | 20% |
| Personal Network | 10% | 25% | 5% | 60% |

### Tier 2: Primary Sliders (8% of users)

Four main weight sliders that must sum to 100%:
1. **Quality Weight** (35% default) -- Cred scores, vibe diversity, Wilson confidence
2. **Recency Weight** (30% default) -- Time decay with configurable half-life
3. **Engagement Weight** (20% default) -- Vibe intensity, comment depth, expert gate engagement
4. **Personalization Weight** (15% default) -- Following relationships, vibe alignment, node affinity

### Tier 3: Advanced Controls (2% of users)

#### Quality Signals (35% total)
- Cred Score (60% of quality): User's NodeCred * Active Seat multiplier
- Vibe Vector Diversity (25%): Rewards posts with varied thoughtful reactions
- Wilson Confidence Score (15%): Statistical confidence interval, prevents low-sample bias

#### Recency Signals (30% total)
- Post Age (70%): Exponential decay, user-selected half-life (1h/6h/12h/24h/7d)
- Trending Velocity (20%): Recent engagement rate (last 4 hours)
- Last Interaction Recency (10%): Surfaces creators you haven't seen lately

#### Engagement Signals (20% total)
- Vibe Vector Intensity (40%): Weighted sum with vector multipliers (Novel: 6x, Insightful: 3x, Funny: 1.5x, Cursed: 0.5x)
- Comment Depth (35%): `Log(comments) * avg_thread_depth * 2.5`
- Expert Gate Engagement (15%): Bonus if high-cred users engaged
- Share Rate (10%): Shares/views ratio

#### Personalization Signals (15% total)
- Following Relationship (50%): Binary 100/20
- Vibe Vector Alignment (30%): Cosine similarity between user's reaction history and post's vibe profile
- Node Affinity (15%): Your NodeCred in the post's Node
- Web of Trust Distance (5%): Graph distance through vouch relationships (1-degree: 1.5x, 2-degree: 1.2x)

### Tier 4: Expert Mode

- Individual vibe vector weight adjustment
- Epsilon-greedy exploration (0-20% random boost)
- Category/author diversity controls
- Chaos Node injection (0-10% of feed from n/chaos)
- Minimum cred threshold, content type filters, Node subscriptions

### Per-Column Settings

Each feed column in the multi-column layout gets its own independent Vibe Validator settings. Stored in column config, not global.

### Technical Notes

- Feed updates automatically when sliders change (debounced)
- Missing data produces neutral scores (50/100), not zeros
- Logarithmic scaling on engagement to prevent runaway virality
- `?sort=chronological` vs `?sort=algorithmic` toggle supported

---

## 5. Eras System (Chronos Protocol)

Dynamic identity system based on "Mood Age" -- a psychologically-driven state decoupled from biological age. Rooted in Erik Erikson's stages of psychosocial development crossed with internet culture.

### How It Works

- Users can adopt Era personas reflecting their current life stage or emotional state
- When an Era is active, the app UI adapts (Dynamic UI Skinning) with that Era's color palette
- Eras are earned through temporal, behavioral, or social unlock mechanics
- Both a Default (age-based) and Unlockable (behavior-based) set exist per life chapter

### Life Chapters & Key Eras

#### Genesis & Discovery (0-12)
- **The Newbie** (default, 0-5): Blue #007BFF + Yellow #FFD700
- **Player One** (default, 6-12): Grey #808080 + Red #FF0000
- Unlockable: Core Memory, The Skibidi, iPad Kid

#### Protagonist Phase (13-19)
- **Main Character** (default, 13-16): Cinema Red #E30022 + Gold #FFD700
- **Vibe Curator** (default, 17-19): Sage Green #9DC183
- Unlockable: The Villain Arc, Academic Weapon, Brat Summer (seasonal), Goblin Mode

#### Quarter-Life Flux (20-29)
- **The Explorer** (default, 20-24): Sunset Orange #FD5E53
- **Saturn Return** (default, 25-29): Cosmic Violet #663399 + Saturn Gold #C5A009
- Unlockable: Build Era, Soft Launch, Delulu

#### Establishment Phase (30-45)
- **The Curator** (default, 34-45): Oat Milk Beige #E0D5C1
- **The Jesus Year** (unlockable, age 33 only): White #FFFFFF + Halo Gold #FFD700
- Unlockable: Soft Life, Corporate Baddie, Vino Vibe

#### Reinvention Phase (46-60)
- **The Icon** (default): Steel Blue #4682B4
- Unlockable: Zaddy/Silver Fox, Rich Auntie Energy

#### Golden Hour (60+)
- **The Sage** (default): Antique Gold #CFB53B
- Unlockable: Coastal Grandmother, OG Status (account age >10 years or age >70)

### Unlock Mechanics

1. **Temporal**: Automatic on birthday (e.g., Saturn Return at 27)
2. **Behavioral**: Hidden achievements (e.g., Goblin Mode: 5 days posting between 1-4 AM)
3. **Social**: Community interaction (e.g., Zaddy: >50% engagement from users 10+ years younger)

### Monetization
- Core Eras are free
- Premium Skins for Eras can be monetized
- Brand partnerships (e.g., Barbie Era sponsored by Mattel)
- Fast-Track purchases for aspirational Eras

---

## 6. Governance & Trust

### Eigentrust-Based Trust System

Node Social uses Eigentrust (the same algorithm Google PageRank is based on) for distributed trust scoring.

**How it works:**
- Trust scores propagate through the social graph
- High-trust users' moderation actions carry more weight
- New users start with low trust; it grows with quality participation
- Trust is contextual per Node (you can be trusted in /programming but unknown in /cooking)

### Governance Structure

#### Node Council
- Elected by Active Seat holders within each Node
- Council members have elevated moderation powers
- Term limits and recall mechanisms prevent power concentration
- Council sets Node rules, vibe weights, and governance policies

#### Node Court
- Appeals system for moderation decisions
- Panel of randomly selected Active Seat holders reviews cases
- Transparent voting with published reasoning
- Precedent system: past decisions inform future rulings

#### Moderation Tiers
1. **Automated**: AI-flagged content (spam, obvious violations)
2. **Community**: User reports with cred-weighted priority
3. **Council**: Council member review for escalated cases
4. **Court**: Appeals go to random panel of Active Seat holders

### Unified Governance UI (Command Center)

Single tabbed screen replacing 5 separate governance screens:
- **Moderation Tab**: Action log, filters by type/status/moderator
- **Council Tab**: Member list, elections, proposals
- **Trust Tab**: User trust scores, Eigentrust visualization
- **Appeals Tab**: Active appeals, voting interface
- **Blocked Tab**: Blocked users management

---

## 7. Vouching System

Web of trust where users stake cred on people they trust.

### Core Mechanics

- **Minimum cred to vouch**: 100
- **Default stake**: 100 cred
- **Revocation penalty**: 50% of staked cred (you made a bad call, own it)
- **Cannot vouch for yourself**
- **Stake cannot exceed current cred**
- Consequences cascade downstream through the trust graph

### UI Components

1. **Profile Vouch Section**: Stats (vouches given/received, total stake), vouch/revoke buttons
2. **Gravity Modal**: Confirmation with warnings about consequences when vouching
3. **Revoke Modal**: Shows penalty prominently before confirming revocation
4. **My Vouches Screen**: Management interface for all given/received vouches with history

### Trust Graph Integration

- Vouch relationships feed into Web of Trust Distance (personalization signal)
- 1-degree vouch: 1.5x weight, 2-degree: 1.2x, 3+: 1.0x
- Bad actors who accumulate negative trust cascade penalties to their vouchers

---

## 8. Content Curation Pipeline

AI-powered content curation to seed the platform with quality content.

### Two-Stage Architecture

```
Stage 1: HARVESTER (Cron, every 15 min)
  - Mechanically pulls from Reddit, HN, Bluesky, RSS, YouTube
  - Basic filters (age, score thresholds, keyword blocklist)
  - Deduplicates against existing content
  - Stores candidates in CurationQueue

Stage 2: CURATOR (Claude Code, hourly)
  - AI evaluates candidates against taste profile
  - Score 7+ auto-posts as themed bot personas
  - Score 5-7 flagged for manual review
  - Score <5 auto-rejected
```

### Bot Personas (14 themed accounts)

Each Node gets a curator bot with personality and posting style:
- TechDigest, ScienceDaily, CodeCurator, CryptoSignal, AIInsider, GamePulse, DesignWeekly, StartupBeat, DataNerd, SecurityAlert, OpenSourceRadar, SpaceWatch, ClimateData, QuantumBits

### Taste Profile (Q's Editorial Standards)

**Loves:** Deep technical content, novel research, contrarian analysis, beautiful engineering
**Hates:** Engagement bait, clickbait, "hot takes" without substance, rage farming, PR disguised as news

### Schema Additions

- `CurationQueue`: Candidate posts with scores, source, status
- `HarvestCursor`: Per-source tracking of last harvested position
- `CurationFeedback`: Admin feedback on curation decisions
- `User.isBot`, `User.botConfig`: Bot persona configuration

---

## 9. Web Interface Design

Fully customizable modular web interface. Users drag, drop, resize, and organize panels.

### Default Layout

```
+----------------------------------------------------------+
| Top Bar: Logo, Search, User Menu                          |
+--------+------------------------------+------------------+
|        |                              |                  |
| LEFT   |      CENTER FEED             |    RIGHT SIDE    |
| SIDE   |   (Multi-column capable)     |                  |
| BAR    |                              |   Vibe Validator |
|        |   Feed Column 1              |   (top)          |
| Nodes  |   Feed Column 2 (optional)   |                  |
|        |   Feed Column 3 (optional)   |   Node Info      |
|        |                              |   (bottom)       |
+--------+------------------------------+------------------+
```

### Panel System

All panels are draggable, resizable, dockable:
- `left-sidebar`: Nodes list (collapsible)
- `feed-column`: Main feed area (supports multiple columns, TweetDeck-style)
- `right-sidebar-top`: Vibe Validator
- `right-sidebar-bottom`: Node info
- `comment-thread`: Detachable comments
- `detached-feed`: Movable feed instance

### Multi-Column Feeds

- Default: single column
- Up to 3-4 columns on desktop
- Each column independent: different node, post type filter, vibe validator settings, scrolling
- Columns resizable via drag divider
- Per-column search bar with dropdown for column type switching

### Post Type Filtering

Filter feeds by content type:
- All types (default), Text only, Images only, Videos only, Links only
- Custom combinations via checkboxes
- Per-column filtering

### Responsive Breakpoints

| Width | Layout | Sidebar | Vibe Validator |
|-------|--------|---------|----------------|
| <768px (mobile) | Single column | Modal drawer | Modal drawer |
| 768-1023px (tablet) | Two columns | Persistent left | Modal drawer |
| >=1024px (desktop) | Three columns | Persistent left | Persistent right (toggleable) |

### Layout Persistence

- Save to localStorage on changes (debounced 500ms)
- Future: backend sync via `/api/user/layout` endpoint
- Handle version migration gracefully
- Fallback to default layout if corrupted

### Reddit-Style Post Cards (Web)

- Left side: Reaction button (Radial Wheel trigger) with subtle reaction indicator
- Post metadata: author, time, node, Era flair
- Content preview (expandable)
- Right side: Comment count, engagement stats
- Hover: subtle background change
- Font: System fonts, 8px grid, neutral grays with accent

---

## 10. Navigation Architecture

Migrating from monolithic App.tsx state machine to Expo Router file-based routing.

### Critical Design Decisions

1. **Auth stays modal-based** (NOT route-based) to preserve anonymous browsing
2. **Complex modals stay context-based**: CreatePost, EditPost, VibeValidator
3. **feedMode is URL state**, feedSource is Zustand
4. **Data passing ALWAYS by ID** (never full objects through navigation)

### Route Structure

```
app/
  app/
    _layout.tsx           -- Root: providers, AuthGate
    +not-found.tsx        -- 404
    (auth)/               -- Auth screens (modal overlay, not route group)
      login.tsx
      register.tsx
      forgot-password.tsx
      reset-password.tsx
      verify-email.tsx
    (app)/                -- Authenticated screens
      _layout.tsx         -- 3-column responsive shell
      index.tsx           -- Feed (home)
      post/[id].tsx       -- Post detail
      profile.tsx         -- Own profile
      create-post.tsx     -- Create post (optional, can stay modal)
      settings/
        feed-preferences.tsx
```

### State Management After Migration

| State | Location | Why |
|-------|----------|-----|
| Auth (user, token) | Zustand | Persists across navigation, written to disk |
| Server data (posts, nodes, comments) | React Query | Cached, deduplicated, auto-refreshed |
| Navigation state | URL (Expo Router) | Deep links, back button, shareable |
| UI interaction state | Local useState | Only the owning component needs it |

### Custom Hooks (Replace Inline Fetching)

- `useFeed({ nodeId })` -- Feed data with caching
- `useNodes()` -- Node list (fetched once, cached 10 min)
- `useSearch(query)` -- Search with debounce
- `useCreatePost()` -- Mutation with feed cache invalidation
- `usePost(id)` -- Single post + comments
- `useFeedPreferences()` -- Feed preferences query + mutation
- `useResponsiveLayout()` -- Breakpoint detection

---

## 11. Cross-Platform Aggregation

Turn Node Social into a TweetDeck replacement aggregating multiple social platforms.

### Platform Viability (2025-2026)

| Platform | Viability | Why |
|----------|-----------|-----|
| **Bluesky** | Excellent | Open AT Protocol, same API as official app, 28M+ MAU |
| **Mastodon** | Excellent | Open ActivityPub, many successful third-party clients |
| **Threads** | Maybe later | ActivityPub federation available but Meta approval painful |
| **Twitter/X** | Dead | $200-$42k/month, killed all third-party clients |
| **Reddit** | Dead | Killed Apollo/RIF/Sync, enterprise pricing only |

### Strategy

1. **Bluesky first** -- Best API, fastest growing, most similar to Twitter UX
2. **Mastodon second** -- Large user base, open protocol
3. **Threads via ActivityPub** -- When federation matures
4. **Skip Twitter/X and Reddit** -- Not worth the cost

### Unified Post Schema

```typescript
interface UnifiedPost {
  id: string;
  platformId: 'node-social' | 'bluesky' | 'mastodon' | 'threads';
  originalId: string;
  uri: string;
  author: { id, handle, displayName, avatar, platformVerified };
  content: string;
  contentWarning?: string;
  media: Array<{type: 'image' | 'video' | 'link'; url: string; alt?: string}>;
  likes: number;
  reposts: number;
  replies: number;
  createdAt: Date;
  vibeScores?: { estimated: boolean; quality, engagement, recency };
}
```

### Vibe Validator for External Content

External posts don't have native vibe reactions. Three approaches:
1. **Engagement-based scoring** (simple): Map likes/replies/reposts to signals
2. **AI-estimated vibes** (advanced): Claude analyzes post content for estimated vibe vector
3. **Hybrid** (recommended): Engagement signals initially, Node Social users can vibe-react to external posts, building real data over time

### New Column Types

`bluesky-home`, `bluesky-feed`, `bluesky-search`, `bluesky-profile`, `mastodon-home`, `mastodon-local`, `mastodon-federated`, `mastodon-search`

### Implementation Phases

1. **Bluesky Read-Only** (2-3 weeks): Auth, adapter, column types, engagement mapping
2. **Bluesky Write** (2 weeks): Like/repost/reply, cross-posting
3. **Mastodon Integration** (2-3 weeks): OAuth (instance-aware), adapter, column types
4. **Unified Experience** (2 weeks): Cross-platform search, unified notifications

---

## 12. Architecture & Tech Stack

### Backend (`backend/api/`)

- **Runtime**: Node.js 22.11.0 (pinned in .nvmrc)
- **Framework**: Fastify with plugins for Prisma, Redis, MeiliSearch, Socket.io
- **Database**: PostgreSQL (via Prisma ORM, 25+ models)
- **Cache**: Redis
- **Search**: MeiliSearch (full-text search with sync queue)
- **Auth**: JWT (HS256, 15min access + 7-day httpOnly refresh cookies), Argon2 passwords, Google OAuth, Apple Sign-In
- **Email**: Resend (via emailQueue)
- **Validation**: Zod schemas on all inputs
- **Real-time**: Socket.io for live updates

### Frontend (`app/`)

- **Framework**: Expo SDK 54, React 19
- **State**: Zustand (auth), React Query (server data)
- **Navigation**: Expo Router (migrating to)
- **UI**: React Native with web support, 3-column responsive layout
- **Builds**: Expo development builds (never Expo Go -- native modules required)

### Infrastructure

- **Containers**: Docker Compose (Postgres:5433, Redis:6379, MeiliSearch:7700)
- **Database Migrations**: Prisma Migrate

### Key Backend Services

- `vibeService.ts` -- Vibe vector reaction logic and aggregation
- `feedScoring.ts` -- Feed ranking algorithm with configurable weights
- `moderationService.ts` -- Content moderation actions and logging
- `expertService.ts` -- Expert gate and cred-based access control
- `socketService.ts` -- Real-time event distribution
- `searchSync.ts` -- MeiliSearch synchronization with retry queue
- `emailQueue.ts` -- Email delivery via Resend

### Authentication Architecture

- Three methods: Email/password (Argon2), Google OAuth, Apple Sign-In
- `FederatedIdentity` table for OAuth provider links (replaces old googleId/appleId fields)
- Token families with reuse detection for refresh token rotation
- Request queue prevents thundering herd on concurrent token refreshes
- CSRF protection via double-submit cookie pattern

### Security Measures (Feb 2026 Audit)

- SSRF protection with IPv4 + IPv6 DNS resolution
- Magic byte verification for image uploads (JPEG, PNG, GIF, WebP)
- Path traversal prevention on file deletion (resolve + startsWith guard)
- Zod validation on all user inputs with no error detail leakage
- Rate limiting on all API endpoints
- UUID validation on all ID parameters

---

## 13. Monetization

### Revenue Streams (Planned)

1. **Premium Eras**: Cosmetic Era skins and branded Eras (e.g., Barbie Era by Mattel)
2. **Fast-Track Unlocks**: Pay to unlock aspirational Eras without meeting behavioral criteria
3. **Layout Templates**: Premium layout configurations for the modular web interface
4. **Node Features**: Premium tools for Node governance (analytics, advanced moderation)
5. **API Access**: For third-party integrations and bots

### Anti-Patterns to Avoid

- No pay-to-win: Cred cannot be purchased
- No algorithmic manipulation: Premium users don't get feed advantages
- No data selling: User data stays on platform
- No engagement manipulation: No dark patterns to increase time-on-site

---

## 14. Implementation Status

### Fully Implemented (as of Feb 2026)

- User registration, login, email verification
- Google OAuth + Apple Sign-In with FederatedIdentity
- JWT auth with refresh token rotation and family-based reuse detection
- Post CRUD with feed (create, read, update, delete)
- Comment system with threading
- Vibe Vector reactions with aggregation
- Node (community) system with membership
- Feed algorithm with Vibe Validator presets + custom weights
- Full-text search via MeiliSearch with sync queue
- User profiles with avatar/banner uploads
- Follower/following system
- Notification system
- Direct messaging
- Content moderation with action logging
- Vouching system (stake, revoke with penalty)
- Rate limiting on all endpoints
- CSRF protection
- Responsive 3-column web layout
- Content curation pipeline (harvesters + AI curator + bot personas)
- Governance Command Center (unified tabbed UI)
- Settings hub
- Security hardening (SSRF, path traversal, input validation)



### Not Yet Started

- Draggable/resizable panel system
- Node Court and appeals system
- Active Seats governance model
- Eigentrust trust propagation
- AI-estimated vibes for external content
- Premium monetization features

---



## Appendix: Reference Documents

These documents are NOT consolidated into this bible but remain useful as standalone references:

- `docs/TYPESCRIPT_GUIDE.md` -- 2200-line TypeScript tutorial specific to this codebase (every `any` fix, Prisma/Zod/Fastify patterns)
- `CLAUDE.md` -- Coding agent protocol and project conventions
- `README.md` -- Project setup and quick-start guide
