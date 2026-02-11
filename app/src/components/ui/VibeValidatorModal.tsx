// Modal wrapper for VibeValidator - used for per-column settings
import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { VibeValidator, VibeValidatorSettings } from './VibeValidator';
import { ColumnVibeSettings } from '../../store/columns';
import { useAppTheme } from '../../hooks/useTheme';

interface VibeValidatorModalProps {
  visible: boolean;
  settings: ColumnVibeSettings;
  onUpdate: (settings: ColumnVibeSettings) => void;
  onClose: () => void;
  columnTitle?: string;
}

// Convert ColumnVibeSettings to VibeValidatorSettings
// ColumnVibeSettings stores advanced/expert as Record<string, unknown> for serialization,
// while VibeValidatorSettings uses typed AdvancedSettings/ExpertSettings interfaces.
// The runtime shape is identical, so these casts are safe.
const toVibeValidatorSettings = (settings: ColumnVibeSettings): VibeValidatorSettings => ({
  preset: settings.preset,
  weights: settings.weights,
  mode: settings.mode,
  intermediate: settings.intermediate,
  advanced: settings.advanced as VibeValidatorSettings['advanced'],
  expert: settings.expert as VibeValidatorSettings['expert'],
});

// Convert VibeValidatorSettings to ColumnVibeSettings
const toColumnVibeSettings = (settings: VibeValidatorSettings): ColumnVibeSettings => ({
  preset: settings.preset,
  weights: settings.weights,
  mode: settings.mode,
  intermediate: settings.intermediate,
  advanced: settings.advanced as Record<string, unknown> | undefined,
  expert: settings.expert as Record<string, unknown> | undefined,
});

export const VibeValidatorModal: React.FC<VibeValidatorModalProps> = ({
  visible,
  settings,
  onUpdate,
  onClose,
  columnTitle,
}) => {
  const theme = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  // Use pixel-based max height: 85% of screen, capped at a reasonable value
  const maxContentHeight = Math.min(windowHeight * 0.85, windowHeight - 80);

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
        <View
          testID="modal-content"
          style={[
            styles.content,
            {
              backgroundColor: theme.panel,
              borderColor: theme.border,
              maxHeight: maxContentHeight,
            },
          ]}
        >
          {/* Close button - stays fixed at top */}
          <TouchableOpacity
            testID="close-button"
            style={[styles.closeButton, { backgroundColor: theme.bg }]}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
          </TouchableOpacity>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={false}
            nestedScrollEnabled={true}
          >
            {/* Column title header */}
            {columnTitle && (
              <View style={[styles.columnHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.columnTitle, { color: theme.muted }]}>Settings for: {columnTitle}</Text>
              </View>
            )}

            {/* VibeValidator */}
            <VibeValidator
              settings={toVibeValidatorSettings(settings)}
              onUpdate={handleUpdate}
            />
          </ScrollView>
        </View>
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
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  columnHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default VibeValidatorModal;
