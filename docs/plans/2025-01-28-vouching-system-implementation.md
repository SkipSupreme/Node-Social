# Vouching System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the vouching UI - profile vouch section, confirmation modals, and vouch management screen.

**Architecture:** Backend already has vouch endpoints. We add 50% revoke penalty logic, then build 4 frontend components: VouchSection (profile), VouchModal (confirm), RevokeVouchModal (revoke), MyVouchesScreen (manage). Wire into existing Sidebar and App.tsx navigation.

**Tech Stack:** React Native/Expo, TypeScript, existing api.ts functions, Prisma for backend penalty logic.

---

## Task 1: Backend - Add Revoke Penalty Logic

**Files:**
- Modify: `backend/api/prisma/schema.prisma` (add penaltyPaid field)
- Modify: `backend/api/src/routes/vouch.ts:82-110` (update DELETE handler)

**Step 1: Add penaltyPaid field to Vouch model**

In `backend/api/prisma/schema.prisma`, find the Vouch model and add:

```prisma
model Vouch {
  id          String   @id @default(uuid())
  voucherId   String
  voucher     User     @relation("VouchGiver", fields: [voucherId], references: [id], onDelete: Cascade)
  voucheeId   String
  vouchee     User     @relation("VouchReceiver", fields: [voucheeId], references: [id], onDelete: Cascade)
  stake       Int      @default(100)
  penaltyPaid Int?     // ADD THIS LINE - Cred lost when revoked
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  revokedAt   DateTime?

  @@unique([voucherId, voucheeId])
  @@index([voucheeId])
  @@index([voucherId, active])
  @@map("vouches")
}
```

**Step 2: Run migration**

```bash
cd backend/api
npx prisma migrate dev --name add_vouch_penalty
```

Expected: Migration creates successfully, penaltyPaid column added.

**Step 3: Update DELETE handler with penalty logic**

In `backend/api/src/routes/vouch.ts`, replace the DELETE handler (lines ~82-110):

```typescript
// DELETE /vouch/:userId - Revoke vouch with 50% penalty
fastify.delete<{ Params: { userId: string } }>(
  '/:userId',
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { userId: voucheeId } = request.params;
    const voucherId = (request.user as { id: string }).id;

    const vouch = await fastify.prisma.vouch.findUnique({
      where: {
        voucherId_voucheeId: { voucherId, voucheeId },
      },
    });

    if (!vouch || !vouch.active) {
      return reply.status(404).send({ error: 'Active vouch not found' });
    }

    // Calculate 50% penalty
    const penalty = Math.floor(vouch.stake * 0.5);

    // Transaction: deduct penalty from voucher's cred and update vouch
    const [updatedVouch] = await fastify.prisma.$transaction([
      fastify.prisma.vouch.update({
        where: { id: vouch.id },
        data: {
          active: false,
          revokedAt: new Date(),
          penaltyPaid: penalty,
        },
      }),
      fastify.prisma.user.update({
        where: { id: voucherId },
        data: {
          cred: { decrement: penalty },
        },
      }),
    ]);

    return reply.send({
      success: true,
      vouch: updatedVouch,
      penaltyPaid: penalty,
      credReturned: vouch.stake - penalty,
    });
  }
);
```

**Step 4: Run backend lint**

```bash
cd backend/api && npm run lint
```

Expected: No errors.

**Step 5: Commit**

```bash
git add backend/api/prisma/schema.prisma backend/api/src/routes/vouch.ts
git commit -m "feat(backend): add 50% penalty on vouch revoke"
```

---

## Task 2: Frontend - Update API Types

**Files:**
- Modify: `app/src/lib/api.ts` (update Vouch type and revokeVouch return type)

**Step 1: Update Vouch type**

Find the `Vouch` type (~line 786) and add penaltyPaid:

