import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { showAlert, showToast } from '../../lib/alert';
import { X, Camera, Link2, Check, Upload, Bot } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateBotProfile, uploadBotAvatar, BotProfile } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAppTheme } from '../../hooks/useTheme';

interface EditBotModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (updatedBot: BotProfile) => void;
  bot: {
    id: string;
    username: string;
    avatar: string | null;
    bio: string | null;
  };
}

// Preset avatar options for bots
const BOT_AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot1&backgroundColor=6366f1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot2&backgroundColor=10b981',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot3&backgroundColor=f59e0b',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot4&backgroundColor=ec4899',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot5&backgroundColor=8b5cf6',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot6&backgroundColor=06b6d4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=curator&backgroundColor=ef4444',
  'https://api.dicebear.com/7.x/bottts/svg?seed=digest&backgroundColor=3b82f6',
  'https://api.dicebear.com/7.x/bottts/svg?seed=news&backgroundColor=22c55e',
  'https://api.dicebear.com/7.x/bottts/svg?seed=tech&backgroundColor=a855f7',
  'https://api.dicebear.com/7.x/bottts/svg?seed=gaming&backgroundColor=f97316',
  'https://api.dicebear.com/7.x/bottts/svg?seed=music&backgroundColor=14b8a6',
];

