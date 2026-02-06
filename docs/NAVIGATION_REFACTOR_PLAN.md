# Navigation Refactor Plan: useState Spaghetti to Expo Router

## Table of Contents

1. [Why This Refactor](#1-why-this-refactor)
2. [Target Architecture](#2-target-architecture)
3. [Navigation Setup (Expo Router)](#3-navigation-setup-expo-router)
4. [Route Groups](#4-route-groups)
5. [Screen Breakdown](#5-screen-breakdown)
6. [Custom Hooks](#6-custom-hooks)
7. [Shared Layout (Responsive 3-Column)](#7-shared-layout-responsive-3-column)
8. [State Management](#8-state-management)
9. [Migration Steps](#9-migration-steps)
10. [File-by-File Guide](#10-file-by-file-guide)
11. [Testing Checklist](#11-testing-checklist)

---

## 1. Why This Refactor

### Current Problems

The current `App.tsx` (502 lines) is doing the job of at least 8 different files:

| Responsibility | Current Location | Problem |
|---|---|---|
| Auth routing | `useState<'login' \| 'register' \| ...>` in `App()` | No URL support, no back button, no deep links for auth |
| Main app routing | `useState<'feed' \| 'profile'>` in `MainApp` | Cannot link to a profile or post |
| Data fetching (feed) | `fetchFeed()` inline in `MainApp` | Re-fetches on every mount, no caching, no deduplication |
| Data fetching (nodes) | `fetchNodes()` inline in `MainApp` | Same data fetched in 4 different places across the app |
| Data fetching (search) | `handleSearch()` inline in `MainApp` | Duplicates the entire post-mapping logic from `fetchFeed` |
| Responsive layout | `useWindowDimensions` + inline conditionals in `MainApp` | Layout logic mixed with business logic |
| Modal state | `menuVisible`, `vibeVisible`, `isCreatePostOpen` in `MainApp` | 3 separate modal states managed at root level |
| Algo settings | `algoSettings` useState in `MainApp` | Never sent to API -- dead state |

### What the Refactor Fixes

- **URL-based navigation**: Every screen gets a real URL. Deep links work. The back button works on web.
- **Automatic code splitting**: Expo Router lazy-loads screens. The login screen does not load feed code.
- **Separation of concerns**: Each file does one thing. You can find what you need.
- **Caching via React Query**: Data is fetched once, cached, and shared across components. No more `fetchNodes()` in 4 places.
- **Type-safe routes**: TypeScript knows what routes exist and what params they take.

---

## 2. Target Architecture

### Final File Structure

```
app/                              <-- This is your existing /home/user/Node-Social/app/ directory
  app/                            <-- NEW: Expo Router file-based routes directory
    _layout.tsx                   <-- Root layout: providers (QueryClient, SafeArea, auth check)
    +not-found.tsx                <-- 404 screen
    (auth)/                       <-- Auth route group (unauthenticated users)
      _layout.tsx                 <-- Auth layout: centers content, dark background
      login.tsx                   <-- /login
      register.tsx                <-- /register
      forgot-password.tsx         <-- /forgot-password
      reset-password.tsx          <-- /reset-password?token=xxx
      verify-email.tsx            <-- /verify-email?token=xxx
      enter-reset-token.tsx       <-- /enter-reset-token
    (app)/                        <-- App route group (authenticated users)
      _layout.tsx                 <-- App layout: 3-column responsive shell
      index.tsx                   <-- / (feed - the home screen)
      post/
        [id].tsx                  <-- /post/abc123 (post detail)
      create-post.tsx             <-- /create-post
      profile.tsx                 <-- /profile (own profile)
      settings/
        feed-preferences.tsx      <-- /settings/feed-preferences
  src/
    components/
      ui/
        Sidebar.tsx               <-- KEEP (minor prop changes)
        Feed.tsx                  <-- KEEP (minor prop changes)
        VibeValidator.tsx         <-- KEEP (connect to React Query)
        CreatePostModal.tsx       <-- KEEP (connect to React Query)
        Icons.tsx                 <-- KEEP (no changes)
        RadialMenu.tsx            <-- KEEP (no changes)
        Header.tsx                <-- NEW: extracted from MainApp
      PostCard.tsx                <-- KEEP (no changes)
      LinkPreviewCard.tsx         <-- KEEP (no changes)
    hooks/
      useFeed.ts                  <-- NEW: feed data fetching
      useNodes.ts                 <-- NEW: node list fetching
      useSearch.ts                <-- NEW: search posts
      useCreatePost.ts            <-- NEW: post creation mutation
      useCreateComment.ts         <-- NEW: comment creation mutation
      usePost.ts                  <-- NEW: single post + comments fetching
      useFeedPreferences.ts       <-- NEW: feed preferences query + mutation
      useResponsiveLayout.ts      <-- NEW: extracted from MainApp
    lib/
      api.ts                      <-- KEEP (no changes needed)
      storage.ts                  <-- KEEP
      cookies.ts                  <-- KEEP
      appleAuth.ts                <-- KEEP
      logging.ts                  <-- KEEP
      mappers.ts                  <-- NEW: post/comment data mapping functions
    store/
      auth.ts                     <-- KEEP (minor additions)
    constants/
      theme.ts                    <-- KEEP
    config.ts                     <-- KEEP
    types/
      index.ts                    <-- NEW: shared TypeScript types
  index.ts                        <-- MODIFY: change entry point for Expo Router
  app.json                        <-- MODIFY: add Expo Router config
  package.json                    <-- MODIFY: add expo-router dependency
  tsconfig.json                   <-- MODIFY: add path aliases
  babel.config.js                 <-- MODIFY: add expo-router plugin
  App.tsx                         <-- DELETE (after migration complete)
```

### What Gets Deleted

- `app/App.tsx` -- replaced entirely by the `app/app/` directory and layout files
- `app/src/screens/FeedScreen.tsx` -- replaced by `app/app/(app)/index.tsx` + `useFeed` hook
- `app/src/screens/CreatePostScreen.tsx` -- replaced by `app/app/(app)/create-post.tsx` + `useCreatePost` hook
- `app/src/screens/PostDetailScreen.tsx` -- replaced by `app/app/(app)/post/[id].tsx` + `usePost` hook
- `app/src/screens/ProfileScreen.tsx` -- replaced by `app/app/(app)/profile.tsx`
- `app/src/screens/LoginScreen.tsx` -- replaced by `app/app/(auth)/login.tsx`
- `app/src/screens/RegisterScreen.tsx` -- replaced by `app/app/(auth)/register.tsx`
- `app/src/screens/ForgotPasswordScreen.tsx` -- replaced by `app/app/(auth)/forgot-password.tsx`
- `app/src/screens/ResetPasswordScreen.tsx` -- replaced by `app/app/(auth)/reset-password.tsx`
- `app/src/screens/VerifyEmailScreen.tsx` -- replaced by `app/app/(auth)/verify-email.tsx`
- `app/src/screens/EnterResetTokenScreen.tsx` -- replaced by `app/app/(auth)/enter-reset-token.tsx`
- `app/src/screens/FeedPreferencesScreen.tsx` -- replaced by `app/app/(app)/settings/feed-preferences.tsx`

The `src/screens/` directory will be empty and can be deleted after migration.

---

## 3. Navigation Setup (Expo Router)

### Why Expo Router (Not React Navigation Directly)

You are on Expo 54. Expo Router is the official routing solution for Expo apps. It is built on top of React Navigation but gives you:

- **File-based routing**: Create a file, get a route. No manual route registration.
- **Web URLs for free**: Each file maps to a URL path. `/post/abc123` just works.
- **Deep linking built in**: No manual Linking.parse() needed.
- **Typed routes**: Import `router` and TypeScript knows your routes.

### Step-by-step Installation

#### 3.1 Install Dependencies

```bash
cd /home/user/Node-Social/app
npx expo install expo-router expo-constants expo-linking expo-status-bar
```

You already have `expo-linking` and `expo-status-bar`, so this will just add `expo-router` and ensure compatible versions.

#### 3.2 Update `app.json`

Add the `scheme` (already present) and set the entry point to `expo-router`:

```jsonc
{
  "expo": {
    "name": "Node Social",
    "slug": "Node Social",
    "version": "1.1.1",
    "scheme": "nodesocial",
    // ... keep all existing config ...
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"           // ADD THIS LINE
    },
    "plugins": [
      "expo-secure-store",
      "expo-apple-authentication",
      "expo-router"                // ADD THIS LINE
    ]
  }
}
```

#### 3.3 Update `package.json`

Change the `main` field to point to `expo-router/entry`:

```jsonc
{
  "main": "expo-router/entry",   // CHANGE FROM "index.ts"
  // ... rest stays the same
}
```

#### 3.4 Update `index.ts`

You can keep the file but it will no longer be the entry point. Expo Router uses its own entry point that scans the `app/` directory for routes.

Alternatively, delete `index.ts` since it is no longer used.

#### 3.5 Update `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router requires this plugin
      'expo-router/babel',
    ],
  };
};
```

**Important**: After changing babel config, clear the Metro cache:

```bash
npx expo start --clear
```

#### 3.6 Update `tsconfig.json`

```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

The `paths` alias lets you write `import { useFeed } from '@/hooks/useFeed'` instead of `import { useFeed } from '../../src/hooks/useFeed'`.

---

## 4. Route Groups

Expo Router uses parenthesized directory names for **route groups**. A route group:
- Creates a shared layout (via `_layout.tsx`)
- Does NOT add a URL segment (so `(auth)/login.tsx` maps to `/login`, not `/auth/login`)

### Auth vs App Split

```
app/
  _layout.tsx        <-- Root: decides if user sees (auth) or (app)
  (auth)/
    _layout.tsx      <-- Auth layout: dark bg, centered card
    login.tsx
    register.tsx
    ...
  (app)/
    _layout.tsx      <-- App layout: 3-column shell, header, sidebar
    index.tsx
    post/[id].tsx
    ...
```

### Root Layout: The Auth Gate

The root `_layout.tsx` is where the "are you logged in?" decision happens. This replaces the `!user ? <AuthFlow /> : <MainApp />` conditional in the current `App.tsx`.

```typescript
// app/app/_layout.tsx
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      retry: 2,
    },
  },
});

function AuthGate() {
  const { user, loading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Still loading from storage, do nothing

    // Check which route group the user is currently in
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // User is not signed in but is trying to access app routes
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // User is signed in but is on an auth screen
      // Redirect to home feed
      router.replace('/(app)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.node.bg }}>
        <ActivityIndicator size="large" color={COLORS.node.accent} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const { loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

**Key concept**: `<Slot />` is Expo Router's way of saying "render whatever child route matches." It is like React Router's `<Outlet />`. The root layout wraps everything in providers and handles the auth redirect.

### Auth Layout

```typescript
// app/app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.node.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
```

This tells Expo Router: "All screens inside `(auth)/` are a stack navigator with no header and a dark background." The `<Stack />` component automatically handles forward/back animations.

### App Layout (The 3-Column Shell)

```typescript
// app/app/(app)/_layout.tsx
import { useState } from 'react';
import { View, Modal, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useNodes } from '@/hooks/useNodes';
import { useFeedPreferences } from '@/hooks/useFeedPreferences';
import { useAuthStore } from '@/store/auth';
import { Header } from '@/components/ui/Header';
import { Sidebar } from '@/components/ui/Sidebar';
import { VibeValidator } from '@/components/ui/VibeValidator';
import { COLORS } from '@/constants/theme';
import { X } from '@/components/ui/Icons';

export default function AppLayout() {
  const { isTablet, isDesktop } = useResponsiveLayout();
  const { user } = useAuthStore();
  const { data: nodes = [] } = useNodes();
  const { preferences, updatePreferences } = useFeedPreferences();

  // Mobile drawer state
  const [menuVisible, setMenuVisible] = useState(false);
  const [vibeVisible, setVibeVisible] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.node.bg }}>
      {/* Header */}
      <Header
        isTablet={isTablet}
        isDesktop={isDesktop}
        rightPanelOpen={rightPanelOpen}
        onToggleMenu={() => setMenuVisible(true)}
        onToggleVibePanel={() =>
          isDesktop ? setRightPanelOpen(!rightPanelOpen) : setVibeVisible(true)
        }
      />

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left: Sidebar (visible on tablet+) */}
        {isTablet && (
          <View style={{ width: 280 }}>
            <Sidebar nodes={nodes} isDesktop user={user} />
          </View>
        )}

        {/* Center: Active screen content */}
        <View style={{ flex: 1, borderLeftWidth: isTablet ? 1 : 0, borderLeftColor: COLORS.node.border }}>
          <Slot />
        </View>

        {/* Right: Vibe Validator (visible on desktop) */}
        {isDesktop && rightPanelOpen && (
          <View style={{ width: 320 }}>
            <VibeValidator
              preferences={preferences}
              onUpdate={updatePreferences}
            />
          </View>
        )}
      </View>

      {/* Mobile: Sidebar drawer */}
      {!isTablet && (
        <Modal visible={menuVisible} animationType="fade" transparent>
          {/* ... same drawer pattern as current App.tsx ... */}
        </Modal>
      )}

      {/* Mobile/Tablet: Vibe Validator drawer */}
      {!isDesktop && (
        <Modal visible={vibeVisible} animationType="fade" transparent>
          {/* ... same drawer pattern as current App.tsx ... */}
        </Modal>
      )}
    </View>
  );
}
```

**Key concept**: `<Slot />` in the app layout renders the matched child route (feed, profile, post detail, etc.) inside the 3-column shell. The sidebar and vibe validator stay persistent as the user navigates between screens.

---

## 5. Screen Breakdown

### What Each Screen File Should Contain

A screen file in Expo Router should be **thin**. It should:
1. Call custom hooks for data
2. Handle route params
3. Render UI components
4. Handle navigation events (back, submit -> navigate)

A screen file should **NOT** contain:
- API calls (use hooks)
- Complex data transformations (use mappers)
- Layout shell (handled by `_layout.tsx`)
- Auth checks (handled by root layout)
- Provider wrappers (handled by root layout)

### Screen: Feed (Home)

```typescript
// app/app/(app)/index.tsx
import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feed } from '@/components/ui/Feed';
import { CreatePostModal } from '@/components/ui/CreatePostModal';
import { useFeed } from '@/hooks/useFeed';
import { useNodes } from '@/hooks/useNodes';
import { COLORS } from '@/constants/theme';
import { TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';

export default function FeedScreen() {
  const router = useRouter();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: feedData, isLoading } = useFeed({ nodeId: selectedNodeId });
  const { data: nodes = [] } = useNodes();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.node.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Feed
        posts={feedData?.posts ?? []}
        onPostPress={(postId) => router.push(`/post/${postId}`)}
      />

      {/* FAB */}
      <TouchableOpacity
        style={fabStyle}
        onPress={() => setIsCreatePostOpen(true)}
      >
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      <CreatePostModal
        visible={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onSuccess={() => setIsCreatePostOpen(false)}
        nodes={nodes}
        initialNodeId={selectedNodeId}
      />
    </View>
  );
}
```

**Key change**: Instead of `onPostPress` calling `setCurrentView('postDetail')` and passing an ID through state, it calls `router.push('/post/abc123')`. The post detail screen reads the ID from the URL.

### Screen: Post Detail

```typescript
// app/app/(app)/post/[id].tsx
import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePost } from '@/hooks/usePost';
import { useCreateComment } from '@/hooks/useCreateComment';
import { COLORS } from '@/constants/theme';
// ... UI components

export default function PostDetailScreen() {
  // [id] in the filename means this param comes from the URL
  // /post/abc123 -> params.id === 'abc123'
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: post, isLoading, error } = usePost(id);
  const createComment = useCreateComment(id);

  if (isLoading) {
    return <ActivityIndicator size="large" color={COLORS.node.accent} />;
  }

  if (error || !post) {
    return <Text>Failed to load post.</Text>;
  }

  return (
    // ... your post detail UI
    // Back button: router.back()
    // Send comment: createComment.mutate({ content: text })
  );
}
```

**Key concept**: `useLocalSearchParams` pulls the `id` from the URL. No more passing `postId` as a prop. This means `/post/abc123` can be shared as a link and it will open directly to that post.

### Screen: Profile

```typescript
// app/app/(app)/profile.tsx
import { View, ScrollView, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useMutation } from '@tanstack/react-query';
import { updateProfile } from '@/lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // No more onBack prop -- use router.back()
  // No more onProfileClick callback chains

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      // Update local auth store with new profile data
    },
  });

  return (
    // ... profile UI
    // Back: <TouchableOpacity onPress={() => router.back()}>
  );
}
```

### Screen: Login

```typescript
// app/app/(auth)/login.tsx
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
// ... existing LoginScreen logic

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onSuccessLogin = () => {
    // AuthGate in root layout will automatically redirect to (app)
    // No manual navigation needed -- just setting auth state triggers redirect
  };

  const goToRegister = () => router.push('/(auth)/register');
  const goToForgotPassword = () => router.push('/(auth)/forgot-password');

  return (
    // ... existing LoginScreen JSX
    // Replace callback props with router.push() calls
  );
}
```

**Key insight for auth screens**: You do NOT need to manually navigate to `/(app)` after login. The `AuthGate` component in the root layout watches `useAuthStore().user`. When `setAuth` sets the user, the gate automatically redirects to the app. This is the same pattern as your current `!user ? <AuthFlow /> : <MainApp />`, but it works with URLs.

### Screen: Reset Password (with URL params)

```typescript
// app/app/(auth)/reset-password.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
// ... existing ResetPasswordScreen logic