```typescript
export type Vouch = {
  id: string;
  voucherId: string;
  voucheeId: string;
  stake: number;
  penaltyPaid?: number;  // ADD THIS
  active: boolean;
  createdAt: string;
  revokedAt?: string;
  voucher?: {
    id: string;
    username: string;
    avatar?: string;
    cred: number;
  };
  vouchee?: {
    id: string;
    username: string;
    avatar?: string;
    cred: number;
  };
};
```

**Step 2: Update revokeVouch return type**

Find `revokeVouch` function (~line 823) and update:

```typescript
export function revokeVouch(userId: string) {
  return request<{ success: boolean; vouch: Vouch; penaltyPaid: number; credReturned: number }>(`/api/v1/vouch/${userId}`, {
    method: "DELETE",
  });
}
```

**Step 3: Run frontend lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 4: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api): update vouch types with penalty fields"
```

---

## Task 3: Frontend - Create VouchModal Component

**Files:**
- Create: `app/src/components/ui/VouchModal.tsx`

**Step 1: Create the gravity modal component**

Create `app/src/components/ui/VouchModal.tsx`:

```typescript
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
```

**Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/src/components/ui/VouchModal.tsx
git commit -m "feat(ui): add VouchModal gravity confirmation component"
```

---

## Task 4: Frontend - Create RevokeVouchModal Component

**Files:**
- Create: `app/src/components/ui/RevokeVouchModal.tsx`

**Step 1: Create the revoke modal component**

Create `app/src/components/ui/RevokeVouchModal.tsx`:

```typescript
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
```

**Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/src/components/ui/RevokeVouchModal.tsx
git commit -m "feat(ui): add RevokeVouchModal with penalty warning"
```

---

## Task 5: Frontend - Create VouchSection Component

**Files:**
- Create: `app/src/components/ui/VouchSection.tsx`

**Step 1: Create the profile vouch section component**

Create `app/src/components/ui/VouchSection.tsx`:

```typescript
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
```

**Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/src/components/ui/VouchSection.tsx
git commit -m "feat(ui): add VouchSection profile component"
```

---

## Task 6: Frontend - Add VouchSection to ProfileScreen

**Files:**
- Modify: `app/src/screens/ProfileScreen.tsx`

**Step 1: Import VouchSection**

At the top of ProfileScreen.tsx, add the import:

```typescript
import { VouchSection } from '../components/ui/VouchSection';
```

Also import useAuthStore if not already:

```typescript
import { useAuthStore } from '../store/auth';
```

**Step 2: Add VouchSection after Cred Section**

Find the closing `</TouchableOpacity>` of the Cred Section (around line 236), and add VouchSection after it:

```tsx
            </TouchableOpacity>

            {/* Web of Trust Section */}
            {user?.id && (
              <View style={{ marginTop: 16 }}>
                <VouchSection
                  userId={user.id}
                  username={user.username || 'user'}
                  currentUserCred={authUser?.cred || 0}
                  isOwnProfile={authUser?.id === user.id}
                />
              </View>
            )}

            {/* Stats Grid */}
```

**Step 3: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 4: Commit**

```bash
git add app/src/screens/ProfileScreen.tsx
git commit -m "feat(profile): integrate VouchSection into ProfileScreen"
```

---

## Task 7: Frontend - Create MyVouchesScreen

**Files:**
- Create: `app/src/screens/MyVouchesScreen.tsx`

**Step 1: Create the vouch management screen**

Create `app/src/screens/MyVouchesScreen.tsx`:

```typescript
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
```

**Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/src/screens/MyVouchesScreen.tsx
git commit -m "feat(screen): add MyVouchesScreen for vouch management"
```

---

## Task 8: Frontend - Wire Up Sidebar and App.tsx

**Files:**
- Modify: `app/src/components/ui/Sidebar.tsx`
- Modify: `app/App.tsx`

**Step 1: Add Handshake icon to Icons.tsx**

In `app/src/components/ui/Icons.tsx`, add Handshake to both import and export:

```typescript
import {
    // ... existing imports ...
    Crown, Handshake  // ADD Handshake
} from 'lucide-react-native';

