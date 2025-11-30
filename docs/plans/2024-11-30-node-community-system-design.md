# Node Community System - Design Document

**Date:** November 30, 2024
**Status:** Approved for Implementation
**Author:** Brainstormed collaboratively

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [Layout Architecture](#layout-architecture)
3. [Global View - "What's Vibing"](#global-view---whats-vibing)
4. [Node Landing Page](#node-landing-page)
5. [Node Identity System](#node-identity-system)
6. [Database Schema Changes](#database-schema-changes)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Implementation Phases](#implementation-phases)

---

## Vision & Goals

### The Problem
Currently, node communities in NODEsocial lack visual identity and a dedicated "home" experience. When users click on a node, they just see filtered posts - there's no sense of entering a community with its own personality, rules, and governance.

The Vibe Validator (feed algorithm tuner) currently occupies the right sidebar permanently, which:
- Takes up valuable real estate that could show contextual content
- Doesn't adapt based on what the user is viewing
- Misses an opportunity to help users discover new communities

### The Vision
Transform nodes from "post filters" into **living communities** with:
- Visual identity (avatars, banners, color themes)
- Community information (rules, stats, council)
- Transparency (public mod log)
- Discovery ("What's Vibing" - the pulse of the platform)

**Future state:** Each node can customize their own CSS/theme, making post cards visually distinct in the feed. Users scrolling will see a colorful tapestry of different communities - not a uniform wall of sameness.

### Design Principles
1. **Vibrancy over sterility** - Make it feel alive, not like a government form (looking at you, Reddit)
2. **Contextual UI** - Right sidebar changes based on what you're viewing
3. **Pulse of society** - Show what's *changing* (velocity), not just what's popular
4. **Tasteful animation** - Subtle activity glow, no particle effects or rave mode
5. **Cross-platform consistency** - Same mental model on desktop, tablet, mobile

---

## Layout Architecture

### Current Desktop Layout (Before)

```
┌─────────────────────────────────────────────────────────────────────┐
│ LEFT SIDEBAR    │     FEED + HEADER              │  RIGHT SIDEBAR   │
│                 │                                │                  │
│ NODEsocial      │  [🔍 Search...    ] [💬] [🔔]  │  VIBE VALIDATOR  │
│                 │                                │  (always here)   │
│ 🔥 Your Flow    │  ┌─────────────────────────┐   │                  │
│ 🔍 Discovery    │  │ Post Card               │   │  [Balanced ▼]   │
│ 👥 Following    │  └─────────────────────────┘   │                  │
│                 │                                │  Quality ════●══ │
│ YOUR NODES      │  ┌─────────────────────────┐   │  Recency ══●════ │
│ • Tech          │  │ Post Card               │   │  Engage  ═●═════ │
│ • Music         │  └─────────────────────────┘   │  Personal ●═════ │
│ • Global        │                                │                  │
└─────────────────────────────────────────────────────────────────────┘
```

### New Desktop Layout (After)

```
┌─────────────────────────────────────────────────────────────────────┐
│ LEFT SIDEBAR    │      CENTER FEED               │  RIGHT SIDEBAR   │
│ (navigation)    │                                │  (contextual)    │
│                 │  ┌──────────────────────────┐  │                  │
│ NODEsocial      │  │ 🔍 Search hashtags...    │  │  Changes based   │
│                 │  │ [Balanced ▼] ← expands   │  │  on context:     │
│ 🔥 Your Flow    │  └──────────────────────────┘  │                  │
│ 🔍 Discovery    │            ↓                   │  Global view =   │
│ 👥 Following    │  ┌──────────────────────────┐  │  "What's Vibing" │
│                 │  │ VIBE VALIDATOR PANEL     │  │                  │
│ YOUR NODES      │  │ (when expanded)          │  │  Node view =     │
│ • n/Tech        │  │ Quality  ════════●═════  │  │  Node Landing    │
│ • n/Music       │  │ Recency  ══════●═══════  │  │  Page            │
│                 │  │ Engage   ════●══════════ │  │                  │
│                 │  │ Personal ══●════════════ │  │                  │
│                 │  │ [Simple] [Expert]        │  │                  │
│                 │  │         [Collapse ▲]     │  │                  │
│                 │  └──────────────────────────┘  │                  │
│                 │                                │                  │
│                 │  ┌──────────────────────────┐  │                  │
│                 │  │ Post Card                │  │                  │
│                 │  └──────────────────────────┘  │                  │
│                 │                                │                  │
│                 │  ┌──────────────────────────┐  │                  │
│                 │  │ Post Card                │  │                  │
│                 │  └──────────────────────────┘  │                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Layout Changes

1. **Vibe Validator moves to Feed Header**
   - Collapsible panel that expands inline (pushes content down)
   - Shows current mode as button (e.g., "Balanced ▼")
   - Click to expand full sliders
   - Consistent with mobile behavior (button → panel)

2. **Search Field Always Visible**
   - Full search input, not just an icon
   - Users can search hashtags and vibe-validate those results

3. **Right Sidebar Becomes Contextual**
   - **Global view** (Your Flow / Discovery / Following): Shows "What's Vibing"
   - **Node view** (specific node selected): Shows Node Landing Page

### Feed Header Component (Collapsed State)

```
┌────────────────────────────────────────────────────────────┐
│  🔍 Search hashtags, users, nodes...          [💬] [🔔]   │
│  [Balanced ▼]                                              │
└────────────────────────────────────────────────────────────┘
```

### Feed Header Component (Expanded State)

```
┌────────────────────────────────────────────────────────────┐
│  🔍 Search hashtags, users, nodes...          [💬] [🔔]   │
│  [Balanced ▼]                                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  VIBE VALIDATOR                                            │
│                                                            │
│  Quality        ═══════════════●═══════════  35           │
│  Recency        ═════════════●═════════════  30           │
│  Engagement     ═════════●═════════════════  20           │
│  Personalization ═════●═══════════════════   15           │
│                                                            │
│  [🎯 Simple]  [⚙️ Expert]                                  │
│                                                            │
│  Presets: [Latest] [Balanced✓] [Popular] [Custom]         │
│                                                            │
│                                    [Collapse ▲]           │
└────────────────────────────────────────────────────────────┘
```

---

## Global View - "What's Vibing"

When viewing **Your Flow**, **Discovery**, or **Following** (no specific node selected), the right sidebar shows the pulse of the platform.

### Design Philosophy
This is NOT Twitter's trending (volume-based popularity). This shows **velocity** - what's *changing* right now. The goal is to give users their finger on the pulse of society, to feel the mood shifting in real-time.

### Component Layout

```
┌─────────────────────────┐
│  🌊 WHAT'S VIBING       │
│                         │
├─────────────────────────┤
│  ⚡ VELOCITY SPIKES     │
│  Vibes accelerating now │
│                         │
│  💡 +284% in n/Tech     │
│     #AIethics #LLMs     │
│                         │
│  🔥 +156% in n/Startups │
│     #fundraising        │
│                         │
│  😄 +203% in n/Gaming   │
│     #indiedev           │
│                         │
│  💙 +178% in n/Mental   │
│     #selfcare           │
│                         │
├─────────────────────────┤
│  🌟 RISING NODES        │
│                         │
│  ┌──┐ n/AIart           │
│  │🎨│ +142 members today│
│  └──┘                   │
│                         │
│  ┌──┐ n/Vinyl           │
│  │🎵│ +89 members today │
│  └──┘                   │
│                         │
│  ┌──┐ n/Gardening       │
│  │🌱│ +67 members today │
│  └──┘                   │
│                         │
├─────────────────────────┤
│  💎 DISCOVER NODES      │
│  Based on your vibes    │
│                         │
│  ┌────────────────────┐ │
│  │ ┌──┐               │ │
│  │ │🎨│ n/DigitalArt  │ │
│  │ └──┘ 3.2k members  │ │
│  │                    │ │
│  │ "Digital artists   │ │
│  │  sharing work"     │ │
│  │                    │ │
│  │ [Preview] [Join]   │ │
│  └────────────────────┘ │
│                         │
│  ┌────────────────────┐ │
│  │ ┌──┐               │ │
│  │ │🎸│ n/GuitarPedals│ │
│  │ └──┘ 891 members   │ │
│  │                    │ │
│  │ "Tone chasers      │ │
│  │  unite"            │ │
│  │                    │ │
│  │ [Preview] [Join]   │ │
│  └────────────────────┘ │
│                         │
│  [See more nodes →]     │
└─────────────────────────┘
```

### Velocity Spikes Section

**What it shows:**
- Which vibe vectors are accelerating fastest
- Which node the spike is happening in
- Related trending hashtags

**How it's calculated:**
- Compare vibe reaction counts from last hour vs previous hour
- Calculate percentage increase
- Rank by acceleration rate (not absolute volume)
- Show top 4-5 spikes

**Vibe icons:**
- 💡 Insightful
- 😄 Joy
- 🔥 Fire
- 💙 Support
- 😱 Shock
- 🤔 Questionable

### Rising Nodes Section

**What it shows:**
- Nodes with fastest member growth today
- Shows node avatar, name, and growth number

**How it's calculated:**
- Count new NodeSubscriptions per node in last 24 hours
- Rank by absolute new member count
- Show top 3-5 nodes

### Discover Nodes Section

**What it shows:**
- Personalized node recommendations
- Based on user's vibe history (which vibes they use most)

**How it's calculated:**
- Analyze user's reaction patterns (which vibes they use)
- Find nodes where those vibes are dominant
- Exclude nodes user already belongs to
- Show top 2-3 recommendations with preview

---

## Node Landing Page

When viewing a **specific node** (user clicked on a node in the sidebar), the right sidebar transforms into the Node Landing Page.

### Full Component Layout

```
┌─────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← Banner area
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   (gradient or custom image)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   with subtle activity glow
│  ┌──────────┐           │
│  │          │           │ ← Avatar overlaps banner
│  │    🎵    │           │   (like modern profiles)
│  │          │           │
│  └──────────┘           │
│                         │
│  n/Music                │ ← Node name
│                         │
│  "Where sound becomes   │ ← Description (editable)
│   community"            │
│                         │
│  👥 1,247 members       │ ← Stats
│  📅 Est. March 2024     │
│  📈 +89 this week       │
│                         │
│  [Join Node]  [••• ▼]   │ ← Action buttons
│                         │
├─────────────────────────┤
│  📜 RULES               │
│                         │
│  1. No self-promo spam  │
│  2. Credit original     │
│     artists             │
│  3. Be constructive in  │
│     feedback            │
│                         │
│  [Show all 5 rules →]   │ ← Expandable if many rules
│                         │
├─────────────────────────┤
│  👑 NODE COUNCIL        │
│                         │
│  ┌──┐ @musicmod         │
│  │  │ Admin · 2y        │ ← Role + tenure
│  └──┘                   │
│                         │
│  ┌──┐ @beatlover        │
│  │  │ Moderator · 6mo   │
│  └──┘                   │
│                         │
│  ┌──┐ @synthwave        │
│  │  │ Moderator · 2mo   │
│  └──┘                   │
│                         │
│  [Message Council]      │ ← Opens DM to council
│                         │
├─────────────────────────┤
│  📋 RECENT MOD ACTIONS  │
│                         │
│  ┌─────────────────────┐│
│  │ Post removed        ││
│  │ Reason: spam        ││
│  │ 2 hours ago         ││
│  └─────────────────────┘│
│                         │
│  ┌─────────────────────┐│
│  │ Warning issued      ││
│  │ Reason: harassment  ││
│  │ yesterday           ││
│  └─────────────────────┘│
│                         │
│  [View full mod log →]  │
│                         │
└─────────────────────────┘
```

### The ••• Menu (Overflow Actions)

When user clicks the ••• button next to "Join Node":

```
┌─────────────────────┐
│ 🔇 Mute Node        │ ← Hide posts from feed
│ 🚪 Leave Node       │ ← If already member
│ 🔗 Share Node       │ ← Copy link
│ 🚩 Report Node      │ ← Report to platform
└─────────────────────┘
```

### Stats Breakdown

| Stat | Source | Calculation |
|------|--------|-------------|
| Members | `NodeSubscription` | `COUNT WHERE nodeId = X` |
| Est. Date | `Node.createdAt` | Format as "Month Year" |
| Growth | `NodeSubscription` | `COUNT WHERE nodeId = X AND joinedAt > 7 days ago` |

### Node Council Display

**Who appears:**
- Users with `NodeSubscription.role` = 'admin' or 'moderator'
- Sorted by role (admins first), then by tenure (joinedAt)

**Tenure calculation:**
- Compare `joinedAt` to now
- Display as "2y", "6mo", "2mo", "3w", "5d"

### Mod Log Preview

**What shows:**
- Last 2-3 mod actions from `ModActionLog` where target is in this node
- Shows action type, reason, and relative time

**Full mod log page:**
- Paginated list of all mod actions
- Filterable by action type
- Public transparency feature

---

## Node Identity System

### Banner Behavior

**Priority order:**
1. **Custom image** - If `Node.banner` is set, display the uploaded image
2. **Gradient fallback** - Auto-generate gradient from `Node.color`

**Gradient generation:**
```typescript
// Example: If node.color = "#6366f1" (indigo)
// Generate gradient from lighter to darker variant
const generateGradient = (baseColor: string) => {
  const lighter = lighten(baseColor, 20);
  const darker = darken(baseColor, 20);
  return `linear-gradient(135deg, ${lighter} 0%, ${baseColor} 50%, ${darker} 100%)`;
};
```

**Activity glow effect:**
- Subtle glow on banner edges when node has high activity
- Based on recent post/reaction velocity in the node
- CSS box-shadow with animated opacity
- NOT over-the-top, just a subtle "alive" feeling

```css
/* Example glow implementation */
.node-banner {
  box-shadow: 0 0 20px rgba(99, 102, 241, var(--glow-opacity));
  transition: --glow-opacity 2s ease-in-out;
}

/* --glow-opacity calculated from activity level: 0 to 0.4 */
```

### Avatar Behavior

**Size:** 80x80px (overlaps banner by ~40px)

**Shape:** Rounded square (border-radius: 16px) to match app aesthetic

**Fallback:** If no avatar uploaded, show first letter of node name on colored background

```
┌────────┐
│   T    │  ← "T" for n/Tech
│        │     Background = node.color
└────────┘
```

### Upload Flow (Admin Only)

Admins can edit node identity via NodeSettingsScreen:

```
┌─────────────────────────────────────────┐
│  Edit Node: n/Music                     │
│                                         │
│  Banner                                 │
│  ┌─────────────────────────────────┐   │
│  │ [Current banner preview]        │   │
│  │                                 │   │
│  │     [Upload New] [Remove]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Avatar                                 │
│  ┌────┐                                │
│  │ 🎵 │  [Upload New] [Remove]         │
│  └────┘                                │
│                                         │
│  Name                                   │
│  [Music________________________]        │
│                                         │
│  Description                            │
│  [Where sound becomes community_]       │
│  [________________________________]     │
│                                         │
│  Primary Color                          │
│  [#6366f1] [🎨 Pick]                   │
│                                         │
│  Rules                                  │
│  1. [No self-promo spam________] [×]   │
│  2. [Credit original artists___] [×]   │
│  3. [Be constructive___________] [×]   │
│  [+ Add Rule]                           │
│                                         │
│            [Cancel]  [Save Changes]     │
└─────────────────────────────────────────┘
```

---

## Database Schema Changes

### Node Model Updates

```prisma
model Node {
  // EXISTING FIELDS
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  description String?
  color       String?  // Used for gradient fallback + theme
  createdAt   DateTime @default(now())
  creatorId   String?
  creator     User?    @relation(fields: [creatorId], references: [id])

  // NEW FIELDS
  avatar      String?  // URL to uploaded avatar image
  banner      String?  // URL to uploaded banner image (null = use gradient)
  rules       Json     @default("[]")  // Array of rule strings: ["Rule 1", "Rule 2"]

  // EXISTING RELATIONS (unchanged)
  posts         Post[]
  vibeWeights   NodeVibeWeight[]
  reactions     VibeReaction[]
  modQueueItems ModQueueItem[]
  vectorConfig  NodeVectorConfig?
  subscriptions NodeSubscription[]

  @@map("nodes")
}
```

### Migration SQL

```sql
-- Add new columns to nodes table
ALTER TABLE nodes ADD COLUMN avatar TEXT;
ALTER TABLE nodes ADD COLUMN banner TEXT;
ALTER TABLE nodes ADD COLUMN rules JSONB DEFAULT '[]'::jsonb;
```

### No New Tables Required

We can leverage existing tables:

| Feature | Existing Table | How |
|---------|---------------|-----|
| Member count | `NodeSubscription` | `COUNT(*)` |
| Council members | `NodeSubscription` | `WHERE role IN ('admin', 'moderator')` |
| Mod log | `ModActionLog` | `WHERE targetType = 'post' AND targetId IN (posts in node)` |
| Velocity data | `PostVibeAggregate` | Calculate from `reactionsLastHour` |
| Growth stats | `NodeSubscription` | `WHERE joinedAt > NOW() - INTERVAL '7 days'` |

---

## API Endpoints

### Node Management

#### `GET /nodes/:id`
Get full node details including stats.

**Response:**
```json
{
  "id": "uuid",
  "slug": "music",
  "name": "Music",
  "description": "Where sound becomes community",
  "color": "#6366f1",
  "avatar": "https://cdn.example.com/nodes/music/avatar.png",
  "banner": "https://cdn.example.com/nodes/music/banner.png",
  "rules": [
    "No self-promo spam",
    "Credit original artists",
    "Be constructive in feedback"
  ],
  "createdAt": "2024-03-15T00:00:00Z",
  "stats": {
    "memberCount": 1247,
    "growthThisWeek": 89,
    "postCount": 4521,
    "activeNow": 23
  },
  "council": [
    {
      "userId": "uuid",
      "username": "musicmod",
      "avatar": "...",
      "role": "admin",
      "joinedAt": "2022-03-15T00:00:00Z"
    }
  ],
  "currentUserMembership": {
    "isMember": true,
    "role": "member",
    "joinedAt": "2024-06-01T00:00:00Z",
    "isMuted": false
  }
}
```

#### `PATCH /nodes/:id`
Update node settings (admin only).

**Request:**
```json
{
  "name": "Music",
  "description": "Where sound becomes community",
  "color": "#6366f1",
  "avatar": "https://...",
  "banner": "https://...",
  "rules": ["Rule 1", "Rule 2", "Rule 3"]
}
```

**Authorization:** Must have `NodeSubscription.role = 'admin'` for this node.

#### `POST /nodes/:id/avatar`
Upload node avatar (admin only).

**Request:** `multipart/form-data` with image file

**Response:**
```json
{
  "avatarUrl": "https://cdn.example.com/nodes/music/avatar.png"
}
```

#### `POST /nodes/:id/banner`
Upload node banner (admin only).

**Request:** `multipart/form-data` with image file

**Response:**
```json
{
  "bannerUrl": "https://cdn.example.com/nodes/music/banner.png"
}
```

### Node Membership

#### `POST /nodes/:id/join`
Join a node.

**Response:**
```json
{
  "success": true,
  "membership": {
    "role": "member",
    "joinedAt": "2024-11-30T00:00:00Z"
  }
}
```

#### `POST /nodes/:id/leave`
Leave a node.

**Response:**
```json
{
  "success": true
}
```

#### `POST /nodes/:id/mute`
Mute a node (hide from feed without leaving).

**Response:**
```json
{
  "success": true,
  "muted": true
}
```

#### `DELETE /nodes/:id/mute`
Unmute a node.

### Mod Log

#### `GET /nodes/:id/mod-log`
Get paginated mod actions for a node.

**Query params:**
- `cursor` - Pagination cursor
- `limit` - Results per page (default 20)
- `action` - Filter by action type (optional)

**Response:**
```json
{
  "actions": [
    {
      "id": "uuid",
      "action": "delete",
      "targetType": "post",
      "targetId": "uuid",
      "reason": "spam",
      "moderatorId": "uuid",
      "moderatorUsername": "musicmod",
      "createdAt": "2024-11-30T10:00:00Z"
    }
  ],
  "nextCursor": "abc123"
}
```

### Trending / Discovery

#### `GET /trending/vibes`
Get velocity spikes across platform.

**Response:**
```json
{
  "spikes": [
    {
      "vibe": "insightful",
      "vibeEmoji": "💡",
      "percentageChange": 284,
      "nodeId": "uuid",
      "nodeSlug": "tech",
      "nodeName": "Tech",
      "hashtags": ["#AIethics", "#LLMs"]
    },
    {
      "vibe": "fire",
      "vibeEmoji": "🔥",
      "percentageChange": 156,
      "nodeId": "uuid",
      "nodeSlug": "startups",
      "nodeName": "Startups",
      "hashtags": ["#fundraising"]
    }
  ],
  "calculatedAt": "2024-11-30T10:00:00Z"
}
```

**Calculation logic:**
1. For each node, for each vibe vector:
   - Get reaction count in last hour
   - Get reaction count in previous hour
   - Calculate percentage change: `((current - previous) / previous) * 100`
2. Filter to spikes > 50% increase
3. Sort by percentage change descending
4. Return top 5

#### `GET /trending/nodes`
Get fastest growing nodes.

**Response:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "slug": "aiart",
      "name": "AI Art",
      "avatar": "...",
      "memberCount": 2341,
      "growthToday": 142
    }
  ]
}
```

**Calculation logic:**
1. Count `NodeSubscription` created in last 24 hours, grouped by node
2. Sort by count descending
3. Return top 5

#### `GET /discover/nodes`
Get personalized node recommendations.

**Response:**
```json
{
  "recommendations": [
    {
      "id": "uuid",
      "slug": "digitalart",
      "name": "Digital Art",
      "description": "Digital artists sharing work",
      "avatar": "...",
      "memberCount": 3200,
      "matchReason": "You often react with 💡 Insightful"
    }
  ]
}
```

**Calculation logic:**
1. Analyze user's `VibeReaction` history to find dominant vibes
2. Find nodes where those vibes are most common
3. Exclude nodes user already belongs to
4. Return top 3

---

## Frontend Components

### New Components

```
src/components/
├── ui/
│   ├── FeedHeader.tsx           # Search + collapsible Vibe Validator
│   ├── NodeLandingPage.tsx      # Right sidebar for node view
│   ├── WhatsVibing.tsx          # Right sidebar for global view
│   ├── NodeBanner.tsx           # Gradient banner + glow effect
│   ├── NodeAvatar.tsx           # Avatar with upload capability
│   ├── NodeRules.tsx            # Rules list with expand/collapse
│   ├── NodeCouncil.tsx          # Council member list
│   ├── ModLogPreview.tsx        # Recent mod actions preview
│   ├── VelocitySpike.tsx        # Single trending vibe item
│   ├── RisingNodes.tsx          # Node growth list
│   ├── DiscoverNodes.tsx        # Personalized recommendations
│   └── NodeOverflowMenu.tsx     # The ••• menu component
│
├── screens/
│   ├── NodeSettingsScreen.tsx   # Admin edit page for node
│   └── ModLogScreen.tsx         # Full mod log page
```

### Component Specifications

#### FeedHeader.tsx

**Props:**
```typescript
interface FeedHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  algoSettings: VibeValidatorSettings;
  onAlgoSettingsChange: (settings: VibeValidatorSettings) => void;
}
```

**State:**
- `isExpanded: boolean` - Whether Vibe Validator panel is expanded

**Behavior:**
- Search input always visible
- Button shows current preset name (e.g., "Balanced")
- Click button toggles `isExpanded`
- When expanded, shows full Vibe Validator controls
- Collapse button at bottom of expanded panel

#### NodeLandingPage.tsx

**Props:**
```typescript
interface NodeLandingPageProps {
  nodeId: string;
  onJoin: () => void;
  onLeave: () => void;
  onMute: () => void;
  onMessageCouncil: () => void;
}
```

**Data fetching:**
- Uses `useQuery` to fetch `GET /nodes/:id`
- Includes stats, council, membership status

**Sections:**
1. Banner + Avatar
2. Name + Description + Stats
3. Action buttons (Join/Leave + Menu)
4. Rules (collapsible if > 3)
5. Council
6. Recent mod actions

#### WhatsVibing.tsx

**Props:**
```typescript
interface WhatsVibingProps {
  onNodeClick: (nodeId: string) => void;
}
```

**Data fetching:**
- `GET /trending/vibes` - Velocity spikes
- `GET /trending/nodes` - Rising nodes
- `GET /discover/nodes` - Recommendations

**Refresh:** Auto-refresh every 60 seconds

#### NodeBanner.tsx

**Props:**
```typescript
interface NodeBannerProps {
  bannerUrl?: string | null;
  color: string;
  activityLevel: number; // 0-1 for glow intensity
}
```

**Behavior:**
- If `bannerUrl` exists, show image
- Otherwise, generate CSS gradient from `color`
- Apply subtle glow effect based on `activityLevel`

**Glow implementation:**
```typescript
const glowOpacity = Math.min(activityLevel * 0.4, 0.4); // Max 0.4 opacity
const glowStyle = {
  boxShadow: `0 0 30px rgba(${hexToRgb(color)}, ${glowOpacity})`,
};
```

### App.tsx Changes

**Right sidebar logic:**
```typescript
// In the main layout render
{isDesktop && rightPanelOpen && (
  <View style={styles.drawerRight}>
    {selectedNodeId ? (
      <NodeLandingPage
        nodeId={selectedNodeId}
        onJoin={handleJoinNode}
        onLeave={handleLeaveNode}
        onMute={handleMuteNode}
        onMessageCouncil={handleMessageCouncil}
      />
    ) : (
      <WhatsVibing onNodeClick={handleNodeSelect} />
    )}
  </View>
)}
```

**New state:**
```typescript
// For node membership actions
const handleJoinNode = async () => {
  await joinNode(selectedNodeId);
  // Refresh node data
};

const handleLeaveNode = async () => {
  await leaveNode(selectedNodeId);
  // Clear selection, return to global
  setSelectedNodeId(null);
};

const handleMuteNode = async () => {
  await muteNode(selectedNodeId);
  // Clear selection, return to global
  setSelectedNodeId(null);
};
```

---

## Implementation Phases

### Phase A: Layout Restructure (Foundation)

**Goal:** Move Vibe Validator to feed header, set up contextual right sidebar

**Tasks:**

1. **Create FeedHeader component**
   - Extract search from current header
   - Add collapsible Vibe Validator panel
   - Implement expand/collapse animation
   - Wire up to existing `algoSettings` state

2. **Update App.tsx layout**
   - Replace current header with FeedHeader
   - Add conditional right sidebar rendering
   - Create placeholder components for NodeLandingPage and WhatsVibing

3. **Mobile consistency**
   - Ensure FeedHeader works on mobile (same button → panel pattern)
   - Test tablet breakpoint behavior

**Files to modify:**
- `App.tsx` - Layout restructure
- `src/components/ui/VibeValidator.tsx` - May need to extract panel content

**Files to create:**
- `src/components/ui/FeedHeader.tsx`
- `src/components/ui/NodeLandingPage.tsx` (placeholder)
- `src/components/ui/WhatsVibing.tsx` (placeholder)

**Estimated scope:** Medium

---

### Phase B: Node Identity

**Goal:** Add avatar, banner, rules to nodes

**Tasks:**

1. **Database migration**
   - Add `avatar`, `banner`, `rules` columns to Node
   - Run migration

2. **Backend API updates**
   - Update `GET /nodes/:id` to return new fields + stats + council
   - Add `PATCH /nodes/:id` for admin updates
   - Add `POST /nodes/:id/avatar` for image upload
   - Add `POST /nodes/:id/banner` for image upload
   - Reuse existing image upload logic from user avatars

3. **NodeBanner component**
   - Gradient generation from color
   - Image display when banner exists
   - Activity glow effect (calculate from recent reactions)

4. **NodeAvatar component**
   - Display with fallback (first letter)
   - Upload capability for admins

5. **NodeLandingPage implementation**
   - Banner + Avatar section
   - Stats display
   - Rules section (collapsible)
   - Council section
   - Wire up real data

6. **NodeSettingsScreen**
   - Form for editing node details
   - Image upload for avatar/banner
   - Rules editor (add/remove/reorder)

**Files to modify:**
- `prisma/schema.prisma` - Add new fields
- `src/routes/nodes.ts` - API endpoints
- `src/lib/api.ts` - Frontend API functions

**Files to create:**
- `src/components/ui/NodeBanner.tsx`
- `src/components/ui/NodeAvatar.tsx`
- `src/components/ui/NodeRules.tsx`
- `src/components/ui/NodeCouncil.tsx`
- `src/screens/NodeSettingsScreen.tsx`

**Estimated scope:** Large

---

### Phase C: What's Vibing

**Goal:** Build the discovery/trending sidebar

**Tasks:**

1. **Backend: Velocity calculation**
   - Create service to calculate vibe velocity spikes
   - Compare hourly reaction counts per vibe per node
   - Cache results (recalculate every 5-10 minutes)

2. **Backend: Trending endpoints**
   - `GET /trending/vibes` - Velocity spikes
   - `GET /trending/nodes` - Rising nodes by member growth
   - `GET /discover/nodes` - Personalized recommendations

3. **Frontend: VelocitySpike component**
   - Display single spike with vibe emoji, percentage, node, hashtags
   - Clickable to navigate to node

4. **Frontend: RisingNodes component**
   - List of growing nodes
   - Shows avatar, name, growth number

5. **Frontend: DiscoverNodes component**
   - Personalized recommendations
   - Preview card with join button

6. **Frontend: WhatsVibing assembly**
   - Combine all sections
   - Auto-refresh logic
   - Loading states

**Files to create:**
- `src/services/trendingService.ts` (backend)
- `src/routes/trending.ts` (backend)
- `src/components/ui/VelocitySpike.tsx`
- `src/components/ui/RisingNodes.tsx`
- `src/components/ui/DiscoverNodes.tsx`
- `src/components/ui/WhatsVibing.tsx`

**Estimated scope:** Large

---

### Phase D: Node Management

**Goal:** Join/leave/mute actions, mod log display

**Tasks:**

1. **Backend: Membership endpoints**
   - `POST /nodes/:id/join`
   - `POST /nodes/:id/leave`
   - `POST /nodes/:id/mute` (new table or field needed?)
   - `DELETE /nodes/:id/mute`

2. **Backend: Mod log endpoint**
   - `GET /nodes/:id/mod-log`
   - Filter ModActionLog by posts in this node
   - Paginate results

3. **Frontend: NodeOverflowMenu**
   - Mute/Leave/Share/Report options
   - Conditional based on membership status

4. **Frontend: ModLogPreview**
   - Show last 2-3 actions
   - Link to full mod log

5. **Frontend: ModLogScreen**
   - Full paginated mod log
   - Filter by action type

6. **Frontend: Message Council flow**
   - Create/find conversation with council members
   - Navigate to chat

**Files to modify:**
- `src/routes/nodes.ts` - Add membership endpoints
- `prisma/schema.prisma` - Add NodeMute table if needed

**Files to create:**
- `src/components/ui/NodeOverflowMenu.tsx`
- `src/components/ui/ModLogPreview.tsx`
- `src/screens/ModLogScreen.tsx`

**Estimated scope:** Medium

---

## Summary

This design transforms nodes from simple post filters into living communities with:

1. **Visual identity** - Avatars, gradient banners with activity glow
2. **Community info** - Stats, rules, council, mod log
3. **Platform pulse** - "What's Vibing" showing velocity spikes
4. **Better UX** - Vibe Validator in feed header, contextual sidebar

The implementation is broken into 4 phases that can be shipped incrementally:
- **Phase A:** Layout restructure (foundation)
- **Phase B:** Node identity (avatar, banner, rules)
- **Phase C:** What's Vibing (trending/discovery)
- **Phase D:** Node management (join/leave/mute, mod log)

Future enhancements (not in this scope):
- Per-node CSS customization
- Colored post cards based on node theme
- TweetDeck-style multi-column with per-column Vibe Validator