export default function ResetPasswordScreen() {
  // URL: /reset-password?token=abc123
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const onSuccess = () => router.replace('/(auth)/login');

  // The token comes from the URL instead of being passed via setState
  // Deep links like nodesocial://reset-password?token=abc will just work

  return (
    // ... existing reset password UI, using `token` from params
  );
}
```

**Key win**: Deep links now work automatically. When a user taps a reset-password link in their email, Expo Router parses the URL and navigates to this screen with the token. No more manual `Linking.parse()` and `setCurrentScreen()`.

---

## 6. Custom Hooks

These hooks replace the inline `fetchFeed()`, `fetchNodes()`, `handleSearch()` functions scattered throughout `App.tsx` and screen components. They use TanStack React Query, which you already have installed.

### 6.1 `useFeed` -- Feed Data

```typescript
// app/src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeed } from '@/lib/api';
import { mapApiPostToUIPost } from '@/lib/mappers';

type UseFeedOptions = {
  nodeId?: string | null;
  cursor?: string;
  limit?: number;
};

export function useFeed(options: UseFeedOptions = {}) {
  const { nodeId, cursor, limit = 20 } = options;

  return useQuery({
    // queryKey is the cache key. When nodeId changes, it re-fetches.
    // React Query handles this automatically -- no useEffect needed.
    queryKey: ['feed', { nodeId, cursor }],
    queryFn: async () => {
      const data = await getFeed({
        nodeId: nodeId || undefined,
        cursor,
        limit,
      });

      return {
        ...data,
        posts: data.posts.map(mapApiPostToUIPost),
      };
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
  });
}

// Hook to refresh the feed from anywhere in the app
export function useRefreshFeed() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['feed'] });
}
```

**What this replaces**: The entire `fetchFeed()` function (lines 67-106 of current App.tsx), the `useEffect([], [])` call, and the `loading`/`posts` state variables.

### 6.2 `useNodes` -- Node List

```typescript
// app/src/hooks/useNodes.ts
import { useQuery } from '@tanstack/react-query';
import { getNodes } from '@/lib/api';
import { SCOPE_COLORS } from '@/constants/theme';

