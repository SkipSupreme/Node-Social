# Dead Code Analysis Report

**Date:** 2026-02-08
**Analyzed:** Frontend (`app/`) + Backend (`backend/api/`)
**Tools:** depcheck, manual import tracing

---

## SAFE — Remove Immediately

### Frontend: Unused Dependencies (package.json)

| Package | Status | Notes |
|---------|--------|-------|
| `zod` | Never imported | Zero usage in any source file |
| `clsx` | Never imported | Zero usage in any source file |
| `tailwind-merge` | Never imported | Zero usage in any source file |
| `@tiptap/extension-mention` | Never imported | Not used in TipTapEditor.tsx |
| `@tiptap/suggestion` | Never imported | Not used in TipTapEditor.tsx |
| `react-native-web-webview` | Never imported | Polyfill — may be needed for web builds, verify first |

### Backend: Unused Dependencies (package.json)

| Package | Status | Notes |
|---------|--------|-------|
| `fastify-socket-io` | Never imported | Backend uses `socket.io` directly via custom plugin |
| `jsonwebtoken` | Never imported | Backend uses `jose` for JWT operations instead |
| `pino` | Never imported | Fastify has built-in Pino logger, no separate import needed |

### Backend: Unused Service Files (~1,590+ lines total)

| File | Est. Lines | Status | Notes |
|------|-----------|--------|-------|
| `services/metaModService.ts` | ~230 | Never imported anywhere | Meta-moderation system, not wired up |
| `services/explorationTaxService.ts` | ~360 | Never imported anywhere | Exploration tax system, not wired up |
| `services/bicameralService.ts` | ~550 | Never imported anywhere | Bicameral governance (proposals, voting, council), not wired up |
| `services/charterService.ts` | ~450 | Never imported anywhere | Charter/governance config system, not wired up |

### Frontend: Dead Code in Source

| File | Lines | Description |
|------|-------|-------------|
| `screens/ChatScreen.tsx` | 67-79 | Commented-out optimistic update code with explanation |

---

## CAUTION — Review Before Removing

### Frontend: Potentially Unused Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| `@expo-google-fonts/bricolage-grotesque` | Referenced by name in theme constants but `useFonts()` never called | Fonts may not actually load — verify visually |
| `@expo-google-fonts/dm-sans` | Referenced by name in theme constants but `useFonts()` never called | Same as above |
| `@testing-library/jest-native` | Only in devDeps, flagged by depcheck | May be loaded via jest.setup.js — verify tests pass after removal |
| `@types/jest` | Only in devDeps, flagged by depcheck | May be needed for test type checking |

### Frontend: Debug console.log Statements

| File | Lines | Description |
|------|-------|-------------|
| `components/ui/ExternalPostCard.tsx` | 487, 493, 499, 506, 515 | Bluesky/Mastodon thread parsing debug logs |
| `components/ui/EditProfileModal.tsx` | ~70 | Avatar upload result logging |
| `screens/LoginScreen.tsx` | 87-96 | Google OAuth redirect URI debug logging |
| `store/auth.ts` | ~28 | Session expiry proactive refresh logging |
| `lib/api.ts` | 1771, 1785, 1809, 1849 | Fallback endpoint "not available" logging |

### Backend: Code Duplication

| File | Lines | Description |
|------|-------|-------------|
| `routes/council.ts` | 171-182 | `calculateActivityMultiplier()` duplicates identical function in `lib/activityTracker.ts` — should import instead |

### Frontend: Incomplete Implementation

| File | Lines | Description |
|------|-------|-------------|
| `components/ui/NodeOverflowMenu.tsx` | 113-124 | `// TODO: Implement report API` — shows fake success without actually reporting |

---

## FALSE POSITIVES — Do NOT Remove

| Package | Why depcheck flagged it | Why it's needed |
|---------|------------------------|-----------------|
| `expo-dev-client` | No source imports | Works at native layer for dev builds |
| `expo-status-bar` | No source imports | Auto-included by Expo SDK |
| `@expo/metro-runtime` | Only in config files | Required for Metro bundler |

---

## Summary Stats

| Category | Count |
|----------|-------|
| Frontend unused deps (SAFE) | 5-6 |
| Backend unused deps (SAFE) | 3 |
| Backend unused service files (SAFE) | 4 |
| Frontend dead code blocks (SAFE) | 1 |
| Debug console.logs (CAUTION) | ~12 statements across 5 files |
| Incomplete features (CAUTION) | 1 |

**Estimated reduction:** ~6-9 npm packages, 4 unused service files (~1,590 lines), 1 duplicate function, scattered debug logging
