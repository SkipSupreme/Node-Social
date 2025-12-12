import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Handshake, CheckCircle, Network, Shield, Sparkles, ChevronRight } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';
import { getVouchStats, VouchStats } from '../../lib/api';
import { VouchModal } from './VouchModal';
import { RevokeVouchModal } from './RevokeVouchModal';

interface VouchSectionProps {
  userId: string;
  username: string;
  currentUserCred: number;
  isOwnProfile: boolean;
  onVouchChange?: () => void;
  onViewTrustGraph?: () => void;
}

const STAKE_TIERS = [100, 500, 1000];
const MIN_CRED_TO_VOUCH = 100;

export const VouchSection: React.FC<VouchSectionProps> = ({
  userId,
  username,
  currentUserCred,
  isOwnProfile,
  onVouchChange,
  onViewTrustGraph,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;

  const [stats, setStats] = useState<VouchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [vouchModalVisible, setVouchModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 100,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.glassBackground} />
        <View style={styles.loadingContent}>
          <ActivityIndicator color="#22d3ee" />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      {/* Glass background with glow */}
      <View style={styles.glassBackground} />

      {/* Animated glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.25],
            }),
          },
        ]}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.iconBadge}>
              <Shield size={20} color="#22d3ee" />
            </View>
            <View>
              <Text style={styles.title}>Web of Trust</Text>
              <Text style={styles.subtitle}>Reputation through vouching</Text>
            </View>
          </View>

          {onViewTrustGraph && (
            <TouchableOpacity style={styles.graphButton} onPress={onViewTrustGraph}>
              <Network size={14} color="#22d3ee" />
              <Text style={styles.graphButtonText}>Graph</Text>
              <ChevronRight size={12} color="#22d3ee" />
            </TouchableOpacity>
          )}
        </View>

        {/* Trust Score Display */}
        <View style={styles.trustScoreContainer}>
          <View style={styles.trustScoreLeft}>
            <Text style={styles.trustScoreValue}>
              {stats?.vouchesReceivedCount || 0}
            </Text>
            <Text style={styles.trustScoreLabel}>Vouchers</Text>
          </View>
          <View style={styles.trustScoreDivider} />
          <View style={styles.trustScoreRight}>
            <View style={styles.stakeDisplay}>
              <Sparkles size={14} color="#fbbf24" />
              <Text style={styles.trustStakeValue}>
                {stats?.totalStakeReceived || 0}
              </Text>
            </View>
            <Text style={styles.trustScoreLabel}>Cred Staked</Text>
          </View>
        </View>

        {/* Top Vouchers */}
        {stats && stats.topVouchers.length > 0 && (
          <View style={styles.vouchersSection}>
            <Text style={styles.vouchersSectionTitle}>Backed by</Text>
            <View style={styles.vouchersRow}>
              {stats.topVouchers.slice(0, 5).map((v, index) => (
                <Animated.View
                  key={v.id}
                  style={[
                    styles.voucherAvatar,
                    { marginLeft: index === 0 ? 0 : -10 },
                  ]}
                >
                  {v.voucher?.avatar ? (
                    <Image source={{ uri: v.voucher.avatar }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient
                      colors={['#06b6d4', '#22d3ee']}
                      style={styles.avatarPlaceholder}
                    >
                      <Text style={styles.avatarText}>
                        {v.voucher?.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </LinearGradient>
                  )}
                </Animated.View>
              ))}
              {stats.topVouchers.length > 5 && (
                <View style={[styles.moreCount, { marginLeft: -10 }]}>
                  <Text style={styles.moreText}>+{stats.topVouchers.length - 5}</Text>
                </View>
              )}
            </View>
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
                      onPress={() => setVouchModalVisible(true)}
                    >
                      <Text style={styles.tierButtonText}>{tier}</Text>
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
                <Shield size={16} color={COLORS.node.muted} />
                <Text style={styles.cantVouchText}>
                  Need {MIN_CRED_TO_VOUCH}+ cred to vouch
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${COLORS.node.panel}f5`,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    borderRadius: RADIUS.xl,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  glowRing: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: RADIUS.xl + 20,
    backgroundColor: '#22d3ee',
    ...Platform.select({
      web: {
        filter: 'blur(40px)',
      },
    }),
  },
  content: {
    padding: SPACING.xl,
  },
  loadingContent: {
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h4,
    fontWeight: '700',
    color: COLORS.node.text,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  graphButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  graphButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: '#22d3ee',
  },
  trustScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  trustScoreLeft: {
    flex: 1,
    alignItems: 'center',
  },
  trustScoreRight: {
    flex: 1,
    alignItems: 'center',
  },
  trustScoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.node.border,
    marginHorizontal: SPACING.lg,
  },
  trustScoreValue: {
    fontSize: TYPOGRAPHY.sizes.statMedium,
    fontWeight: '800',
    color: '#22d3ee',
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  trustStakeValue: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  stakeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustScoreLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.node.muted,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.caps,
    marginTop: 4,
  },
  vouchersSection: {
    marginBottom: SPACING.lg,
  },
  vouchersSectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.node.muted,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.caps,
    marginBottom: SPACING.sm,
  },
  vouchersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voucherAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.node.panel,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreCount: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.node.bg,
    borderWidth: 2,
    borderColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: COLORS.node.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  actionsContainer: {
    marginTop: SPACING.sm,
  },
  tierContainer: {},
  tierRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: '#0891b2',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  tierButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: TYPOGRAPHY.sizes.body,
  },
  customButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  customButtonText: {
    color: COLORS.node.muted,
    fontSize: TYPOGRAPHY.sizes.small,
  },
  vouchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  vouchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  vouchedText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: TYPOGRAPHY.sizes.body,
  },
  revokeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  revokeButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: TYPOGRAPHY.sizes.small,
  },
  cantVouchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.node.bg,
  },
  cantVouchText: {
    color: COLORS.node.muted,
    fontSize: TYPOGRAPHY.sizes.small,
  },
});