export type UINode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  vibeVelocity: number;
  color: string;
};

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: async () => {
      const data = await getNodes();
      // Map API nodes to UI nodes (same mapping from current App.tsx line 53-59)
      return data.map((n, index): UINode => ({
        ...n,
        type: 'child',
        vibeVelocity: Math.floor(Math.random() * 100),
        color: SCOPE_COLORS[index % SCOPE_COLORS.length],
      }));
    },
    staleTime: 1000 * 60 * 10, // Nodes don't change often -- cache for 10 minutes
  });
}
```

**What this replaces**: `fetchNodes()` in App.tsx (lines 49-63), plus the identical `loadNodes()` in FeedScreen.tsx (lines 33-39), and `loadNodes` in CreatePostScreen.tsx (lines 33-44). Three separate implementations become one hook.

### 6.3 `useSearch` -- Search Posts

```typescript
// app/src/hooks/useSearch.ts
import { useQuery } from '@tanstack/react-query';
import { searchPosts } from '@/lib/api';
import { mapApiPostToUIPost } from '@/lib/mappers';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const data = await searchPosts(query);
      return {
        ...data,
        posts: data.posts.map(mapApiPostToUIPost),
      };
    },
    // Only run this query when there is actually a search query
    enabled: query.trim().length > 0,
    staleTime: 1000 * 60 * 1, // Search results stale after 1 minute
  });
}
```

**What this replaces**: `handleSearch()` in App.tsx (lines 116-158), which is a near-exact copy of `fetchFeed()` with the same post-mapping logic duplicated.

### 6.4 `useCreatePost` -- Post Creation

```typescript
// app/src/hooks/useCreatePost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '@/lib/api';

