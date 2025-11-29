import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { vouchForUser } from '../../lib/api';

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
    } catch (err: any) {
      setError(err.message || 'Failed to vouch');
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🤝 Vouch for @{username}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>

          {/* Stake Selection */}
          <Text style={styles.stakeLabel}>
            You're staking <Text style={styles.stakeAmount}>{actualStake}</Text> cred
          </Text>

          <View style={styles.tierRow}>
            {STAKE_TIERS.map((tier) => (
              <TouchableOpacity
                key={tier}
                style={[
                  styles.tierButton,
                  !showCustom && selectedStake === tier && styles.tierButtonActive,
                ]}
                onPress={() => {
                  setSelectedStake(tier);
                  setShowCustom(false);
                }}
              >
                <Text
                  style={[
                    styles.tierText,
                    !showCustom && selectedStake === tier && styles.tierTextActive,
                  ]}
                >
                  {tier}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.customButton, showCustom && styles.customButtonActive]}
            onPress={() => setShowCustom(true)}
          >
            {showCustom ? (
              <TextInput
                style={styles.customInput}
                value={customStake}
                onChangeText={setCustomStake}
                keyboardType="numeric"
                placeholder="Enter amount..."
                placeholderTextColor={COLORS.node.muted}
                autoFocus
              />
            ) : (
              <Text style={styles.customText}>Custom amount...</Text>
            )}
          </TouchableOpacity>

          {/* Warning Section */}
          <View style={styles.warningBox}>
            <AlertTriangle size={18} color="#f59e0b" />
            <Text style={styles.warningTitle}>What this means:</Text>
          </View>
          <View style={styles.warningList}>
            <Text style={styles.warningItem}>• If they abuse trust, you lose this cred AND your reputation</Text>
            <Text style={styles.warningItem}>• Your vouch chain is affected - people you've vouched for may lose trust too</Text>
            <Text style={styles.warningItem}>• Revoking later costs 50% of stake</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Actions */}
          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
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
            <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: COLORS.node.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.node.border,
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
    color: COLORS.node.text,
  },
  closeButton: {
    padding: 4,
  },
  stakeLabel: {
    fontSize: 16,
    color: COLORS.node.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  stakeAmount: {
    color: COLORS.node.accent,
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
    borderColor: COLORS.node.border,
    alignItems: 'center',
  },
  tierButtonActive: {
    borderColor: COLORS.node.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tierText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.node.muted,
  },
  tierTextActive: {
    color: COLORS.node.accent,
  },
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    marginBottom: 20,
  },
  customButtonActive: {
    borderColor: COLORS.node.accent,
  },
  customText: {
    color: COLORS.node.muted,
    fontSize: 14,
  },
  customInput: {
    color: COLORS.node.text,
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
    color: COLORS.node.muted,
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
    backgroundColor: COLORS.node.accent,
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
    color: COLORS.node.muted,
    fontSize: 14,
  },
});
