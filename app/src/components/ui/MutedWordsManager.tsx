// MutedWordsManager - Manage muted words/phrases for feed filtering
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, HelpCircle } from './Icons';
import { COLORS } from '../../constants/theme';
import { getMutedWords, addMutedWord, removeMutedWord, clearAllMutedWords, MutedWord } from '../../lib/api';

interface MutedWordsManagerProps {
  visible: boolean;
  onClose: () => void;
}

export const MutedWordsManager: React.FC<MutedWordsManagerProps> = ({
  visible,
  onClose,
}) => {
  const [mutedWords, setMutedWords] = useState<MutedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch muted words on mount
  useEffect(() => {
    if (visible) {
      fetchMutedWords();
    }
  }, [visible]);

  const fetchMutedWords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMutedWords();
      setMutedWords(data.mutedWords || []);
    } catch (err) {
      console.error('Failed to fetch muted words:', err);
      setError('Failed to load muted words');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) return;

    // Validate regex if needed
    if (isRegex) {
      try {
        new RegExp(newWord, 'i');
      } catch {
        Alert.alert('Invalid Regex', 'The pattern you entered is not a valid regular expression.');
        return;
      }
    }

    try {
      setAdding(true);
      setError(null);
      const data = await addMutedWord(newWord.trim(), isRegex);
      setMutedWords(prev => [data.mutedWord, ...prev]);
      setNewWord('');
      setIsRegex(false);
    } catch (err: any) {
      if (err.message?.includes('409') || err.message?.includes('already')) {
        Alert.alert('Already Muted', 'This word is already in your muted list.');
      } else {
        Alert.alert('Error', 'Failed to add muted word. Please try again.');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveWord = async (id: string) => {
    try {
      await removeMutedWord(id);
      setMutedWords(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      Alert.alert('Error', 'Failed to remove muted word. Please try again.');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Muted Words',
      'Are you sure you want to remove all muted words? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllMutedWords();
              setMutedWords([]);
            } catch (err) {
              Alert.alert('Error', 'Failed to clear muted words. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  // Using absolute positioning instead of Modal to avoid nested modal issues
  return (
    <View style={styles.fullScreenOverlay}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Muted Words</Text>
            <Text style={styles.subtitle}>Posts containing these words will be hidden</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color={COLORS.node.text} />
          </TouchableOpacity>
        </View>

        {/* Add Word Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newWord}
              onChangeText={setNewWord}
              placeholder="Enter word or phrase to mute..."
              placeholderTextColor={COLORS.node.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleAddWord}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, (!newWord.trim() || adding) && styles.addButtonDisabled]}
              onPress={handleAddWord}
              disabled={!newWord.trim() || adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Plus size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Regex Toggle */}
          <TouchableOpacity
            style={styles.regexToggle}
            onPress={() => setIsRegex(!isRegex)}
          >
            <View style={[styles.checkbox, isRegex && styles.checkboxChecked]}>
              {isRegex && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.regexLabel}>Use as regex pattern</Text>
            <Text style={styles.regexHint}>(advanced)</Text>
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <HelpCircle size={16} color={COLORS.node.accent} />
          <Text style={styles.infoText}>
            Muted words are case-insensitive and match anywhere in post content or title.
          </Text>
        </View>

        {/* Muted Words List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.node.accent} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchMutedWords}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : mutedWords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No muted words yet</Text>
            <Text style={styles.emptyHint}>
              Add words or phrases above to filter them from your feed
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listCount}>{mutedWords.length} muted word{mutedWords.length !== 1 ? 's' : ''}</Text>
              {mutedWords.length > 0 && (
                <TouchableOpacity onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {mutedWords.map((item) => (
                <View key={item.id} style={styles.wordItem}>
                  <View style={styles.wordContent}>
                    <Text style={styles.wordText}>{item.word}</Text>
                    {item.isRegex && (
                      <View style={styles.regexBadge}>
                        <Text style={styles.regexBadgeText}>regex</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveWord(item.id)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </>
        )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.node.panel,
    zIndex: 100,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.node.panel,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.node.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.node.border,
  },
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.node.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.node.text,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.node.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: COLORS.node.muted,
    opacity: 0.5,
  },
  regexToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.node.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.node.accent,
    borderColor: COLORS.node.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  regexLabel: {
    fontSize: 13,
    color: COLORS.node.text,
  },
  regexHint: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: `${COLORS.node.accent}15`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.node.accent}30`,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.node.muted,
    lineHeight: 18,
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
    color: '#ef4444',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.node.accent,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.node.text,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.node.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listCount: {
    fontSize: 13,
    color: COLORS.node.muted,
    fontWeight: '500',
  },
  clearAllText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.node.bg,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  wordContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordText: {
    fontSize: 14,
    color: COLORS.node.text,
  },
  regexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: `${COLORS.node.accent}20`,
    borderRadius: 4,
  },
  regexBadgeText: {
    fontSize: 10,
    color: COLORS.node.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});

export default MutedWordsManager;