type CreatePostInput = {
  content: string;
  nodeId?: string;
  linkUrl?: string;
};

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => createPost(input),
    onSuccess: () => {
      // Invalidate the feed cache so it re-fetches with the new post
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
```

**What this replaces**: The `handleSubmit` function in CreatePostModal.tsx and CreatePostScreen.tsx, plus the manual `queryClient.invalidateQueries` + `fetchFeed()` double-call in App.tsx line 319-322.

### 6.5 `usePost` -- Single Post + Comments

```typescript
// app/src/hooks/usePost.ts
import { useQuery } from '@tanstack/react-query';
import { getPost, getComments } from '@/lib/api';

export function usePost(postId: string) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const [post, comments] = await Promise.all([
        getPost(postId),
        getComments(postId),
      ]);
      return { post, comments };
    },
    enabled: !!postId,
  });
}
```

### 6.6 `useCreateComment` -- Comment Creation

```typescript
// app/src/hooks/useCreateComment.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment } from '@/lib/api';

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { content: string; parentId?: string }) =>
      createComment(postId, input),
    onSuccess: () => {
      // Re-fetch post data (which includes comments)
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      // Also update the feed's comment counts
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
```

### 6.7 `useFeedPreferences` -- Feed Preferences

```typescript
// app/src/hooks/useFeedPreferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeedPreferences,
  updateFeedPreferences,
  type FeedPreferenceUpdate,
} from '@/lib/api';

export function useFeedPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['feedPreferences'],
    queryFn: getFeedPreferences,
    staleTime: 1000 * 60 * 30, // Preferences rarely change -- cache 30 min
  });

  const mutation = useMutation({
    mutationFn: (update: FeedPreferenceUpdate) => updateFeedPreferences(update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] }); // Re-fetch feed with new weights
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    updatePreferences: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
```

**What this replaces**: The dead `algoSettings` state in App.tsx (line 38-41) that was never sent to the API. This hook actually connects the VibeValidator sliders to the real backend feed preferences.

### 6.8 `useResponsiveLayout` -- Breakpoint Detection

```typescript
// app/src/hooks/useResponsiveLayout.ts
import { useWindowDimensions } from 'react-native';

export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const breakpoint: LayoutBreakpoint = isDesktop
    ? 'desktop'
    : isTablet
    ? 'tablet'
    : 'mobile';

  return {
    width,
    height,
    isTablet,
    isDesktop,
    breakpoint,
  };
}
```

### 6.9 Shared Mapper Functions

The current App.tsx duplicates post-mapping logic in both `fetchFeed` and `handleSearch`. Extract this into a shared mapper:

```typescript
// app/src/lib/mappers.ts
import type { Post, Comment } from './api';

// This is the shape the Feed UI component expects
export type UIPost = {
  id: string;
  node: { id?: string; name: string; color: string };
  author: {
    username: string;
    avatar: string;
    era: string;
    connoisseurCred: number;
  };
  title: string;
  content: string;
  createdAt: string;
  commentCount: number;
  expertGated: boolean;
  vibes: any[];
  linkMeta?: Post['linkMeta'];
  comments: UIComment[];
};

export type UIComment = {
  id: string;
  author: {
    username: string;
    avatar: string;
    era: string;
    connoisseurCred: number;
  };
  content: string;
  timestamp: Date;
  depth: number;
  replies: UIComment[];
};

export function mapApiPostToUIPost(p: Post): UIPost {
  return {
    id: p.id,
    node: {
      id: p.node?.id,
      name: p.node?.name || 'Global',
      color: '#6366f1',
    },
    author: {
      username: p.author.email.split('@')[0],
      avatar: `https://picsum.photos/seed/${p.author.id}/200`,
      era: 'Builder Era',
      connoisseurCred: 420,
    },
    title: p.title || 'Untitled Post',
    content: p.content,
    createdAt: p.createdAt,
    commentCount: p.commentCount,
    expertGated: false,
    vibes: [],
    linkMeta: p.linkMeta,
    comments: [], // Comments loaded separately in post detail
  };
}

export function mapApiCommentToUIComment(c: Comment): UIComment {
  return {
    id: c.id,
    author: {
      username: c.author.email.split('@')[0],
      avatar: `https://picsum.photos/seed/${c.author.id}/200`,
      era: 'Builder Era',
      connoisseurCred: 100,
    },
    content: c.content,
    timestamp: new Date(c.createdAt),
    depth: 0,
    replies: [],
  };
}
```

**What this replaces**: The 25-line `mappedPosts` block duplicated in both `fetchFeed` (App.tsx line 71-99) and `handleSearch` (App.tsx line 124-152).

---

## 7. Shared Layout (Responsive 3-Column)

The responsive 3-column layout currently lives inline in `MainApp`. After the refactor, it lives in `app/(app)/_layout.tsx`.

### Layout Architecture

```
+------------------------------------------------------------------+
|  Header (full width)                                              |
+----------+-----------------------------+-------------------------+
|          |                             |                         |
| Sidebar  |   <Slot />                  |  Vibe Validator         |
| 280px    |   (active screen)           |  320px                  |
|          |                             |                         |
| (tablet+ |   Feed / Profile /          |  (desktop only,         |
|  only)   |   Post Detail / etc.        |   toggleable)           |
|          |                             |                         |
+----------+-----------------------------+-------------------------+
```

### Breakpoint Behavior

| Width | Layout | Sidebar | Vibe Validator |
|---|---|---|---|
| < 768px (mobile) | Single column | Modal drawer | Modal drawer |
| 768-1023px (tablet) | Two columns | Persistent left | Modal drawer |
| >= 1024px (desktop) | Three columns | Persistent left | Persistent right (toggleable) |

### Extracted Header Component

```typescript
// app/src/components/ui/Header.tsx
import { View, TouchableOpacity, Text, TextInput, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Search, X, MessageSquare, Bell, PanelRight } from './Icons';
import { COLORS } from '@/constants/theme';

type HeaderProps = {
  isTablet: boolean;
  isDesktop: boolean;
  rightPanelOpen: boolean;
  onToggleMenu: () => void;
  onToggleVibePanel: () => void;
  // Search is handled within the header itself
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: () => void;
};

