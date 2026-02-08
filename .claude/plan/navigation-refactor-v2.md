/evvery# Navigation Refactor v2: Updated Plan

## Executive Summary

The original plan (NAVIGATION_REFACTOR_PLAN.md) was written when App.tsx was ~500 lines with ~8 screens. The app has since grown to **1910 lines** with **20 screens**, anonymous browsing, multi-column desktop layout, external feeds (Bluesky/Mastodon), Socket.io real-time, a theme system, and a full governance suite. This v2 plan reflects the current reality.

---

## 1. Critical Errors in Original Plan

### 1.1 AuthGate Would Break Anonymous Browsing (SHOWSTOPPER)

**Original plan**: AuthGate redirects unauthenticated users to `/(auth)/login`.

**Reality**: The app supports **anonymous browsing**. Unauthenticated users can browse the feed, read posts, and explore nodes. Auth is only required for actions (post, comment, save, message). This is handled by `AuthPromptProvider` + `requireAuth()` hook that shows a modal when needed.

**Fix**: The root layout must NOT redirect to login. Instead, auth screens should be modals that overlay the app, just like the current implementation.

### 1.2 Plan Lists 12 Screens, App Has 20

**Missing from original plan:**

| Screen | Purpose | Route |
|--------|---------|-------|
| NotificationsScreen | Notifications feed | `/notifications` |
| SavedPostsScreen | Bookmarked posts | `/saved` |
| DiscoveryScreen | Trending posts & users | `/discovery` |
| FollowingScreen | Posts from followed users | `/following` |
| MessagesScreen | Conversation list | `/messages` |
| ChatScreen | Single conversation | `/messages/[conversationId]` |
| GovernanceScreen | Moderation, Council, Appeals, Trust, Blocked (5 tabs) | `/governance` |
| SettingsScreen | User settings hub | `/settings` |
| ThemesScreen | Theme marketplace | `/settings/themes` |
| ThemeEditorScreen | Custom theme editor | `/settings/theme-editor` |
| CredHistoryScreen | Cred transaction history | `/cred-history` |
| NodeSettingsScreen | Node admin settings | `/node/[id]/settings` |
| ModLogScreen | Node moderation log | `/node/[id]/mod-log` |

### 1.3 Provider Stack is Deeper Than Planned

**Original plan**: SafeAreaProvider > QueryClientProvider > Slot

**Reality**: View > ErrorBoundary > SafeAreaProvider > PortalProvider > QueryClientProvider > AuthPromptProvider > SocketProvider > MainApp

All of these providers must be preserved in the root layout.

### 1.4 Feed Complexity Underestimated

**Original plan**: Simple `useFeed({ nodeId })` hook.

**Reality**: Feed has multiple sources (node/bluesky/mastodon/mixed), cursor-based pagination, pull-to-refresh, real-time socket updates, debounced algo preference saves, 3 feed modes (global/discovery/following), and external post integration. A single `useFeed` hook won't cut it.

### 1.5 State Is More Complex Than Mapped

**Missing from plan's state map:**

| State | Location | Purpose |
|-------|----------|---------|
| feedSource | useState + storage | Which feed source (node/bluesky/mastodon/mixed) |
| externalPosts | useState | Posts from external platforms |
| editingPost / isEditPostOpen | useState | Edit post modal state |
| quotedExternalPost | useState | Quote an external post |
| showAddColumnModal | useState | Multi-column add modal |
| nodeInfoVisible / nodeInfoNodeId | useState | Node info sheet state |
| sidebarCollapsed | useState | Desktop sidebar collapse |
| navigationHistory | useState | Manual back stack |
| headerTranslateY | Animated.Value | Animated header hide on scroll |
| feedMode | useState | global/discovery/following |
| settingsInitialized | useState | Prevents double-fetch on init |
| refreshing / loadingMore / nextCursor / hasMore | useState | Pagination state |
| isMultiColumnEnabled | Zustand (columnsStore) | Desktop multi-column toggle |
| columns | Zustand (columnsStore) | Column configuration |
| userTheme / nodeThemeOverride | Zustand (themeStore) | Theme state |

