// Search-bar-centric column header component
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Search, ChevronDown, Globe, Compass, Users, User, Bell, TrendingUp, Hash } from './Icons';
import { COLORS } from '../../constants/theme';
import { ColumnType } from '../../store/columns';

interface ColumnSearchBarProps {
  currentType: ColumnType;
  currentTitle: string;
  onTypeChange: (type: ColumnType, title: string, nodeId?: string) => void;
  onSearch: (query: string) => void;
  nodes: Array<{ id: string; name: string; color?: string; avatar?: string }>;
}

// Column type options
const columnTypeOptions: { type: ColumnType; title: string; icon: React.ComponentType<any> }[] = [
  { type: 'global', title: 'Global Feed', icon: Globe },
  { type: 'discovery', title: 'Discovery', icon: Compass },
  { type: 'following', title: 'Following', icon: Users },
  { type: 'trending', title: 'Trending', icon: TrendingUp },
  { type: 'notifications', title: 'Notifications', icon: Bell },
  { type: 'profile', title: 'My Profile', icon: User },
];

export const ColumnSearchBar: React.FC<ColumnSearchBarProps> = ({
  currentType,
  currentTitle,
  onTypeChange,
  onSearch,
  nodes,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    setIsDropdownOpen(true);
    setShowNodePicker(false);
  };

  const handleBackdropPress = () => {
    setIsDropdownOpen(false);
    setShowNodePicker(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleTypeSelect = (type: ColumnType, title: string) => {
    if (type === 'node') {
      setShowNodePicker(true);
    } else {
      onTypeChange(type, title);
      setIsDropdownOpen(false);
      setSearchQuery('');
      inputRef.current?.blur();
    }
  };

  const handleNodeSelect = (node: { id: string; name: string }) => {
    onTypeChange('node', node.name, node.id);
    setIsDropdownOpen(false);
    setShowNodePicker(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleSearchSubmit = () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      onSearch(trimmedQuery);
      setSearchQuery('');
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSearchOptionPress = () => {
    handleSearchSubmit();
  };

  const handleChangeText = (text: string) => {
    setSearchQuery(text);
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.inputContainer}>
        <Search size={16} color={COLORS.node.muted} testID="search-icon" />
        <TextInput
          ref={inputRef}
          testID="search-input"
          style={styles.input}
          placeholder={currentTitle}
          placeholderTextColor={COLORS.node.muted}
          value={searchQuery}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          accessibilityLabel={`Search or select column type. Currently: ${currentTitle}`}
        />
        <TouchableOpacity
          testID="dropdown-chevron"
          onPress={() => {
            if (isDropdownOpen) {
              handleBackdropPress();
            } else {
              handleFocus();
              inputRef.current?.focus();
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronDown
            size={14}
            color={COLORS.node.muted}
            style={isDropdownOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* Dropdown */}
      {isDropdownOpen && (
        <>
          <TouchableOpacity
            testID="dropdown-backdrop"
            style={styles.backdrop}
            onPress={handleBackdropPress}
            activeOpacity={1}
          />
          <View testID="column-dropdown" style={styles.dropdown}>
            <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
              {/* Search option - shown when typing */}
              {searchQuery.trim() && (
                <TouchableOpacity
                  testID="search-option"
                  style={styles.dropdownOption}
                  onPress={handleSearchOptionPress}
                >
                  <Search size={14} color={COLORS.node.accent} />
                  <Text style={styles.searchOptionText}>Search: {searchQuery}</Text>
                </TouchableOpacity>
              )}

              {/* Node picker view */}
              {showNodePicker ? (
                <View testID="node-picker">
                  <Text style={styles.sectionLabel}>Select Node</Text>
                  {nodes.map((node) => (
                    <TouchableOpacity
                      key={node.id}
                      style={styles.nodeOption}
                      onPress={() => handleNodeSelect(node)}
                    >
                      {node.avatar ? (
                        <Image source={{ uri: node.avatar }} style={styles.nodeAvatar} />
                      ) : (
                        <View style={[styles.nodeAvatarPlaceholder, { backgroundColor: node.color || COLORS.node.accent }]}>
                          <Text style={styles.nodeAvatarText}>{node.name[0]}</Text>
                        </View>
                      )}
                      <Text style={styles.nodeName}>{node.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  {/* Column type options */}
                  {columnTypeOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = currentType === option.type;
                    return (
                      <TouchableOpacity
                        key={option.type}
                        testID={`option-${option.type}`}
                        style={[styles.dropdownOption, isActive && styles.dropdownOptionActive]}
                        onPress={() => handleTypeSelect(option.type, option.title)}
                      >
                        <Icon size={14} color={isActive ? COLORS.node.accent : COLORS.node.text} />
                        <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                          {option.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Node Feed option */}
                  <TouchableOpacity
                    testID="option-node"
                    style={[styles.dropdownOption, currentType === 'node' && styles.dropdownOptionActive]}
                    onPress={() => handleTypeSelect('node', 'Node Feed')}
                  >
                    <Hash size={14} color={currentType === 'node' ? COLORS.node.accent : COLORS.node.text} />
                    <Text style={[styles.optionText, currentType === 'node' && styles.optionTextActive]}>
                      Node Feed
                    </Text>
                    <ChevronDown size={12} color={COLORS.node.muted} style={{ transform: [{ rotate: '-90deg' }], marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.node.text,
    padding: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 98,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: COLORS.node.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    zIndex: 99,
    maxHeight: 300,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  dropdownScroll: {
    padding: 6,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dropdownOptionActive: {
    backgroundColor: `${COLORS.node.accent}15`,
  },
  optionText: {
    fontSize: 13,
    color: COLORS.node.text,
  },
  optionTextActive: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
  searchOptionText: {
    fontSize: 13,
    color: COLORS.node.accent,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.node.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nodeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  nodeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  nodeAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  nodeName: {
    fontSize: 13,
    color: COLORS.node.text,
  },
});

export default ColumnSearchBar;
