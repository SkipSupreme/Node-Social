# Modular Reddit-like Web Interface Implementation Plan

## Overview

Build a fully customizable web interface where users can drag, drop, resize, and organize panels exactly how they want. Layouts persist between sessions. Feed filtering by post type enables Twitter/Bluesky, TikTok, or Reddit-style experiences.

**CRITICAL:** Vibe Vectors, Radial Wheel Menu, and Vibe Validator are Node Social's core differentiators and must be prioritized above all else. These features are what we're selling.

## Architecture Overview

### Layout Structure (Default)

```
┌─────────────────────────────────────────────────────┐
│ Top Bar: Logo, Search, User Menu                    │
├──────┬───────────────────────────────┬──────────────┤
│      │                               │              │
│ LEFT │         CENTER FEED           │    RIGHT     │
│ SIDE │      (Multi-column capable)   │    SIDE      │
│ BAR  │                               │    BAR       │
│      │  • Feed Column 1              │   ┌────────┐ │
│Nodes │  • Feed Column 2 (optional)   │   │VIBE    │ │
│      │  • Feed Column 3 (optional)   │   │VALIDATOR│ │
│      │                               │   └────────┘ │
│      │                               │   ┌────────┐ │
│      │                               │   │NODE    │ │
│      │                               │   │INFO    │ │
│      │                               │   └────────┘ │
└──────┴───────────────────────────────┴──────────────┘
```

### Key Features

1. **Left Sidebar**: Node/subreddit list (collapsible)
2. **Center Area**: Main feed(s) - supports multiple columns (TweetDeck-style)
3. **Right Sidebar**: Split into two sections:
   - Top: Vibe Validator (feed algorithm controls)
   - Bottom: Node community information
4. **All panels** are draggable, resizable, dockable, and can be moved anywhere
5. **Feed filtering** by post type (text, image, video, link, or combinations)
6. **Panel persistence** - layouts saved and restored on login

---

## Implementation Phases

### Phase 0: CORE FEATURES - Vibe Vectors & Radial Menu (TOP PRIORITY)

**CRITICAL:** These are Node Social's core differentiators. Must be built first and perfectly executed. This is what we're selling.

#### 0.1 Vibe Vectors System (Backend)

**Architecture:**
- **Platform-wide:** Fixed set of Vibe Vectors (e.g., "Funny", "Insightful", "Angry", "Novel", "Cursed")
- **Per Node:** Weighting/priority for each vector (affects feed ranking within that Node)
- **Example:** /funny node weights "Funny" higher, /programming weights "Insightful" higher
- **Purpose:** Same reactions available everywhere, but each community prioritizes what matters most to them

**Files to create/modify:**
- `backend/api/prisma/schema.prisma` - Add `VibeVector`, `NodeVibeWeight`, `VibeReaction` models
- `backend/api/src/routes/posts.ts` - Add `/posts/:id/reactions` endpoint
- `backend/api/src/services/vibeService.ts` - Vibe Vector logic and Node weighting
- `backend/api/src/services/credService.ts` - ConnoisseurCred calculation from reactions
- `backend/api/src/config/vibeVectors.ts` - Platform-wide vector definitions and seed data

**Schema additions:**

