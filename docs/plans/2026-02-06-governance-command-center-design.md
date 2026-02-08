# Governance Command Center — Design

## Problem

Five governance-related screens (Moderation Queue, Node Council, Web of Trust, Appeals, Blocked & Muted) exist as separate, bare-minimum pages with inconsistent design and no shared visual identity. Navigating between them requires going back to the sidebar each time. The screens themselves look generic and lack the visual polish expected of a real social platform.

## Solution

Consolidate all five into a single **Governance Command Center** screen with horizontal tabs. Redesign each tab's content with information-dense, scannable layouts.

## Architecture

### New file
- `app/src/screens/GovernanceScreen.tsx` — unified screen

### Modified files
- `app/App.tsx` — route `governance` view + backward-compat aliases
- `app/src/components/ui/Sidebar.tsx` — collapse 4 nav entries into 1

### Deleted files (after new screen works)
- `app/src/screens/ModerationQueueScreen.tsx`
- `app/src/screens/NodeCouncilScreen.tsx`
- `app/src/screens/WebOfTrustScreen.tsx`
- `app/src/screens/AppealsScreen.tsx`
- `app/src/screens/BlockedMutedScreen.tsx`

### No backend changes

## Screen Structure

```
┌──────────────────────────────────────────────────┐
│  ← Command Center                          ↻     │
├──────────────────────────────────────────────────┤
│  🛡 Mod  │  👑 Council  │  🌐 Trust  │  ⚖ Appeals  │  🚫 Blocked │
├──────────────────────────────────────────────────┤
│                                                  │
│  [Active tab content]                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Props
```tsx
interface GovernanceScreenProps {
  onBack: () => void;
  initialTab?: 'moderation' | 'council' | 'trust' | 'appeals' | 'blocked';
  nodeId?: string;
  nodeName?: string;
  userId?: string;
  onUserClick?: (userId: string) => void;
}
```

### Tab bar
- 5 tabs: icon + short label
- Scrollable on mobile (each tab ~80px), spread evenly on desktop
- Active: accent bottom bar + accent icon/text
- Inactive: muted icon/text
- `theme.panel` background with `theme.border` bottom

## Tab Designs

### Moderation Tab

**Top strip:** 4 priority filter pills in a row
```
🔴 2 Critical   🟠 5 High   🟡 12 Medium   ⚪ 3 Low
```
Tappable to filter. Active filter gets filled background.

**Queue items:** Compact rows (NOT full PostCard embeds):
- Left: 2px vertical priority color bar (full row height)
- Content: avatar (24px) + @username + post preview (1 line) + flag score badge + time
- Right: action chips — `Approve` (green) `Remove` (red) `Warn` (amber)

**Reason modal:** Kept as-is (Modal with TextInput).

**Data:** `GET /api/v1/mod/queue` — fetched on tab mount.

### Council Tab

**Your Status card:** Progress bar style
- Governance weight number
- Horizontal progress bar toward council threshold
- "Need X more to join" or gold "On the Council" state

**Leaderboard:** Compact rows
- Rank # (or crown for #1)
- Avatar (32px) + @username
- Horizontal weight bar (proportional to top member)
- Activity multiplier badge

**Stats:** Inline text row, not big cards: "12 Members · 4,230 Total Weight"

**Data:** `getNodeCouncil(nodeId)` + `getCouncilEligibility(nodeId)` — fetched on tab mount.

### Trust Tab

**Stats strip:** Compact horizontal row above graph
- "3 Vouched · 120 cred out | 5 Vouchers · 340 cred in | Trust: 230"

**SVG Graph:** Kept — the interactive visualization is good. Full width.

**Legend:** Small inline row of colored dots with labels below the graph, not a separate card.

**Selected node:** Floating detail appears as overlay near the graph, not a separate section at the bottom.

**Data:** `GET /vouches/given/:userId` + `GET /vouches/received/:userId` — fetched on tab mount.

### Appeals Tab

**Sub-tabs:** Pill-style segmented control: `All` | `Jury` | `Mine`

**Appeal items:** Card with left color stripe (status color)
- Line 1: status badge + appeal type + date
- Line 2-3: reason text (truncated)
- Footer: stake amount + time remaining + vote progress (if voting)

**Jury duty items:** More prominent — accent border, "Your Vote Needed" banner, Uphold/Overturn buttons primary-styled.

**Vote modal:** Kept as-is.

**Data:** `listAppeals()` or `getMyJuryDuties()` — fetched on sub-tab change.

### Blocked Tab

**Sub-tabs:** Pill-style segmented control: `Blocked (3)` | `Muted (1)`

**User rows:** Minimal — avatar (36px) + @username + era badge inline. Unblock/Unmute as subtle text button right-aligned. No bordered cards, just clean rows with bottom border separator.

**Data:** `getBlockedUsers()` + `getMutedUsers()` — fetched on tab mount.

## Navigation Changes

### Sidebar (expanded)
Before: 4 entries (Moderation, Council, Appeals, Blocked & Muted)
After: 1 entry — Shield icon + "Governance"

### Sidebar (collapsed)
Before: 4 icon entries
After: 1 Shield icon

### App.tsx routing
- New view: `governance` → `<GovernanceScreen>`
- Legacy views still work:
  - `moderation` → `<GovernanceScreen initialTab="moderation">`
  - `council` → `<GovernanceScreen initialTab="council">`
  - `appeals` → `<GovernanceScreen initialTab="appeals">`
  - `blocked-muted` → `<GovernanceScreen initialTab="blocked">`
  - `trust-graph` → `<GovernanceScreen initialTab="trust">`

## Performance
- Lazy tab loading: each tab's data fetches only when first selected
- Memoized themed styles via `useMemo + StyleSheet.create`
- Modals rendered lazily: `{visible && <Modal>}`
