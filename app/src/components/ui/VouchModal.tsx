import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { vouchForUser } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAppTheme } from '../../hooks/useTheme';

interface VouchModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  username: string;
}

const STAKE_TIERS = [100, 500, 1000];

export const VouchModal: React.FC<VouchModalProps> = ({
  visible,
  onClose,
  onSuccess,
  userId,
  username,
}) => {
  const theme = useAppTheme();
  const [selectedStake, setSelectedStake] = useState<number>(100);
  const [customStake, setCustomStake] = useState<string>('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualStake = showCustom ? parseInt(customStake) || 0 : selectedStake;

  const handleConfirm = async () => {
    if (actualStake < 100) {
      setError('Minimum stake is 100 cred');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await vouchForUser(userId, actualStake);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to vouch'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedStake(100);
    setCustomStake('');
    setShowCustom(false);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>🤝 Vouch for @{username}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Stake Selection */}
          <Text style={[styles.stakeLabel, { color: theme.muted }]}>
            You're staking <Text style={[styles.stakeAmount, { color: theme.accent }]}>{actualStake}</Text> cred
          </Text>

          <View style={styles.tierRow}>
            {STAKE_TIERS.map((tier) => (
              <TouchableOpacity
                key={tier}
                style={[
                  styles.tierButton,
                  { borderColor: theme.border },
                  !showCustom && selectedStake === tier && [styles.tierButtonActive, { borderColor: theme.accent }],
                ]}
                onPress={() => {
                  setSelectedStake(tier);
                  setShowCustom(false);
                }}
              >
                <Text
                  style={[
                    styles.tierText,
                    { color: theme.muted },
                    !showCustom && selectedStake === tier && [styles.tierTextActive, { color: theme.accent }],
                  ]}
                >
                  {tier}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.customButton, { borderColor: theme.border }, showCustom && { borderColor: theme.accent }]}
            onPress={() => setShowCustom(true)}
          >
            {showCustom ? (
              <TextInput
                style={[styles.customInput, { color: theme.text }]}
                value={customStake}
                onChangeText={setCustomStake}
                keyboardType="numeric"
                placeholder="Enter amount..."
                placeholderTextColor={theme.muted}
                autoFocus
              />
            ) : (
              <Text style={[styles.customText, { color: theme.muted }]}>Custom amount...</Text>
            )}
          </TouchableOpacity>

          {/* Warning Section */}
          <View style={styles.warningBox}>
            <AlertTriangle size={18} color="#f59e0b" />
            <Text style={styles.warningTitle}>What this means:</Text>
          </View>
          <View style={styles.warningList}>
            <Text style={[styles.warningItem, { color: theme.muted }]}>• If they abuse trust, you lose this cred AND your reputation</Text>
            <Text style={[styles.warningItem, { color: theme.muted }]}>• Your vouch chain is affected - people you've vouched for may lose trust too</Text>
            <Text style={[styles.warningItem, { color: theme.muted }]}>• Revoking later costs 50% of stake</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Actions */}
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: theme.accent }, loading && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={loading || actualStake < 100}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmText}>Confirm Vouch ({actualStake})</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
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
    padding: 20,
  },
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
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
  stakeLabel: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  stakeAmount: {
    fontWeight: 'bold',
  },
  tierRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  tierButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tierButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tierText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tierTextActive: {},
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  customText: {
    fontSize: 14,
  },
  customInput: {
    fontSize: 16,
    padding: 0,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
  },
  warningList: {
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmText: {
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
