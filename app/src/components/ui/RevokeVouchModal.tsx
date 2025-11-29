import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { revokeVouch } from '../../lib/api';

interface RevokeVouchModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (penaltyPaid: number) => void;
  userId: string;
  username: string;
  stake: number;
}

export const RevokeVouchModal: React.FC<RevokeVouchModalProps> = ({
  visible,
  onClose,
  onSuccess,
  userId,
  username,
  stake,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const penalty = Math.floor(stake * 0.5);
  const credReturned = stake - penalty;

  const handleRevoke = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await revokeVouch(userId);
      onSuccess(result.penaltyPaid);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke vouch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <AlertTriangle size={24} color="#ef4444" />
            <Text style={styles.title}>Revoke Vouch</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text style={styles.infoText}>
            You vouched <Text style={styles.highlight}>{stake} cred</Text> for @{username}
          </Text>

          {/* Penalty Box */}
          <View style={styles.penaltyBox}>
            <Text style={styles.penaltyLabel}>Revoking costs 50% of your stake:</Text>
            <Text style={styles.penaltyAmount}>-{penalty} cred</Text>
          </View>

          <Text style={styles.penaltyNote}>
            This cred is lost permanently.{'\n'}
            Your remaining stake ({credReturned}) returns to you.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Actions */}
          <TouchableOpacity
            style={[styles.revokeButton, loading && styles.revokeButtonDisabled]}
            onPress={handleRevoke}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.revokeText}>Revoke & Lose {penalty} Cred</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.keepButton}>
            <Text style={styles.keepText}>Keep Vouch</Text>
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.node.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.node.muted,
    marginBottom: 20,
  },
  highlight: {
    color: COLORS.node.text,
    fontWeight: '600',
  },
  penaltyBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  penaltyLabel: {
    color: COLORS.node.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  penaltyAmount: {
    color: '#ef4444',
    fontSize: 28,
    fontWeight: 'bold',
  },
  penaltyNote: {
    color: COLORS.node.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  revokeButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  revokeButtonDisabled: {
    opacity: 0.5,
  },
  revokeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  keepButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  keepText: {
    color: COLORS.node.muted,
    fontSize: 14,
  },
});
