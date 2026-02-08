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
import { showAlert } from '../../lib/alert';
import { X, Camera, Link2, Check, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile, uploadAvatar, AuthResponse } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAppTheme } from '../../hooks/useTheme';

type User = AuthResponse['user'];

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  currentAvatar?: string | null;
  username: string;
}

// Preset avatar options (colorful gradient avatars)
const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/shapes/svg?seed=felix&backgroundColor=6366f1',
  'https://api.dicebear.com/7.x/shapes/svg?seed=aneka&backgroundColor=10b981',
  'https://api.dicebear.com/7.x/shapes/svg?seed=leo&backgroundColor=f59e0b',
  'https://api.dicebear.com/7.x/shapes/svg?seed=maya&backgroundColor=ec4899',
  'https://api.dicebear.com/7.x/shapes/svg?seed=zoe&backgroundColor=8b5cf6',
  'https://api.dicebear.com/7.x/shapes/svg?seed=noah&backgroundColor=06b6d4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=luna&backgroundColor=6366f1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=max&backgroundColor=10b981',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=star&backgroundColor=f59e0b',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=pixel&backgroundColor=ec4899',
  'https://api.dicebear.com/7.x/identicon/svg?seed=hash&backgroundColor=8b5cf6',
  'https://api.dicebear.com/7.x/identicon/svg?seed=block&backgroundColor=06b6d4',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  onSuccess,
  currentAvatar,
  username,
}) => {
  const theme = useAppTheme();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || '');
  const [pendingUpload, setPendingUpload] = useState<string | null>(null); // Local URI for preview
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'url' | 'presets' | 'upload'>('presets');

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // If there's a pending upload, upload it first
      if (pendingUpload) {
        setUploading(true);
        const result = await uploadAvatar(pendingUpload);
        setUploading(false);
        onSuccess(result.user);
        onClose();
        return;
      }

      // Otherwise just update with URL
      const result = await updateProfile({ avatar: avatarUrl || '' });
      onSuccess(result.user);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update profile'));
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
        quality: 0.7, // Compress to 70%
      });

      if (!result.canceled && result.assets[0]) {
        // Set the pending upload and show preview
        setPendingUpload(result.assets[0].uri);
        setAvatarUrl(''); // Clear any URL since we're uploading
        setMode('upload');
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Failed to pick image');
    }
  };

  const handlePresetSelect = (url: string) => {
    setAvatarUrl(url);
    setPendingUpload(null); // Clear any pending upload
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setPendingUpload(null);
  };

  const handleUrlChange = (url: string) => {
    setAvatarUrl(url);
    setPendingUpload(null); // Clear any pending upload
  };

  // Display either the pending upload preview, current avatar URL, or nothing
  const displayAvatar = pendingUpload || avatarUrl;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Edit Profile Picture</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Current Avatar Preview */}
          <View style={styles.previewSection}>
            <View style={[styles.avatarPreview, { borderColor: theme.accent }]}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.previewImage} />
              ) : (
                <View style={[styles.placeholderAvatar, { backgroundColor: theme.accent }]}>
                  <Text style={styles.placeholderText}>
                    {username?.[0]?.toUpperCase() || '?'}
                  </Text>
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
            <ScrollView style={styles.presetsContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.presetsGrid}>
                {AVATAR_PRESETS.map((url, index) => (
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
            </ScrollView>
          ) : mode === 'url' ? (
            <View style={styles.urlSection}>
              <Text style={[styles.urlLabel, { color: theme.text }]}>Image URL</Text>
              <TextInput
                style={[styles.urlInput, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                value={avatarUrl}
                onChangeText={handleUrlChange}
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.urlHint, { color: theme.muted }]}>
                Paste a direct link to an image. Works with Imgur, Cloudinary, or any image URL.
              </Text>
            </View>
          ) : (
            <View style={styles.uploadSection}>
              {pendingUpload ? (
                <>
                  <Text style={[styles.uploadInfo, { color: theme.muted }]}>
                    Image selected and ready to upload. The image will be resized to 400x400 and compressed.
                  </Text>
                  <TouchableOpacity style={[styles.changeImageButton, { backgroundColor: theme.panel, borderColor: theme.border }]} onPress={handlePickImage}>
                    <Camera size={16} color={theme.accent} />
                    <Text style={[styles.changeImageText, { color: theme.accent }]}>Choose different image</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.panel, borderColor: theme.border }]} onPress={handlePickImage}>
                  <Upload size={24} color={theme.accent} />
                  <Text style={[styles.uploadButtonText, { color: theme.text }]}>Choose from Gallery</Text>
                  <Text style={[styles.uploadHint, { color: theme.muted }]}>Images will be resized and compressed</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Actions */}
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
    padding: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 420,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  placeholderText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
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
    maxHeight: 200,
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
    borderRadius: 28,
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
  uploadButton: {
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
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
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
