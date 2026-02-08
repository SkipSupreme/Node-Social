# Settings Screen Design

## Goal

Create a unified Settings hub accessible via a sidebar gear icon. Consolidates scattered settings (account linking, themes, profile editing, feed presets, muted words) into one discoverable location. Replaces the Themes icon in the sidebar.

## Decisions

- **Approach:** Settings hub with sections that navigate to sub-screens (option C)
- **Customization depth:** Theme + profile flair (option B) — themes, node themes, avatar/banner/bio/era editing
- **Access point:** Sidebar gear icon replacing the Palette/Themes icon (option A)
- **Vibe Validator:** Stays in-feed (per-column desktop, inline mobile). Settings only manages saved preset profiles.
- **Backend:** No new endpoints needed. All APIs already exist.

## Screen Structure

The Settings screen is a scrollable list of sections with tappable rows. Each row either navigates to a sub-screen or opens an inline form.

### Sections

| Section | Row | Action |
|---------|-----|--------|
| **Customization** | Your Theme | Navigate to ThemesScreen |
| | Theme Editor | Navigate to ThemeEditorScreen |
| | Edit Profile | Open EditProfileModal (avatar, banner, bio, era) |
| **Connected Accounts** | Bluesky | Status indicator + navigate to LinkedAccountsModal |
| | Mastodon | Status indicator + navigate to LinkedAccountsModal |
| **Feed Profiles** | [list of saved presets] | Tap to edit, swipe to delete, "+" to create |
| | Preset Marketplace | Navigate to PresetMarketplaceModal |
| **Content & Privacy** | Muted Words | Navigate to MutedWordsManager |
| | Blocked Users | Navigate to GovernanceScreen (Blocked tab) |
| **Account** | Change Email | Inline edit form |
| | Change Password | Inline form |
| | Sign Out | Confirmation then logout |
| | Delete Account | Danger zone, confirmation dialog |

## Implementation

### New files
- `app/src/screens/SettingsScreen.tsx` — The hub screen

### Reused as-is (navigated into)
- `ThemesScreen` — from Customization
- `ThemeEditorScreen` — from Customization
- `PresetMarketplaceModal` — from Feed Profiles
- `MutedWordsManager` — from Content & Privacy
- `GovernanceScreen` (Blocked tab) — from Content & Privacy

### Reused inline (re-mounted in Settings)
- `LinkedAccountsModal` — Bluesky/Mastodon connection UI
- `EditProfileModal` — Avatar/banner/bio editing

### Sidebar changes
- Replace Palette icon with Settings gear icon
- `onThemesClick` callback becomes `onSettingsClick`
- Remove linked accounts icon from ProfileHero

### Navigation changes
- Add `'settings'` to `currentView` state in App.tsx
- Render `SettingsScreen` when `currentView === 'settings'`

## Files to modify
1. `app/src/screens/SettingsScreen.tsx` (new)
2. `app/App.tsx` — add settings navigation, render SettingsScreen
3. `app/src/components/ui/Sidebar.tsx` — swap Palette for Settings gear
4. `app/src/components/profile/ProfileHero.tsx` — remove linked accounts icon