---

## 2. Updated Target Architecture

### 2.1 Route Structure

```
app/
  app/                              <-- Expo Router routes directory
    _layout.tsx                     <-- Root: ALL providers, NO auth gate redirect
    +not-found.tsx                  <-- 404 screen

    (main)/                         <-- Main app group (anonymous + authenticated)
      _layout.tsx                   <-- Responsive shell: sidebar (desktop) + bottom tabs (mobile)

      (tabs)/                       <-- Tab-based navigation for bottom nav
        _layout.tsx                 <-- Bottom tab bar (mobile only, hidden on desktop)
        index.tsx                   <-- Feed (home) - the "/" route
        discovery.tsx               <-- Discovery feed
        notifications.tsx           <-- Notifications (auth-gated via requireAuth)
        profile/
          index.tsx                 <-- Own profile (auth-gated)

      post/[id].tsx                 <-- Post detail
      user/[id].tsx                 <-- Other user's profile
      saved.tsx                     <-- Saved posts (auth-gated)
      following.tsx                 <-- Following feed (auth-gated)
      cred-history.tsx              <-- Cred history (auth-gated)

      messages/
        index.tsx                   <-- Conversations list (auth-gated)
        [conversationId].tsx        <-- Chat screen (auth-gated)

      governance/
        index.tsx                   <-- Governance tabs (auth-gated)

      settings/
        index.tsx                   <-- Settings main (auth-gated)
        themes.tsx                  <-- Theme marketplace
        theme-editor.tsx            <-- Custom theme editor

      node/[id]/
        settings.tsx                <-- Node admin settings
        mod-log.tsx                 <-- Node moderation log

  src/
    components/                     <-- KEEP all existing components
    hooks/                          <-- NEW: extracted data hooks
      useFeed.ts                    <-- Feed data + pagination + external sources
      useNodes.ts                   <-- Node list
      useSearch.ts                  <-- Post + user search
      useCreatePost.ts              <-- Post creation mutation
      useCreateComment.ts           <-- Comment creation mutation
      usePost.ts                    <-- Single post + comments
      useFeedPreferences.ts         <-- Feed preferences query + mutation
      useResponsiveLayout.ts        <-- Breakpoint detection
      useNotifications.ts           <-- Notifications query
      useMessages.ts                <-- Conversations + messages
      useSavedPosts.ts              <-- Saved posts query
      useProfile.ts                 <-- User profile + stats
      useGovernance.ts              <-- Governance data (council, appeals, vouches)
      useTheme.ts                   <-- KEEP existing
    lib/
      api.ts                        <-- KEEP (no changes)
      mappers.ts                    <-- NEW: post/comment mapping functions
      storage.ts                    <-- KEEP
      cookies.ts                    <-- KEEP
      appleAuth.ts                  <-- KEEP
    store/
      auth.ts                       <-- KEEP
      theme.ts                      <-- KEEP
      columns.ts                    <-- KEEP
      linkedAccounts.ts             <-- KEEP
    context/
      AuthPromptContext.tsx          <-- KEEP (critical for anonymous browsing)
      SocketContext.tsx              <-- KEEP
    constants/
      theme.ts                      <-- KEEP
    config.ts                       <-- KEEP
```

### 2.2 Key Architectural Decisions

#### Auth: Modal-Based, NOT Route-Based

Auth screens MUST remain as modals overlaying the app. This preserves anonymous browsing. The `AuthPromptProvider` pattern stays.

```
User taps "Save Post" → requireAuth() → shows auth modal → user logs in → modal closes → user is back on the same post
```

If we used route-based auth (`/(auth)/login`), this flow would navigate the user away from the post, breaking the experience.

**For deep links** (reset-password, verify-email): These can be routes since they're standalone flows, or remain as modals triggered by deep link handling in the root layout. The modal approach is simpler and already works.

#### Bottom Tabs: Mobile Only, Hidden on Desktop

