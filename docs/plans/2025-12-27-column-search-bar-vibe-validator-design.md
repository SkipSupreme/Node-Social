# Multi-Column UX Improvements: Search Bar Header + Per-Column VibeValidator

## Problem Statement

The current multi-column TweetDeck-style layout has several UX issues:

1. **Dead-end columns**: Clicking the column title on "Trending" or "Notifications" columns does nothing - users get stuck and can't switch column types
2. **Search friction**: Accessing search requires clicking through a dropdown, then a full-screen modal
3. **No per-column algorithm control**: VibeValidator (feed algorithm tuner) only works globally, not per-column

## Design Goals

- Power users should feel like they're in control
- Primary interaction is through a persistent search bar
- Every column should be reconfigurable at any time
- Feed algorithm settings should be granular (per-column)

## Solution

### 1. Search-Bar-Centric Column Header

Replace the current title + dropdown with a unified search bar:

```
┌────────────────────────────────────────────────────────┐
│ [🔍 Global Feed                    ▼] [⚙️] [←][→] [×] │
└────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows current column type as placeholder (e.g., "Global Feed", "Discovery", "Search: react native")
- Clicking/focusing opens a dropdown with:
  - All column type options (Global, Discovery, Following, Trending, Notifications, Node Feed)
  - Live "Search: {typed query}" option as user types
- Typing a query and pressing Enter switches column to search mode for that query
- Selecting a column type from dropdown switches to that type
- Dropdown dismisses on blur or selection

**Header buttons (right side):**
- ⚙️ Settings (VibeValidator) - opens modal
- ← → Move column (when applicable)
- × Close column (when >1 column exists)

### 2. Per-Column VibeValidator

Each column gets its own feed algorithm settings:

- Settings icon (⚙️) in column header
- Opens VibeValidator in a modal (not inline - columns too narrow)
- Settings saved per-column in the columns store
- Only applicable to feed-based columns (global, discovery, following, node, search)
- Greyed out / hidden for non-feed columns (notifications, trending, profile)

**Store changes:**
```typescript
interface FeedColumn {
  id: string;
  type: ColumnType;
  title: string;
  nodeId?: string;
  searchQuery?: string;
  userId?: string;
  // NEW: per-column vibe settings
  vibeSettings?: VibeValidatorSettings;
}
```

### 3. Fix Header Consistency

All column types (including trending and notifications) will use the same header component with the search bar. The dropdown will always be available to switch types.

## Components to Modify

1. **`FeedColumn.tsx`** - Major refactor of header section
2. **`columns.ts` (store)** - Add `vibeSettings` to FeedColumn interface
3. **New: `ColumnHeader.tsx`** - Extract header into reusable component
4. **New: `ColumnSearchBar.tsx`** - Search bar with dropdown
5. **New: `VibeValidatorModal.tsx`** - Modal wrapper for VibeValidator

- Drag-and-drop column reordering (keep button-based)
- Syncing VibeValidator settings across columns
- Backend changes (all frontend)

## Test Strategy (TDD)

Tests will be written FIRST for each piece:

1. **ColumnSearchBar component tests**
   - Renders with current column type as placeholder
   - Opens dropdown on focus
   - Shows all column type options in dropdown
   - Typing updates search option in dropdown
   - Enter key with query switches to search type
   - Selecting option calls onTypeChange callback
   - Dropdown closes on blur/selection

2. **Column store tests**
   - Adding column with vibeSettings persists correctly
   - Updating column vibeSettings works
   - Loading from storage restores vibeSettings

3. **VibeValidatorModal tests**
   - Opens when settings icon clicked
   - Closes on backdrop tap / X button
   - Changes propagate to parent via callback

4. **FeedColumn integration tests**
   - All column types render with search bar header
   - Settings icon visibility based on column type
   - Move buttons visibility based on position

## Implementation Order

1. Write tests for ColumnSearchBar
2. Implement ColumnSearchBar (RED → GREEN)
3. Write tests for store vibeSettings
4. Update store (RED → GREEN)
5. Write tests for VibeValidatorModal
6. Implement VibeValidatorModal (RED → GREEN)
7. Write tests for FeedColumn header refactor
8. Refactor FeedColumn to use new components (RED → GREEN)
9. Clean up: remove old dropdown/modal code from FeedColumn
