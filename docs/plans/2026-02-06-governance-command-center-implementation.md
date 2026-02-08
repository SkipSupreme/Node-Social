# Governance Command Center — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate 6 separate governance screens (Moderation, Council, Trust, Appeals, Vouches, Blocked/Muted) into a single tabbed "Command Center" screen with redesigned, information-dense layouts.

**Architecture:** One new `GovernanceScreen.tsx` with horizontal tab bar. Each tab renders its content inline with lazy data loading. Sidebar collapses 5 entries into 1. App.tsx routes legacy view names to the new screen with `initialTab`. Old screen files deleted after verification.

**Tech Stack:** React Native, lucide-react-native icons, react-native-svg (Trust tab), existing API functions from `app/src/lib/api.ts`, theme system via `useAppTheme()`.

**Design doc:** `docs/plans/2026-02-06-governance-command-center-design.md`

---

## Task 1: Create GovernanceScreen shell with tab bar

**Files:**
- Create: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Create the screen file with tab bar and empty tab content**

```tsx
import React, { useState, useMemo, ComponentType } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Crown, Globe, Scale, Ban, RefreshCw } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';

type TabId = 'moderation' | 'council' | 'trust' | 'appeals' | 'blocked';

interface TabDef {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ size?: number; color?: string }>;
}

const TABS: TabDef[] = [
  { id: 'moderation', label: 'Moderation', shortLabel: 'Mod', icon: Shield },
  { id: 'council', label: 'Council', shortLabel: 'Council', icon: Crown },
  { id: 'trust', label: 'Trust', shortLabel: 'Trust', icon: Globe },
  { id: 'appeals', label: 'Appeals', shortLabel: 'Appeals', icon: Scale },
  { id: 'blocked', label: 'Blocked', shortLabel: 'Blocked', icon: Ban },
];

interface GovernanceScreenProps {
  onBack: () => void;
  initialTab?: TabId;
  nodeId?: string;
  nodeName?: string;
  userId?: string;
  onUserClick?: (userId: string) => void;
}

export const GovernanceScreen: React.FC<GovernanceScreenProps> = ({
  onBack,
  initialTab = 'moderation',
  nodeId,
  nodeName,
  userId,
  onUserClick,
}) => {
  const theme = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const ts = useMemo(() => StyleSheet.create({
    container: { backgroundColor: theme.bg },
    header: { borderBottomColor: theme.border },
    headerTitle: { color: theme.text },
    tabBar: { backgroundColor: theme.panel, borderBottomColor: theme.border },
    tabActive: { borderBottomColor: theme.accent },
    tabLabel: { color: theme.muted },
    tabLabelActive: { color: theme.accent },
  }), [theme]);

  return (
    <SafeAreaView style={[styles.container, ts.container]}>
      {/* Header */}
      <View style={[styles.header, ts.header]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, ts.headerTitle]}>Command Center</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, ts.tabBar]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive, isActive && ts.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon size={16} color={isActive ? theme.accent : theme.muted} />
              <Text style={[styles.tabLabel, ts.tabLabel, isActive && ts.tabLabelActive]}>
                {tab.shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'moderation' && (
          <Text style={{ color: theme.muted, padding: 20 }}>Moderation tab placeholder</Text>
        )}
        {activeTab === 'council' && (
          <Text style={{ color: theme.muted, padding: 20 }}>Council tab placeholder</Text>
        )}
        {activeTab === 'trust' && (
          <Text style={{ color: theme.muted, padding: 20 }}>Trust tab placeholder</Text>
        )}
        {activeTab === 'appeals' && (
          <Text style={{ color: theme.muted, padding: 20 }}>Appeals tab placeholder</Text>
        )}
        {activeTab === 'blocked' && (
          <Text style={{ color: theme.muted, padding: 20 }}>Blocked tab placeholder</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 32,
  },
  tabBar: {
    borderBottomWidth: 1,
    maxHeight: 44,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
```

**Step 2: Verify file was created correctly**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -5`
Expected: 0 errors (or only pre-existing ones)

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: add GovernanceScreen shell with tab bar"
```

---

## Task 2: Wire up routing in App.tsx and Sidebar

**Files:**
- Modify: `app/App.tsx` (imports, sidebar props, screen rendering)
- Modify: `app/src/components/ui/Sidebar.tsx` (collapse 5 nav items into 1)

**Step 1: Update App.tsx**

1. **Add import** (near line 41-48, alongside existing screen imports):
```tsx
import { GovernanceScreen } from './src/screens/GovernanceScreen';
```