export function Header({
  isTablet,
  isDesktop,
  rightPanelOpen,
  onToggleMenu,
  onToggleVibePanel,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
}: HeaderProps) {
  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: COLORS.node.bg }}
    >
      <View style={[styles.header, { paddingHorizontal: isTablet ? 24 : 16 }]}>
        {/* Mobile: hamburger menu */}
        {!isTablet && (
          <TouchableOpacity onPress={onToggleMenu}>
            <Menu color={COLORS.node.muted} size={24} />
          </TouchableOpacity>
        )}

        {/* Desktop: search bar */}
        {isTablet ? (
          <View style={styles.desktopSearch}>
            <Search size={16} color={COLORS.node.muted} />
            <TextInput
              placeholder="Search Nodes, people, or vibes..."
              placeholderTextColor={COLORS.node.muted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={onSearchChange}
              onSubmitEditing={onSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange?.('')}>
                <X size={16} color={COLORS.node.muted} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.headerTitle}>
            Node<Text style={{ color: COLORS.node.accent }}>Social</Text>
          </Text>
        )}

        {/* Right icons */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <MessageSquare color={COLORS.node.muted} size={24} />
          <Bell color={COLORS.node.muted} size={24} />
          <TouchableOpacity onPress={onToggleVibePanel}>
            <PanelRight
              color={
                isDesktop && rightPanelOpen
                  ? COLORS.node.accent
                  : COLORS.node.muted
              }
              size={24}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    backgroundColor: COLORS.node.bg,
    width: '100%',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  desktopSearch: {
    flex: 1,
    maxWidth: 400,
    height: 36,
    backgroundColor: COLORS.node.panel,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 24,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: '100%',
  },
});
```

---

## 8. State Management

### Decision Matrix: Where Does Each Piece of State Live?

| State | Current Location | Target Location | Why |
|---|---|---|---|
| `user`, `token`, `loading` | Zustand (`useAuthStore`) | Zustand (`useAuthStore`) | Auth state needs to persist across navigation and be available everywhere. Zustand is correct. |
| `posts` (feed data) | `useState` in `MainApp` | React Query (`useFeed`) | Server data. Should be cached, deduplicated, and auto-refreshed. |
| `nodes` (node list) | `useState` in `MainApp` | React Query (`useNodes`) | Server data fetched in 4 places. Cache once, use everywhere. |
| `searchQuery` | `useState` in `MainApp` | `useState` in `Header` component | UI-local state. Only the search input cares about it. |
| `selectedNodeId` | `useState` in `MainApp` | URL query param or `useState` in feed screen | Could be a URL param (`/?node=abc`) for shareability, or local state. |
| `algoSettings` | `useState` in `MainApp` (never sent to API!) | React Query (`useFeedPreferences`) | Should be server state. Connect to the real API. |
| `menuVisible` | `useState` in `MainApp` | `useState` in `AppLayout` | UI-local state. Only the layout needs it. |
| `vibeVisible` | `useState` in `MainApp` | `useState` in `AppLayout` | UI-local state. Only the layout needs it. |
| `rightPanelOpen` | `useState` in `MainApp` | `useState` in `AppLayout` | UI-local state. Only the layout needs it. |
| `currentView` (feed/profile) | `useState` in `MainApp` | **URL** (Expo Router) | This IS navigation. It should be a URL, not state. |
| `currentScreen` (login/register/...) | `useState` in `App` | **URL** (Expo Router) | This IS navigation. It should be a URL, not state. |
| `resetToken`, `verifyToken` | `useState` in `App` | **URL query params** | Deep link params. Expo Router handles this automatically. |
| `isCreatePostOpen` | `useState` in `MainApp` | `useState` in feed screen | UI-local state. Could also be a route (`/create-post`) for web URL support. |
| `post` (single post detail) | `useState` in `PostDetailScreen` | React Query (`usePost`) | Server data. Cache it. |
| `comments` | `useState` in `PostDetailScreen` | React Query (`usePost`) | Server data. Part of post detail query. |
| `feedPreferences` | `useState` in `FeedPreferencesScreen` | React Query (`useFeedPreferences`) | Server data. Share between FeedPreferencesScreen and VibeValidator. |

### What Stays in Zustand

Only **authentication state**:

```typescript
// Zustand is the right choice for:
// - Data that needs to survive navigation (user session)
// - Data that needs to be written to disk (token persistence)
// - Global state that many components read but rarely write

useAuthStore:
  user: User | null
  token: string | null
  loading: boolean
  appleUserId: string | null
  setAuth()
  loadFromStorage()
  logout()
  markEmailVerified()
  checkAppleCredentials()
```

### What Moves to React Query

All **server-fetched data**:

```typescript
// React Query is the right choice for:
// - Data fetched from the API
// - Data that should be cached and shared across components
// - Data that needs loading/error states
// - Data that needs background refetching

['feed', { nodeId }]         -> useFeed()
['nodes']                    -> useNodes()
['search', query]            -> useSearch()
['post', postId]             -> usePost()
['feedPreferences']          -> useFeedPreferences()
['vibeVectors']              -> useVibeVectors() (future)
```

### What Becomes Local `useState`

Only **UI interaction state** that no other component needs:

```
menuVisible          -> in AppLayout
vibeVisible          -> in AppLayout
rightPanelOpen       -> in AppLayout
searchQuery          -> in Header
isCreatePostOpen     -> in FeedScreen
isEditing (profile)  -> in ProfileScreen
formData (profile)   -> in ProfileScreen
```

### What Becomes URL State

**Navigation state** and **shareable parameters**:

```
Which screen is shown    -> URL path (/login, /post/abc, /profile)
Reset password token     -> /reset-password?token=abc
Verify email token       -> /verify-email?token=abc
Selected node filter     -> Could be /?node=abc (optional enhancement)
Post ID for detail view  -> /post/abc123
```

---

## 9. Migration Steps

These steps are ordered to minimize breakage. Each step results in a working app.

### Phase 0: Preparation (No Behavior Changes)

#### Step 0.1: Create the hooks directory and mapper file

Create empty hook files with the implementations from Section 6. These do not affect the current app since nothing imports them yet.

Files to create:
- `app/src/hooks/useFeed.ts`
- `app/src/hooks/useNodes.ts`
- `app/src/hooks/useSearch.ts`
- `app/src/hooks/useCreatePost.ts`
- `app/src/hooks/useCreateComment.ts`
- `app/src/hooks/usePost.ts`
- `app/src/hooks/useFeedPreferences.ts`
- `app/src/hooks/useResponsiveLayout.ts`
- `app/src/lib/mappers.ts`
- `app/src/types/index.ts`

**Test**: The app should still build and run exactly as before.

#### Step 0.2: Create the Header component

Extract the header from MainApp into `app/src/components/ui/Header.tsx` (as described in Section 7). Import and use it in the current `App.tsx` to verify it works before the router migration.

**Test**: The header looks and works the same.

#### Step 0.3: Verify hooks work by using them in existing screens

Temporarily import `useNodes` in one of the existing screens (e.g., `CreatePostScreen.tsx`) alongside the existing `loadNodes` logic. Verify the data matches. Remove the test import.

**Test**: Console log shows identical data from hook vs inline fetch.

### Phase 1: Install Expo Router

#### Step 1.1: Install expo-router

```bash
cd /home/user/Node-Social/app
npx expo install expo-router
```

#### Step 1.2: Update configuration files

Update these files as described in Section 3:
- `app.json` (add `"bundler": "metro"` to web, add `"expo-router"` to plugins)
- `package.json` (change `"main"` to `"expo-router/entry"`)
- `babel.config.js` (add `"expo-router/babel"` plugin)
- `tsconfig.json` (add `baseUrl` and `paths`)

#### Step 1.3: Create the route directory structure

Create the `app/app/` directory (yes, `app/app/` -- the outer `app` is your project, the inner `app` is the Expo Router routes directory).

```bash
mkdir -p app/app/\(auth\)
mkdir -p app/app/\(app\)/post
mkdir -p app/app/\(app\)/settings
```

#### Step 1.4: Create the root layout

Create `app/app/_layout.tsx` with the `AuthGate` pattern from Section 4. This is the most critical file.

#### Step 1.5: Create a minimal (auth) group

Create `app/app/(auth)/_layout.tsx` and `app/app/(auth)/login.tsx`.

For `login.tsx`, start by just wrapping the existing `LoginScreen` component:

```typescript
// app/app/(auth)/login.tsx  -- MINIMAL VERSION FOR TESTING
import { useRouter } from 'expo-router';
import { LoginScreen } from '../../src/screens/LoginScreen';