Expo Router's `Tabs` navigator renders the bottom tab bar. On desktop, we hide it and show the sidebar instead. The `(tabs)` group handles the 5 main mobile tabs: Feed, Discovery, Create (action, not a tab destination), Notifications, Profile.

#### Desktop Layout: Sidebar + Content + Right Panel

The responsive shell lives in `(main)/_layout.tsx`. It renders:
- Desktop (>=1024): Sidebar (persistent, collapsible) + Slot + Right Panel (WhatsVibing or NodeLandingPage)
- Mobile (<1024): Slot only (sidebar as modal, bottom nav from tabs layout)

#### Multi-Column Mode: Stays in Main Layout

When `isMultiColumnEnabled` is true on desktop, the feed screen renders `MultiColumnContainer` instead of the single-feed `Feed` component. This is a screen-level concern, not a routing concern.

---

## 3. Root Layout: Provider Stack

```typescript
// app/app/_layout.tsx
export default function RootLayout() {
  // Initialize auth, theme hydration, etc.
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <PortalProvider>
            <QueryClientProvider client={queryClient}>
              <StatusBar barStyle="light-content" />
              <AuthPromptProvider
                user={user}
                onLogin={() => /* show login modal */}
                onRegister={() => /* show register modal */}
              >
                <SocketProvider>
                  <Slot />
                </SocketProvider>
              </AuthPromptProvider>

              {/* Auth modals (login, register, forgot-password) */}
              {/* Deep link modals (reset-password, verify-email) */}
              {/* Portal host for radial wheel */}
              <PortalHost name="radialWheel" />
              <ToastContainer />
            </QueryClientProvider>
          </PortalProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}
```

**Key difference from original plan**: No AuthGate redirect. Auth modals live here at the root level, just like the current App.tsx. The `Slot` renders the main app for everyone.

---

## 4. Updated State Management Map

### Stays in Zustand
| Store | State | Why |
|-------|-------|-----|
| useAuthStore | user, token, loading, appleUserId | Persisted auth session |
| useThemeStore | userTheme, nodeThemeOverride, previewTheme | Persisted theme with computed active |
| useColumnsStore | columns, isMultiColumnEnabled | Persisted column layout config |
| useLinkedAccountsStore | linkedAccounts | External platform connections |

### Moves to React Query
| Query Key | Hook | Replaces |
|-----------|------|----------|
| `['feed', { nodeId, feedMode, source, cursor }]` | `useFeed()` | fetchFeed() in MainApp |
| `['externalFeed', { source, cursor }]` | `useExternalFeed()` | external feed fetching in MainApp |
| `['nodes']` | `useNodes()` | fetchNodes() in MainApp |
| `['search', query]` | `useSearch()` | handleSearch() in MainApp |
| `['post', postId]` | `usePost()` | PostDetailScreen inline fetch |
| `['feedPreferences']` | `useFeedPreferences()` | loadFeedPreferences/saveFeedPreferences |
| `['notifications']` | `useNotifications()` | NotificationsScreen inline fetch |
| `['conversations']` | `useConversations()` | MessagesScreen inline fetch |
| `['messages', conversationId]` | `useMessages()` | ChatScreen inline fetch |
| `['savedPosts']` | `useSavedPosts()` | SavedPostsScreen inline fetch |
| `['userProfile', userId]` | `useProfile()` | ProfileScreen inline fetch |
| `['userStats', userId]` | `useUserStats()` | ProfileScreen stats fetch |
| `['vibeVectors']` | `useVibeVectors()` | Various inline fetches |
| `['council', nodeId]` | `useCouncil()` | GovernanceScreen inline fetch |
| `['appeals']` | `useAppeals()` | GovernanceScreen inline fetch |
| `['vouches']` | `useVouches()` | GovernanceScreen inline fetch |
| `['trendingVibes']` | `useTrendingVibes()` | WhatsVibing inline fetch |