2. **Replace the 6 governance screen conditionals** (lines ~1446-1483) with unified routing. Replace these blocks:
```
currentView === 'moderation' ? <ModerationQueueScreen ... />
currentView === 'appeals' ? <AppealsScreen ... />
currentView === 'council' ? <NodeCouncilScreen ... />
currentView === 'vouches' ? <MyVouchesScreen ... />
currentView === 'trust-graph' ? <WebOfTrustScreen ... />
currentView === 'blocked-muted' ? <BlockedMutedScreen ... />
```
With a single block:
```tsx
) : currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted' ? (
  <GovernanceScreen
    onBack={goBack}
    initialTab={
      currentView === 'moderation' ? 'moderation' :
      currentView === 'council' ? 'council' :
      currentView === 'trust-graph' || currentView === 'vouches' ? 'trust' :
      currentView === 'appeals' ? 'appeals' :
      currentView === 'blocked-muted' ? 'blocked' :
      (viewParams?.initialTab || 'moderation')
    }
    nodeId={selectedNodeId || 'global'}
    nodeName={nodes.find(n => n.id === selectedNodeId)?.name || 'Global'}
    userId={viewParams?.userId}
    onUserClick={(uid) => navigateTo('profile', { userId: uid })}
  />
```

3. **Update desktop sidebar props** (lines ~1219-1223). Replace 5 governance callbacks:
```tsx
onModerationClick={() => navigateTo('governance', { initialTab: 'moderation' })}
onAppealsClick={() => navigateTo('governance', { initialTab: 'appeals' })}
onCouncilClick={() => navigateTo('governance', { initialTab: 'council' })}
onVouchesClick={() => navigateTo('governance', { initialTab: 'trust' })}
onBlockedMutedClick={() => requireAuth('Sign in to manage blocked users') && navigateTo('governance', { initialTab: 'blocked' })}
```

4. **Update mobile sidebar props** (lines ~1567-1588). Same pattern but with `setMenuVisible(false)` wrappers.

**Step 2: Update Sidebar.tsx**

1. **Add `onGovernanceClick` prop** to `SidebarProps` interface. Keep existing individual callback props for now (backward compat).

2. **Collapsed sidebar**: Replace the 5 governance `CollapsedNavItem`s (lines 226-250: Ban, Shield, Scale, Crown, Handshake) with a single one:
```tsx
<CollapsedNavItem
    icon={Shield}
    active={currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted'}
    onPress={onGovernanceClick || onModerationClick}
/>
```

3. **Expanded sidebar**: Replace the 5 governance `NavItem`s (lines 396-440: Blocked & Muted, Moderation, Appeals, Node Council, My Vouches) with a single one:
```tsx
<NavItem
    icon={Shield}
    label="Governance"
    active={currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted'}
    onPress={() => {
        if (onClose && !isDesktop) onClose();
        if (onGovernanceClick) onGovernanceClick();
        else if (onModerationClick) onModerationClick();
    }}
/>
```

**Step 3: Verify TypeScript passes**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 4: Commit**

```bash
git add app/App.tsx app/src/components/ui/Sidebar.tsx
git commit -m "feat: route governance views to unified GovernanceScreen"
```

---

## Task 3: Implement Moderation tab

**Files:**
- Modify: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Add moderation tab content**

Move the logic from `ModerationQueueScreen.tsx` into the GovernanceScreen as a `ModerationTab` component. Redesign the layout:

- **Top strip**: 4 priority filter pills showing counts (Critical, High, Medium, Low). Tappable to filter.
- **Queue items**: Compact rows with left priority color bar (2px), inline content (avatar 24px + @username + post preview truncated 1 line + flag score badge + time), right action chips (Approve/Remove/Warn).
- **Reason modal**: Kept as lazy `{visible && <Modal>}`.

Key data: `api.get<{ items: ModQueueItem[] }>('/api/v1/mod/queue')`

Important: Fetch data only on tab mount (first time selected), not on screen mount. Use a `useEffect` with `activeTab === 'moderation'` guard, and a ref to track if data has been loaded.

**Step 2: Verify**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: implement Moderation tab in GovernanceScreen"
```

---

## Task 4: Implement Council tab

**Files:**
- Modify: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Add council tab content**

Redesign from `NodeCouncilScreen.tsx`:

- **Your Status card**: Progress bar showing governance weight toward council threshold. Gold "On the Council" badge state.
- **Stats**: Inline text row (not big cards): "12 Members · 4,230 Total Weight"
- **Leaderboard**: Compact rows — rank (crown for #1), avatar 32px + @username, horizontal weight bar proportional to top member, activity % badge.

Key data: `getNodeCouncil(nodeId)` + `getCouncilEligibility(nodeId)`

Lazy loading same pattern as Task 3.

**Step 2: Verify**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: implement Council tab in GovernanceScreen"
```

---

## Task 5: Implement Trust tab (graph + vouches)

**Files:**
- Modify: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Add trust tab content**

Combines `WebOfTrustScreen.tsx` graph + `MyVouchesScreen.tsx` vouch list:

