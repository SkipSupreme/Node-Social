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