### Stays as Local useState
| State | Where | Why |
|-------|-------|-----|
| menuVisible | Main layout | UI interaction only |
| vibeVisible | Main layout | UI interaction only |
| sidebarCollapsed | Main layout | UI interaction only |
| isCreatePostOpen | Feed screen | UI interaction only |
| isEditPostOpen | Feed screen | UI interaction only |
| editingPost | Feed screen | UI interaction only |
| quotedExternalPost | Feed screen | UI interaction only |
| searchQuery | Header/Search component | UI interaction only |
| nodeInfoVisible / nodeInfoNodeId | Main layout | UI interaction only |

### Becomes URL State (Expo Router)
| State | URL | Replaces |
|-------|-----|----------|
| currentView | URL path (`/`, `/post/abc`, `/messages`) | useState('feed') |
| viewParams.postId | `/post/[id]` | viewParams.postId |
| viewParams.userId | `/user/[id]` | viewParams.userId |
| viewParams.conversationId | `/messages/[conversationId]` | viewParams.conversationId |
| selectedNodeId | Query param `?node=abc` or context | useState(nodeId) |
| feedMode | Route (`/`, `/discovery`, `/following`) | useState('global') |
| resetToken | Deep link handling | useState(resetToken) |
| verifyToken | Deep link handling | useState(verifyToken) |
| governance tab | Query param `?tab=moderation` | viewParams.initialTab |

---

## 5. Updated Hooks (More Complex Than Original)

### 5.1 useFeed — Much More Complex

The original plan's useFeed was 35 lines. The real one needs to handle:

```typescript
// app/src/hooks/useFeed.ts
type UseFeedOptions = {
  nodeId?: string | null;
  feedMode?: 'global' | 'discovery' | 'following';
  feedSource?: 'node' | 'bluesky' | 'mastodon' | 'mixed';
  algoSettings?: VibeValidatorSettings;
};

// Returns:
// - useInfiniteQuery for cursor-based pagination
// - Separate external posts query for mixed mode
// - Pull-to-refresh handler
// - Load more handler
// - Optimistic post removal (for moderation)
// - Real-time socket integration for new posts
```

This is a ~100+ line hook, not 35.

### 5.2 useNodes — Similar to Planned

The plan's useNodes is close to correct. Minor update: nodes now have `avatar` and `color` from the API, so the random color assignment is removed.

### 5.3 useFeedPreferences — Already Connected

The plan said `algoSettings` was dead state never sent to API. This was fixed — it's now fully connected via `loadFeedPreferences()` and `saveFeedPreferences()`. The hook needs to handle:
- Load preferences on mount
- Debounced save on change
- Preset mapping (frontend IDs ↔ backend IDs)
- All 4 modes: simple, intermediate, advanced, expert

### 5.4 New Hooks Not in Original Plan

| Hook | Purpose | Complexity |
|------|---------|------------|
| `useNotifications()` | Fetch + mark-read notifications | Medium |
| `useConversations()` | List conversations with real-time | Medium |
| `useMessages(conversationId)` | Messages for a conversation with socket | High |
| `useSavedPosts()` | Saved posts query + toggle mutation | Low |
| `useProfile(userId)` | User profile + stats + posts + comments | Medium |
| `useGovernance(nodeId)` | Council + appeals + vouches + mod queue | High |
| `useVouches()` | Vouch given/received + stats | Medium |
| `useTrendingVibes()` | Trending vibes + nodes for WhatsVibing | Low |
| `useExternalFeed(config)` | Bluesky/Mastodon feed fetching | Medium |
| `useNodeDetails(nodeId)` | Node details for landing page + themes | Medium |

---

## 6. Migration Strategy (Updated)

### Phase 0: Preparation (No Behavior Changes)

**Step 0.1**: Create hooks directory and implement ALL hooks listed above. Wire them to the existing `lib/api.ts` functions. Test by importing alongside existing inline fetches and verifying data matches.

**Step 0.2**: Create `lib/mappers.ts` with the `mapPost()` function currently inline in App.tsx (lines 614-653). Also extract `mapApiCommentToUIComment`.

