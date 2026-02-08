import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { revokeVouch } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAppTheme } from '../../hooks/useTheme';

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
  const theme = useAppTheme();
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to revoke vouch'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <AlertTriangle size={24} color="#ef4444" />
            <Text style={[styles.title, { color: theme.text }]}>Revoke Vouch</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text style={[styles.infoText, { color: theme.muted }]}>
            You vouched <Text style={[styles.highlight, { color: theme.text }]}>{stake} cred</Text> for @{username}
          </Text>

          {/* Penalty Box */}
          <View style={styles.penaltyBox}>
            <Text style={[styles.penaltyLabel, { color: theme.muted }]}>Revoking costs 50% of your stake:</Text>
            <Text style={styles.penaltyAmount}>-{penalty} cred</Text>
          </View>

          <Text style={[styles.penaltyNote, { color: theme.muted }]}>
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
            <Text style={[styles.keepText, { color: theme.muted }]}>Keep Vouch</Text>
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  infoText: {
    fontSize: 15,
    marginBottom: 20,
  },
  highlight: {
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
    fontSize: 13,
    marginBottom: 4,
  },
  penaltyAmount: {
    color: '#ef4444',
    fontSize: 28,
    fontWeight: 'bold',
  },
  penaltyNote: {
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
    fontSize: 14,
  },
});