- **Top section**: Vouch stats strip (compact horizontal: "3 Given · 120 cred | 5 Received · 340 cred | Trust: 230") + filter pills (All/Given/Received/Revoked)
- **Vouch list**: Compact rows — avatar + @username + "You vouched X cred" or "Vouched you X cred" + time ago. Given vouches show Revoke text button. Tappable to view profile.
- **Trust Graph section**: SVG graph from WebOfTrustScreen (keep the useMemo'd renderGraph). Compact legend inline.

Key data: `getVouchesGiven()` + `getVouchesReceived()` + vouch graph endpoints

Note: The SVG graph needs `react-native-svg` imports (Svg, Circle, Line, G, Text as SvgText, Defs, RadialGradient, Stop).

The RevokeVouchModal is imported from `../components/ui/RevokeVouchModal` and rendered lazily.

**Step 2: Verify**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: implement Trust tab with vouches and graph"
```

---

## Task 6: Implement Appeals tab

**Files:**
- Modify: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Add appeals tab content**

Redesign from `AppealsScreen.tsx`:

- **Sub-tabs**: Pill-style segmented control: All | Jury | Mine
- **Appeal cards**: Left color stripe (status color), status badge + type + date on line 1, reason text lines 2-3, footer with stake + time remaining + progress.
- **Jury duty items**: Accent border, "Your Vote Needed" banner, primary-styled Uphold/Overturn buttons.
- **Vote modal**: Kept as lazy `{visible && <Modal>}`.

Key data: `listAppeals()`, `getMyJuryDuties()`, `voteOnAppeal()`

**Step 2: Verify**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: implement Appeals tab in GovernanceScreen"
```

---

## Task 7: Implement Blocked tab

**Files:**
- Modify: `app/src/screens/GovernanceScreen.tsx`

**Step 1: Add blocked tab content**

Redesign from `BlockedMutedScreen.tsx`:

- **Sub-tabs**: Pill toggles: Blocked (N) | Muted (N)
- **User rows**: Minimal — avatar 36px + @username + era badge inline. Unblock/Unmute as subtle accent text button right-aligned. Clean rows with bottom border separator, no card borders.

Key data: `getBlockedUsers()`, `getMutedUsers()`, `blockUser()`, `muteUser()`

**Step 2: Verify**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/src/screens/GovernanceScreen.tsx
git commit -m "feat: implement Blocked tab in GovernanceScreen"
```

---

## Task 8: Clean up old screen files

**Files:**
- Delete: `app/src/screens/ModerationQueueScreen.tsx`
- Delete: `app/src/screens/NodeCouncilScreen.tsx`
- Delete: `app/src/screens/WebOfTrustScreen.tsx`
- Delete: `app/src/screens/AppealsScreen.tsx`
- Delete: `app/src/screens/MyVouchesScreen.tsx`
- Delete: `app/src/screens/BlockedMutedScreen.tsx`
- Modify: `app/App.tsx` (remove old imports)

**Step 1: Remove old imports from App.tsx**

Remove these import lines:
```tsx
import { ModerationQueueScreen } from './src/screens/ModerationQueueScreen';
import { AppealsScreen } from './src/screens/AppealsScreen';
import { NodeCouncilScreen } from './src/screens/NodeCouncilScreen';
import { MyVouchesScreen } from './src/screens/MyVouchesScreen';
import { WebOfTrustScreen } from './src/screens/WebOfTrustScreen';
import { BlockedMutedScreen } from './src/screens/BlockedMutedScreen';
```

**Step 2: Remove old sidebar props from SidebarProps interface**

Remove from SidebarProps:
- `onModerationClick`
- `onAppealsClick`
- `onCouncilClick`
- `onVouchesClick`
- `onBlockedMutedClick`

Add if not already added:
- `onGovernanceClick?: () => void`

**Step 3: Remove old sidebar callback props from App.tsx**

Remove the 5 individual governance callback props from both desktop and mobile Sidebar instances. Replace with single `onGovernanceClick`.

**Step 4: Delete old screen files**

```bash
rm app/src/screens/ModerationQueueScreen.tsx
rm app/src/screens/NodeCouncilScreen.tsx
rm app/src/screens/WebOfTrustScreen.tsx
rm app/src/screens/AppealsScreen.tsx
rm app/src/screens/MyVouchesScreen.tsx
rm app/src/screens/BlockedMutedScreen.tsx
```

**Step 5: Verify TypeScript passes**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json 2>&1 | head -10`
Expected: 0 errors

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old governance screen files, clean up imports"
```

---

## Task 9: Final verification and visual QA

**Step 1: Full TypeScript check**

Run: `cd /Users/joshhd/Documents/node-social && npx tsc --noEmit --project app/tsconfig.json`
Expected: 0 errors

**Step 2: Verify all navigation paths work**

Check in the running app:
- Sidebar → Governance → lands on Moderation tab
- Each tab switches correctly
- Back button returns to previous view
- Legacy deep links (if someone had `moderation` in URL/state) still work

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final governance screen polish"
```
