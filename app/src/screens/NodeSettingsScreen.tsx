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
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, Trash2, Plus, X } from '../components/ui/Icons';
import { COLORS } from '../constants/theme';
import {
  getNodeDetails,
  updateNode,
  uploadNodeAvatar,
  uploadNodeBanner,
  deleteNodeAvatar,
  deleteNodeBanner,
  NodeDetails,
} from '../lib/api';
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

export const NodeSettingsScreen: React.FC<NodeSettingsScreenProps> = ({
  nodeId,
  onBack,
}) => {
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
    } catch (err: any) {
      setError(err.message || 'Failed to load node');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Node name is required');
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
      Alert.alert('Success', 'Node settings updated');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save settings');
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
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload avatar');
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
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteNodeAvatar(nodeId);
      setNodeData((prev) => (prev ? { ...prev, avatar: null } : prev));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete avatar');
    }
  };

  const handleDeleteBanner = async () => {
    try {
      await deleteNodeBanner(nodeId);
      setNodeData((prev) => (prev ? { ...prev, banner: null } : prev));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete banner');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.node.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !nodeData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.node.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Node not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.node.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Node Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Banner</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avatar</Text>
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
                style={styles.avatarButton}
                onPress={() => pickImage('avatar')}
              >
                <Text style={styles.avatarButtonText}>Upload New</Text>
              </TouchableOpacity>
              {nodeData.avatar && (
                <TouchableOpacity
                  style={[styles.avatarButton, styles.avatarButtonDanger]}
                  onPress={handleDeleteAvatar}
                >
                  <Text style={styles.avatarButtonTextDanger}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Node name"
            placeholderTextColor={COLORS.node.muted}
            maxLength={50}
          />
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this node about?"
            placeholderTextColor={COLORS.node.muted}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Color Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.colorOption,
                  { backgroundColor: preset },
                  color === preset && styles.colorOptionSelected,
                ]}
                onPress={() => setColor(preset)}
              />
            ))}
          </View>
        </View>

        {/* Rules Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rules ({rules.length}/10)</Text>
          <View style={styles.rulesList}>
            {rules.map((rule, index) => (
              <View key={index} style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
                <TouchableOpacity
                  style={styles.ruleRemoveButton}
                  onPress={() => removeRule(index)}
                >
                  <X size={16} color={COLORS.node.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {rules.length < 10 && (
            <View style={styles.addRuleRow}>
              <TextInput
                style={[styles.textInput, styles.ruleInput]}
                value={newRule}
                onChangeText={setNewRule}
                placeholder="Add a rule..."
                placeholderTextColor={COLORS.node.muted}
                maxLength={200}
                onSubmitEditing={addRule}
              />
              <TouchableOpacity
                style={[styles.addRuleButton, !newRule.trim() && styles.addRuleButtonDisabled]}
                onPress={addRule}
                disabled={!newRule.trim()}
              >
                <Plus size={20} color={newRule.trim() ? '#fff' : COLORS.node.muted} />
              </TouchableOpacity>
            </View>
          )}
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
    backgroundColor: COLORS.node.bg,
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
    color: COLORS.node.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.node.accent,
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
    borderBottomColor: COLORS.node.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  avatarButtonDanger: {
    borderColor: '#ef4444',
  },
  avatarButtonText: {
    color: COLORS.node.text,
    fontSize: 14,
    fontWeight: '500',
  },
  avatarButtonTextDanger: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.node.text,
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
    borderColor: COLORS.node.text,
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  ruleNumber: {
    color: COLORS.node.muted,
    fontSize: 14,
    width: 24,
  },
  ruleText: {
    flex: 1,
    color: COLORS.node.text,
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
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRuleButtonDisabled: {
    backgroundColor: COLORS.node.panel,
  },
});

export default NodeSettingsScreen;
