import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, CheckCircle } from '../components/ui/Icons';
import { useAppTheme } from '../hooks/useTheme';
import { useThemeStore, DEFAULT_THEME, type ThemeTokens } from '../store/theme';
import { updateProfile } from '../lib/api';
import { showAlert, showConfirm } from '../lib/alert';
import { getErrorMessage } from '../lib/errors';

// ── Types ──────────────────────────────────────────────────────
interface ThemeEditorScreenProps {
  onBack: () => void;
}

interface ColorField {
  key: keyof ThemeTokens;
  label: string;
}

// ── Editable color fields ──────────────────────────────────────
const COLOR_FIELDS: ColorField[] = [
  { key: 'bg', label: 'Background' },
  { key: 'panel', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'textSecondary', label: 'Secondary Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Borders' },
  { key: 'profileBg', label: 'Profile Background' },
  { key: 'postCardBg', label: 'Post Card Background' },
];

// ── Hex validation ─────────────────────────────────────────────
const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

/** Normalise shorthand hex (#abc → #aabbcc) */
function normalizeHex(value: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value.split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return value;
}

// ── Color Row ──────────────────────────────────────────────────
const ColorRow = React.memo(function ColorRow({
  field,
  value,
  onChange,
  theme,
}: {
  field: ColorField;
  value: string;
  onChange: (key: keyof ThemeTokens, value: string) => void;
  theme: ThemeTokens;
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<TextInput>(null);

  const handleChange = useCallback(
    (text: string) => {
      // Always update the local input so the user can type freely
      setLocalValue(text);

      // Only push to the theme store when the value is a valid hex
      if (isValidHex(text)) {
        onChange(field.key, normalizeHex(text));
      }
    },
    [field.key, onChange],
  );

  // Sync from parent when external reset happens
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <View style={[rowStyles.row, { borderBottomColor: theme.border }]}>
      <View style={rowStyles.labelWrap}>
        <View
          style={[
            rowStyles.swatch,
            {
              backgroundColor: isValidHex(localValue) ? localValue : value,
              borderColor: theme.borderLight,
            },
          ]}
        />
        <Text style={[rowStyles.label, { color: theme.text }]}>
          {field.label}
        </Text>
      </View>

      <TextInput
        ref={inputRef}
        style={[
          rowStyles.input,
          {
            backgroundColor: theme.inputBg,
            color: theme.text,
            borderColor: isValidHex(localValue) ? theme.border : '#ef4444',
          },
        ]}
        value={localValue}
        onChangeText={handleChange}
        placeholder="#000000"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={9}
      />
    </View>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    fontFamily: 'monospace',
  },
});

// ── Live Preview Card ──────────────────────────────────────────
const LivePreviewCard = React.memo(function LivePreviewCard({
  theme,
}: {
  theme: ThemeTokens;
}) {
  return (
    <View
      style={[
        previewStyles.card,
        {
          backgroundColor: theme.postCardBg ?? theme.panel,
          borderColor: theme.postCardBorder ?? theme.border,
          borderRadius: theme.radius,
          boxShadow: theme.shadow,
        },
      ]}
    >
      {/* Header row */}
      <View style={previewStyles.header}>
        <View
          style={[previewStyles.avatar, { backgroundColor: theme.accent }]}
        />
        <View style={previewStyles.headerText}>
          <Text
            style={[previewStyles.displayName, { color: theme.text }]}
            numberOfLines={1}
          >
            Preview User
          </Text>
          <Text
            style={[
              previewStyles.handle,
              { color: theme.textSecondary },
            ]}
            numberOfLines={1}
          >
            @preview
          </Text>
        </View>
      </View>

      {/* Body */}
      <Text style={[previewStyles.body, { color: theme.text }]}>
        This is a live preview of how posts will look with your current theme
        settings. Adjust colors and see changes instantly.
      </Text>

      {/* Footer */}
      <View
        style={[
          previewStyles.footer,
          { borderTopColor: theme.border },
        ]}
      >
        <View
          style={[
            previewStyles.vibeChip,
            { backgroundColor: theme.accent + '22' },
          ]}
        >
          <Text style={[previewStyles.vibeText, { color: theme.accent }]}>
            ✦ insightful
          </Text>
        </View>
        <Text style={[previewStyles.timestamp, { color: theme.muted }]}>
          just now
        </Text>
      </View>
    </View>
  );
});

const previewStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '700',
  },
  handle: {
    fontSize: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  vibeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vibeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
  },
});

