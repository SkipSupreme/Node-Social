// Modal wrapper for VibeValidator - used for per-column settings
import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { COLORS } from '../../constants/theme';
import { VibeValidator, VibeValidatorSettings } from './VibeValidator';
import { ColumnVibeSettings } from '../../store/columns';

interface VibeValidatorModalProps {
  visible: boolean;
  settings: ColumnVibeSettings;
  onUpdate: (settings: ColumnVibeSettings) => void;
  onClose: () => void;
  columnTitle?: string;
}

// Convert ColumnVibeSettings to VibeValidatorSettings
const toVibeValidatorSettings = (settings: ColumnVibeSettings): VibeValidatorSettings => ({
  preset: settings.preset,
  weights: settings.weights,
  mode: settings.mode,
  intermediate: settings.intermediate,
  advanced: settings.advanced as any,
  expert: settings.expert as any,
});

// Convert VibeValidatorSettings to ColumnVibeSettings
const toColumnVibeSettings = (settings: VibeValidatorSettings): ColumnVibeSettings => ({
  preset: settings.preset,
  weights: settings.weights,
  mode: settings.mode,
  intermediate: settings.intermediate,
  advanced: settings.advanced as Record<string, unknown> | undefined,
  expert: settings.expert as any,
});

export const VibeValidatorModal: React.FC<VibeValidatorModalProps> = ({
  visible,
  settings,
  onUpdate,
  onClose,
  columnTitle,
}) => {
  if (!visible) {
    return null;
  }

  const handleUpdate = (newSettings: VibeValidatorSettings) => {
    onUpdate(toColumnVibeSettings(newSettings));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        testID="vibe-validator-modal"
        style={styles.container}
        accessibilityRole="none"
        accessibilityLabel="Vibe settings dialog"
      >
        {/* Backdrop */}
        <TouchableOpacity
          testID="modal-backdrop"
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        />

        {/* Modal Content */}
        <Pressable>
          <View testID="modal-content" style={styles.content}>
            {/* Column title header */}
            {columnTitle && (
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>Settings for: {columnTitle}</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              testID="close-button"
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>

            {/* VibeValidator */}
            <VibeValidator
              settings={toVibeValidatorSettings(settings)}
              onUpdate={handleUpdate}
            />
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  columnHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.node.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.node.text,
    lineHeight: 24,
  },
});

export default VibeValidatorModal;