export default function Login() {
  const router = useRouter();

  return (
    <LoginScreen
      onSuccessLogin={() => {}}  // AuthGate handles redirect
      goToRegister={() => router.push('/(auth)/register')}
      goToForgotPassword={() => router.push('/(auth)/forgot-password')}
    />
  );
}
```

#### Step 1.6: Create a minimal (app) group

Create `app/app/(app)/_layout.tsx` and `app/app/(app)/index.tsx`.

For `index.tsx`, start by wrapping the current `MainApp` component. This is a temporary bridge.

**Test**: Clear Metro cache (`npx expo start --clear`). The app should boot into the login screen or the feed, depending on auth state. Navigation between login/register should work via URLs.

### Phase 2: Migrate Auth Screens

#### Step 2.1: Create all auth route files

For each auth screen, create a thin route file that wraps the existing screen component:

- `app/app/(auth)/register.tsx` -- wraps `RegisterScreen`
- `app/app/(auth)/forgot-password.tsx` -- wraps `ForgotPasswordScreen`
- `app/app/(auth)/reset-password.tsx` -- wraps `ResetPasswordScreen`
- `app/app/(auth)/verify-email.tsx` -- wraps `VerifyEmailScreen`
- `app/app/(auth)/enter-reset-token.tsx` -- wraps `EnterResetTokenScreen`

Each wrapper converts callback props to `router.push()` / `router.replace()` calls.

#### Step 2.2: Remove deep link handling from old App.tsx

The old `useEffect` that parses deep links via `Linking.parse()` can be removed. Expo Router handles deep links automatically based on the file structure.

**Test**: All auth flows work. Deep links for reset-password and verify-email work. Back button works on web.

### Phase 3: Migrate App Screens

#### Step 3.1: Build the real (app) layout

Replace the minimal `(app)/_layout.tsx` with the full 3-column responsive layout from Section 4 and Section 7. This layout uses `useNodes`, `useResponsiveLayout`, and the extracted `Header` component.

#### Step 3.2: Migrate the feed screen

Create the real `(app)/index.tsx` that uses `useFeed` instead of inline fetching. The Feed UI component (`src/components/ui/Feed.tsx`) stays the same.

#### Step 3.3: Migrate post detail

Create `(app)/post/[id].tsx` using `usePost` and `useCreateComment`.

#### Step 3.4: Migrate profile

Create `(app)/profile.tsx` using the auth store directly.

#### Step 3.5: Migrate create post

Either keep the modal approach (no route needed) or create `(app)/create-post.tsx` as a full-screen route. The modal approach is simpler and recommended.

#### Step 3.6: Migrate feed preferences

Create `(app)/settings/feed-preferences.tsx` using `useFeedPreferences`.

**Test**: All app screens work. Navigation between feed/profile/post-detail works. Creating posts refreshes the feed. Search works. The 3-column layout is responsive.

### Phase 4: Cleanup

#### Step 4.1: Delete the old `App.tsx`

Once all screens are migrated and tested, delete `app/App.tsx`. It is no longer imported by anything.

#### Step 4.2: Delete the old `index.ts`

The old entry point `app/index.ts` (which called `registerRootComponent(App)`) is no longer needed. Expo Router uses its own entry.

#### Step 4.3: Delete old screen files

Delete all files in `app/src/screens/` since they have been replaced by route files in `app/app/`.

#### Step 4.4: Clean up unused imports

Run the TypeScript compiler to find unused imports:

```bash
cd /home/user/Node-Social/app
npx tsc --noEmit
```

Fix any errors.

#### Step 4.5: Move screen-specific styles

If any route file in `app/app/` got large because of styles, extract styles into separate files or keep them co-located at the bottom of the route file (this is fine for Expo Router).

**Test**: Full regression test. Everything works. No dead code.

---

## 10. File-by-File Guide

### New Files to Create

#### `app/app/_layout.tsx` -- Root Layout

**Purpose**: Wraps the entire app in providers (SafeAreaProvider, QueryClientProvider). Contains `AuthGate` which redirects unauthenticated users to login and authenticated users away from auth screens.

**Contains**:
- `QueryClient` initialization with default options
- `AuthGate` component that watches `useAuthStore` and `useSegments`
- `RootLayout` component that calls `loadFromStorage` and renders providers + `<Slot />`
- Loading spinner while auth state is being restored from storage

**Does NOT contain**: Any UI (screens, headers, sidebars).

**Lines**: ~60-80

---

#### `app/app/+not-found.tsx` -- 404 Screen

**Purpose**: Shown when navigating to a route that does not exist.

**Contains**:
- Simple centered text: "Page not found"
- Link back to home

**Lines**: ~20

---

#### `app/app/(auth)/_layout.tsx` -- Auth Layout

**Purpose**: Configures the stack navigator for auth screens. Sets dark background, hides header, sets animation style.

**Contains**:
- `<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.node.bg } }} />`

**Lines**: ~15

---

#### `app/app/(auth)/login.tsx` -- Login Route

**Purpose**: Login screen with email/password, Google, and Apple sign-in.

**Contains**:
- All the existing `LoginScreen` logic (Google OAuth, Apple auth, form handling)
- Uses `router.push()` for navigation instead of callback props
- Uses `useAuthStore().setAuth()` for auth -- AuthGate handles redirect

**Does NOT contain**: `onSuccessLogin`, `goToRegister`, `goToForgotPassword` props -- these are replaced by router calls.

**Migration notes**: Copy the contents of `src/screens/LoginScreen.tsx` into this file. Replace:
- `onSuccessLogin()` -> remove (AuthGate handles it)
- `goToRegister()` -> `router.push('/(auth)/register')`
- `goToForgotPassword()` -> `router.push('/(auth)/forgot-password')`

**Lines**: ~300 (this is a complex screen due to OAuth -- that is OK)

---

#### `app/app/(auth)/register.tsx` -- Register Route

**Purpose**: Registration form.

**Contains**: Existing `RegisterScreen` logic with router-based navigation.

**Migration notes**: Replace:
- `onSuccessLogin()` -> `router.replace('/(auth)/login')` (or let AuthGate handle it if auto-login after register)
- `goToLogin()` -> `router.push('/(auth)/login')`

**Lines**: ~200

---

#### `app/app/(auth)/forgot-password.tsx` -- Forgot Password Route

**Purpose**: Email input to request password reset.

**Contains**: Existing `ForgotPasswordScreen` logic.

**Migration notes**: Replace:
- `goToLogin()` -> `router.push('/(auth)/login')`
- `onEnterTokenManually?.()` -> `router.push('/(auth)/enter-reset-token')`

**Lines**: ~130

---

#### `app/app/(auth)/reset-password.tsx` -- Reset Password Route

**Purpose**: New password form, accessed via deep link with token.

**Contains**: Existing `ResetPasswordScreen` logic.

**Migration notes**:
- Token comes from `useLocalSearchParams<{ token: string }>()` instead of prop
- `onSuccess()` -> `router.replace('/(auth)/login')`
- Deep link `nodesocial://reset-password?token=abc` automatically routed here

**Lines**: ~120

---

#### `app/app/(auth)/verify-email.tsx` -- Verify Email Route

**Purpose**: Email verification screen, accessed via deep link with token.

**Contains**: Existing `VerifyEmailScreen` logic.

