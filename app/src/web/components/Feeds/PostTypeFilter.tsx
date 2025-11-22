// Phase 4.2 - Post Type Filter Component
// Filter feed by post type (text, image, video, link)

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export type PostType = 'text' | 'image' | 'video' | 'link';

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
    <View style={styles.container}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  filterButtonSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  filterIcon: {
    fontSize: 14,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  filterButtonTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
});

