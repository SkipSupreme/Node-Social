import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Search, ChevronDown, Menu, X } from './Icons';
import { useAppTheme } from '../../hooks/useTheme';
import { VibeValidatorSettings } from './VibeValidator';
import { getPresetDisplayName, PresetType } from './PresetBottomSheet';
import { NodeLogo } from './NodeLogo';

export type FeedSourceType = 'node' | 'bluesky' | 'mastodon' | 'mixed';

interface FeedHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;

  // Vibe Validator - now opens modal via callback
  algoSettings: VibeValidatorSettings;
  onVibeClick: () => void;

  // Feed source for mobile mixed feed
  feedSource?: FeedSourceType;
  onFeedSourceChange?: (source: FeedSourceType) => void;

  // Navigation actions
  onMenuClick?: () => void;

  // Layout
  isDesktop?: boolean;
}

// Get display name for feed source
const getFeedSourceDisplayName = (source: FeedSourceType): string => {
  switch (source) {
    case 'node': return 'Node';
    case 'bluesky': return 'Bluesky';
    case 'mastodon': return 'Mastodon';
    case 'mixed': return 'Mixed';
    default: return 'Mixed';
  }
};

// Get emoji/icon for feed source
const getFeedSourceIcon = (source: FeedSourceType): string => {
  switch (source) {
    case 'node': return '';
    case 'bluesky': return '🦋';
    case 'mastodon': return '🦣';
    case 'mixed': return '✨';
    default: return '✨';
  }
};

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  algoSettings,
  onVibeClick,
  feedSource = 'mixed',
  onFeedSourceChange,
  onMenuClick,
  isDesktop = false,
}) => {
  const theme = useAppTheme();
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const [showFeedSourceModal, setShowFeedSourceModal] = useState(false);
  const currentPresetName = getPresetDisplayName(algoSettings.preset as PresetType);

  // Display feed source name (preset is shown separately on the Vibe Validator button)
  const getButtonDisplayText = () => {
    return `${getFeedSourceIcon(feedSource)} ${getFeedSourceDisplayName(feedSource)}`;
  };

  // Handle feed source selection
  const handleSourceSelect = (source: FeedSourceType) => {
    onFeedSourceChange?.(source);
    setShowFeedSourceModal(false);
  };

  // Mobile Layout - Clean header, vibe validator opens as modal via onVibeClick
  if (!isDesktop) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        {!mobileSearchActive ? (
          <View style={styles.mobileHeaderRow}>
            {/* Left: Menu + Logo */}
            <View style={styles.mobileLeft}>
              <TouchableOpacity onPress={onMenuClick} style={styles.menuButton}>
                <Menu size={24} color={theme.text} />
              </TouchableOpacity>
              <NodeLogo size="small" showText={true} />
            </View>

            {/* Right: Search + Feed Source + Preset */}
            <View style={styles.mobileRight}>
              <TouchableOpacity
                onPress={() => setMobileSearchActive(true)}
                style={[styles.iconButton, { backgroundColor: theme.panel, borderColor: theme.border }]}
              >
                <Search size={20} color={theme.text} />
              </TouchableOpacity>

              {/* Feed Source Button */}
              <TouchableOpacity
                style={[styles.sourceButton, { backgroundColor: theme.panel, borderColor: theme.border }]}
                onPress={() => setShowFeedSourceModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sourceButtonText, { color: theme.text }]} numberOfLines={1}>
                  {getButtonDisplayText()}
                </Text>
                <ChevronDown size={14} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Vibe Validator Button - always accessible */}
              <TouchableOpacity
                style={[styles.presetButton, { backgroundColor: `${theme.accent}15`, borderColor: theme.accent }]}
                onPress={onVibeClick}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetButtonText, { color: theme.accent }]} numberOfLines={1}>
                  {currentPresetName}
                </Text>
                <ChevronDown size={14} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Mobile Search Active
          <View style={styles.mobileSearchRow}>
            <View style={[styles.searchInputWrapper, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <Search size={16} color={theme.muted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search posts, users, nodes..."
                placeholderTextColor={theme.muted}
                value={searchQuery}
                onChangeText={onSearchChange}
                onSubmitEditing={onSearch}
                autoFocus
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setMobileSearchActive(false);
                onSearchChange('');
              }}
              style={[styles.cancelButton, { backgroundColor: theme.panel, borderColor: theme.border }]}
            >
              <Text style={[styles.cancelButtonText, { color: theme.accent }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feed Source Selection Modal */}
        <Modal
          visible={showFeedSourceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFeedSourceModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowFeedSourceModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Feed</Text>
                <TouchableOpacity
                  onPress={() => setShowFeedSourceModal(false)}
                  style={styles.modalCloseButton}
                >
                  <X size={20} color={theme.muted} />
                </TouchableOpacity>
              </View>

              {/* Feed Source Options */}
              <View style={styles.sourceOptions}>
                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                    feedSource === 'mixed' && { borderColor: theme.accent, backgroundColor: `${theme.accent}10` },
                  ]}
                  onPress={() => handleSourceSelect('mixed')}
                >
                  <Text style={styles.sourceOptionIcon}>✨</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      { color: theme.text },
                      feedSource === 'mixed' && { color: theme.accent },
                    ]}>
                      Mixed Feed
                    </Text>
                    <Text style={[styles.sourceOptionDesc, { color: theme.muted }]}>
                      Node Social + Bluesky + Mastodon
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                    feedSource === 'node' && { borderColor: theme.accent, backgroundColor: `${theme.accent}10` },
                  ]}
                  onPress={() => handleSourceSelect('node')}
                >
                  <NodeLogo size="small" showText={false} />
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      { color: theme.text },
                      feedSource === 'node' && { color: theme.accent },
                    ]}>
                      Node Social Only
                    </Text>
                    <Text style={[styles.sourceOptionDesc, { color: theme.muted }]}>
                      Posts from your network
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                    feedSource === 'bluesky' && { borderColor: theme.accent, backgroundColor: `${theme.accent}10` },
                  ]}
                  onPress={() => handleSourceSelect('bluesky')}
                >
                  <Text style={styles.sourceOptionIcon}>🦋</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      { color: theme.text },
                      feedSource === 'bluesky' && { color: theme.accent },
                    ]}>
                      Bluesky
                    </Text>
                    <Text style={[styles.sourceOptionDesc, { color: theme.muted }]}>
                      Trending on Bluesky
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                    feedSource === 'mastodon' && { borderColor: theme.accent, backgroundColor: `${theme.accent}10` },
                  ]}
                  onPress={() => handleSourceSelect('mastodon')}
                >
                  <Text style={styles.sourceOptionIcon}>🦣</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      { color: theme.text },
                      feedSource === 'mastodon' && { color: theme.accent },
                    ]}>
                      Mastodon
                    </Text>
                    <Text style={[styles.sourceOptionDesc, { color: theme.muted }]}>
                      Trending on mastodon.social
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // Desktop layout is handled in App.tsx now
  return null;
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
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
  // Rectangular button style with rounded corners
  iconButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mobileSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Feed source button
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  sourceOptions: {
    gap: 8,
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceOptionIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  sourceOptionText: {
    flex: 1,
  },
  sourceOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  sourceOptionDesc: {
    fontSize: 12,
  },
});