**Migration notes**:
- Token comes from `useLocalSearchParams<{ token: string }>()` instead of `pendingToken` prop
- Email comes from `useAuthStore().user?.email` instead of prop
- `onVerified` -> call `markEmailVerified()` then `router.replace('/(auth)/login')`
- `onLogout` -> call `logout()` (AuthGate will redirect to login)

**Lines**: ~170

---

#### `app/app/(auth)/enter-reset-token.tsx` -- Manual Token Entry Route

**Purpose**: Manual token input for password reset (when deep link does not work).

**Contains**: Existing `EnterResetTokenScreen` logic.

**Migration notes**:
- `onTokenEntered(token)` -> `router.push({ pathname: '/(auth)/reset-password', params: { token } })`
- `goBack()` -> `router.back()`

**Lines**: ~80

---

#### `app/app/(app)/_layout.tsx` -- App Layout (3-Column Shell)

**Purpose**: The persistent layout around all authenticated screens. Contains the header, sidebar, and vibe validator.

**Contains**:
- `useResponsiveLayout()` for breakpoint detection
- `useNodes()` for sidebar data
- `useFeedPreferences()` for vibe validator data
- `<Header />` component
- `<Sidebar />` component (persistent on tablet+, modal on mobile)
- `<VibeValidator />` component (persistent on desktop, modal on mobile/tablet)
- `<Slot />` for rendering the active child screen
- Mobile drawer modals for sidebar and vibe validator

**Does NOT contain**: Feed data fetching, post rendering, or any screen-specific logic.

**Lines**: ~150

---

#### `app/app/(app)/index.tsx` -- Feed Screen (Home)

**Purpose**: The main feed showing posts.

**Contains**:
- `useFeed({ nodeId: selectedNodeId })` for feed data
- `<Feed posts={...} />` component
- FAB button to open create post modal
- `<CreatePostModal />` component

**Does NOT contain**: Sidebar, header, vibe validator (these are in the layout).

**Lines**: ~80

---

#### `app/app/(app)/post/[id].tsx` -- Post Detail Screen

**Purpose**: Single post view with comments.

**Contains**:
- `useLocalSearchParams<{ id: string }>()` to get post ID from URL
- `usePost(id)` for post + comment data
- `useCreateComment(id)` for adding comments
- Post card rendering
- Comment list
- Comment input

**Does NOT contain**: Back button logic (Expo Router provides this on web, the stack handles it on native).

**Lines**: ~150

---

#### `app/app/(app)/profile.tsx` -- Profile Screen

**Purpose**: View and edit own profile.

**Contains**:
- `useAuthStore()` for user data
- Profile edit form with `useMutation` for `updateProfile`
- Logout button that calls `useAuthStore().logout()`

**Lines**: ~180

---

#### `app/app/(app)/create-post.tsx` -- Create Post Screen (Optional)

**Purpose**: Full-screen create post experience (alternative to modal).

**Contains**:
- `useCreatePost()` mutation
- `useNodes()` for node selector
- Content input, node picker, link preview

**Note**: This is optional. You can keep using `CreatePostModal` from the feed screen instead. Having a route is useful for web where users might want to navigate directly to `/create-post`.

**Lines**: ~150

---

#### `app/app/(app)/settings/feed-preferences.tsx` -- Feed Preferences Screen

**Purpose**: Configure feed algorithm weights.

**Contains**:
- `useFeedPreferences()` for current preferences + save mutation
- Preset selector (latest, balanced, popular, expert, personal, custom)
- Custom weight sliders

**Lines**: ~200

---

#### `app/src/hooks/useFeed.ts`

**Purpose**: Fetch and cache feed data via React Query.

See Section 6.1 for full implementation.

**Lines**: ~35

---

#### `app/src/hooks/useNodes.ts`

**Purpose**: Fetch and cache node list via React Query.

See Section 6.2 for full implementation.

**Lines**: ~30

---

#### `app/src/hooks/useSearch.ts`

**Purpose**: Search posts via React Query (only fetches when query is non-empty).

See Section 6.3 for full implementation.

**Lines**: ~25

---

#### `app/src/hooks/useCreatePost.ts`

**Purpose**: Post creation mutation that invalidates feed cache on success.

See Section 6.4 for full implementation.

**Lines**: ~20

---

#### `app/src/hooks/useCreateComment.ts`

**Purpose**: Comment creation mutation that invalidates post and feed cache on success.

See Section 6.6 for full implementation.

**Lines**: ~25

---

#### `app/src/hooks/usePost.ts`

**Purpose**: Fetch single post + comments via React Query.

See Section 6.5 for full implementation.

**Lines**: ~20

---

#### `app/src/hooks/useFeedPreferences.ts`

**Purpose**: Fetch + update feed preferences via React Query.

See Section 6.7 for full implementation.

**Lines**: ~35

---

#### `app/src/hooks/useResponsiveLayout.ts`

**Purpose**: Detect mobile/tablet/desktop breakpoints from window width.

See Section 6.8 for full implementation.

**Lines**: ~25

---

#### `app/src/lib/mappers.ts`

**Purpose**: Transform API response types into UI display types.

See Section 6.9 for full implementation.

**Lines**: ~80

---

#### `app/src/types/index.ts`

**Purpose**: Shared TypeScript types used across hooks, components, and screens.

**Contains**:
```typescript
// Re-export API types
export type { Post, Node, Comment, AuthResponse, FeedPreference } from '../lib/api';

// UI-specific types
export type { UIPost, UIComment } from '../lib/mappers';
export type { UINode } from '../hooks/useNodes';
export type { LayoutBreakpoint } from '../hooks/useResponsiveLayout';
```

**Lines**: ~15

---

#### `app/src/components/ui/Header.tsx`

**Purpose**: The app header bar with search, hamburger menu, notifications, and panel toggle.

See Section 7 for full implementation.

**Lines**: ~90

---

### Modified Files

#### `app/app.json`

Add `"bundler": "metro"` to `web` config and `"expo-router"` to `plugins`.

---

#### `app/package.json`

Change `"main"` from `"index.ts"` to `"expo-router/entry"`.

---

#### `app/tsconfig.json`

Add `baseUrl`, `paths`, and `include` arrays.

---

#### `app/babel.config.js`

Add `"expo-router/babel"` plugin.

---

#### `app/src/store/auth.ts`

Add an `updateUser` action so the profile screen can update the cached user without needing the full auth response:

```typescript
// Add to AuthState type:
updateUser: (updates: Partial<User>) => Promise<void>;

// Add to create():
updateUser: async (updates) => {
  set((state) => {
    if (!state.user) return state;
    const updated = { ...state.user, ...updates };
    storage.setItem('user', JSON.stringify(updated));
    return { user: updated };
  });
},
```

---

#### `app/src/components/ui/Sidebar.tsx`

Minor changes:
- Use `router.push()` for node navigation instead of `onNodeSelect` callback
- Or keep the callback pattern and let the layout pass it (simpler for now)

---

#### `app/src/components/ui/Feed.tsx`

Minor changes:
- Add `onPostPress?: (postId: string) => void` prop
- When a post card is tapped, call `onPostPress(post.id)`

---

#### `app/src/components/ui/VibeValidator.tsx`

Change to accept preferences from `useFeedPreferences` hook instead of local state:
- Props change from `{ settings, onUpdate }` to `{ preferences, onUpdate }`
- Wire slider changes to call the real `updateFeedPreferences` API

