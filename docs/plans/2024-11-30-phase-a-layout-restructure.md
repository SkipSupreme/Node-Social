# Phase A: Layout Restructure - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Vibe Validator from right sidebar to collapsible feed header, set up contextual right sidebar that shows different content based on what user is viewing.

**Architecture:**
- Create `FeedHeader` component that contains search input + collapsible Vibe Validator panel
- Modify `App.tsx` to use FeedHeader and conditionally render right sidebar content
- Create placeholder components for `NodeLandingPage` and `WhatsVibing` (full implementation in later phases)

**Tech Stack:** React Native, Expo, TypeScript, existing COLORS theme system

**Reference Design:** See `docs/plans/2024-11-30-node-community-system-design.md` for visual layouts

---

## Task 1: Create FeedHeader Component (Desktop Version)

**Files:**
- Create: `app/src/components/ui/FeedHeader.tsx`

**Step 1: Create the basic FeedHeader component with search and collapsed state**

Create `app/src/components/ui/FeedHeader.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Search, ChevronDown, ChevronUp, MessageSquare, Bell } from './Icons';
import { COLORS } from '../../constants/theme';
import { VibeValidator, VibeValidatorSettings } from './VibeValidator';
import { getPresetDisplayName, PresetType } from './PresetBottomSheet';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FeedHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;

  // Vibe Validator
  algoSettings: VibeValidatorSettings;
  onAlgoSettingsChange: (settings: VibeValidatorSettings) => void;

  // Navigation actions (desktop only)
  onMessagesClick?: () => void;
  onNotificationsClick?: () => void;

  // Layout
  isDesktop?: boolean;
}

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  algoSettings,
  onAlgoSettingsChange,
  onMessagesClick,
  onNotificationsClick,
  isDesktop = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const currentPresetName = getPresetDisplayName(algoSettings.preset as PresetType);

  return (
    <View style={styles.container}>
      {/* Main Header Row */}
      <View style={styles.headerRow}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Search size={16} color={COLORS.node.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hashtags, users, nodes..."
            placeholderTextColor={COLORS.node.muted}
            value={searchQuery}
            onChangeText={onSearchChange}
            onSubmitEditing={onSearch}
          />
        </View>

        {/* Preset Button */}
        <TouchableOpacity
          style={styles.presetButton}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <Text style={styles.presetButtonText}>{currentPresetName}</Text>
          {isExpanded ? (
            <ChevronUp size={16} color={COLORS.node.accent} />
          ) : (
            <ChevronDown size={16} color={COLORS.node.accent} />
          )}
        </TouchableOpacity>

        {/* Desktop Nav Icons */}
        {isDesktop && (
          <View style={styles.navIcons}>
            <TouchableOpacity onPress={onMessagesClick} style={styles.navIcon}>
              <MessageSquare size={24} color={COLORS.node.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onNotificationsClick} style={styles.navIcon}>
              <Bell size={24} color={COLORS.node.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Expandable Vibe Validator Panel */}
      {isExpanded && (
        <View style={styles.validatorPanel}>
          <VibeValidator
            settings={algoSettings}
            onUpdate={onAlgoSettingsChange}
          />
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={toggleExpanded}
          >
            <ChevronUp size={16} color={COLORS.node.muted} />
            <Text style={styles.collapseButtonText}>Collapse</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.node.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: COLORS.node.text,
    fontSize: 14,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${COLORS.node.accent}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  presetButtonText: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  navIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 8,
  },
  navIcon: {
    padding: 4,
  },
  validatorPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    maxHeight: 500,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    backgroundColor: COLORS.node.panel,
  },
  collapseButtonText: {
    color: COLORS.node.muted,
    fontSize: 13,
    fontWeight: '500',
  },
});
```

**Step 2: Verify the file was created correctly**

Run: `ls -la app/src/components/ui/FeedHeader.tsx`

Expected: File exists with proper permissions

**Step 3: Commit this task**