export {
    // ... existing exports ...
    Crown, Handshake  // ADD Handshake
};
```

**Step 2: Add My Vouches to Sidebar props**

In `app/src/components/ui/Sidebar.tsx`, add to interface:

```typescript
interface SidebarProps {
    // ... existing props ...
    onVouchesClick?: () => void;  // ADD THIS
}
```

Add to destructuring:

```typescript
export const Sidebar = ({
    // ... existing ...
    onVouchesClick,  // ADD THIS
    // ...
}: SidebarProps) => {
```

**Step 3: Add NavItem for My Vouches**

In the collapsed view section (after Council), add:

```tsx
<CollapsedNavItem
    icon={Handshake}
    active={currentView === 'vouches'}
    onPress={onVouchesClick}
/>
```

In the expanded view section (after Council), add:

```tsx
<NavItem
    icon={Handshake}
    label="My Vouches"
    active={currentView === 'vouches'}
    onPress={() => {
        if (onClose && !isDesktop) onClose();
        if (onVouchesClick) onVouchesClick();
    }}
/>
```

**Step 4: Update App.tsx currentView type**

In `app/App.tsx`, update the currentView type:

```typescript
const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'beta' | 'notifications' | 'saved' | 'cred-history' | 'themes' | 'messages' | 'chat' | 'discovery' | 'following' | 'post-detail' | 'moderation' | 'appeals' | 'council' | 'vouches'>('feed');
```

**Step 5: Import MyVouchesScreen**

Add at the top of App.tsx:

```typescript
import { MyVouchesScreen } from './src/screens/MyVouchesScreen';
```

**Step 6: Add onVouchesClick to both Sidebar instances**

In the desktop Sidebar (around line 489):

```tsx
onVouchesClick={() => setCurrentView('vouches')}
```

In the mobile Sidebar modal (around line 717):

```tsx
onVouchesClick={() => {
  setMenuVisible(false);
  setCurrentView('vouches');
}}
```

**Step 7: Add MyVouchesScreen rendering**

After the council screen rendering (around line 657), add:

```tsx
) : currentView === 'vouches' ? (
  <MyVouchesScreen
    onBack={() => setCurrentView('feed')}
    onViewProfile={(userId) => {
      // TODO: Navigate to user profile
      setCurrentView('feed');
    }}
  />
```

**Step 8: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors.

**Step 9: Commit**

```bash
git add app/src/components/ui/Icons.tsx app/src/components/ui/Sidebar.tsx app/App.tsx
git commit -m "feat: wire up MyVouchesScreen to sidebar and navigation"
```

---

## Task 9: Final Integration Test

**Step 1: Start backend**

```bash
cd backend/api && npm run dev
```

**Step 2: Start frontend**

```bash
cd app && npm start
```

**Step 3: Manual test checklist**

- [ ] Navigate to a user's profile → see VouchSection
- [ ] Click "Vouch 100" → see gravity modal with warnings
- [ ] Confirm vouch → vouch succeeds, stats update
- [ ] See "You vouched X cred" with Revoke button
- [ ] Click Revoke → see penalty modal showing 50% loss
- [ ] Navigate to My Vouches → see vouch in list
- [ ] Filter by Given/Received/Revoked works
- [ ] Revoke from My Vouches → penalty applied, appears in Revoked filter

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete vouching system UI implementation"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Backend | Add 50% revoke penalty logic |
| 2 | API Types | Update Vouch type with penaltyPaid |
| 3 | VouchModal | Gravity confirmation modal |
| 4 | RevokeVouchModal | Revoke with penalty warning |
| 5 | VouchSection | Profile vouch stats + buttons |
| 6 | ProfileScreen | Integrate VouchSection |
| 7 | MyVouchesScreen | Vouch management with filters |
| 8 | Sidebar + App | Wire up navigation |
| 9 | Integration | Manual testing |

**Estimated tasks:** 9
**Files created:** 4
**Files modified:** 6