**Step 0.3**: Verify hooks work by temporarily using them in existing screens.

**Test**: App builds and runs identically. No behavior changes.

### Phase 1: Install Expo Router + Minimal Scaffolding

**Step 1.1**: Install expo-router:
```bash
cd app
npx expo install expo-router expo-constants
```

**Step 1.2**: Update config files:
- `package.json`: Change `"main"` to `"expo-router/entry"`
- `app.json`: Add `"expo-router"` to plugins, add `"bundler": "metro"` to web
- `babel.config.js`: Add `"expo-router/babel"` plugin
- `tsconfig.json`: Add `baseUrl`, `paths` for `@/` alias

**Step 1.3**: Create route directory structure with shell files that wrap existing screens.

**Step 1.4**: Create root `_layout.tsx` with the full provider stack (NO auth gate redirect).

**Step 1.5**: Create `(main)/_layout.tsx` as a passthrough that renders `<Slot />`. We'll add the responsive shell later.

**Step 1.6**: Create minimal `(tabs)/_layout.tsx` with the 4 tab routes + 1 action tab.

**Step 1.7**: Create `(tabs)/index.tsx` that wraps the current MainApp's feed view.

**Test**: App boots into feed via Expo Router. URLs work. Back button works on web.

### Phase 2: Migrate Auth to Modals at Root Level

**Step 2.1**: Move auth modal logic from current `App()` component to `_layout.tsx`.

**Step 2.2**: Move deep link handling (`Linking.parse` for reset-password and verify-email) to root layout. Expo Router handles deep links automatically for route-based screens, but since auth stays modal-based, we keep explicit handling.

**Step 2.3**: Wire `AuthPromptProvider` callbacks to show auth modals.

**Test**: Anonymous browsing works. Auth prompts show modals. Deep links for reset/verify work.

### Phase 3: Migrate Tab Screens

**Step 3.1**: Feed screen (`(tabs)/index.tsx`) — use `useFeed` hook + existing `Feed` component.
**Step 3.2**: Discovery screen (`(tabs)/discovery.tsx`) — wrap DiscoveryScreen.
**Step 3.3**: Notifications screen (`(tabs)/notifications.tsx`) — wrap NotificationsScreen with `requireAuth`.
**Step 3.4**: Profile screen (`(tabs)/profile/index.tsx`) — wrap ProfileScreen for own profile.

**Test**: Bottom tab navigation works on mobile. Feed loads. Notifications require auth.

### Phase 4: Migrate Stack Screens

**Step 4.1**: Post detail (`post/[id].tsx`) — use `useLocalSearchParams` + `usePost` hook.
**Step 4.2**: User profile (`user/[id].tsx`) — ProfileScreen with userId from URL.
**Step 4.3**: Messages (`messages/index.tsx`, `messages/[conversationId].tsx`).
**Step 4.4**: Governance (`governance/index.tsx`) with tab query param.
**Step 4.5**: Settings (`settings/index.tsx`, `settings/themes.tsx`, `settings/theme-editor.tsx`).
**Step 4.6**: Saved posts, following, cred-history.
**Step 4.7**: Node settings and mod log (`node/[id]/settings.tsx`, `node/[id]/mod-log.tsx`).

**Test**: All navigation works. Deep links to post detail (`/post/abc123`) work. Browser back button works.

### Phase 5: Build the Responsive Shell

**Step 5.1**: Implement `(main)/_layout.tsx` with the responsive shell:
- Desktop: Sidebar (collapsible) + Slot + Right Panel (WhatsVibing / NodeLandingPage)
- Mobile: Just Slot (sidebar is modal, bottom nav from tabs layout)

**Step 5.2**: Move mobile-specific components (animated header, node header) into the shell layout.

**Step 5.3**: Wire multi-column mode for desktop.

**Test**: Full responsive behavior works. Desktop shows sidebar + 3-column layout. Mobile shows bottom nav + modal sidebar.

### Phase 6: Cleanup