```bash
git add app/src/components/ui/FeedHeader.tsx
git commit -m "feat: create FeedHeader component with collapsible Vibe Validator

- Search input always visible
- Preset button shows current algorithm mode
- Click to expand full Vibe Validator panel
- Desktop nav icons (messages, notifications)
- LayoutAnimation for smooth expand/collapse"
```

---

## Task 2: Create Placeholder Components for Right Sidebar

**Files:**
- Create: `app/src/components/ui/WhatsVibing.tsx`
- Create: `app/src/components/ui/NodeLandingPage.tsx`

**Step 1: Create WhatsVibing placeholder component**

Create `app/src/components/ui/WhatsVibing.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, Zap, Users } from './Icons';
import { COLORS } from '../../constants/theme';

interface WhatsVibingProps {
  onNodeClick?: (nodeId: string) => void;
}

export const WhatsVibing: React.FC<WhatsVibingProps> = ({ onNodeClick }) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TrendingUp size={20} color={COLORS.node.accent} />
        <Text style={styles.headerTitle}>What's Vibing</Text>
      </View>

      {/* Velocity Spikes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Zap size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Velocity Spikes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Vibes accelerating now</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Real-time vibe velocity tracking
          </Text>
        </View>
      </View>

      {/* Rising Nodes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Rising Nodes</Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Fastest growing communities
          </Text>
        </View>
      </View>

      {/* Discover Nodes Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Discover Nodes</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Based on your vibes</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Personalized node recommendations
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginBottom: 12,
  },
  placeholder: {
    padding: 20,
    backgroundColor: COLORS.node.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.node.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
```

**Step 2: Create NodeLandingPage placeholder component**

Create `app/src/components/ui/NodeLandingPage.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Users, Calendar, TrendingUp, BookOpen, Crown, FileText } from './Icons';
import { COLORS } from '../../constants/theme';

interface NodeLandingPageProps {
  nodeId: string;
  onJoin?: () => void;
  onLeave?: () => void;
  onMute?: () => void;
  onMessageCouncil?: () => void;
}

export const NodeLandingPage: React.FC<NodeLandingPageProps> = ({
  nodeId,
  onJoin,
  onLeave,
  onMute,
  onMessageCouncil,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Banner Placeholder */}
      <View style={styles.bannerPlaceholder}>
        <Text style={styles.bannerPlaceholderText}>Node Banner</Text>
      </View>

      {/* Avatar + Basic Info */}
      <View style={styles.infoSection}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>N</Text>
        </View>

        <Text style={styles.nodeName}>n/{nodeId.substring(0, 8)}...</Text>
        <Text style={styles.nodeDescription}>Node description will appear here</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Users size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>-- members</Text>
          </View>
          <View style={styles.stat}>
            <Calendar size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>Est. --</Text>
          </View>
          <View style={styles.stat}>
            <TrendingUp size={14} color={COLORS.node.muted} />
            <Text style={styles.statText}>+-- this week</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinButtonText}>Join Node</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuButtonText}>•••</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rules Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <BookOpen size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Rules</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Community rules
          </Text>
        </View>
      </View>

      {/* Council Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Crown size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Node Council</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Moderator list
          </Text>
        </View>
        <TouchableOpacity style={styles.messageCouncilButton} onPress={onMessageCouncil}>
          <Text style={styles.messageCouncilText}>Message Council</Text>
        </TouchableOpacity>
      </View>

      {/* Mod Log Section - Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={COLORS.node.accent} />
          <Text style={styles.sectionTitle}>Recent Mod Actions</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Coming soon: Moderation transparency log
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  bannerPlaceholder: {
    height: 100,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -32,
    borderWidth: 3,
    borderColor: COLORS.node.panel,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  nodeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
    marginTop: 12,
  },
  nodeDescription: {
    fontSize: 14,
    color: COLORS.node.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  joinButton: {
    flex: 1,
    backgroundColor: COLORS.node.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  menuButtonText: {
    color: COLORS.node.text,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  placeholder: {
    padding: 16,
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.node.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  messageCouncilButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    alignItems: 'center',
  },
  messageCouncilText: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
```

