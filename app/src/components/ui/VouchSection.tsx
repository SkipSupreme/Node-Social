import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Handshake, CheckCircle } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { getVouchStats, VouchStats } from '../../lib/api';
import { VouchModal } from './VouchModal';
import { RevokeVouchModal } from './RevokeVouchModal';

interface VouchSectionProps {
  userId: string;
  username: string;
  currentUserCred: number;
  isOwnProfile: boolean;
  onVouchChange?: () => void;
}

const STAKE_TIERS = [100, 500, 1000];
const MIN_CRED_TO_VOUCH = 100;

export const VouchSection: React.FC<VouchSectionProps> = ({
  userId,
  username,
  currentUserCred,
  isOwnProfile,
  onVouchChange,
}) => {
  const [stats, setStats] = useState<VouchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [vouchModalVisible, setVouchModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await getVouchStats(userId);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch vouch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const handleVouchSuccess = () => {
    fetchStats();
    onVouchChange?.();
  };

  const handleRevokeSuccess = () => {
    fetchStats();
    onVouchChange?.();
  };

  const canVouch = !isOwnProfile && currentUserCred >= MIN_CRED_TO_VOUCH;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.node.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Handshake size={20} color={COLORS.node.accent} />
        <Text style={styles.title}>Web of Trust</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          Vouched by <Text style={styles.statsHighlight}>{stats?.vouchesReceivedCount || 0}</Text> people
        </Text>
        <Text style={styles.statsText}>
          (<Text style={styles.statsHighlight}>{stats?.totalStakeReceived || 0}</Text> cred)
        </Text>
      </View>

      {/* Top Vouchers */}
      {stats && stats.topVouchers.length > 0 && (
        <View style={styles.vouchersRow}>
          {stats.topVouchers.slice(0, 3).map((v) => (
            <View key={v.id} style={styles.voucherAvatar}>
              {v.voucher?.avatar ? (
                <Image source={{ uri: v.voucher.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {v.voucher?.username?.[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
          ))}
          {stats.topVouchers.length > 3 && (
            <View style={styles.moreCount}>
              <Text style={styles.moreText}>+{stats.topVouchers.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      {!isOwnProfile && (
        <View style={styles.actionsContainer}>
          {stats?.hasVouched ? (
            /* Already vouched state */
            <View style={styles.vouchedRow}>
              <View style={styles.vouchedBadge}>
                <CheckCircle size={16} color="#10b981" />
                <Text style={styles.vouchedText}>
                  You vouched {stats.myVouchStake} cred
                </Text>
              </View>
              <TouchableOpacity
                style={styles.revokeButton}
                onPress={() => setRevokeModalVisible(true)}
              >
                <Text style={styles.revokeButtonText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          ) : canVouch ? (
            /* Can vouch - show tier buttons */
            <View style={styles.tierContainer}>
              <View style={styles.tierRow}>
                {STAKE_TIERS.map((tier) => (
                  <TouchableOpacity
                    key={tier}
                    style={styles.tierButton}
                    onPress={() => {
                      setVouchModalVisible(true);
                    }}
                  >
                    <Text style={styles.tierButtonText}>Vouch {tier}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.customButton}
                onPress={() => setVouchModalVisible(true)}
              >
                <Text style={styles.customButtonText}>Custom amount...</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Can't vouch */
            <View style={styles.cantVouchBox}>
              <Text style={styles.cantVouchText}>
                Need {MIN_CRED_TO_VOUCH}+ cred to vouch
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Modals */}
      <VouchModal
        visible={vouchModalVisible}
        onClose={() => setVouchModalVisible(false)}
        onSuccess={handleVouchSuccess}
        userId={userId}
        username={username}
      />

      <RevokeVouchModal
        visible={revokeModalVisible}
        onClose={() => setRevokeModalVisible(false)}
        onSuccess={handleRevokeSuccess}
        userId={userId}
        username={username}
        stake={stats?.myVouchStake || 0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.node.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  statsHighlight: {
    color: COLORS.node.text,
    fontWeight: '600',
  },
  vouchersRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  voucherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.node.border,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: COLORS.node.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreCount: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.node.bg,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: COLORS.node.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 4,
  },
  tierContainer: {},
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tierButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.node.accent,
    alignItems: 'center',
  },
  tierButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  customButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    alignItems: 'center',
  },
  customButtonText: {
    color: COLORS.node.muted,
    fontSize: 13,
  },
  vouchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vouchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vouchedText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  revokeButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  cantVouchBox: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.node.bg,
    alignItems: 'center',
  },
  cantVouchText: {
    color: COLORS.node.muted,
    fontSize: 13,
  },
});
