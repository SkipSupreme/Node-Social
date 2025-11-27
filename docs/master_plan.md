# Node Social: The Complete Bible
## Everything We're Building - Version 1.0

**Last Updated:** November 26, 2025  
**BDFL:** Josh  
**Status:** The Definitive Reference  
**Motto:** WE ARE NODE. Quality over engagement. Always.

---

# Table of Contents

1. [The Vision](#1-the-vision)
2. [Core Philosophy](#2-core-philosophy)
3. [Complete Feature List](#3-complete-feature-list)
4. [The Vibe System](#4-the-vibe-system)
5. [Governance & Moderation](#5-governance--moderation)
6. [Reputation System](#6-reputation-system)
7. [Community Structure](#7-community-structure)
8. [User Experience](#8-user-experience)
9. [Technical Architecture](#9-technical-architecture)
10. [Database Schema](#10-database-schema)
11. [API Endpoints](#11-api-endpoints)
12. [Infrastructure & Costs](#12-infrastructure--costs)
13. [Monetization](#13-monetization)
14. [Development Roadmap](#14-development-roadmap)
15. [Success Metrics](#15-success-metrics)
16. [Glossary](#16-glossary)

---

# 1. The Vision

## What We're Building

Node Social is a next-generation social media platform that solves the fundamental problem destroying every major platform: **engagement-optimized algorithms that amplify rage, division, and low-quality content**.

We're building the social media we wish existed.

## Why Now

- **50% of consumers** will abandon or limit social media by 2025 due to quality decay
- **Bluesky** grew from 10M → 38M users in 5 months (Nov 2024) - demand is real
- **Threads** lost 82% of daily users in first month - being big isn't enough
- **48% of teens** now see social media as mostly negative (up from 32% in 2022)
- **Every competitor is failing:** Bluesky can't scale moderation, Threads launched incomplete, Mastodon chose ideology over usability, Cohost had no revenue model

## Our Thesis

**Users aren't leaving social media—they're leaving engagement-over-experience platforms.**

Every competitor prioritizes viral growth over quality. We do the opposite.

## What Makes Us Different

| Competitor Problem | Node Social Solution |
|-------------------|---------------------|
| Binary upvote/downvote | 6D Vibe Vectors with intensity |
| Opaque algorithms | User-controlled Vibe Validator |
| Hidden moderation | Public ModActionLog |
| Static mod teams | Active Seat governance |
| Exploit volunteer mods | Professional + wellness support |
| Engagement = toxicity | Quality = ranking signal |

---

# 2. Core Philosophy

## The Zen of Node

```
Optimistic Curation over Pessimistic Filtering.
Amplify the best; don't just filter the worst.
Default to meritocracy.

Flowing guidelines over a rigid constitution.
Reputation is permanent. Governance is active.
An active expert is better than an inactive one (for a seat).

Actions have consequences.
Transparency is total.
Public logs are non-negotiable.

Appeals must have a stake.
Community Juries over platform fiat.
Trust the expert. Sort by Cred.

Substance is better than low-context.
Empower experts to gate the conversation.

Value generated is better than volume subscribed.
Faucets must be balanced by sinks.
Hyperinflation is a bug.
Earning by adoption is better than burning for access.

Learning by doing is better than reading a manual.
A place for chaos contains it.
Communities must be earned, not just created.
```

## Active, Optimistic Curation

**Pessimistic Filtering (Old Way):** Users manually block/mute/filter bad content. Stressful, negative, reactive.

**Optimistic Curation (Our Way):** System finds and surfaces quality. Community-verified experts (Cred) elevate valuable contributions. Meritocratic by default.

---

# 3. Complete Feature List

## 🔵 CORE PLATFORM

### Authentication & Identity
- [ ] Email/password registration
- [ ] Email verification
- [ ] Password reset flow
- [ ] Google OAuth (free)
- [ ] Apple Sign-In ($99/year required for iOS anyway)
- [ ] JWT access tokens (15-minute expiry)
- [ ] Refresh token rotation with reuse detection
- [ ] Biometric authentication (Face ID, Touch ID, fingerprint)
- [ ] Multiple device sessions
- [ ] "Logout all devices" functionality
- [ ] Account deletion (GDPR compliant)
- [ ] Data export (JSON, CSV)

### User Profiles
- [ ] Username (unique, changeable with Cred burn)
- [ ] Display name
- [ ] Bio/about section
- [ ] Avatar/profile picture
- [ ] Banner image
- [ ] Era badge (auto-assigned from birthday)
- [ ] Cred display (total + per-Node)
- [ ] Council seats held
- [ ] Vouch stats (vouched by / vouching for)
- [ ] Activity multiplier display
- [ ] Top Nodes (by Cred)
- [ ] Top Vibe Vectors received
- [ ] Profile privacy settings
- [ ] Custom CSS theme (personal)
- [ ] Pinned posts
- [ ] Following/followers counts
- [ ] Joined date
- [ ] Last active indicator (optional)

### Content Types
- [ ] Text posts (with character limit TBD)
- [ ] Link posts with preview cards
- [ ] Image posts (single and gallery)
- [ ] Video posts
- [ ] Audio posts (voice notes)
- [ ] Polls
- [ ] Threads (connected post sequences)
- [ ] Reposts (with optional quote)
- [ ] Cross-posts (to multiple Nodes)

### Comments & Discussions
- [ ] Threaded comments (unlimited depth)
- [ ] Comment reactions (full Vibe Vectors)
- [ ] Comment sorting (7 modes - see below)
- [ ] Collapse/expand threads
- [ ] "Load more replies" pagination
- [ ] Expert comment highlighting
- [ ] OP (Original Poster) indicator
- [ ] Comment editing (with history)
- [ ] Comment deletion
- [ ] Reply notifications
- [ ] Mention notifications (@username)

---

## 🟣 THE VIBE SYSTEM (Our Core Innovation)

### The Six Vibe Vectors
| Vector | Icon | Color | Meaning |
|--------|------|-------|---------|
| **Insightful** | 💡 | #00BFFF | Knowledge, analysis, utility |
| **Joy** | 😄 | #FFD700 | Amusement, delight, fun |
| **Fire** | 🔥 | #FF4500 | Intensity, hype, heat |
| **Support** | 💙 | #FF69B4 | Empathy, solidarity, love |
| **Shock** | ⚡ | #32CD32 | Surprise, awe, "WTF" |
| **Questionable** | 🤔 | #9370DB | Skepticism, doubt, scrutiny |

### Radial Wheel Interface
- [ ] Long-press to open (300ms trigger)
- [ ] Drag to select vector(s)
- [ ] Distance from center = intensity (0-100%)
- [ ] Multi-vector selection in one gesture
- [ ] Haptic feedback at 25%, 50%, 75%, 100%
- [ ] Visual glow at high intensity
- [ ] Quick tap shortcuts (configurable)
- [ ] Swipe gestures on post cards
- [ ] Keyboard shortcuts (desktop)
- [ ] Accessibility: list mode, slider mode, reduced motion

### Vibe Validator (User-Controlled Algorithm)

**Mode 1: Simple (90% of users)**
- [ ] 5 preset cards, no visible sliders
- [ ] Presets: Latest First, Balanced, What's Hot, Expert Voices, My Network
- [ ] Mini bar charts showing weight distribution
- [ ] One-tap activation

**Mode 2: Intermediate (8% of users)**
- [ ] 4 pillar sliders (Quality, Recency, Engagement, Personalization)
- [ ] Sliders auto-normalize to 100%
- [ ] Time range selector (1h, 6h, 24h, 7d, all)
- [ ] Discovery rate slider (epsilon)
- [ ] Quick toggles: Hide muted words, Show seen posts, Text only, Media only, Links only, Has discussion

**Mode 3: Advanced (1.5% of users)**
- [ ] Sub-signal tuning within each pillar
- [ ] Quality: Author Cred weight, Vector quality weight, Confidence weight
- [ ] Recency: Time decay, Velocity, Freshness, Half-life hours, Decay function
- [ ] Engagement: Intensity, Discussion depth, Share weight, Expert comment bonus
- [ ] Personalization: Following weight, Alignment, Affinity, Trust network
- [ ] Vector weight overrides (per-vector multipliers)
- [ ] Anti-alignment penalty setting

**Mode 4: Expert (0.5% of users)**
- [ ] Full parameter access (~50+ settings)
- [ ] Custom suppression rules (expression language)
- [ ] Custom boost rules
- [ ] Network controls (vouch weighting, negative vouches)
- [ ] Diversity controls (max posts per author, topic clustering penalty)
- [ ] Content type targeting (text/image/video/link ratios)
- [ ] Exploration pool selection
- [ ] User experiments (A/B test your own feed)
- [ ] Time-based profiles (different algorithms by time of day)
- [ ] Mood toggles (temporary algorithm shifts)

### Community Presets
- [ ] Save personal presets
- [ ] Share presets publicly
- [ ] Subscribe to another user's algorithm
- [ ] Auto-update when preset author changes
- [ ] Local overrides on subscribed presets
- [ ] Preset ratings and discovery
- [ ] Featured presets (platform-curated)
- [ ] Tags for preset categorization

### Comment Sorting Modes
| Mode | Primary Signal | Secondary Signal |
|------|---------------|-----------------|
| **Insightful** | 💡 Insightful sum | Quality score |
| **Joyful** | 😄 Joy sum | Engagement |
| **Heated** | 🔥 Fire sum | Recency |
| **Supportive** | 💙 Support sum | Following |
| **Controversial** | Mixed high-intensity | Discussion depth |
| **New** | Recency | None |
| **Top** | Total positive | Wilson confidence |

---

## 🟢 GOVERNANCE & MODERATION

### ModActionLog (Public Transparency)
- [ ] Immutable, append-only log
- [ ] Every moderation action recorded
- [ ] Fields: Action ID, Moderator, Target, Action type, Reason, Timestamp, Appealable
- [ ] Public API for querying logs
- [ ] Filter by Node, moderator, action type, date range
- [ ] Export functionality

### Node Court System (Three Tiers)

**Tier 1: Appeal Stake**
- [ ] User stakes Cred (not money) to appeal
- [ ] Free appeals exist but take longer
- [ ] Cred-staked appeals get priority
- [ ] Win: Cred returned + bonus
- [ ] Lose: Cred burned

**Tier 2: Community Jury**
- [ ] High-cred users (>1000 Cred) serve as jurors
- [ ] Jury pool randomly selected
- [ ] Votes weighted by credWeight
- [ ] 4 options: Uphold, Overturn, Abstain, Question
- [ ] "Question" pauses vote, requires justification
- [ ] Threshold for escalation to Tier 3

**Tier 3: Hub Court (Escalation)**
- [ ] Council of parent Hub Node reviews
- [ ] Final, binding verdict
- [ ] Precedent logging for future reference

### Verdicts & Consequences
**If OVERTURNED:**
- [ ] Original content restored
- [ ] Trending score reinstated
- [ ] "Victorious Flair" badge (permanent)
- [ ] Staked Cred returned

**If UPHELD:**
- [ ] Content remains removed
- [ ] Staked Cred burned
- [ ] Potential account consequences

### Council of Node (Dynamic Governance)
- [ ] Top 5-10 highest-Cred ACTIVE users per Node
- [ ] "Active" = participated in last 30 days
- [ ] Reputation permanent, governance requires activity
- [ ] Automatic rotation when users go inactive
- [ ] Immediate seat restoration when returning
- [ ] Public voting records

### Moderation Infrastructure
- [ ] AI pre-filtering (obvious violations, spam)
- [ ] Human review queue (prioritized by flag score)
- [ ] User reports with categories
- [ ] CSAM detection (legal requirement)
- [ ] Deepfake detection
- [ ] Coordinated harassment detection
- [ ] Bot/sockpuppet detection
- [ ] Rate limiting on all actions
- [ ] Moderator wellness program
- [ ] Geographic distribution (24/7 coverage)
- [ ] Crisis response protocol

### Flag Score System
- [ ] Automatic flagging from Vibe Vectors
- [ ] Questionable ratio weighting
- [ ] Shock ratio weighting
- [ ] Combo signal (both Shock + Questionable)
- [ ] Velocity anomaly detection
- [ ] Expert flag amplification (high-Cred users)
- [ ] Priority tiers: Critical (<15min), High (<1hr), Medium (<4hr), Low (<24hr)

---

## 🟡 REPUTATION SYSTEM (Cred)

### Cred Earning
- [ ] Positive Vibe Vectors on your content
- [ ] Weighted by reactor's Cred
- [ ] Vector weights: Insightful (3x), Support (2.5x), Fire (2x), Joy (1.5x)
- [ ] Per-Node accumulation (separate scores per community)
- [ ] Total Cred = sum of all Node Cred

### Cred Loss
- [ ] Questionable reactions (1.5x weight)
- [ ] Shock reactions (1x, only if content removed)
- [ ] Upheld reports (5x per report)
- [ ] Appeal stake burn (when losing appeal)
- [ ] Vouch stake burn (vouched for bad actor)

### Activity Multiplier (Governance Only)
- [ ] Last 7 days: 100%
- [ ] 8-14 days: 90%
- [ ] 15-30 days: 80%
- [ ] 31-60 days: 70%
- [ ] 60+ days: 50%
- [ ] Base Cred never decays, only governance influence

### Web of Trust (Vouching)
- [ ] High-Cred users can vouch for newcomers
- [ ] Vouching stakes your own reputation
- [ ] Vouched users earn Cred faster
- [ ] If vouched user becomes bad actor → voucher loses Cred
- [ ] Trust propagation (friends of friends)
- [ ] Max trust distance setting (1-6 hops)
- [ ] Trust decay per hop

### Cred Faucets (Creation)
- [ ] Quality content receiving positive reactions
- [ ] Only way new Cred enters the system

### Cred Sinks (Destruction)
- [ ] Appeal Stake Burn
- [ ] Vouch Stake Burn
- [ ] Node Proposal filing fee (500 Cred)
- [ ] Username change burn
- [ ] Premium feature costs (if implemented)

---

## 🔴 COMMUNITY STRUCTURE (Nodes)

### Node Basics
- [ ] Community name (n/name format)
- [ ] Description
- [ ] Rules/guidelines
- [ ] Banner image
- [ ] Icon
- [ ] Custom Vibe Vector labels (per-Node)
- [ ] Disabled vectors option
- [ ] Subscriber count
- [ ] Vibe Velocity score
- [ ] Active/dormant status

### Node Hierarchy
- [ ] Hub Nodes (top-level: n/tech, n/gaming)
- [ ] Child Nodes (specialized: n/tech/ai, n/tech/web)
- [ ] Geographic hierarchy (n/canada → n/alberta → n/calgary)
- [ ] Content syndication up/down hierarchy
- [ ] Appeal escalation follows hierarchy

### Node Creation
- [ ] NodeProposal required (community approval)
- [ ] Filing fee: 500 Cred burn
- [ ] Parent Hub community votes
- [ ] Charter defines rules, vector labels
- [ ] Prevents spam Nodes

### Node Lifecycle
- [ ] Active: Normal operation
- [ ] Dormant: 0 activity for 90 days → read-only
- [ ] Revival: Successful NodeProposal restores active status

### Special Nodes
- [ ] n/orientation: Onboarding, Curation Gauntlet
- [ ] n/chaos: Minimal rules, pressure-release valve
- [ ] n/themes: Custom CSS sharing/voting

### Expert Gate Posts
- [ ] Post creator sets comment threshold
- [ ] Options: Vouched only, High-Cred only, Custom Cred minimum
- [ ] [Expert Gate] flair displayed
- [ ] Non-qualifying users can read and reply to experts, not make top-level comments
- [ ] Prevents "normie flooding" while maintaining accessibility

---

## ⚪ USER EXPERIENCE

### Feed
- [ ] Main feed (all subscribed Nodes)
- [ ] Per-Node feed
- [ ] Following-only feed
- [ ] Explore/discover feed
- [ ] Chronological toggle
- [ ] Algorithmic (Vibe Validator)
- [ ] Pull-to-refresh
- [ ] Infinite scroll
- [ ] "Why am I seeing this?" explainer
- [ ] "More like this" / "Less like this"
- [ ] Seen post tracking (optional)

### Onboarding: Curation Gauntlet
- [ ] All new users land in n/orientation
- [ ] Feed pre-filled with intentional spam/rage-bait
- [ ] Interactive tutorial: drag Vibe Validator sliders
- [ ] Watch feed clean up instantly
- [ ] Teaches killer feature by doing, not reading

### Search
- [ ] Keyword search in posts
- [ ] User search
- [ ] Node/community search
- [ ] Tag/hashtag search
- [ ] Semantic search (not just exact matches)
- [ ] Advanced filters (date, Node, author, Vibe type)
- [ ] MeiliSearch integration

### Notifications
- [ ] Replies to your posts/comments
- [ ] Mentions (@username)
- [ ] Reactions on your content
- [ ] New followers
- [ ] Moderation actions on your content
- [ ] Appeal status updates
- [ ] Node announcements
- [ ] Granular controls (per-type, per-Node)
- [ ] Multiple channels (push, email, in-app)
- [ ] Intelligent batching (prevent fatigue)

### Direct Messages
- [ ] 1-on-1 messaging
- [ ] Group messages
- [ ] Media sharing
- [ ] Read receipts (optional)
- [ ] Message reactions
- [ ] Thread organization
- [ ] Abuse prevention (rate limits, block lists)
- [ ] Report mechanism

### Harassment Protection
- [ ] Per-user blocking (platform-wide)
- [ ] Per-Node blocking
- [ ] Muting (hide without blocking)
- [ ] Word/phrase muting
- [ ] Private profile option
- [ ] DM restrictions (followers only, etc.)
- [ ] Report buttons everywhere
- [ ] Block evasion detection

### Accessibility
- [ ] Screen reader support (all elements)
- [ ] Keyboard navigation (all features)
- [ ] Color contrast standards (WCAG 2.1 AA)
- [ ] Alt text for images
- [ ] Captions for video
- [ ] Font size controls
- [ ] Reduced motion option
- [ ] High contrast mode

### Data & Privacy
- [ ] Data export (all posts, comments, connections, messages)
- [ ] GDPR compliance
- [ ] Privacy dashboard
- [ ] Connected apps management
- [ ] Session management
- [ ] Two-factor authentication
- [ ] Login history

---

## 🟤 EVENTS & ENGAGEMENT

### Community Events
- [ ] "Vibe Quilt" (our r/place equivalent)
- [ ] Node-specific events
- [ ] Time-limited challenges
- [ ] Community celebrations
- [ ] AMAs / live threads

### Rankings & Leaderboards
- [ ] Vibe Velocity (community quality rankings)
- [ ] Top contributors (per-Node)
- [ ] Rising communities
- [ ] Trending topics/tags
- [ ] Quality metrics (not just volume)

### Starter Packs (Bluesky-style)
- [ ] Curated onboarding kits
- [ ] One-click follow lists
- [ ] Node bundles
- [ ] Topic-based discovery
- [ ] Shareable onboarding links

### Theme Marketplace
- [ ] n/themes Node for CSS sharing
- [ ] Upload custom CSS
- [ ] Vote on themes (Vibe Vectors)
- [ ] "Best" = highest-voted
- [ ] Earn Cred from theme adoption
- [ ] Safety review for malicious CSS
- [ ] Gallery of top themes

---

## 🟠 DEVELOPER TOOLS

### Public API
- [ ] RESTful endpoints
- [ ] Authentication (API keys, OAuth)
- [ ] Rate limiting
- [ ] Comprehensive documentation
- [ ] Versioning (v1, v2, etc.)
- [ ] Webhook support
- [ ] Sandbox/testing environment

### Bot Support
- [ ] Bot account type
- [ ] Bot API access
- [ ] Rate limits for bots
- [ ] Bot verification
- [ ] Bot directory

### Third-Party Integration
- [ ] Third-party client guidelines
- [ ] Open algorithm (source available)
- [ ] Embedding support
- [ ] Share intents

### Community Health Dashboard
- [ ] Toxicity trends
- [ ] Engagement quality metrics
- [ ] New vs returning users
- [ ] Response times (mod actions)
- [ ] Moderator workload
- [ ] User retention (cohort analysis)
- [ ] Content velocity
- [ ] Anomaly detection
- [ ] Automated alerts

---

# 4. The Vibe System (Technical Deep Dive)

## Scoring Engine Formula

```
Final_Score = Base_Score × Suppression_Factor × Diversity_Factor × (1 + Exploration_Factor)

Base_Score = (Q × Quality) + (R × Recency) + (E × Engagement) + (P × Personalization)
Where Q + R + E + P = 1.0
```

### Quality Score Components
- **Author Cred**: Normalized, capped, with council/new-user bonuses
- **Vector Quality Ratio**: (positive value - negative value) / total intensity
- **Wilson Confidence**: Statistical confidence interval for rating quality

### Recency Score Components
- **Time Decay**: Exponential, linear, or step function
- **Velocity**: Recent reaction rate vs average
- **Freshness**: Bonus for very new content

### Engagement Score Components
- **Intensity**: Weighted sum of all reaction intensities
- **Discussion**: Comment count × depth × expert participation
- **Shares**: Optionally weighted by sharer trust

### Personalization Score Components
- **Following**: Boost for followed authors
- **Alignment**: Cosine similarity with user's vibe profile
- **Affinity**: User's Cred in post's Node
- **Trust**: Distance in vouch network

### Modifiers
- **Suppression**: Product of triggered suppression rules
- **Diversity**: Penalizes repetitive authors/topics
- **Exploration**: Random injection for serendipity (epsilon)

---

# 5. Governance & Moderation (Technical)

## Flag Score Calculation

```typescript
flagScore = 
  (questionableRatio × 3.0) +
  (shockRatio × 2.0) +
  (comboRatio × 5.0) +
  (velocitySpike × 2.0) +
  (explicitReports × 10.0);
```

## Expert Flag Amplification

```typescript
expertFlagWeight = 1 + (reactorCred / 1000) × 0.5;
// User with 2000 Cred: their Questionable = 2x normal weight
```

## Priority Tiers

| Priority | Flag Score | Response Time |
|----------|-----------|---------------|
| 🔴 Critical | > 50 | < 15 minutes |
| 🟠 High | 30-50 | < 1 hour |
| 🟡 Medium | 15-30 | < 4 hours |
| 🟢 Low | 5-15 | < 24 hours |
| ⚪ Monitor | < 5 | Periodic |

---

# 6. Reputation System (Technical)

## Cred Earning Formula

```typescript
function calculateCredEarned(post: Post): number {
  let credEarned = 0;
  for (const reaction of post.reactions) {
    const reactorCred = Math.min(reaction.user.nodeCred, 2000);
    const normalizedCred = reactorCred / 1000;
    const positiveValue = 
      (reaction.vectors.insightful × 3.0) +
      (reaction.vectors.support × 2.5) +
      (reaction.vectors.joy × 1.5) +
      (reaction.vectors.fire × 2.0);
    credEarned += normalizedCred × positiveValue;
  }
  return credEarned;
}
```

## EigenTrust-like Trust Score

```typescript
// Trust flows through vouch network
// Seed nodes (verified accounts) start with 1.0
// Trust propagates with decay per hop
// Converges after ~10-20 iterations
```

---

# 7. Technical Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Mobile** | React Native + Expo SDK 54 |
| **Web** | React (shared components) |
| **Backend** | Node.js 22 + Fastify |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Search** | MeiliSearch |
| **Real-time** | Socket.io |
| **Jobs** | BullMQ |
| **Storage** | Backblaze B2 |
| **CDN** | Cloudflare + BunnyCDN |

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Mobile (Expo)  │  Web (React)  │  Third-Party Clients      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Fastify)                   │
│  - Authentication & Authorization                            │
│  - Rate Limiting & DDoS Protection                          │
│  - Request Validation                                        │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Business Logic Layer   │  │   Real-Time Layer       │
│  - User Management       │  │  - Socket.io            │
│  - Content Management    │  │  - Live Notifications   │
│  - Vibe System           │  │  - Real-Time Feed       │
│  - Moderation System     │  │  - Collaborative Events │
│  - Cred Calculation      │  │                         │
└────────────────────────┬─┘  └───────────┬─────────────┘
                         │                 │
              ┌──────────┴─────────────────┴──────────┐
              ▼                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                         DATA LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL    │  Redis       │  MeiliSearch  │  Backblaze  │
│  - Users       │  - Sessions  │  - Full-text  │  - Media    │
│  - Content     │  - Cache     │  - Semantic   │  - Backups  │
│  - Relations   │  - Rate lim  │               │             │
│  - Reputation  │  - Pub/Sub   │               │             │
└─────────────────────────────────────────────────────────────┘
```

## Modular Monolith Architecture

- **NOT microservices** (until 20-30 engineers)
- Single deployable unit
- Internal module boundaries
- Shared database (with schema separation)
- Faster development, lower ops overhead
- Netflix, Amazon Prime Video, Segment all moved BACK to monoliths

---

# 8. Database Schema (Core Tables)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  era VARCHAR(50),
  birthday DATE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  total_cred INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP
);

-- Nodes (Communities)
CREATE TABLE nodes (
  id UUID PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES nodes(id),
  icon_url TEXT,
  banner_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  vibe_velocity DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(id),
  node_id UUID REFERENCES nodes(id),
  content TEXT,
  content_type VARCHAR(20),
  media_urls JSONB,
  expert_gate_cred INTEGER,
  status VARCHAR(20) DEFAULT 'published',
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vibe Reactions
CREATE TABLE vibe_reactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  insightful DECIMAL(3,2) DEFAULT 0,
  joy DECIMAL(3,2) DEFAULT 0,
  fire DECIMAL(3,2) DEFAULT 0,
  support DECIMAL(3,2) DEFAULT 0,
  shock DECIMAL(3,2) DEFAULT 0,
  questionable DECIMAL(3,2) DEFAULT 0,
  total_intensity DECIMAL(5,2) GENERATED ALWAYS AS (...) STORED,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- User Node Cred
CREATE TABLE user_node_cred (
  user_id UUID REFERENCES users(id),
  node_id UUID REFERENCES nodes(id),
  cred INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, node_id)
);

-- Vouches (Web of Trust)
CREATE TABLE vouches (
  id UUID PRIMARY KEY,
  voucher_id UUID REFERENCES users(id),
  vouchee_id UUID REFERENCES users(id),
  stake INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mod Action Log
CREATE TABLE mod_action_log (
  id UUID PRIMARY KEY,
  moderator_id UUID REFERENCES users(id),
  target_type VARCHAR(20),
  target_id UUID,
  action VARCHAR(50),
  reason TEXT,
  node_id UUID REFERENCES nodes(id),
  appealable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Vibe Config
CREATE TABLE user_vibe_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  mode VARCHAR(20) DEFAULT 'simple',
  active_preset_id VARCHAR(100) DEFAULT 'balanced',
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# 9. API Endpoints

## Authentication
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/verify-email
POST /api/v1/auth/google
POST /api/v1/auth/apple
```

## Users
```
GET    /api/v1/users/:id
GET    /api/v1/users/:id/posts
GET    /api/v1/users/:id/cred
GET    /api/v1/users/:id/followers
GET    /api/v1/users/:id/following
PATCH  /api/v1/users/:id
POST   /api/v1/users/:id/follow
DELETE /api/v1/users/:id/follow
GET    /api/v1/me
```

## Nodes
```
GET    /api/v1/nodes
GET    /api/v1/nodes/:id
POST   /api/v1/nodes
PATCH  /api/v1/nodes/:id
GET    /api/v1/nodes/:id/posts
GET    /api/v1/nodes/:id/members
POST   /api/v1/nodes/:id/subscribe
DELETE /api/v1/nodes/:id/subscribe
GET    /api/v1/nodes/:id/vector-config
PUT    /api/v1/nodes/:id/vector-config
POST   /api/v1/nodes/:id/proposals
```

## Posts
```
GET    /api/v1/posts
GET    /api/v1/posts/:id
POST   /api/v1/posts
PATCH  /api/v1/posts/:id
DELETE /api/v1/posts/:id
POST   /api/v1/posts/:id/reactions
PUT    /api/v1/posts/:id/reactions
DELETE /api/v1/posts/:id/reactions
GET    /api/v1/posts/:id/reactions
GET    /api/v1/posts/:id/comments
```

## Comments
```
GET    /api/v1/comments/:id
POST   /api/v1/posts/:postId/comments
PATCH  /api/v1/comments/:id
DELETE /api/v1/comments/:id
POST   /api/v1/comments/:id/reactions
```

## Feed
```
GET    /api/v1/feed
GET    /api/v1/feed/explain/:postId
```

## Vibe Config
```
GET    /api/v1/vibe-config
PUT    /api/v1/vibe-config
GET    /api/v1/vibe-config/presets
POST   /api/v1/vibe-config/presets
GET    /api/v1/vibe-config/community-presets
POST   /api/v1/vibe-config/community-presets/:id/import
POST   /api/v1/vibe-config/experiments
POST   /api/v1/vibe-config/experiments/:id/end
```

## Moderation
```
GET    /api/v1/moderation/log
GET    /api/v1/moderation/queue
POST   /api/v1/moderation/actions
POST   /api/v1/reports
GET    /api/v1/appeals
POST   /api/v1/appeals
POST   /api/v1/appeals/:id/vote
```

## Search
```
GET    /api/v1/search/posts
GET    /api/v1/search/users
GET    /api/v1/search/nodes
```

---

# 10. Infrastructure & Costs

## Scaling Path

| Users | Monthly Cost | Infrastructure |
|-------|-------------|----------------|
| 1K | $32 | 1 server, managed DB |
| 10K | $173 | 2 servers, DB replica |
| 100K | $1,000 | 4-6 servers, 2 replicas, Redis |
| 1M | $7,500 | 20-30 servers, 6 replicas, Kafka |

**Key insight:** Each 10x growth = only 5-6x cost increase with proper optimization

## Cost-Saving Strategies
- Cloudflare free tier (CDN)
- BunnyCDN ($0.01/GB for media)
- Backblaze B2 (80% cheaper than S3)
- PostgreSQL read replicas (not sharding until 10M+)
- Aggressive Redis caching
- Open source monitoring (Grafana, Prometheus)
- MeiliSearch instead of Elasticsearch

---

# 11. Monetization

## Tier Structure

**Free Tier (85% of users)**
- All community features
- Basic Vibe Validator
- Standard uploads (10MB)
- Full functionality

**Premium Tier ($7/month, 10% of users)**
- Larger uploads (100MB)
- Advanced analytics
- Priority support
- Custom CSS themes
- Multiple account support
- Early beta access

**Creator Subscriptions (5% earning)**
- User subscriptions to creators
- Platform takes 12% (not 45% like YouTube)
- Transparent payment terms

## Financial Projections (100K users)

| Revenue Stream | Monthly |
|----------------|---------|
| Premium (10K × $7) | $70,000 |
| Creator cut (5K × $20 × 12%) | $12,000 |
| **Total MRR** | **$82,000** |

| Costs | Monthly |
|-------|---------|
| Infrastructure | $15,000 |
| Moderation (20%) | $16,000 |
| Engineering (5) | $50,000 |
| Operations (3) | $25,000 |
| Marketing | $8,000 |
| **Total** | **$114,000** |

**Break-even:** ~150K users

---

# 12. Development Roadmap

## Phase 1: MVP Core Loop (Months 1-3)
- [ ] Authentication (email, Google, Apple)
- [ ] User profiles (basic)
- [ ] Nodes (create, subscribe, post)
- [ ] Posts (text, images)
- [ ] Comments (threaded)
- [ ] Basic Vibe Vectors (tap to select, no radial wheel)
- [ ] Simple feed (chronological + basic scoring)
- [ ] Simple Vibe Validator (5 presets)
- [ ] Basic search
- [ ] Notifications (basic)
- [ ] Mobile app (Expo)
- [ ] Moderation foundation (ModActionLog, reports)

**Success:** 50 alpha users, 60% day-1 retention

## Phase 2: Community & Curation (Months 3-6)
- [ ] Radial Wheel (full gesture support)
- [ ] Cred system
- [ ] Web of Trust (vouching)
- [ ] Node hierarchy
- [ ] Active Seat mechanic
- [ ] Council of Node formation
- [ ] Starter Packs
- [ ] Intermediate Vibe Validator
- [ ] DMs
- [ ] Enhanced notifications
- [ ] MeiliSearch integration

**Success:** 1,000 users, 20% earning Cred

## Phase 3: Expert Tools (Months 6-9)
- [ ] Node Court (all three tiers)
- [ ] Expert Gate Posts
- [ ] Advanced Vibe Validator
- [ ] Theme Marketplace (n/themes)
- [ ] Community health dashboard
- [ ] Public API v1
- [ ] Bot support

**Success:** 10,000 users, Node Court active

## Phase 4: Scale & Events (Months 9-12)
- [ ] Expert Vibe Validator
- [ ] User experiments (A/B testing your feed)
- [ ] Community presets marketplace
- [ ] Events (Vibe Quilt)
- [ ] Rankings & leaderboards
- [ ] Multiple language support
- [ ] Performance optimization

**Success:** 100,000 users, profitable path

## Phase 5: Ecosystem (Months 12+)
- [ ] Advanced AI moderation
- [ ] Deepfake detection
- [ ] Federation experiments
- [ ] International expansion
- [ ] Native apps optimization
- [ ] Desktop app

**Success:** 1M+ users, sustainability

---

# 13. Success Metrics

## Retention Targets
- Day 1: 60%
- Day 7: 30%
- Day 30: 15%
- Day 90: 10%

## Engagement Targets
- Average connections per user: 10+
- Posts per active user: 3+/week
- Comments per active user: 10+/week
- Vibe Vector usage: 80%+ of active users

## Quality Targets
- Average session duration: 10+ minutes
- DAU/MAU ratio: 20%+
- Appeal success rate: 15-25%
- Report resolution: <24 hours for 90%

## Business Targets
- Premium conversion: 10%
- LTV:CAC ratio: 3:1+
- Infrastructure cost per user: <$0.10/month

---

# 14. Glossary

| Term | Definition |
|------|------------|
| **Active Seat** | Governance position requiring 30-day activity |
| **Atomic Network** | Small (5K-50K) initial launch community |
| **Cred** | Reputation score from community validation |
| **Council of Node** | Top active high-Cred users governing a Node |
| **Cred Faucet** | Mechanism creating new Cred |
| **Cred Sink** | Mechanism destroying Cred |
| **Curation Gauntlet** | Interactive onboarding tutorial |
| **Era** | Age-based "vibe" bracket from birthday |
| **Expert Gate** | Post setting restricting top-level comments |
| **Hub Node** | Parent community in hierarchy |
| **ModActionLog** | Immutable public moderation record |
| **Node** | A community with its own governance |
| **Node Court** | Three-tier appeal system |
| **Optimistic Curation** | Amplify good vs filter bad |
| **Radial Wheel** | Gesture-based reaction selector |
| **Vibe Validator** | User-controlled algorithm panel |
| **Vibe Vectors** | 6D multi-dimensional reactions |
| **Vibe Velocity** | Community quality ranking |
| **Web of Trust** | Vouch network establishing reputation |

---

# 15. What's Missing / TBD

## Features Needing Design
- [ ] Video processing pipeline
- [ ] Audio/voice note implementation
- [ ] Polls system design
- [ ] Cross-posting mechanics
- [ ] Federation strategy (AT Protocol? Custom?)
- [ ] Desktop app strategy
- [ ] Offline-first mobile support
- [ ] Analytics/insights for users
- [ ] Scheduled posts
- [ ] Draft management

## Decisions Pending
- [ ] Exact Cred amounts for all actions
- [ ] Character limits (posts, comments, bio)
- [ ] Media size limits per tier
- [ ] Rate limit specifics
- [ ] Appeal stake amounts
- [ ] Node proposal voting threshold
- [ ] Maximum trust distance default
- [ ] Jury selection algorithm

## Research Needed
- [ ] Deepfake detection providers
- [ ] CSAM detection compliance
- [ ] International content laws
- [ ] Payment processor options (backup to Stripe)
- [ ] Legal entity structure

---

# The End Goal

**We're not trying to be the next Facebook, Twitter, or Reddit.**

We're trying to be the first Node Social—a platform where:

- **Quality beats engagement**
- **Communities govern themselves transparently**
- **Users control what they see by default**
- **Moderators are treated as essential partners**
- **Social media makes people feel better, not worse**

If we succeed, other platforms will copy our governance models. Transparent moderation becomes expected. Users demand control over their algorithms. Quality content gets rewarded.

**That's winning.**

---

**WE ARE NODE. Quality over engagement. Always.**

---

*Document Version: 1.0*
*Last Updated: November 26, 2025*
*BDFL: Josh*