**Step 6.1**: Delete `App.tsx` (replaced by route layouts).
**Step 6.2**: Delete `index.ts` (replaced by expo-router/entry).
**Step 6.3**: Delete `src/screens/` directory (replaced by route files in `app/app/`).
**Step 6.4**: Run `npx tsc --noEmit` and fix any type errors.
**Step 6.5**: Clean up unused imports.

**Test**: Full regression test per checklist below.

---

## 7. What Would Impress at Interviews

### 7.1 Architecture Talking Points

1. **"We migrated from a 1900-line useState state machine to file-based routing"** — Shows you understand when custom solutions outgrow their usefulness and how to migrate incrementally.

2. **"Anonymous browsing with modal-based auth"** — Most apps force login. Explain why modal auth is architecturally better for engagement (users can browse before committing) and how `AuthPromptProvider` + `requireAuth()` is a clean pattern for this.

3. **"Server state vs client state separation"** — Explain why `useAuthStore` (Zustand) for auth, React Query for server data, and URL for navigation state is the correct taxonomy. Draw the diagram.

4. **"Multi-column TweetDeck-style desktop layout with persisted column configuration"** — Show the `useColumnsStore` and how each column independently fetches its own data. This is a non-trivial UI pattern.

5. **"Real-time Socket.io integration that respects feed filters"** — The socket handler checks `feedModeRef.current` and `selectedNodeIdRef.current` before adding posts. Explain why refs are needed to avoid stale closures.

6. **"Federated feed aggregation"** — Pulling from Node Social + Bluesky + Mastodon into a unified feed. Explain the interleaving strategy and how cursor-based pagination works across sources.

7. **"Theme system with layered overrides"** — User theme → node theme override → preview → computed active. Explain the merge chain and persistence strategy.

### 7.2 Code Quality Signals

- **Debounced preference saves** with ref-based latest-value access (avoid stale closures)
- **Optimistic updates** for post actions (delete, save toggle)
- **Cursor-based pagination** with deduplication on append
- **Memoized callbacks** with `useCallback` to prevent unnecessary re-renders
- **Context value memoization** with `useMemo` in providers
- **ErrorBoundary** at root level with recovery button

### 7.3 What's Still Missing (Potential Improvements to Discuss)

1. **Error boundaries per route** — Currently one global boundary. Per-route boundaries would isolate crashes.
2. **Suspense boundaries** — For loading states instead of manual `if (isLoading)` checks.
3. **React Query infinite queries** — For feed pagination instead of manual cursor management.
4. **Optimistic UI for posting** — Show the post immediately in the feed before server confirms.
5. **Prefetching** — Prefetch post detail data when hovering on web, or when post card enters viewport.
6. **URL-based node selection** — `/?node=abc123` instead of useState.
7. **Animated route transitions** — Shared element transitions between feed and post detail.
8. **Offline support** — React Query's persistence layer + service worker for web.

---

## 8. Updated Testing Checklist

### Anonymous Browsing (NEW — not in original plan)
- [ ] Cold launch with no stored token → shows feed (NOT login)
- [ ] Tap "Save Post" while anonymous → shows auth prompt modal
- [ ] Login via auth prompt → returns to same screen, action completes
- [ ] Register via auth prompt → returns to same screen
- [ ] Close auth prompt → stays on current screen, action cancelled
- [ ] Navigate to /notifications while anonymous → shows auth prompt

### Auth Flow
- [ ] Login with email/password → auth modal closes, feed stays
- [ ] Login with Google OAuth → auth modal closes
- [ ] Login with Apple Sign-In (iOS) → auth modal closes
- [ ] Register → verify email screen (if email verification required)
- [ ] Forgot password → sends email, shows success
- [ ] Reset password via deep link → shows reset form
- [ ] Verify email via deep link → verifies, closes modal
- [ ] Logout → clears auth, shows feed (anonymous)