**Step 3: Verify both files exist**

Run: `ls -la app/src/components/ui/WhatsVibing.tsx app/src/components/ui/NodeLandingPage.tsx`

Expected: Both files exist

**Step 4: Commit this task**

```bash
git add app/src/components/ui/WhatsVibing.tsx app/src/components/ui/NodeLandingPage.tsx
git commit -m "feat: create placeholder components for contextual right sidebar

- WhatsVibing: placeholder for global view (velocity spikes, rising nodes, discover)
- NodeLandingPage: placeholder for node view (banner, stats, rules, council, mod log)
- Both have proper structure ready for Phase B/C implementation"
```

---

## Task 3: Update App.tsx - Add Mobile FeedHeader Support

The FeedHeader needs to handle mobile differently. We need to update it to support the mobile layout with menu button and logo.

**Files:**
- Modify: `app/src/components/ui/FeedHeader.tsx`

**Step 1: Update FeedHeader to support mobile layout**

Replace the entire `app/src/components/ui/FeedHeader.tsx` with this updated version that handles mobile:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Search, ChevronDown, ChevronUp, MessageSquare, Bell, Menu, X } from './Icons';
import { COLORS } from '../../constants/theme';
import { VibeValidator, VibeValidatorSettings } from './VibeValidator';
import { getPresetDisplayName, PresetType } from './PresetBottomSheet';
import { NodeLogo } from './NodeLogo';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FeedHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;

  // Vibe Validator
  algoSettings: VibeValidatorSettings;
  onAlgoSettingsChange: (settings: VibeValidatorSettings) => void;

  // Navigation actions
  onMessagesClick?: () => void;
  onNotificationsClick?: () => void;
  onMenuClick?: () => void;

  // Layout
  isDesktop?: boolean;
}

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  algoSettings,
  onAlgoSettingsChange,
  onMessagesClick,
  onNotificationsClick,
  onMenuClick,
  isDesktop = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const currentPresetName = getPresetDisplayName(algoSettings.preset as PresetType);

  // Mobile Layout
  if (!isDesktop) {
    return (
      <View style={styles.container}>
        {/* Mobile Header Row */}
        {!mobileSearchActive ? (
          <View style={styles.mobileHeaderRow}>
            {/* Left: Menu + Logo */}
            <View style={styles.mobileLeft}>
              <TouchableOpacity onPress={onMenuClick} style={styles.menuButton}>
                <Menu size={24} color={COLORS.node.text} />
              </TouchableOpacity>
              <NodeLogo size="small" showText={true} />
            </View>

            {/* Right: Search Icon + Preset Button */}
            <View style={styles.mobileRight}>
              <TouchableOpacity
                onPress={() => setMobileSearchActive(true)}
                style={styles.mobileIconButton}
              >
                <Search size={20} color={COLORS.node.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButtonMobile}
                onPress={toggleExpanded}
                activeOpacity={0.7}
              >
                <Text style={styles.presetButtonText} numberOfLines={1}>
                  {currentPresetName}
                </Text>
                {isExpanded ? (
                  <ChevronUp size={14} color={COLORS.node.accent} />
                ) : (
                  <ChevronDown size={14} color={COLORS.node.accent} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Mobile Search Active
          <View style={styles.mobileSearchRow}>
            <View style={styles.mobileSearchInputWrapper}>
              <Search size={16} color={COLORS.node.muted} />
              <TextInput
                style={styles.mobileSearchInput}
                placeholder="Search posts, users, nodes..."
                placeholderTextColor={COLORS.node.muted}
                value={searchQuery}
                onChangeText={onSearchChange}
                onSubmitEditing={onSearch}
                autoFocus
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setMobileSearchActive(false);
                onSearchChange('');
              }}
              style={styles.mobileSearchCancel}
            >
              <Text style={styles.mobileSearchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expandable Vibe Validator Panel (Mobile) */}
        {isExpanded && (
          <View style={styles.validatorPanel}>
            <VibeValidator
              settings={algoSettings}
              onUpdate={onAlgoSettingsChange}
            />
            <TouchableOpacity
              style={styles.collapseButton}
              onPress={toggleExpanded}
            >
              <ChevronUp size={16} color={COLORS.node.muted} />
              <Text style={styles.collapseButtonText}>Collapse</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Desktop Layout
  return (
    <View style={styles.container}>
      {/* Desktop Header Row */}
      <View style={styles.headerRow}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Search size={16} color={COLORS.node.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hashtags, users, nodes..."
            placeholderTextColor={COLORS.node.muted}
            value={searchQuery}
            onChangeText={onSearchChange}
            onSubmitEditing={onSearch}
          />
        </View>

        {/* Preset Button */}
        <TouchableOpacity
          style={styles.presetButton}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <Text style={styles.presetButtonText}>{currentPresetName}</Text>
          {isExpanded ? (
            <ChevronUp size={16} color={COLORS.node.accent} />
          ) : (
            <ChevronDown size={16} color={COLORS.node.accent} />
          )}
        </TouchableOpacity>

        {/* Desktop Nav Icons */}
        <View style={styles.navIcons}>
          <TouchableOpacity onPress={onMessagesClick} style={styles.navIcon}>
            <MessageSquare size={24} color={COLORS.node.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNotificationsClick} style={styles.navIcon}>
            <Bell size={24} color={COLORS.node.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Vibe Validator Panel */}
      {isExpanded && (
        <View style={styles.validatorPanel}>
          <VibeValidator
            settings={algoSettings}
            onUpdate={onAlgoSettingsChange}
          />
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={toggleExpanded}
          >
            <ChevronUp size={16} color={COLORS.node.muted} />
            <Text style={styles.collapseButtonText}>Collapse</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.node.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  // Desktop Styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: COLORS.node.text,
    fontSize: 14,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: `${COLORS.node.accent}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  presetButtonText: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  navIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 8,
  },
  navIcon: {
    padding: 4,
  },
  // Mobile Styles
  mobileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mobileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 4,
  },
  mobileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  presetButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.node.accent}20`,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  mobileSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  mobileSearchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  mobileSearchInput: {
    flex: 1,
    color: COLORS.node.text,
    fontSize: 14,
  },
  mobileSearchCancel: {
    padding: 8,
  },
  mobileSearchCancelText: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  // Validator Panel (shared)
  validatorPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    maxHeight: 500,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    backgroundColor: COLORS.node.panel,
  },
  collapseButtonText: {
    color: COLORS.node.muted,
    fontSize: 13,
    fontWeight: '500',
  },
});
```

**Step 2: Verify the update**

Run: `head -50 app/src/components/ui/FeedHeader.tsx`

Expected: See the updated imports including NodeLogo

**Step 3: Commit this task**

```bash
git add app/src/components/ui/FeedHeader.tsx
git commit -m "feat: add mobile layout support to FeedHeader

- Mobile: menu button + logo on left, search icon + preset button on right
- Mobile search expands to full input when activated
- Consistent Vibe Validator expand/collapse on both layouts
- Reuses existing mobile patterns from App.tsx"
```

---

## Task 4: Integrate FeedHeader into App.tsx

Now we wire up the FeedHeader component and contextual right sidebar in App.tsx.

**Files:**
- Modify: `app/App.tsx`

**Step 1: Add imports for new components**

At the top of `app/App.tsx`, after the existing imports (around line 30), add:

```typescript
import { FeedHeader } from './src/components/ui/FeedHeader';
import { WhatsVibing } from './src/components/ui/WhatsVibing';
import { NodeLandingPage } from './src/components/ui/NodeLandingPage';
```

**Step 2: Replace the header section in App.tsx**

Find the `{/* Header - Full Width */}` section (around line 525-618) and replace the entire `<Animated.View>` block with the FeedHeader component.

Locate this code block:
```typescript
          {/* Header - Full Width (absolute on mobile, content scrolls underneath) */}
          <Animated.View style={[
            styles.header,
            !isDesktop && styles.mobileHeader,
            !isDesktop && { transform: [{ translateY: headerTranslateY }] }
          ]}>
```

And replace EVERYTHING from that `<Animated.View>` opening tag through its closing `</Animated.View>` (around line 618) with:

```typescript
          {/* Header - FeedHeader with collapsible Vibe Validator */}
          <Animated.View style={[
            !isDesktop && styles.mobileHeader,
            !isDesktop && { transform: [{ translateY: headerTranslateY }] }
          ]}>
            <FeedHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearch={handleSearch}
              algoSettings={algoSettings}
              onAlgoSettingsChange={setAlgoSettings}
              onMessagesClick={() => setCurrentView('messages')}
              onNotificationsClick={() => setCurrentView('notifications')}
              onMenuClick={() => setMenuVisible(true)}
              isDesktop={isDesktop}
            />
          </Animated.View>
```

**Step 3: Replace the right sidebar content**

Find the right sidebar section (around line 709-713):
```typescript
        {/* Desktop Right Panel */}
        {isDesktop && rightPanelOpen && (
          <View style={styles.drawerRight}>
            <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
          </View>
        )}
```

Replace it with the contextual sidebar:

```typescript
        {/* Desktop Right Panel - Contextual Content */}
        {isDesktop && rightPanelOpen && (
          <View style={styles.drawerRight}>
            {selectedNodeId ? (
              <NodeLandingPage
                nodeId={selectedNodeId}
                onJoin={() => console.log('Join node:', selectedNodeId)}
                onLeave={() => {
                  setSelectedNodeId(null);
                  setFeedMode('global');
                  fetchFeed(null, 'global', selectedPostTypes);
                }}
                onMute={() => console.log('Mute node:', selectedNodeId)}
                onMessageCouncil={() => console.log('Message council:', selectedNodeId)}
              />
            ) : (
              <WhatsVibing onNodeClick={handleNodeSelect} />
            )}
          </View>
        )}
```

**Step 4: Remove the duplicate mobile Vibe Validator modal**

Find and REMOVE this entire block (around line 797-812) since the FeedHeader now handles Vibe Validator:

```typescript
      {/* Mobile Vibe Validator Modal */}
      {!isDesktop && (
        <Modal visible={vibeVisible} animationType="slide" transparent>
          <View style={styles.vibeModalOverlay}>
            <View style={styles.vibeModalContent}>
              <TouchableOpacity
                onPress={() => setVibeVisible(false)}
                style={styles.vibeModalClose}
              >
                <X size={24} color={COLORS.node.text} />
              </TouchableOpacity>
              <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
            </View>
          </View>
        </Modal>
      )}
```

**Step 5: Clean up unused state and styles**

Remove the `vibeVisible` state and related code:
- Find `const [vibeVisible, setVibeVisible] = useState(false);` (around line 54) and remove it
- The `vibeModalOverlay`, `vibeModalContent`, `vibeModalClose` styles can stay (no harm) or be removed

**Step 6: Verify App.tsx compiles**

Run: `cd /Users/joshhd/Documents/node-social/app && npx tsc --noEmit`

Expected: No TypeScript errors (or only pre-existing ones)

**Step 7: Commit this task**

```bash
git add app/App.tsx
git commit -m "feat: integrate FeedHeader and contextual right sidebar

- Replace old header with FeedHeader component
- Right sidebar now shows WhatsVibing (global) or NodeLandingPage (node selected)
- Remove old mobile Vibe Validator modal (now in FeedHeader)
- Vibe Validator is now collapsible in feed header on all devices"
```

---

## Task 5: Remove Right Panel Toggle Button (Desktop)

Since the right panel now shows contextual content (not just Vibe Validator), we should keep it always visible on desktop and remove the toggle button.

**Files:**
- Modify: `app/App.tsx`

**Step 1: Remove the PanelRight toggle button from FeedHeader nav icons**

The FeedHeader component doesn't have the PanelRight toggle. But we need to make sure `rightPanelOpen` is always true on desktop, or remove the state entirely.

In `app/App.tsx`, find:
```typescript
const [rightPanelOpen, setRightPanelOpen] = useState(true);
```

This is fine as-is since it defaults to `true`. But let's remove the ability to toggle it from the old header (which we already removed).

**Step 2: Verify right panel is always open on desktop**

The right sidebar condition is:
```typescript
{isDesktop && rightPanelOpen && (
```

Since we removed the toggle button in Task 4, `rightPanelOpen` will always be true. This is correct behavior.

**Step 3: Optional cleanup - remove rightPanelOpen state if not needed elsewhere**

Search for `rightPanelOpen` usage. If it's only used for the right sidebar condition and we want it always visible, we can simplify. However, keeping the state allows us to add a toggle back later if needed.

For now, leave it as-is. No code changes needed.

**Step 4: Commit (documentation only)**

```bash
git commit --allow-empty -m "docs: right panel now always visible on desktop

- Removed toggle button (was in old header, now removed)
- rightPanelOpen state kept for potential future use
- Right sidebar shows contextual content based on selection"
```

---

## Task 6: Test the Layout Changes

**Step 1: Start the development server**

Run: `cd /Users/joshhd/Documents/node-social/app && npm start`

**Step 2: Test desktop layout in browser**

- Open in browser (press `w` in Expo)
- Verify: FeedHeader shows search input + preset button + messages/notifications icons
- Verify: Clicking preset button expands Vibe Validator inline
- Verify: Right sidebar shows "What's Vibing" when no node selected
- Verify: Clicking a node in left sidebar shows NodeLandingPage in right sidebar

**Step 3: Test mobile layout**

- Resize browser to mobile width (< 1024px)
- Verify: FeedHeader shows menu + logo on left, search icon + preset button on right
- Verify: Clicking search icon expands search input
- Verify: Clicking preset button expands Vibe Validator inline

**Step 4: Fix any issues found during testing**

Document any issues and fix them before proceeding.

**Step 5: Commit test results**

```bash
git commit --allow-empty -m "test: verify Phase A layout changes work correctly

- Desktop: FeedHeader with collapsible Vibe Validator ✓
- Desktop: Contextual right sidebar (WhatsVibing/NodeLandingPage) ✓
- Mobile: Menu + logo + search + preset button ✓
- Mobile: Collapsible Vibe Validator ✓"
```

---

## Task 7: Final Cleanup and Documentation

**Step 1: Remove unused imports from App.tsx**

Check if any imports are now unused after removing the old header code:
- `PanelRight` - may be unused now, remove if so
- Any other unused imports

**Step 2: Update any comments**

Make sure comments in App.tsx reflect the new structure.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: cleanup unused code after Phase A layout restructure

- Remove unused imports
- Update comments to reflect new architecture
- Phase A complete: Layout restructured for node community system"
```

---

## Summary

Phase A is complete when:

1. ✅ `FeedHeader` component created with:
   - Search input (always visible on desktop, expandable on mobile)
   - Preset button that expands Vibe Validator inline
   - Desktop nav icons (messages, notifications)
   - Mobile menu button + logo

2. ✅ `WhatsVibing` placeholder component created

3. ✅ `NodeLandingPage` placeholder component created

4. ✅ `App.tsx` updated to:
   - Use FeedHeader instead of old header
   - Show contextual right sidebar (WhatsVibing vs NodeLandingPage)
   - Remove old mobile Vibe Validator modal

5. ✅ All changes tested on desktop and mobile layouts

---

## Next Steps

After Phase A is complete, proceed to:
- **Phase B**: Node identity (avatar, banner, rules) - database + backend + UI
- **Phase C**: What's Vibing (trending/discovery endpoints + real UI)
- **Phase D**: Node management (join/leave/mute, mod log)

See `docs/plans/2024-11-30-node-community-system-design.md` for full details.
