import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { X, ExternalLink, Check, AlertCircle } from 'lucide-react-native';
import { connectBluesky, initMastodonOAuth, completeMastodonOAuth, disconnectLinkedAccount } from '../../lib/api';
import { useLinkedAccountsStore } from '../../store/linkedAccounts';
import { useAppTheme } from '../../hooks/useTheme';

interface LinkedAccountsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LinkedAccountsModal: React.FC<LinkedAccountsModalProps> = ({ visible, onClose }) => {
  const theme = useAppTheme();
  const { accounts, fetchAccounts, hasLinkedAccount, getAccount } = useLinkedAccountsStore();

  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyAppPassword, setBskyAppPassword] = useState('');
  const [mastoInstance, setMastoInstance] = useState('mastodon.social');
  const [loading, setLoading] = useState<string | null>(null); // 'bluesky' | 'mastodon' | 'disconnect-bluesky' | etc.
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mastoOAuthState, setMastoOAuthState] = useState<string | null>(null);
  const [mastoAuthUrl, setMastoAuthUrl] = useState<string | null>(null);
  const [mastoCode, setMastoCode] = useState('');

  useEffect(() => {
    if (visible) {
      fetchAccounts();
      setError(null);
      setSuccess(null);
    }
  }, [visible, fetchAccounts]);

  const handleConnectBluesky = async () => {
    if (!bskyHandle.trim() || !bskyAppPassword.trim()) {
      setError('Please enter your Bluesky handle and app password');
      return;
    }

    setLoading('bluesky');
    setError(null);
    try {
      const result = await connectBluesky(bskyHandle.trim(), bskyAppPassword.trim());
      setSuccess(`Connected as ${result.handle}`);
      setBskyHandle('');
      setBskyAppPassword('');
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Bluesky account');
    } finally {
      setLoading(null);
    }
  };

  const handleInitMastodon = async () => {
    if (!mastoInstance.trim()) {
      setError('Please enter a Mastodon instance');
      return;
    }

    setLoading('mastodon');
    setError(null);
    try {
      const result = await initMastodonOAuth(mastoInstance.trim());
      setMastoOAuthState(result.state);
      setMastoAuthUrl(result.authUrl);

      // Try to open the auth URL — may be blocked by popup blocker
      try {
        if (Platform.OS === 'web') {
          window.open(result.authUrl, '_blank');
        } else {
          await Linking.openURL(result.authUrl);
        }
      } catch {
        // If popup blocked, user can click the link shown in step 2
      }

      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Mastodon auth');
      setLoading(null);
    }
  };

  const handleCompleteMastodon = async () => {
    if (!mastoCode.trim() || !mastoOAuthState) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading('mastodon-callback');
    setError(null);
    try {
      const result = await completeMastodonOAuth(mastoCode.trim(), mastoOAuthState);
      setSuccess(`Connected as ${result.handle}`);
      setMastoCode('');
      setMastoOAuthState(null);
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete Mastodon auth');
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    setLoading(`disconnect-${platform}`);
    setError(null);
    try {
      await disconnectLinkedAccount(platform);
      setSuccess(`${platform === 'bluesky' ? 'Bluesky' : 'Mastodon'} account disconnected`);
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(null);
    }
  };

  const bskyAccount = getAccount('bluesky');
  const mastoAccount = getAccount('mastodon');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Linked Accounts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Status Messages */}
          {error && (
            <View style={[styles.statusBar, { backgroundColor: '#ef444420' }]}>
              <AlertCircle size={14} color="#ef4444" />
              <Text style={[styles.statusText, { color: '#ef4444' }]}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={[styles.statusBar, { backgroundColor: '#22c55e20' }]}>
              <Check size={14} color="#22c55e" />
              <Text style={[styles.statusText, { color: '#22c55e' }]}>{success}</Text>
            </View>
          )}

          {/* Bluesky Section */}
          <View style={[styles.section, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Bluesky</Text>

            {bskyAccount ? (
              <View style={styles.connectedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connectedHandle, { color: theme.text }]}>
                    {bskyAccount.handle}
                  </Text>
                  <Text style={[styles.connectedStatus, { color: theme.muted }]}>Connected</Text>
                </View>
                <TouchableOpacity
                  style={[styles.disconnectBtn, { borderColor: '#ef4444' }]}
                  onPress={() => handleDisconnect('bluesky')}
                  disabled={loading === 'disconnect-bluesky'}
                >
                  {loading === 'disconnect-bluesky' ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Disconnect</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.connectForm}>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  placeholder="Handle (e.g. user.bsky.social)"
                  placeholderTextColor={theme.muted}
                  value={bskyHandle}
                  onChangeText={setBskyHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  placeholder="App Password"
                  placeholderTextColor={theme.muted}
                  value={bskyAppPassword}
                  onChangeText={setBskyAppPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.helpLink]}
                  onPress={() => Linking.openURL('https://bsky.app/settings/app-passwords')}
                >
                  <ExternalLink size={12} color={theme.accent} />
                  <Text style={[styles.helpText, { color: theme.accent }]}>
                    Get an App Password from Bluesky Settings
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.connectBtn, { backgroundColor: theme.accent }]}
                  onPress={handleConnectBluesky}
                  disabled={loading === 'bluesky'}
                >
                  {loading === 'bluesky' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.connectBtnText}>Connect Bluesky</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Mastodon Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mastodon</Text>

            {mastoAccount ? (
              <View style={styles.connectedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connectedHandle, { color: theme.text }]}>
                    {mastoAccount.handle}
                  </Text>
                  <Text style={[styles.connectedStatus, { color: theme.muted }]}>
                    Connected{mastoAccount.instanceUrl ? ` (${new URL(mastoAccount.instanceUrl).hostname})` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.disconnectBtn, { borderColor: '#ef4444' }]}
                  onPress={() => handleDisconnect('mastodon')}
                  disabled={loading === 'disconnect-mastodon'}
                >
                  {loading === 'disconnect-mastodon' ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Disconnect</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : mastoOAuthState ? (
              /* OAuth Step 2: Enter the authorization code */
              <View style={styles.connectForm}>
                <Text style={[styles.helpText, { color: theme.text, marginBottom: 4, fontWeight: '600' }]}>
                  Step 1: Click the link below to authorize
                </Text>
                {mastoAuthUrl && (
                  <TouchableOpacity
                    style={[styles.helpLink, { marginBottom: 8 }]}
                    onPress={() => Linking.openURL(mastoAuthUrl)}
                  >
                    <ExternalLink size={12} color={theme.accent} />
                    <Text style={[styles.helpText, { color: theme.accent }]} numberOfLines={1}>
                      Open Mastodon Authorization Page
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.helpText, { color: theme.text, marginBottom: 4, fontWeight: '600' }]}>
                  Step 2: Copy the code and paste it here
                </Text>
                <Text style={[styles.helpText, { color: theme.muted, marginBottom: 8 }]}>
                  After authorizing, Mastodon will show you a code. Copy it and paste below.
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  placeholder="Paste authorization code"
                  placeholderTextColor={theme.muted}
                  value={mastoCode}
                  onChangeText={setMastoCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.connectBtn, { backgroundColor: theme.accent }]}
                  onPress={handleCompleteMastodon}
                  disabled={loading === 'mastodon-callback'}
                >
                  {loading === 'mastodon-callback' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.connectBtnText}>Complete Connection</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setMastoOAuthState(null); setMastoAuthUrl(null); }}>
                  <Text style={[styles.helpText, { color: theme.muted, textAlign: 'center', marginTop: 8 }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* OAuth Step 1: Enter instance */
              <View style={styles.connectForm}>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  placeholder="Instance domain (e.g. mastodon.social)"
                  placeholderTextColor={theme.muted}
                  value={mastoInstance}
                  onChangeText={setMastoInstance}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.connectBtn, { backgroundColor: theme.accent }]}
                  onPress={handleInitMastodon}
                  disabled={loading === 'mastodon'}
                >
                  {loading === 'mastodon' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.connectBtnText}>Connect Mastodon</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectedHandle: {
    fontSize: 14,
    fontWeight: '600',
  },
  connectedStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectForm: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpText: {
    fontSize: 12,
  },
  connectBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