export const EditBotModal: React.FC<EditBotModalProps> = ({
  visible,
  onClose,
  onSuccess,
  bot,
}) => {
  const theme = useAppTheme();
  const [avatarUrl, setAvatarUrl] = useState(bot.avatar || '');
  const [bio, setBio] = useState(bot.bio || '');
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'url' | 'presets' | 'upload'>('presets');

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      let updatedBot: BotProfile;

      // If there's a pending upload, upload it first
      if (pendingUpload) {
        setUploading(true);
        const result = await uploadBotAvatar(bot.id, pendingUpload);
        setUploading(false);

        // If bio also changed, update it
        if (bio !== bot.bio) {
          const bioResult = await updateBotProfile(bot.id, { bio });
          updatedBot = bioResult.bot;
        } else {
          updatedBot = result.bot;
        }
      } else {
        // Update via URL/bio
        const updateData: { bio?: string; avatar?: string } = {};
        if (bio !== bot.bio) updateData.bio = bio;
        if (avatarUrl !== bot.avatar) updateData.avatar = avatarUrl;

        if (Object.keys(updateData).length === 0) {
          onClose();
          return;
        }

        const result = await updateBotProfile(bot.id, updateData);
        updatedBot = result.bot;
      }

      showToast(`@${bot.username} updated`, 'success');
      onSuccess(updatedBot);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update bot'));
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        showAlert('Permission Required', 'Please allow access to your photos to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPendingUpload(result.assets[0].uri);
        setAvatarUrl('');
        setMode('upload');
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Failed to pick image');
    }
  };

  const handlePresetSelect = (url: string) => {
    setAvatarUrl(url);
    setPendingUpload(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setPendingUpload(null);
  };

  const handleUrlChange = (url: string) => {
    setAvatarUrl(url);
    setPendingUpload(null);
  };

  const displayAvatar = pendingUpload || avatarUrl;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitle}>
              <Bot size={20} color={theme.accent} />
              <Text style={[styles.title, { color: theme.text }]}>Edit @{bot.username}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Current Avatar Preview */}
            <View style={styles.previewSection}>
              <View style={[styles.avatarPreview, { borderColor: theme.accent }]}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={styles.previewImage} />
                ) : (
                  <View style={[styles.placeholderAvatar, { backgroundColor: theme.accent }]}>
                    <Bot size={32} color="#fff" />
                  </View>
                )}
              </View>
              {pendingUpload && (
                <View style={styles.uploadBadge}>
                  <Upload size={12} color="#fff" />
                  <Text style={styles.uploadBadgeText}>Ready to upload</Text>
                </View>
              )}
              {displayAvatar && (
                <TouchableOpacity style={styles.removeButton} onPress={handleRemoveAvatar}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mode Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: theme.panel, borderColor: theme.border }, mode === 'presets' && { borderColor: theme.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                onPress={() => setMode('presets')}
              >
                <Text style={[styles.tabText, { color: theme.muted }, mode === 'presets' && { color: theme.accent }]}>
                  Presets
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: theme.panel, borderColor: theme.border }, mode === 'url' && { borderColor: theme.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                onPress={() => setMode('url')}
              >
                <Link2 size={14} color={mode === 'url' ? theme.accent : theme.muted} />
                <Text style={[styles.tabText, { color: theme.muted }, mode === 'url' && { color: theme.accent }]}>
                  URL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: theme.panel, borderColor: theme.border }, (mode === 'upload' || pendingUpload) && { borderColor: theme.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                onPress={handlePickImage}
              >
                <Camera size={14} color={(mode === 'upload' || pendingUpload) ? theme.accent : theme.muted} />
                <Text style={[styles.tabText, { color: theme.muted }, (mode === 'upload' || pendingUpload) && { color: theme.accent }]}>
                  Upload
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            {mode === 'presets' ? (
              <View style={styles.presetsContainer}>
                <View style={styles.presetsGrid}>
                  {BOT_AVATAR_PRESETS.map((url, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.presetItem,
                        { borderColor: theme.border },
                        avatarUrl === url && { borderColor: theme.accent },
                      ]}
                      onPress={() => handlePresetSelect(url)}
                    >
                      <Image source={{ uri: url }} style={styles.presetImage} />
                      {avatarUrl === url && (
                        <View style={[styles.checkmark, { backgroundColor: theme.accent }]}>
                          <Check size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : mode === 'url' ? (
              <View style={styles.urlSection}>
                <Text style={[styles.urlLabel, { color: theme.text }]}>Image URL</Text>
                <TextInput
                  style={[styles.urlInput, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                  value={avatarUrl}
                  onChangeText={handleUrlChange}
                  placeholder="https://example.com/bot-avatar.jpg"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.urlHint, { color: theme.muted }]}>
                  Paste a direct link to an image.
                </Text>
              </View>
            ) : (
              <View style={styles.uploadSection}>
                {pendingUpload ? (
                  <>
                    <Text style={[styles.uploadInfo, { color: theme.muted }]}>
                      Image selected and ready to upload. It will be resized to 400x400.
                    </Text>
                    <TouchableOpacity style={[styles.changeImageButton, { backgroundColor: theme.panel, borderColor: theme.border }]} onPress={handlePickImage}>
                      <Camera size={16} color={theme.accent} />
                      <Text style={[styles.changeImageText, { color: theme.accent }]}>Choose different image</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={[styles.uploadButtonStyle, { backgroundColor: theme.panel, borderColor: theme.border }]} onPress={handlePickImage}>
                    <Upload size={24} color={theme.accent} />
                    <Text style={[styles.uploadButtonText, { color: theme.text }]}>Choose from Gallery</Text>
                    <Text style={[styles.uploadHint, { color: theme.muted }]}>Images will be resized and compressed</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Bio Section */}
            <View style={styles.bioSection}>
              <Text style={[styles.bioLabel, { color: theme.text }]}>Bot Bio</Text>
              <TextInput
                style={[styles.bioInput, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Describe what this bot does..."
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={[styles.bioHint, { color: theme.muted }]}>{bio.length}/500</Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.accent }, (loading || uploading) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading || uploading}
            >
              {loading || uploading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.saveText}>
                    {uploading ? 'Uploading...' : 'Saving...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.saveText}>
                  {pendingUpload ? 'Upload & Save' : 'Save Changes'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 420,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  uploadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    marginTop: 8,
  },
  removeText: {
    color: '#ef4444',
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  presetsContainer: {
    marginBottom: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetItem: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  checkmark: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 8,
    padding: 2,
  },
  urlSection: {
    marginBottom: 16,
  },
  urlLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  urlInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  urlHint: {
    fontSize: 12,
    marginTop: 6,
  },
  uploadSection: {
    marginBottom: 16,
  },
  uploadButtonStyle: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadHint: {
    fontSize: 12,
  },
  uploadInfo: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bioSection: {
    marginBottom: 16,
  },
  bioLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  bioInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bioHint: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
  },
});
