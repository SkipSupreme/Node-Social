import React, { ComponentType } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Clock, Scale, Flame, Users, Sparkles, Settings, Check, X } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

export type PresetType = 'latest' | 'balanced' | 'trending' | 'expert' | 'network' | 'custom';

interface PresetOption {
  id: PresetType;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  weights: { quality: number; recency: number; engagement: number; personalization: number };
}

const PRESETS: PresetOption[] = [
  {
    id: 'latest',
    name: 'Latest First',
    description: 'Newest posts at the top',
    icon: Clock,
    weights: { quality: 10, recency: 70, engagement: 10, personalization: 10 },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Mix of quality, fresh, and engaging',
    icon: Scale,
    weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
  },
  {
    id: 'trending',
    name: "What's Hot",
    description: 'Most engaging content right now',
    icon: Flame,
    weights: { quality: 20, recency: 25, engagement: 45, personalization: 10 },
  },
  {
    id: 'expert',
    name: 'Expert Voices',
    description: 'High-cred contributors only',
    icon: Sparkles,
    weights: { quality: 60, recency: 15, engagement: 15, personalization: 10 },
  },
  {
    id: 'network',
    name: 'My Network',
    description: 'People you follow and trust',
    icon: Users,
    weights: { quality: 20, recency: 20, engagement: 10, personalization: 50 },
  },
];

interface PresetBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  currentPreset: PresetType;
  onSelectPreset: (preset: PresetType, weights: { quality: number; recency: number; engagement: number; personalization: number }) => void;
  onOpenAdvanced: () => void;
}

export const PresetBottomSheet: React.FC<PresetBottomSheetProps> = ({
  visible,
  onClose,
  currentPreset,
  onSelectPreset,
  onOpenAdvanced,
}) => {
  const handleSelect = (preset: PresetOption) => {
    onSelectPreset(preset.id, preset.weights);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Feed Algorithm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Choose how your feed is sorted</Text>

          {/* Preset Options */}
          <View style={styles.presetList}>
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = currentPreset === preset.id;

              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetItem, isSelected && styles.presetItemSelected]}
                  onPress={() => handleSelect(preset)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.presetIcon, isSelected && styles.presetIconSelected]}>
                    <Icon size={20} color={isSelected ? '#fff' : COLORS.node.accent} />
                  </View>
                  <View style={styles.presetContent}>
                    <Text style={[styles.presetName, isSelected && styles.presetNameSelected]}>
                      {preset.name}
                    </Text>
                    <Text style={styles.presetDescription}>{preset.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkMark}>
                      <Check size={16} color={COLORS.node.accent} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Advanced Settings Button */}
          <TouchableOpacity
            style={styles.advancedButton}
            onPress={() => {
              onClose();
              onOpenAdvanced();
            }}
            activeOpacity={0.7}
          >
            <Settings size={18} color={COLORS.node.accent} />
            <Text style={styles.advancedText}>Advanced Settings</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Get display name for a preset
export const getPresetDisplayName = (preset: PresetType): string => {
  const found = PRESETS.find((p) => p.id === preset);
  return found?.name || 'Custom';
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.node.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.node.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.node.muted,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  presetList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.node.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  presetItemSelected: {
    borderColor: COLORS.node.accent,
    backgroundColor: `${COLORS.node.accent}15`,
  },
  presetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.node.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  presetIconSelected: {
    backgroundColor: COLORS.node.accent,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
    marginBottom: 2,
  },
  presetNameSelected: {
    color: COLORS.node.accent,
  },
  presetDescription: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  checkMark: {
    marginLeft: 8,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  advancedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.accent,
  },
});
