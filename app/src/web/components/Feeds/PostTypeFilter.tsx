// Phase 4.2 - Post Type Filter Component
// Filter feed by post type (text, image, video, link, poll)

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../../../constants/theme';

export type PostType = 'text' | 'image' | 'video' | 'link' | 'poll';

interface PostTypeFilterProps {
  selectedTypes: PostType[];
  onTypesChange: (types: PostType[]) => void;
  multiSelect?: boolean; // Allow multiple types (default: true)
}

const ALL_POST_TYPES: { type: PostType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: '📝' },
  { type: 'image', label: 'Images', icon: '🖼️' },
  { type: 'video', label: 'Videos', icon: '🎥' },
  { type: 'link', label: 'Links', icon: '🔗' },
  { type: 'poll', label: 'Polls', icon: '📊' },
];

export const PostTypeFilter: React.FC<PostTypeFilterProps> = ({
  selectedTypes,
  onTypesChange,
  multiSelect = true,
}) => {
  const isSelected = (type: PostType) => selectedTypes.includes(type);

  const handleToggle = (type: PostType) => {
    if (multiSelect) {
      if (isSelected(type)) {
        // Deselect
        onTypesChange(selectedTypes.filter((t) => t !== type));
      } else {
        // Select
        onTypesChange([...selectedTypes, type]);
      }
    } else {
      // Single select
      onTypesChange([type]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTypes.length === ALL_POST_TYPES.length) {
      onTypesChange([]); // Deselect all = show all types
    } else {
      onTypesChange(ALL_POST_TYPES.map((t) => t.type)); // Select all
    }
  };

  const showAll = selectedTypes.length === 0 || selectedTypes.length === ALL_POST_TYPES.length;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={[styles.filterButton, showAll && styles.filterButtonSelected]}
        onPress={handleSelectAll}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterButtonText, showAll && styles.filterButtonTextSelected]}>
          All
        </Text>
      </TouchableOpacity>

      {ALL_POST_TYPES.map(({ type, label, icon }) => {
        const selected = isSelected(type);
        return (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, selected && styles.filterButtonSelected]}
            onPress={() => handleToggle(type)}
            activeOpacity={0.7}
          >
            <Text style={styles.filterIcon}>{icon}</Text>
            <Text style={[styles.filterButtonText, selected && styles.filterButtonTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    gap: 4,
  },
  filterButtonSelected: {
    backgroundColor: `${COLORS.node.accent}20`,
    borderColor: COLORS.node.accent,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.node.muted,
  },
  filterButtonTextSelected: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
});

