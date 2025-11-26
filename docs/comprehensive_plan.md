# Comprehensive Implementation Plan - "Polishing the Stratosphere"

## Goal Description
Fix reported bugs (usernames, timestamps, beta nav) and implement missing core features (polls, comments, share/save, notifications) to get the platform "off the ground". Additionally, improve the desktop experience for authentication screens.

## User Review Required
> [!IMPORTANT]
> **Backend Changes**: Some features (Saved Posts, Mute/Block) might require backend schema changes. For this iteration, I will implement them as **frontend-only** (using local storage or visual toggles) or **mocked** features unless explicitly instructed to modify the DB schema.
> **Username Display**: I will change the mapping to use the actual `username` field from the DB instead of the email prefix.

## Proposed Changes

### 1. Core Fixes (High Priority)

#### [MODIFY] [App.tsx](file:///Users/joshhd/Documents/node-social/app/App.tsx)
- **Username**: Update `fetchFeed` mapping to use `p.author.username` instead of `p.author.email.split('@')[0]`.
- **Timestamps**: Ensure `createdAt` is passed as a valid date string/object.

#### [MODIFY] [Feed.tsx](file:///Users/joshhd/Documents/node-social/app/src/components/ui/Feed.tsx)
- **Timestamps**: Improve `timeAgo` function to handle ISO strings and timezones correctly.
- **Polls**: Add rendering logic for `post.poll` inside `PostCard`.
- **Post Menu**: Add `Modal` or conditional rendering for the "..." menu (Mute/Block options).

#### [MODIFY] [BetaTestScreen.tsx](file:///Users/joshhd/Documents/node-social/app/src/screens/BetaTestScreen.tsx)
- **Navigation**: Add a "Back" or "Exit Lab" button to return to the main feed.

### 2. Feature Implementation

#### [MODIFY] [Feed.tsx](file:///Users/joshhd/Documents/node-social/app/src/components/ui/Feed.tsx)
- **Comments**:
    - Add a `TextInput` and "Post" button to `PostCard` (when comments are expanded).
    - Add "Reply" input logic to `CommentNode`.
    - Connect to `createComment` API.
- **Share**: Implement `Share.share()` from React Native.
- **Save**: Implement a visual toggle for the Bookmark icon. (Persisting to `AsyncStorage` or Context for "Saved Posts" view).

#### [MODIFY] [ProfileScreen.tsx](file:///Users/joshhd/Documents/node-social/app/src/screens/ProfileScreen.tsx)
- **Avatar**: Add an "Edit Avatar" button (using `expo-image-picker` if available, or a text input for URL as a fallback).

### 3. New Screens & Navigation

#### [NEW] [NotificationsScreen.tsx](file:///Users/joshhd/Documents/node-social/app/src/screens/NotificationsScreen.tsx)
- Create a simple list of mock or real notifications.

#### [NEW] [SavedPostsScreen.tsx](file:///Users/joshhd/Documents/node-social/app/src/screens/SavedPostsScreen.tsx)
- Create a screen to view saved posts (reading from the storage mechanism implemented above).

#### [MODIFY] [App.tsx](file:///Users/joshhd/Documents/node-social/app/App.tsx)
- **Navigation**: Add routing for `notifications` and `saved-posts` views.
- **Icons**: Wire up the Bell icon to the Notifications view.

### 4. Desktop Polish (New Request)

#### [MODIFY] Auth Screens (Login, Register, ForgotPassword, etc.)
- Wrap content in a centered container with max-width for desktop screens.
- Ensure proper spacing and layout on larger displays.

## Verification Plan

### Automated Tests
- None currently available.

### Manual Verification
1.  **Usernames**: Reload app and verify Post Cards show `SkipSupreme` instead of `joshhunterduvar`.
2.  **Timestamps**: Verify posts show correct relative time (e.g., "2h ago") instead of "Just now".
3.  **Polls**: Create a poll (or find one) and verify it renders options and allows voting.
4.  **Beta Nav**: Go to Beta screen -> Click "Exit" -> Verify return to Feed.
5.  **Comments**: Open a post -> Type comment -> Submit -> Verify it appears.
6.  **Share**: Click Share -> Verify system share sheet opens.
7.  **Save**: Click Save -> Go to Saved Posts (if implemented) -> Verify post is there.
8.  **Desktop Auth**: Resize window to desktop size -> Verify Login/Register screens are centered and look good.