---

#### `app/src/components/ui/CreatePostModal.tsx`

Change to use `useCreatePost` hook instead of inline API calls:
- Replace `createPost()` call with `createPostMutation.mutate()`
- Remove manual `queryClient.invalidateQueries` (the hook handles it)

---

### Deleted Files (After Full Migration)

| File | Replaced By |
|---|---|
| `app/App.tsx` | `app/app/_layout.tsx` + route files |
| `app/index.ts` | Expo Router entry (`expo-router/entry`) |
| `app/src/screens/LoginScreen.tsx` | `app/app/(auth)/login.tsx` |
| `app/src/screens/RegisterScreen.tsx` | `app/app/(auth)/register.tsx` |
| `app/src/screens/ForgotPasswordScreen.tsx` | `app/app/(auth)/forgot-password.tsx` |
| `app/src/screens/ResetPasswordScreen.tsx` | `app/app/(auth)/reset-password.tsx` |
| `app/src/screens/VerifyEmailScreen.tsx` | `app/app/(auth)/verify-email.tsx` |
| `app/src/screens/EnterResetTokenScreen.tsx` | `app/app/(auth)/enter-reset-token.tsx` |
| `app/src/screens/FeedScreen.tsx` | `app/app/(app)/index.tsx` |
| `app/src/screens/PostDetailScreen.tsx` | `app/app/(app)/post/[id].tsx` |
| `app/src/screens/ProfileScreen.tsx` | `app/app/(app)/profile.tsx` |
| `app/src/screens/CreatePostScreen.tsx` | `app/app/(app)/create-post.tsx` (or kept as modal) |
| `app/src/screens/FeedPreferencesScreen.tsx` | `app/app/(app)/settings/feed-preferences.tsx` |

---

## 11. Testing Checklist

After each phase, verify these scenarios:

### Auth Flow
- [ ] Cold launch with no stored token -> shows login screen
- [ ] Cold launch with valid stored token -> shows feed
- [ ] Cold launch with expired token -> refreshes token and shows feed (or shows login if refresh fails)
- [ ] Login with email/password -> shows feed
- [ ] Login with Google OAuth -> shows feed
- [ ] Login with Apple Sign-In (iOS only) -> shows feed
- [ ] Register new account -> navigates to login (or auto-login)
- [ ] Forgot password -> sends email, shows success
- [ ] Reset password via deep link (`nodesocial://reset-password?token=abc`) -> shows reset form with token pre-filled
- [ ] Verify email via deep link (`nodesocial://verify-email?token=abc`) -> verifies and redirects to login
- [ ] Logout -> shows login screen, clears stored tokens
- [ ] Navigate to `/profile` while logged out -> redirected to login
- [ ] Navigate to `/login` while logged in -> redirected to feed

### Feed
- [ ] Feed loads on app launch (authenticated)
- [ ] Pull to refresh works (if implemented)
- [ ] Node filter changes the feed content
- [ ] Search finds posts
- [ ] Clearing search restores feed
- [ ] Creating a post refreshes the feed
- [ ] Tapping a post card navigates to post detail

### Post Detail
- [ ] Post and comments load from URL (`/post/abc123`)
- [ ] Adding a comment updates the comment list
- [ ] Back button returns to feed
- [ ] Deep link to post detail works

### Profile
- [ ] Shows current user info
- [ ] Edit mode allows changing bio
- [ ] Save updates profile
- [ ] Sign out works from profile

### Responsive Layout
- [ ] Mobile (< 768px): Single column, hamburger menu, vibe validator in modal
- [ ] Tablet (768-1023px): Two columns (sidebar + feed), vibe validator in modal
- [ ] Desktop (>= 1024px): Three columns (sidebar + feed + vibe validator)
- [ ] Desktop: Toggle right panel hides/shows vibe validator
- [ ] Window resize transitions smoothly between breakpoints

### Web-Specific
- [ ] URLs update when navigating (browser address bar shows `/post/abc123`)
- [ ] Browser back button works
- [ ] Direct URL navigation works (paste `/post/abc123` into address bar)
- [ ] Page refresh preserves auth state

### Performance
- [ ] Nodes are fetched once, not on every screen
- [ ] Feed data is cached (navigating away and back does not re-fetch immediately)
- [ ] Creating a post invalidates the feed cache (so it re-fetches)
- [ ] No "flash of wrong screen" during auth check on startup

---

## Quick Reference: Import Path Changes

With the `@/` path alias configured in `tsconfig.json`, imports from route files become cleaner:

```typescript
// BEFORE (from a deeply nested route file):
import { useFeed } from '../../../src/hooks/useFeed';
import { COLORS } from '../../../src/constants/theme';

// AFTER (with @/ alias):
import { useFeed } from '@/hooks/useFeed';
import { COLORS } from '@/constants/theme';
```

The `@/` alias maps to `app/src/`, so `@/hooks/useFeed` resolves to `app/src/hooks/useFeed.ts`.

---

## Common Gotchas

### 1. The double `app/app/` directory is not a typo

Your project lives at `/home/user/Node-Social/app/`. Expo Router looks for routes in a directory called `app/` inside your project root. So the full path to your routes is `/home/user/Node-Social/app/app/`. This is confusing but correct.

### 2. Clear Metro cache after config changes

Whenever you change `babel.config.js`, `tsconfig.json`, or `app.json`, run:

```bash
npx expo start --clear
```

Metro caches aggressively and will use stale config otherwise.

### 3. `(auth)` and `(app)` do NOT appear in URLs

Route groups in parentheses are organizational. The URL for `app/app/(auth)/login.tsx` is `/login`, not `/auth/login`. The URL for `app/app/(app)/post/[id].tsx` is `/post/abc123`, not `/app/post/abc123`.

### 4. `useSegments()` returns the route group name

Even though `(auth)` is not in the URL, `useSegments()` returns `['(auth)', 'login']`. This is how the `AuthGate` knows which group the user is currently in.

### 5. `router.replace()` vs `router.push()`

- `router.push()` adds to the navigation stack (user can go back)
- `router.replace()` replaces the current screen (user cannot go back)

Use `replace` for:
- Auth redirects (login -> feed, or feed -> login)
- After successful password reset (reset -> login)
- After email verification

Use `push` for:
- Normal navigation (feed -> post detail)
- Going to register from login
- Going to forgot-password from login

### 6. The `Slot` component vs `Stack` component

- `<Slot />` renders the matched child route with no animation and no header. Use it when you are building your own layout (like the 3-column shell).
- `<Stack />` renders children as a stack navigator with push/pop animations and optional headers. Use it for the auth flow where screens slide in/out.

You can use `<Slot />` in the app layout and `<Stack />` in the auth layout. They can be mixed.

### 7. Do NOT delete `src/components/` -- only `src/screens/`

The components in `src/components/ui/` (Feed, Sidebar, VibeValidator, PostCard, etc.) are reusable UI components. They stay. Only the screen files in `src/screens/` are replaced by route files in `app/app/`.

### 8. React Query DevTools

For debugging, you can add React Query devtools (web only):

```bash
npx expo install @tanstack/react-query-devtools
```

Add to root layout:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Inside QueryClientProvider:
{Platform.OS === 'web' && <ReactQueryDevtools />}
```

This gives you a floating panel showing all cached queries, their states, and timestamps.
