import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Handshake, User } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { getVouchesGiven, getVouchesReceived, Vouch } from '../lib/api';
import { RevokeVouchModal } from '../components/ui/RevokeVouchModal';

interface MyVouchesScreenProps {
  onBack: () => void;
  onViewProfile: (userId: string) => void;
}

type FilterType = 'all' | 'given' | 'received' | 'revoked';

interface VouchItem extends Vouch {
  direction: 'given' | 'received';
}

export const MyVouchesScreen: React.FC<MyVouchesScreenProps> = ({ onBack, onViewProfile }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [vouches, setVouches] = useState<VouchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokeModal, setRevokeModal] = useState<{
    visible: boolean;
    userId: string;
    username: string;
    stake: number;
  } | null>(null);

  const fetchVouches = async () => {
    try {
      const [given, received] = await Promise.all([
        getVouchesGiven(),
        getVouchesReceived(),
      ]);

      const allVouches: VouchItem[] = [
        ...given.map((v) => ({ ...v, direction: 'given' as const })),
        ...received.map((v) => ({ ...v, direction: 'received' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setVouches(allVouches);
    } catch (error) {
      console.error('Failed to fetch vouches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVouches();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVouches();
  };

  const handleRevokeSuccess = () => {
    fetchVouches();
    setRevokeModal(null);
  };

  const filteredVouches = vouches.filter((v) => {
    if (filter === 'all') return v.active;
    if (filter === 'given') return v.direction === 'given' && v.active;
    if (filter === 'received') return v.direction === 'received' && v.active;
    if (filter === 'revoked') return !v.active;
    return true;
  });

  const stats = {
    given: vouches.filter((v) => v.direction === 'given' && v.active).length,
    received: vouches.filter((v) => v.direction === 'received' && v.active).length,
    revoked: vouches.filter((v) => !v.active).length,
    totalStaked: vouches
      .filter((v) => v.direction === 'given' && v.active)
      .reduce((sum, v) => sum + v.stake, 0),
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return 'Today';
  };

  const renderVouch = ({ item }: { item: VouchItem }) => {
    const user = item.direction === 'given' ? item.vouchee : item.voucher;
    const isRevoked = !item.active;

    return (
      <View style={[styles.vouchCard, isRevoked && styles.vouchCardRevoked]}>
        <TouchableOpacity
          style={styles.vouchUser}
          onPress={() => user?.id && onViewProfile(user.id)}
        >
          <View style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <User size={20} color={COLORS.node.muted} />
            )}
          </View>
          <View style={styles.vouchInfo}>
            <Text style={styles.username}>@{user?.username || 'user'}</Text>
            <Text style={styles.vouchMeta}>
              {item.direction === 'given' ? 'You vouched' : 'Vouched you'}{' '}
              <Text style={styles.stakeAmount}>{item.stake} cred</Text>
              {' • '}{timeAgo(item.createdAt)}
            </Text>
            {isRevoked && item.penaltyPaid && (
              <Text style={styles.penaltyText}>-{item.penaltyPaid} cred penalty</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.vouchActions}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => user?.id && onViewProfile(user.id)}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
          {item.direction === 'given' && item.active && (
            <TouchableOpacity
              style={styles.revokeBtn}
              onPress={() =>
                setRevokeModal({
                  visible: true,
                  userId: item.voucheeId,
                  username: user?.username || 'user',
                  stake: item.stake,
                })
              }
            >
              <Text style={styles.revokeBtnText}>Revoke</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'given', label: 'Given' },
    { key: 'received', label: 'Received' },
    { key: 'revoked', label: 'Revoked' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={COLORS.node.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vouches</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <Text style={styles.statItem}>
          Total Staked: <Text style={styles.statValue}>{stats.totalStaked} cred</Text>
        </Text>
        <Text style={styles.statItem}>
          Given: <Text style={styles.statValue}>{stats.given}</Text> • Received:{' '}
          <Text style={styles.statValue}>{stats.received}</Text> • Revoked:{' '}
          <Text style={styles.statValue}>{stats.revoked}</Text>
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[styles.filterText, filter === f.key && styles.filterTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vouch List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.node.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredVouches}
          renderItem={renderVouch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.node.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Handshake size={48} color={COLORS.node.muted} />
              <Text style={styles.emptyText}>No vouches yet</Text>
            </View>
          }
        />
      )}

      {/* Revoke Modal */}
      {revokeModal && (
        <RevokeVouchModal
          visible={revokeModal.visible}
          onClose={() => setRevokeModal(null)}
          onSuccess={handleRevokeSuccess}
          userId={revokeModal.userId}
          username={revokeModal.username}
          stake={revokeModal.stake}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.node.text,
  },
  statsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.node.panel,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  statItem: {
    color: COLORS.node.muted,
    fontSize: 13,
    marginBottom: 2,
  },
  statValue: {
    color: COLORS.node.text,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.node.panel,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: COLORS.node.accent,
  },
  filterText: {
    color: COLORS.node.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.node.accent,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vouchCard: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    marginBottom: 12,
  },
  vouchCardRevoked: {
    opacity: 0.6,
  },
  vouchUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.node.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  vouchInfo: {
    flex: 1,
  },
  username: {
    color: COLORS.node.text,
    fontWeight: '600',
    fontSize: 15,
  },
  vouchMeta: {
    color: COLORS.node.muted,
    fontSize: 13,
    marginTop: 2,
  },
  stakeAmount: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
  penaltyText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 2,
  },
  vouchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  viewButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.node.bg,
  },
  viewButtonText: {
    color: COLORS.node.text,
    fontSize: 13,
    fontWeight: '500',
  },
  revokeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  revokeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: COLORS.node.muted,
    fontSize: 16,
    marginTop: 12,
  },
});