```prisma
// Platform-wide Vibe Vector definitions (config table)
model VibeVector {
  id          String   @id @default(uuid())
  slug        String   @unique // "funny", "insightful", "angry", "novel", "cursed"
  name        String   // Display name: "Funny", "Insightful", etc.
  emoji       String?  // Optional emoji icon
  description String?  // Tooltip/help text
  order       Int      // Display order in radial wheel
  enabled     Boolean  @default(true) // Can disable platform-wide
  
  // Relations
  nodeWeights NodeVibeWeight[] // Which nodes weight this vector how much
  reactions   VibeReaction[]   // Reactions using this vector
  
  @@map("vibe_vectors")
}

// Per-Node weighting of vectors (how much each vector matters in that Node)
model NodeVibeWeight {
  id          String   @id @default(uuid())
  nodeId      String
  node        Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  vectorId    String
  vector      VibeVector @relation(fields: [vectorId], references: [id])
  weight      Float    @default(1.0) // 0.0-2.0+, how much this vector affects ranking in this Node
  
  @@unique([nodeId, vectorId])
  @@index([nodeId])
  @@map("node_vibe_weights")
}

// User reactions to posts/comments
model VibeReaction {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  postId      String?
  post        Post?    @relation(fields: [postId], references: [id])
  commentId   String?
  comment     Comment? @relation(fields: [commentId], references: [id])
  nodeId      String   // Which Node's context (affects weighting calculation)
  node        Node     @relation(fields: [nodeId], references: [id])
  
  // Intensity-based reactions (0.0-1.0 for each vector)
  intensities Json     // {"funny": 0.8, "insightful": 0.2, "angry": 0.0, "novel": 0.0}
  totalIntensity Float @default(0.0) // Sum of all intensities
  
  createdAt   DateTime @default(now())
  
  @@unique([userId, postId, nodeId]) // One reaction per user per post per node
  @@index([postId, nodeId])
  @@index([userId, createdAt(sort: Desc)])
  @@map("vibe_reactions")
}

// Update Node model
model Node {
  // ... existing fields ...
  vibeWeights NodeVibeWeight[] // Per-node vector weightings
  reactions   VibeReaction[]   // Reactions in this Node's context
  @@map("nodes")
}

// Update User model
model User {
  // ... existing fields ...
  reactions   VibeReaction[]   // User's reactions
  // ... rest of model ...
}
```

**Initial Platform Vectors (TBD - needs Reddit community research):**
- **Definite:** "Funny", "Insightful", "Angry"
- **Likely:** "Novel", "Cursed" (from master plan)
- **To research:** 
  - Review Reddit communities to identify common reaction types
  - Analyze what reactions make sense across different communities
  - Finalize complete list before Phase 0 completion
- **Configuration:** Stored in `vibe_vectors` table, seeded on first deployment
- **Default weighting:** All Nodes start with 1.0 weight for all vectors (equal priority)

**Node weighting logic:**
- Each Node can set custom weights for each platform vector (default: 1.0 for all)
- Higher weight = reactions with that vector contribute more to post ranking in that Node
- Example: /funny node might set `{funny: 1.5, insightful: 0.5, angry: 0.3}`
- When ranking posts in /funny, "Funny" reactions count more toward trending
- Weighting affects feed algorithm, NOT which vectors are available (all vectors always available)

