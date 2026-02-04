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
import { COLORS } from '../../constants/theme';
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
      <View style={styles.container}>
        {!mobileSearchActive ? (
          <View style={styles.mobileHeaderRow}>
            {/* Left: Menu + Logo */}
            <View style={styles.mobileLeft}>
              <TouchableOpacity onPress={onMenuClick} style={styles.menuButton}>
                <Menu size={24} color={COLORS.node.text} />
              </TouchableOpacity>
              <NodeLogo size="small" showText={true} />
            </View>

            {/* Right: Search + Feed Source + Preset */}
            <View style={styles.mobileRight}>
              <TouchableOpacity
                onPress={() => setMobileSearchActive(true)}
                style={styles.iconButton}
              >
                <Search size={20} color={COLORS.node.text} />
              </TouchableOpacity>

              {/* Feed Source Button */}
              <TouchableOpacity
                style={styles.sourceButton}
                onPress={() => setShowFeedSourceModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.sourceButtonText} numberOfLines={1}>
                  {getButtonDisplayText()}
                </Text>
                <ChevronDown size={14} color={COLORS.node.textSecondary} />
              </TouchableOpacity>

              {/* Vibe Validator Button - always accessible */}
              <TouchableOpacity
                style={styles.presetButton}
                onPress={onVibeClick}
                activeOpacity={0.7}
              >
                <Text style={styles.presetButtonText} numberOfLines={1}>
                  {currentPresetName}
                </Text>
                <ChevronDown size={14} color={COLORS.node.accent} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Mobile Search Active
          <View style={styles.mobileSearchRow}>
            <View style={styles.searchInputWrapper}>
              <Search size={16} color={COLORS.node.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search posts, users, nodes..."
                placeholderTextColor={COLORS.node.muted}
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
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Feed</Text>
                <TouchableOpacity
                  onPress={() => setShowFeedSourceModal(false)}
                  style={styles.modalCloseButton}
                >
                  <X size={20} color={COLORS.node.muted} />
                </TouchableOpacity>
              </View>

              {/* Feed Source Options */}
              <View style={styles.sourceOptions}>
                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    feedSource === 'mixed' && styles.sourceOptionActive,
                  ]}
                  onPress={() => handleSourceSelect('mixed')}
                >
                  <Text style={styles.sourceOptionIcon}>✨</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      feedSource === 'mixed' && styles.sourceOptionTitleActive,
                    ]}>
                      Mixed Feed
                    </Text>
                    <Text style={styles.sourceOptionDesc}>
                      Node Social + Bluesky + Mastodon
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    feedSource === 'node' && styles.sourceOptionActive,
                  ]}
                  onPress={() => handleSourceSelect('node')}
                >
                  <NodeLogo size="small" showText={false} />
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      feedSource === 'node' && styles.sourceOptionTitleActive,
                    ]}>
                      Node Social Only
                    </Text>
                    <Text style={styles.sourceOptionDesc}>
                      Posts from your network
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    feedSource === 'bluesky' && styles.sourceOptionActive,
                  ]}
                  onPress={() => handleSourceSelect('bluesky')}
                >
                  <Text style={styles.sourceOptionIcon}>🦋</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      feedSource === 'bluesky' && styles.sourceOptionTitleActive,
                    ]}>
                      Bluesky
                    </Text>
                    <Text style={styles.sourceOptionDesc}>
                      Trending on Bluesky
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sourceOption,
                    feedSource === 'mastodon' && styles.sourceOptionActive,
                  ]}
                  onPress={() => handleSourceSelect('mastodon')}
                >
                  <Text style={styles.sourceOptionIcon}>🦣</Text>
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      feedSource === 'mastodon' && styles.sourceOptionTitleActive,
                    ]}>
                      Mastodon
                    </Text>
                    <Text style={styles.sourceOptionDesc}>
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
    backgroundColor: COLORS.node.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
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
    backgroundColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.node.accent}15`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  presetButtonText: {
    color: COLORS.node.accent,
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.node.text,
    fontSize: 14,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.node.panel,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  cancelButtonText: {
    color: COLORS.node.accent,
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  sourceButtonText: {
    color: COLORS.node.text,
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.node.border,
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
    color: COLORS.node.text,
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
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  sourceOptionActive: {
    borderColor: COLORS.node.accent,
    backgroundColor: `${COLORS.node.accent}10`,
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
    color: COLORS.node.text,
    marginBottom: 2,
  },
  sourceOptionTitleActive: {
    color: COLORS.node.accent,
  },
  sourceOptionDesc: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  hintBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: `${COLORS.node.accent}10`,
    borderRadius: 8,
  },
  hintText: {
    fontSize: 13,
    color: COLORS.node.textSecondary,
    textAlign: 'center',
  },
});
