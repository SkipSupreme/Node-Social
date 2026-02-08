import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, Trash2, Plus, X } from '../components/ui/Icons';
import { useAppTheme } from '../hooks/useTheme';
import {
  getNodeDetails,
  updateNode,
  uploadNodeAvatar,
  uploadNodeBanner,
  deleteNodeAvatar,
  deleteNodeBanner,
  NodeDetails,
} from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import * as ImagePicker from 'expo-image-picker';

interface NodeSettingsScreenProps {
  nodeId: string;
  onBack: () => void;
}

// Color presets for node themes
const COLOR_PRESETS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

// Theme token fields editable via Community Theme section
const CUSTOM_THEME_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'panel', label: 'Panel / Card' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Border' },
] as const;

const isValidHex = (value: string): boolean =>
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);

export const NodeSettingsScreen: React.FC<NodeSettingsScreenProps> = ({
  nodeId,
  onBack,
}) => {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodeData, setNodeData] = useState<NodeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');

  // Custom community theme state
  const [customThemeColors, setCustomThemeColors] = useState<Record<string, string>>({
    bg: '',
    panel: '',
    text: '',
    accent: '',
    border: '',
  });
  const [savingTheme, setSavingTheme] = useState(false);

  // Image upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    fetchNodeData();
  }, [nodeId]);

  const fetchNodeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNodeDetails(nodeId);
      setNodeData(data);
      // Initialize form with current values
      setName(data.name);
      setDescription(data.description || '');
      setColor(data.color || '#6366f1');
      setRules(data.rules || []);
      if (data.customTheme) {
        setCustomThemeColors({
          bg: (data.customTheme.bg as string) || '',
          panel: (data.customTheme.panel as string) || '',
          text: (data.customTheme.text as string) || '',
          accent: (data.customTheme.accent as string) || '',
          border: (data.customTheme.border as string) || '',
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Error', 'Node name is required');
      return;
    }

    setSaving(true);
    try {
      await updateNode(nodeId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        rules: rules.filter((r) => r.trim()),
      });
      showAlert('Success', 'Node settings updated');
      onBack();
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (type: 'avatar' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [4, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (type === 'avatar') {
        await handleAvatarUpload(uri);
      } else {
        await handleBannerUpload(uri);
      }
    }
  };

  const handleAvatarUpload = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const result = await uploadNodeAvatar(nodeId, uri);
      setNodeData((prev) =>
        prev ? { ...prev, avatar: result.avatarUrl } : prev
      );
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (uri: string) => {
    setUploadingBanner(true);
    try {
      const result = await uploadNodeBanner(nodeId, uri);
      setNodeData((prev) =>
        prev ? { ...prev, banner: result.bannerUrl } : prev
      );
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteNodeAvatar(nodeId);
      setNodeData((prev) => (prev ? { ...prev, avatar: null } : prev));
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    }
  };

  const handleDeleteBanner = async () => {
    try {
      await deleteNodeBanner(nodeId);
      setNodeData((prev) => (prev ? { ...prev, banner: null } : prev));
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    }
  };

  const addRule = () => {
    if (newRule.trim() && rules.length < 10) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateThemeColor = (key: string, value: string) => {
    setCustomThemeColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    try {
      const themeData: Record<string, string> = {};
      for (const [key, value] of Object.entries(customThemeColors)) {
        if (value && isValidHex(value)) {
          themeData[key] = value;
        }
      }
      await updateNode(nodeId, {
        customTheme: Object.keys(themeData).length > 0 ? themeData : null,
      });
      showAlert('Success', 'Community theme updated');
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    } finally {
      setSavingTheme(false);
    }
  };

  const handleResetTheme = async () => {
    setSavingTheme(true);
    try {
      await updateNode(nodeId, { customTheme: null });
      setCustomThemeColors({ bg: '', panel: '', text: '', accent: '', border: '' });
      showAlert('Success', 'Community theme reset to default');
    } catch (err: unknown) {
      showAlert('Error', getErrorMessage(err));
    } finally {
      setSavingTheme(false);
    }
  };

  const hasAnyThemeColor = Object.values(customThemeColors).some((v) => v.trim() !== '');

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !nodeData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Error</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.muted }]}>{error || 'Node not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Node Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled, { backgroundColor: theme.accent }]}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Banner</Text>
          <View style={[styles.bannerPreview, { backgroundColor: color }]}>
            {nodeData.banner ? (
              <Image source={{ uri: nodeData.banner }} style={styles.bannerImage} />
            ) : null}
            <View style={styles.bannerOverlay}>
              {uploadingBanner ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.bannerActions}>
                  <TouchableOpacity
                    style={styles.imageActionButton}
                    onPress={() => pickImage('banner')}
                  >
                    <Camera size={20} color="#fff" />
                    <Text style={styles.imageActionText}>Upload</Text>
                  </TouchableOpacity>
                  {nodeData.banner && (
                    <TouchableOpacity
                      style={styles.imageActionButton}
                      onPress={handleDeleteBanner}
                    >
                      <Trash2 size={20} color="#fff" />
                      <Text style={styles.imageActionText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Avatar Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Avatar</Text>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarPreview, { backgroundColor: color }]}>
              {nodeData.avatar ? (
                <Image source={{ uri: nodeData.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholderText}>
                  {name.charAt(0).toUpperCase() || 'N'}
                </Text>
              )}
              {uploadingAvatar && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.avatarActions}>
              <TouchableOpacity
                style={[styles.avatarButton, { backgroundColor: theme.panel, borderColor: theme.border }]}
                onPress={() => pickImage('avatar')}
              >
                <Text style={[styles.avatarButtonText, { color: theme.text }]}>Upload New</Text>
              </TouchableOpacity>
              {nodeData.avatar && (
                <TouchableOpacity
                  style={[styles.avatarButton, styles.avatarButtonDanger, { backgroundColor: theme.panel, borderColor: theme.border }]}
                  onPress={handleDeleteAvatar}
                >
                  <Text style={styles.avatarButtonTextDanger}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Name Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Name</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Node name"
            placeholderTextColor={theme.muted}
            maxLength={50}
          />
        </View>

        {/* Description Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this node about?"
            placeholderTextColor={theme.muted}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Color Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Primary Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.colorOption,
                  { backgroundColor: preset },
                  color === preset && styles.colorOptionSelected,
                , { borderColor: theme.text }]}
                onPress={() => setColor(preset)}
              />
            ))}
          </View>
        </View>

        {/* Rules Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Rules ({rules.length}/10)</Text>
          <View style={styles.rulesList}>
            {rules.map((rule, index) => (
              <View key={index} style={[styles.ruleItem, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                <Text style={[styles.ruleNumber, { color: theme.muted }]}>{index + 1}.</Text>
                <Text style={[styles.ruleText, { color: theme.text }]}>{rule}</Text>
                <TouchableOpacity
                  style={styles.ruleRemoveButton}
                  onPress={() => removeRule(index)}
                >
                  <X size={16} color={theme.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {rules.length < 10 && (
            <View style={styles.addRuleRow}>
              <TextInput
                style={[styles.textInput, styles.ruleInput, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                value={newRule}
                onChangeText={setNewRule}
                placeholder="Add a rule..."
                placeholderTextColor={theme.muted}
                maxLength={200}
                onSubmitEditing={addRule}
              />
              <TouchableOpacity
                style={[styles.addRuleButton, !newRule.trim() && styles.addRuleButtonDisabled]}
                onPress={addRule}
                disabled={!newRule.trim()}
              >
                <Plus size={20} color={newRule.trim() ? '#fff' : theme.muted} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Community Theme Section */}
        <View style={[styles.section, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Community Theme</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>
            Override default theme colors for members browsing this node.
            Leave a field empty to use the default.
          </Text>

          <View style={styles.themeFieldsList}>
            {CUSTOM_THEME_FIELDS.map(({ key, label }) => {
              const value = customThemeColors[key] || '';
              const valid = !value || isValidHex(value);
              return (
                <View key={key} style={styles.themeFieldRow}>
                  <View
                    style={[
                      styles.themeColorSwatch,
                      {
                        backgroundColor: value && isValidHex(value) ? value : theme.panel,
                        borderColor: valid ? theme.border : '#ef4444',
                      },
                    ]}
                  />
                  <View style={styles.themeFieldInputWrap}>
                    <Text style={[styles.themeFieldLabel, { color: theme.textSecondary }]}>
                      {label}
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.themeFieldInput,
                        {
                          backgroundColor: theme.panel,
                          borderColor: valid ? theme.border : '#ef4444',
                          color: theme.text,
                        },
                      ]}
                      value={value}
                      onChangeText={(v) => updateThemeColor(key, v)}
                      placeholder="#hexcolor"
                      placeholderTextColor={theme.muted}
                      maxLength={7}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.themeActions}>
            <Pressable
              onPress={handleSaveTheme}
              disabled={savingTheme}
              style={({ pressed }) => [
                styles.themeActionButton,
                { backgroundColor: theme.accent, opacity: pressed || savingTheme ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.themeActionButtonText}>
                {savingTheme ? 'Saving...' : 'Save Theme'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleResetTheme}
              disabled={savingTheme || !hasAnyThemeColor}
              style={({ pressed }) => [
                styles.themeActionButton,
                styles.themeResetButton,
                {
                  borderColor: theme.border,
                  opacity: pressed || savingTheme || !hasAnyThemeColor ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.themeResetButtonText, { color: theme.text }]}>
                Reset Theme
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  bannerPreview: {
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  imageActionButton: {
    alignItems: 'center',
    gap: 4,
  },
  imageActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPreview: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatarButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  avatarButtonDanger: {
    borderColor: '#ef4444',
  },
  avatarButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  avatarButtonTextDanger: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
  },
  rulesList: {
    gap: 8,
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  ruleNumber: {
    fontSize: 14,
    width: 24,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
  },
  ruleRemoveButton: {
    padding: 4,
  },
  addRuleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ruleInput: {
    flex: 1,
  },
  addRuleButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRuleButtonDisabled: {
  },
  // Community Theme styles
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  themeFieldsList: {
    gap: 12,
    marginBottom: 16,
  },
  themeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeColorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
  },
  themeFieldInputWrap: {
    flex: 1,
    gap: 2,
  },
  themeFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  themeFieldInput: {
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  themeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  themeActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  themeResetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  themeResetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NodeSettingsScreen;