// ── Main Screen ────────────────────────────────────────────────
export const ThemeEditorScreen = ({ onBack }: ThemeEditorScreenProps) => {
  const theme = useAppTheme();
  const [saving, setSaving] = useState(false);

  // Derive "working" values from activeTheme (which includes preview)
  const getFieldValue = useCallback(
    (key: keyof ThemeTokens): string => {
      const val = theme[key];
      return typeof val === 'string' ? val : String(val ?? '');
    },
    [theme],
  );

  // ── Handlers ───────────────────────────────────────────────
  const handleColorChange = useCallback(
    (key: keyof ThemeTokens, value: string) => {
      useThemeStore.getState().setPreviewTheme({
        ...useThemeStore.getState().previewTheme,
        [key]: value,
      });
    },
    [],
  );

  const handleRadiusChange = useCallback((text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num <= 30) {
      useThemeStore.getState().setPreviewTheme({
        ...useThemeStore.getState().previewTheme,
        radius: num,
      });
    } else if (text === '') {
      useThemeStore.getState().setPreviewTheme({
        ...useThemeStore.getState().previewTheme,
        radius: 0,
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { activeTheme } = useThemeStore.getState();
      // Persist to backend
      await updateProfile({ customTheme: activeTheme as unknown as Record<string, unknown> });
      // Commit locally: merge preview into userTheme and clear preview
      useThemeStore.getState().setUserTheme(activeTheme);
      useThemeStore.getState().clearPreview();
      showAlert('Theme Saved', 'Your custom theme has been applied.');
    } catch (err) {
      showAlert('Error', getErrorMessage(err, 'Failed to save theme.'));
    } finally {
      setSaving(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    const confirmed = await showConfirm(
      'Reset Theme',
      'This will restore the default theme and erase your customizations.',
      { destructive: true },
    );
    if (!confirmed) return;
    try {
      useThemeStore.getState().resetToDefault();
      await updateProfile({ customTheme: {} });
      showAlert('Theme Reset', 'Default theme has been restored.');
    } catch (err) {
      showAlert('Error', getErrorMessage(err, 'Failed to reset theme.'));
    }
  }, []);

  const handleCancel = useCallback(() => {
    useThemeStore.getState().clearPreview();
    onBack();
  }, [onBack]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.border, backgroundColor: theme.panel },
        ]}
      >
        <Pressable
          onPress={handleCancel}
          style={[styles.backButton, { backgroundColor: theme.bg }]}
        >
          <ArrowLeft color={theme.text} size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Theme Editor
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live Preview */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Live Preview
        </Text>
        <View
          style={[
            styles.previewWrap,
            { backgroundColor: theme.bgAlt, borderRadius: theme.radius },
          ]}
        >
          <LivePreviewCard theme={theme} />
        </View>

        {/* Color Fields */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 28 }]}>
          Colors
        </Text>
        <View
          style={[
            styles.fieldGroup,
            { backgroundColor: theme.panel, borderColor: theme.border, borderRadius: theme.radius },
          ]}
        >
          {COLOR_FIELDS.map((field) => (
            <ColorRow
              key={field.key}
              field={field}
              value={getFieldValue(field.key)}
              onChange={handleColorChange}
              theme={theme}
            />
          ))}
        </View>

        {/* Radius */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 28 }]}>
          Border Radius
        </Text>
        <View
          style={[
            styles.radiusRow,
            { backgroundColor: theme.panel, borderColor: theme.border, borderRadius: theme.radius },
          ]}
        >
          <Text style={[styles.radiusLabel, { color: theme.text }]}>
            Radius (0–30)
          </Text>
          <TextInput
            style={[
              styles.radiusInput,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={String(theme.radius)}
            onChangeText={handleRadiusChange}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="10"
            placeholderTextColor={theme.muted}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.button,
              styles.saveButton,
              {
                backgroundColor: theme.accent,
                opacity: pressed || saving ? 0.7 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <CheckCircle color="#fff" size={18} />
                <Text style={styles.saveButtonText}>Save Theme</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.button,
              styles.resetButton,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.panelHover : 'transparent',
              },
            ]}
          >
            <RefreshCw color={theme.textSecondary} size={18} />
            <Text style={[styles.resetButtonText, { color: theme.textSecondary }]}>
              Reset to Default
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              {
                backgroundColor: pressed ? theme.panelHover : 'transparent',
              },
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: theme.muted }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Static styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  previewWrap: {
    padding: 16,
  },
  fieldGroup: {
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  radiusInput: {
    width: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveButton: {},
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetButton: {
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