**Key implementation points:**
- Vibe Vectors are platform-wide (same set for all users/Nodes)
- Node-specific weighting affects feed ranking, not which vectors are available
- Intensity values are 0.0-1.0 (percentage-based)
- Users can apply multiple vectors with different intensities in one reaction
- Reactions feed into ConnoisseurCred calculation (experts' reactions weighted more)
- Don't display raw counts prominently (research: visible scores create bias)
- Reactions are personal expression, not public voting

#### 0.2 Radial Wheel Menu (Frontend - Web)

**What it is:** Click-and-hold "React" button, procedural wheel fans out. Drag cursor over multiple vectors (e.g., "70% Funny, 20% Insightful") in one fluid motion, sets intensity for each vector.

**Files to create:**
- `app/src/web/components/VibeVectors/RadialWheelMenu.tsx` - Main radial wheel component
- `app/src/web/components/VibeVectors/RadialWheelSlice.tsx` - Individual vector slice
- `app/src/web/components/VibeVectors/RadialWheelContainer.tsx` - Container with animations
- `app/src/web/hooks/useRadialWheel.ts` - Mouse/touch tracking for drag interactions
- `app/src/web/components/VibeVectors/VibeIntensityDisplay.tsx` - Show selected intensities in real-time
- `app/src/web/lib/vibeVectors.ts` - Vector definitions, helper functions

**Interaction flow:**
1. User click-and-holds "React" button on post/comment
2. Radial wheel fans out procedurally (animated, smooth CSS transforms)
3. Each Vibe Vector is a slice arranged in a circle (e.g., "Insightful", "Funny", "Cursed", "Novel", "Angry")
4. User drags cursor over multiple slices
5. Intensity set based on how long cursor hovers/drags in each slice zone
6. Visual feedback shows intensity buildup (0% → 100% for each vector)
7. Release mouse/touch to submit reaction with multiple intensities

**Design requirements:**
- Smooth animations (CSS transitions/transforms, requestAnimationFrame)
- Hover feedback for each slice (highlight, glow effect)
- Intensity visualization (progress ring or fill per slice)
- Patent-potential gesture (innovative interaction - investigate patent before launch)
- Works with mouse (desktop) and touch (mobile web)
- Accessibility: Keyboard navigation support, screen reader friendly

**Example interaction:**
- Click-hold "React" button → wheel appears with fade-in animation
- Drag over "Insightful" for 300ms → 70% intensity shown in progress ring
- Drag over "Funny" briefly (100ms) → 20% intensity
- Release → reaction saved: `{insightful: 0.7, funny: 0.2, angry: 0.0, novel: 0.0, cursed: 0.0}`
- Visual confirmation: wheel collapses, button shows reaction state

**Technical implementation:**
- Use React state to track mouse/touch position and timing
- Calculate angle from center to determine which slice
- Track hover duration per slice to build intensity (0ms = 0%, max = 100%)
- Debounce/throttle updates for performance
- Store pending reaction state, submit on release

#### 0.3 Vibe Vectors UI Integration (Web)

**Files to create:**
- `app/src/web/components/VibeVectors/PostVibeReactions.tsx` - Display reactions on post (compact, counts hidden by default)
- `app/src/web/components/VibeVectors/ReactionButton.tsx` - "React" button that triggers radial wheel
- `app/src/web/components/VibeVectors/VibeVectorBadge.tsx` - Individual vector display (optional counts on hover)
- `app/src/web/components/VibeVectors/ReactionSummary.tsx` - Summary view (e.g., "42 reactions" - expandable)

**Display philosophy (from master plan):**
- Don't display raw counts prominently (research: visible scores create bias before users read content)
- Reactions primarily for ranking/filtering, not public voting
- Counts available on demand (hover or click to expand)
- Feel like personal expression, not public voting
- Show vector presence subtly (e.g., colored dot if post has that reaction type)
- On hover/click: show breakdown of reactions with counts

**UI examples:**
- Compact: "React" button with subtle indicator if user already reacted
- Expanded: Show all vectors with intensity bars (hidden by default, on click/hover)
- User's own reaction: Highlighted, shows their intensity breakdown

#### 0.4 Vibe Validator Integration (Web - Priority)

**Files to create:**
- `app/src/web/components/FeedControls/VibeValidator.tsx` - Main panel (reuse mobile logic from `FeedPreferencesScreen.tsx`)
- `app/src/web/components/FeedControls/VibeVectorSliders.tsx` - Sliders for each Vibe Vector (show/hide by vector type)
- `app/src/web/components/FeedControls/PresetSelector.tsx` - Quick presets (Latest, Balanced, Popular, Expert, Personal)
- `app/src/web/components/FeedControls/WeightSliders.tsx` - Main algorithm weights (Quality, Recency, Engagement, Personalization)
- `app/src/web/components/FeedControls/AdvancedSettings.tsx` - Collapsible advanced controls

**Right sidebar integration:**
- Top section of right sidebar = Vibe Validator (always visible, collapsible)
- Controls feed algorithm weights in real-time
- Feed updates automatically when sliders change (debounced to avoid excessive API calls)
- Per-feed settings: Each column can have its own Vibe Validator settings

**Vibe Vector filtering:**
- Sliders to show/hide posts with specific Vibe Vectors
- Example: Drag "Cursed" slider to 0% → hide all posts with "Cursed" reactions
- Works in combination with main algorithm weights

**API integration:**
- Use existing `/feed-preferences` endpoint
- Extend to support Vibe Vector filtering weights
- Backend applies weights to feed ranking algorithm

**Future enhancements (Phase 3):**
- "Why am I seeing this?" explainer per post
- "More like this" / "Less like this" correction buttons
- Machine learning feedback loop

#### 0.5 Backend Feed Algorithm with Vibe Vectors

**Files to create/modify:**
- `backend/api/src/services/feedAlgorithm.ts` - Core feed ranking logic
- `backend/api/src/routes/posts.ts` - Update `/posts` to use algorithm with Node weighting
- `backend/api/src/services/nodeWeightService.ts` - Calculate weighted scores based on Node's vector weights

**Ranking factors:**
1. **Vibe Vector intensities** (weighted by reactor's ConnoisseurCred AND Node's vector weights)
2. **Vibe Vector diversity** (posts with varied reactions score higher)
3. **Quality weight** (from Vibe Validator user preferences)
4. **Recency weight** (from Vibe Validator, time decay)
5. **Engagement weight** (from Vibe Validator, comment depth, reaction totals)
6. **Personalization weight** (from Vibe Validator, following relationships)

**Node weighting application:**
- When calculating post score in a Node, multiply each Vibe Vector's contribution by Node's weight for that vector
- Example: Post has 10 "Funny" reactions in /funny node (weight: 1.5)
- Contribution = (10 reactions * avg intensity * reactor cred) * 1.5
- Same post in /programming node (Funny weight: 0.5) would have lower score

**Implementation:**
- Default: chronological if no preferences set
- When preferences exist: apply weighted algorithm
- Support `?sort=chronological` vs `?sort=algorithmic` toggle
- Support `?nodeId=xyz` to apply that Node's weights

**Performance considerations:**
- Cache Node weights (Redis)
- Batch calculate scores for multiple posts
- Index on VibeReaction (postId, nodeId, createdAt)
- Consider materialized view for trending scores (updated periodically)

---

### Phase 1: Core Layout System & Panel Infrastructure

#### 1.1 Panel System Foundation

**Files to create:**
- `app/src/web/components/PanelSystem/PanelSystem.tsx` - Main panel container
- `app/src/web/components/PanelSystem/Panel.tsx` - Individual draggable panel
- `app/src/web/components/PanelSystem/PanelDragHandle.tsx` - Drag handle component
- `app/src/web/components/PanelSystem/PanelResizer.tsx` - Resize handles (all edges)
- `app/src/web/components/PanelSystem/PanelHeader.tsx` - Header with minimize/close buttons
- `app/src/web/hooks/usePanelLayout.ts` - Panel state management hook
- `app/src/web/lib/panelPersistence.ts` - Save/load panel layouts

**Key libraries needed:**
- `react-grid-layout` or `@dnd-kit/core` + `@dnd-kit/sortable` for drag/drop
- `local-storage` for layout persistence (later: backend sync)

**Panel types:**
- `left-sidebar` (Nodes list)
- `feed-column` (Main feed area)
- `right-sidebar-top` (Vibe Validator)
- `right-sidebar-bottom` (Node info)
- `comment-thread` (Detachable comments)
- `detached-feed` (Movable feed instance)

#### 1.2 Layout State Management

**File:** `app/src/web/store/panelLayout.ts` (Zustand store)

**State structure:**

```typescript
type PanelLayout = {
  panels: {
    [panelId: string]: {
      type: PanelType;
      x: number;
      y: number;
      width: number;
      height: number;
      minimized: boolean;
      order: number;
      zIndex: number;
    };
  };
  columns: {
    [columnId: string]: {
      width: number;
      feeds: FeedConfig[];
    };
  };
  lastSaved: string;
  version: string; // For migration handling
};
```

**Persistence:**
- Save to `localStorage` on layout changes (debounced, ~500ms)
- Optionally sync to backend `/api/user/layout` endpoint (future)
- Handle version migration gracefully
- Fallback to default layout if corrupted

---

### Phase 2: Left Sidebar - Nodes List

#### 2.1 Node Sidebar Component

**Files:**
- `app/src/web/components/Sidebars/LeftSidebar.tsx`
- `app/src/web/components/Sidebars/NodeList.tsx`
- `app/src/web/components/Sidebars/NodeListItem.tsx`
- `app/src/web/components/Sidebars/NodeSearch.tsx`

**Features:**
- Collapsible sidebar (hamburger menu, keyboard shortcut)
- List of all nodes (from existing `getNodes()` API)
- Current node highlighted
- Search/filter nodes (instant search)
- Click node to filter feed
- Shows node subscriber counts (future)
- Shows node activity indicators (future)
- "Create Node" button (future)

**Styling:**
- Reddit classic style: compact, clean, minimal
- Hover states with subtle background change
- Active node indicator (left border highlight)
- Sticky scroll (if long list)
- Responsive: collapse on mobile

---

### Phase 3: Right Sidebar Components

#### 3.1 Vibe Validator Panel (Top Right)

**Files:**
- `app/src/web/components/Sidebars/RightSidebarTop.tsx`
- `app/src/web/components/FeedControls/VibeValidator.tsx` (reuse mobile logic)
- `app/src/web/components/FeedControls/PresetSelector.tsx`
- `app/src/web/components/FeedControls/WeightSliders.tsx`
- `app/src/web/components/FeedControls/VibeVectorSliders.tsx` (NEW - per-vector filters)

**Integration:**
- Reuse existing `FeedPreferencesScreen.tsx` logic where possible
- Wire to `/feed-preferences` API endpoints
- Auto-apply to active feeds when changed
- Per-column settings: Each feed column can have independent Vibe Validator settings

#### 3.2 Node Info Panel (Bottom Right)

**Files:**
- `app/src/web/components/Sidebars/RightSidebarBottom.tsx`
- `app/src/web/components/NodeInfo/NodeInfoCard.tsx`
- `app/src/web/components/NodeInfo/NodeStats.tsx`

**Display:**
- Node name, description
- Subscriber count
- Node Vibe Vector weights (visual indicator of which vectors matter most)
- Node rules (future)
- Moderator list (future)
- "Join/Leave" button (future)
- Node activity stats (future)
- "About" section with community guidelines

---

### Phase 4: Center Feed Area - Multi-Column System

#### 4.1 Feed Column Container

**Files:**
- `app/src/web/components/Feeds/FeedContainer.tsx`
- `app/src/web/components/Feeds/FeedColumn.tsx`
- `app/src/web/components/Feeds/MultiColumnLayout.tsx`
- `app/src/web/components/Feeds/AddColumnButton.tsx`

**Features:**
- Default: single column
- Add column button (max 3-4 columns on desktop)
- Each column independent:
  - Different node filter
  - Different post type filter
  - Different Vibe Validator settings
  - Independent scrolling
  - Independent pagination
- Columns resizable (drag divider between columns)
- Drag columns to reorder

#### 4.2 Post Type Filtering

**Files:**
- `app/src/web/components/Feeds/PostTypeFilter.tsx`
- Extend `app/src/lib/api.ts` to support `postType` query param

**Backend changes:**
- Update `backend/api/src/routes/posts.ts` to filter by `postType`
- Support multiple types: `?postType=text,image` or `?postTypes=text,image,video`
- Add index on `postType` column if needed (already exists in schema)

**Filter options:**
- All types (default)
- Text only (Twitter/Bluesky vibe)
- Images only
- Videos only (TikTok vibe)
- Links only
- Text + Images
- Custom combinations (checkboxes)

**UI:**
- Dropdown or chip selector in feed header
- Per-column filter (for multi-column)
- Remember selection per feed column
- Quick presets: "Text Only", "Video Only", "Images Only", etc.

#### 4.3 Feed Header Controls

**Files:**
- `app/src/web/components/Feeds/FeedHeader.tsx`
- `app/src/web/components/Feeds/FeedSortMenu.tsx`
- `app/src/web/components/Feeds/FeedActionsMenu.tsx`

**Controls per column:**
- Node selector (dropdown)
- Post type filter (chips/dropdown)
- Sort options (New, Hot, Top, Cred Sort, Algorithmic)
- Column actions menu:
  - Detach column (make into movable panel)
  - Duplicate column
  - Close column
  - Reset to defaults

---

### Phase 5: Detachable Components

#### 5.1 Detachable Comments

**Files:**
- `app/src/web/components/Comments/DetachableComments.tsx`
- `app/src/web/components/Comments/CommentThread.tsx`
- Modify `PostCardWeb.tsx` to support "Open Comments in Panel" button

**Behavior:**
- Click post → comments open in right sidebar (default)
- Option: "Detach Comments" button → creates movable panel
- Panel can be moved anywhere, resized
- Multiple comment threads can be open simultaneously
- Close button removes panel
- Comments stay synced with main post view

#### 5.2 Detachable Feeds

**Files:**
- Extend `FeedColumn.tsx` to support detached mode
- Add "Detach Feed" button to feed header

**Behavior:**
- Feed column becomes independent panel
- Can be moved to any position
- Multiple detached feeds possible
- Can be re-docked to center area
- Each detached feed maintains its own filters and settings

---

### Phase 6: Web-Specific Post Cards & Styling

#### 6.1 Reddit-style Post Card (Web)

**Files:**
- `app/src/web/components/Posts/PostCardWeb.tsx` (new, web-specific)
- `app/src/web/components/Posts/PostCardHeader.tsx`
- `app/src/web/components/Posts/PostCardContent.tsx`
- `app/src/web/components/Posts/PostCardFooter.tsx`
- Keep `app/src/components/PostCard.tsx` for mobile

**Design:**
- Reddit classic aesthetic
- Left side: Reaction button (Radial Wheel Menu) with subtle reaction indicator
- Post metadata (author, time, node, Era flair)
- Content preview (expandable if long)
- Right side: Comment count, engagement stats
- "View Comments" opens in sidebar/panel
- Hover: subtle background change

**Responsive:**
- Works in narrow columns (multi-column mode)
- Adapts to wide single-column layout
- Mobile: falls back to existing mobile PostCard

#### 6.2 Web Typography & Spacing

**Files:**
- `app/src/web/styles/webTheme.ts`
- `app/src/web/styles/webColors.ts`

**Reddit-style design tokens:**
- Font: System fonts (Inter, SF Pro, or similar) - `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Colors: Neutral grays (#F8FAFC background, #1E293B text) with accent (#2563EB)
- Spacing: Compact, 8px grid system
- Borders: Subtle, 1px (#E2E8F0)
- Hover states: Light background changes (#F1F5F9)
- Focus states: Blue outline for accessibility

---

### Phase 7: Layout Persistence

#### 7.1 LocalStorage Persistence

**Files:**
- `app/src/web/lib/panelPersistence.ts`

**Save:**
- Panel positions, sizes
- Column configurations
- Feed filters per column
- Minimized/hidden state
- Vibe Validator settings per feed
- Layout template name (future: multiple layouts)

**Load:**
- On app load: restore layout from localStorage
- Fallback: default layout if none exists
- Migration: handle version changes gracefully
- Validate layout structure before applying

#### 7.2 Backend Sync (Future - Phase 3)

**Files:**
- `backend/api/src/routes/user.ts` - add `/user/layout` endpoint
- `backend/api/prisma/schema.prisma` - add `UserLayout` model

**Benefits:**
- Sync across devices
- Cloud backup
- Layout sharing (future)
- Multiple named layouts (future)

---

### Phase 8: Mobile Responsiveness

#### 8.1 Responsive Breakpoints

**Strategy:**
- Desktop (>1024px): Full modular panel system
- Tablet (768-1024px): Simplified, single column, collapsible sidebars
- Mobile (<768px): Use existing mobile screens (current `FeedScreen.tsx`, `PostCard.tsx`)

**Files:**
- `app/src/web/hooks/useResponsive.ts`
- Conditional rendering based on screen size
- Mobile: Hide panel system, use existing mobile screens

**Mobile considerations:**
- Radial Wheel Menu must work on touch (already planned)
- Panels too complex for mobile - use native mobile UI
- Vibe Validator accessible via settings screen on mobile

---

## Technical Decisions

### Drag & Drop Library

**Recommendation:** `react-grid-layout` (similar to VS Code)

- **Pros:** Grid-based, handles resize well, mature, good performance
- **Cons:** Grid system might be restrictive for free-form dragging

**Alternative:** `@dnd-kit/core` + `@dnd-kit/sortable`

- **Pros:** More flexible, modern API, better for custom interactions
- **Cons:** More manual work for resize logic, potentially more complex

**Decision:** Start with `react-grid-layout` for MVP, evaluate if limitations become an issue. Can migrate to `@dnd-kit` later if needed.

### State Management

- **Panel layout state:** Zustand store (add to existing `app/src/store/`)
- **Feed state:** React Query (already in use) + Zustand for multi-column coordination
- **Vibe Validator state:** Zustand (syncs with backend preferences)
- **UI state:** React state for simple local UI (modals, dropdowns)

### Post Type Filtering Backend

**Schema status:**
- `Post.postType` already exists (line 54 of schema.prisma)
- Current values: "text", "image", "link"
- **Add:** "video" type support when implementing video posts

**API changes:**

```typescript
// backend/api/src/routes/posts.ts
GET /posts?postType=text|image|video|link
GET /posts?postTypes=text,image,video  // Multiple types
```

**Query logic:**
- If `postType` single value: `WHERE postType = 'text'`
- If `postTypes` comma-separated: `WHERE postType IN ('text', 'image')`

---

## File Structure

```
app/src/
├── components/           # Mobile components (existing)
│   ├── PostCard.tsx
│   └── ...
├── web/                  # NEW: Web-specific components
│   ├── components/
│   │   ├── PanelSystem/  # Panel infrastructure
│   │   │   ├── PanelSystem.tsx
│   │   │   ├── Panel.tsx
│   │   │   ├── PanelDragHandle.tsx
│   │   │   └── PanelResizer.tsx
│   │   ├── Sidebars/     # Left & Right sidebars
│   │   │   ├── LeftSidebar.tsx
│   │   │   ├── RightSidebarTop.tsx
│   │   │   └── RightSidebarBottom.tsx
│   │   ├── Feeds/        # Feed columns & multi-column
│   │   │   ├── FeedContainer.tsx
│   │   │   ├── FeedColumn.tsx
│   │   │   └── MultiColumnLayout.tsx
│   │   ├── Posts/        # Web post cards
│   │   │   └── PostCardWeb.tsx
│   │   ├── Comments/     # Detachable comments
│   │   │   └── DetachableComments.tsx
│   │   ├── FeedControls/ # Vibe Validator UI
│   │   │   ├── VibeValidator.tsx
│   │   │   └── WeightSliders.tsx
│   │   └── VibeVectors/  # Core feature: Vibe Vectors & Radial Menu
│   │       ├── RadialWheelMenu.tsx
│   │       ├── RadialWheelSlice.tsx
│   │       ├── ReactionButton.tsx
│   │       └── PostVibeReactions.tsx
│   ├── hooks/
│   │   ├── usePanelLayout.ts
│   │   ├── useResponsive.ts
│   │   └── useRadialWheel.ts
│   ├── lib/
│   │   ├── panelPersistence.ts
│   │   └── vibeVectors.ts
│   ├── store/
│   │   └── panelLayout.ts
│   └── styles/
│       ├── webTheme.ts
│       └── webColors.ts
├── lib/                  # Shared (existing)
│   └── api.ts            # Extend for postType filtering, reactions
└── screens/              # Mobile screens (existing)
    └── ...
```

---

## Success Criteria

### Phase 0 (Critical - Must Perfect):
✅ Radial Wheel Menu works smoothly with mouse and touch
✅ Vibe Vectors allow intensity-based multi-vector reactions
✅ Vibe Validator controls feed algorithm in real-time
✅ Node weighting affects feed ranking correctly
✅ Reactions don't show counts prominently (reduces bias)

### Phase 1-8:
✅ Users can drag and resize all panels
✅ Layout persists between sessions
✅ Feed filtering by post type works (text-only, video-only, etc.)
✅ Multi-column feeds work (TweetDeck-style)
✅ Comments can be detached into movable panels
✅ Left sidebar shows nodes (Reddit-style)
✅ Right sidebar has Vibe Validator (top) and Node Info (bottom)
✅ Responsive: mobile uses existing screens, desktop uses new system
✅ Performance: smooth dragging, fast feed loads

---

## Future Enhancements (Post-MVP)

1. **Layout Templates:**
   - Save named layouts ("Work Mode", "TikTok Mode", "Programming Mode", etc.)
   - Quick switch between templates
   - Share layout configs

2. **Layout Sharing:**
   - Export layout config as JSON
   - Import others' layouts
   - Community layout marketplace

3. **Keyboard Shortcuts:**
   - `Cmd/Ctrl + K` - Command palette
   - `Cmd/Ctrl + [1-9]` - Switch between feeds
   - Arrow keys to navigate posts
   - `R` - React (opens Radial Wheel)

4. **Panel Grouping:**
   - Group related panels
   - Collapse/expand groups
   - Snap-to-grid alignment helpers

5. **Backend Layout Sync:**
   - Save layouts to backend
   - Sync across devices
   - Version history

6. **Advanced Vibe Validator:**
   - "Why am I seeing this?" explainer per post
   - "More like this" / "Less like this" correction buttons
   - Machine learning feedback loop
   - Per-Node Vibe Validator settings

---

## Notes

- **Vibe Vectors are Node Social's core differentiator** - Must be perfect before anything else
- **Radial Wheel Menu is patent-potential** - Investigate patent before launch
- **Reddit research required** - Finalize complete Vibe Vector list by reviewing Reddit communities
- **Platform-wide vectors with Node weighting** - Same reactions everywhere, different priorities per community
- **Mobile uses existing screens** - Panel system is desktop-only, mobile keeps current UI

---

This plan implements a fully modular, Reddit-inspired web interface where users have complete control over their layout - "Social media on your terms!" But first and foremost, we perfect the Vibe Vectors and Radial Menu - that's what we're selling.

