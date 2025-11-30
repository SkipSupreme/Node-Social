import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Search, ChevronDown, Menu } from './Icons';
import { COLORS } from '../../constants/theme';
import { VibeValidatorSettings } from './VibeValidator';
import { getPresetDisplayName, PresetType } from './PresetBottomSheet';
import { NodeLogo } from './NodeLogo';

interface FeedHeaderProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;

  // Vibe Validator - now opens modal via callback
  algoSettings: VibeValidatorSettings;
  onVibeClick: () => void;

  // Navigation actions
  onMenuClick?: () => void;

  // Layout
  isDesktop?: boolean;
}

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  algoSettings,
  onVibeClick,
  onMenuClick,
  isDesktop = false,
}) => {
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const currentPresetName = getPresetDisplayName(algoSettings.preset as PresetType);

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

            {/* Right: Search Icon + Preset Button */}
            <View style={styles.mobileRight}>
              <TouchableOpacity
                onPress={() => setMobileSearchActive(true)}
                style={styles.iconButton}
              >
                <Search size={20} color={COLORS.node.text} />
              </TouchableOpacity>
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
});