### Feed
- [ ] Feed loads on app launch (anonymous or authenticated)
- [ ] Pull to refresh works
- [ ] Infinite scroll (load more) works with cursor
- [ ] Node filter changes feed content
- [ ] Feed mode switching (global/discovery/following)
- [ ] Feed source switching (node/bluesky/mastodon/mixed)
- [ ] Search finds posts and users
- [ ] Real-time new posts appear via socket
- [ ] Creating a post refreshes feed
- [ ] Algo settings debounce-save and affect feed

### Navigation
- [ ] Tap post → navigates to /post/[id]
- [ ] Browser back → returns to feed
- [ ] Deep link /post/abc123 → shows post detail
- [ ] Tap user avatar → navigates to /user/[id]
- [ ] Messages → conversation list → chat
- [ ] Governance with tab switching
- [ ] Settings → themes → theme editor
- [ ] Node settings and mod log (require nodeId)

### Desktop Layout
- [ ] Sidebar visible and collapsible
- [ ] Multi-column mode toggle works
- [ ] Right panel shows WhatsVibing / NodeLandingPage
- [ ] Column add/remove/reorder
- [ ] Node info sheet overlay

### Mobile Layout
- [ ] Bottom nav with 5 tabs (Feed, Discovery, Create, Notifications, Profile)
- [ ] Animated header hides on scroll down, shows on scroll up
- [ ] Sidebar as modal drawer (left swipe or hamburger)
- [ ] Vibe validator as bottom sheet (90% height)
- [ ] Node header shows when viewing specific node

### Web-Specific
- [ ] URLs update in browser address bar
- [ ] Browser back/forward navigation works
- [ ] Direct URL paste works (/post/abc123)
- [ ] Page refresh preserves auth state
- [ ] OAuth redirect works on web

### Performance
- [ ] Nodes fetched once, cached via React Query
- [ ] Feed data cached (navigate away and back doesn't re-fetch within staleTime)
- [ ] Post creation invalidates feed cache
- [ ] No flash of wrong screen on startup
- [ ] Skeleton loading states shown during initial fetch
- [ ] FlatList optimizations (keyExtractor, windowSize, etc.)

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Expo Router + existing Expo SDK compatibility | High | Check expo-router version compatibility with Expo SDK 54 before starting. Run `npx expo install expo-router` to get compatible version. |
| Breaking anonymous browsing | Critical | Test anonymous flows at EVERY phase. AuthPromptProvider must survive the migration. |
| Multi-column mode regression | High | Test multi-column mode separately after Phase 5. Column config is persisted in storage. |
| Socket.io integration | Medium | Socket provider stays at root level. Real-time events should continue working since they're provider-based, not navigation-based. |
| Theme system | Medium | Theme store is Zustand-based and independent of navigation. Should survive migration unchanged. |
| Deep link handling | Medium | Test deep links explicitly at Phase 2. Expo Router handles file-based deep links automatically, but modal-based auth deep links need explicit handling. |
| Build size increase | Low | Expo Router adds ~50KB. Code splitting should offset this by lazy-loading screens. |
| Double `app/app/` directory confusion | Low | Document clearly. This is standard for Expo Router projects where the project directory is named `app`. |

---

## 10. Estimated Scope

| Phase | Files Created | Files Modified | Files Deleted | Effort |
|-------|--------------|----------------|---------------|--------|
| Phase 0: Hooks + Mappers | ~15 | 0 | 0 | Medium |
| Phase 1: Expo Router Setup | ~5 shell routes | 4 config files | 0 | Low |
| Phase 2: Auth Modals | 1 | 1 | 0 | Low |
| Phase 3: Tab Screens | 4 route files | 0 | 0 | Medium |
| Phase 4: Stack Screens | ~15 route files | 0 | 0 | High |
| Phase 5: Responsive Shell | 2 layout files | 0 | 0 | High |
| Phase 6: Cleanup | 0 | 0 | ~22 | Low |
| **Total** | **~42 new files** | **~5 modified** | **~22 deleted** | **~2-3 weeks** |

---

## SESSION_ID
- CODEX_SESSION: N/A (pure analysis session)
- GEMINI_SESSION: N/A (pure analysis session)
