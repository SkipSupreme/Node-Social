/**
 * Node Charter Service
 * Per governance.md Section 4.2 - Smart Contract Governance
 *
 * "The Node Charter is not just text; it is a configuration file"
 * Charters encode governance rules that are automatically enforced.
 */

import type { PrismaClient, NodeCharter } from '@prisma/client';

// Default charter values
const DEFAULT_CHARTER = {
  governanceStyle: 'republic',
  modTermLengthDays: 180,
  modTermsAllowed: 3,
  incumbencyThreshold: 0.55,
  banAppealThresholdHours: 24,
  autoAppealEnabled: true,
  explorationRate: 0.10,
  autoModLevel: 'medium',
  requireCitations: false,
  minTrustToPost: 'shadow',
  quorumPercent: 0.10,
  supermajorityPercent: 0.67,
};

export type GovernanceStyle = 'dictatorship' | 'republic' | 'democracy';
export type AutoModLevel = 'low' | 'medium' | 'high';
export type TrustTier = 'gold' | 'silver' | 'bronze' | 'shadow';

export interface CharterConfig {
  governanceStyle: GovernanceStyle;
  modTermLengthDays: number;
  modTermsAllowed: number;
  incumbencyThreshold: number;
  banAppealThresholdHours: number;
  autoAppealEnabled: boolean;
  explorationRate: number;
  autoModLevel: AutoModLevel;
  requireCitations: boolean;
  minTrustToPost: TrustTier;
  quorumPercent: number;
  supermajorityPercent: number;
}

/**
 * Create a new charter for a node with default values.
 */
export async function createCharter(
  prisma: PrismaClient,
  nodeId: string,
  config?: Partial<CharterConfig>
): Promise<NodeCharter> {
  return prisma.nodeCharter.create({
    data: {
      nodeId,
      ...DEFAULT_CHARTER,
      ...config,
    },
  });
}

/**
 * Get a node's charter, creating one with defaults if it doesn't exist.
 */
export async function getOrCreateCharter(
  prisma: PrismaClient,
  nodeId: string
): Promise<NodeCharter> {
  let charter = await prisma.nodeCharter.findUnique({
    where: { nodeId },
  });

  if (!charter) {
    charter = await createCharter(prisma, nodeId);
  }

  return charter;
}

/**
 * Update a charter field and log the amendment.
 */
export async function amendCharter(
  prisma: PrismaClient,
  nodeId: string,
  field: keyof CharterConfig,
  newValue: string | number | boolean,
  proposedBy: string,
  reason?: string
): Promise<NodeCharter> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  const oldValue = (charter as Record<string, unknown>)[field];

  // Log the amendment
  await prisma.charterAmendment.create({
    data: {
      charterId: charter.id,
      field,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      proposedBy,
      reason: reason ?? null,
    },
  });

  // Update the charter
  return prisma.nodeCharter.update({
    where: { nodeId },
    data: { [field]: newValue },
  });
}

/**
 * Check if a user meets the minimum trust tier to post in a node.
 */
export async function canUserPost(
  prisma: PrismaClient,
  nodeId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  const trustScore = await prisma.trustScore.findUnique({
    where: { userId },
    select: { tier: true },
  });

  const userTier = trustScore?.tier || 'shadow';
  const minTier = charter.minTrustToPost;

  // Tier hierarchy: gold > silver > bronze > shadow
  const tierOrder = { gold: 3, silver: 2, bronze: 1, shadow: 0 };
  const userTierValue = tierOrder[userTier as TrustTier] ?? 0;
  const minTierValue = tierOrder[minTier as TrustTier] ?? 0;

  if (userTierValue >= minTierValue) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `This node requires ${minTier} tier or higher to post. Your current tier: ${userTier}`,
  };
}

/**
 * Check if a ban should automatically trigger an appeal.
 * Per governance.md: Bans > 24 hours go to Node Jury.
 */
export async function shouldAutoAppeal(
  prisma: PrismaClient,
  nodeId: string,
  banDurationHours: number
): Promise<boolean> {
  const charter = await getOrCreateCharter(prisma, nodeId);

  if (!charter.autoAppealEnabled) {
    return false;
  }

  return banDurationHours > charter.banAppealThresholdHours;
}

/**
 * Calculate the vote threshold needed for a moderator to win re-election.
 * Per governance.md Section 7.3: Incumbency Disadvantage.
 * 2nd term needs 55%, 3rd term needs 60%, etc.
 */
export function calculateIncumbencyThreshold(
  charter: NodeCharter,
  termNumber: number
): number {
  if (termNumber <= 1) {
    return 0.50; // First term: simple majority
  }

  // Each additional term adds 5%
  const additionalPercent = (termNumber - 1) * 0.05;
  return Math.min(0.75, charter.incumbencyThreshold + additionalPercent);
}

/**
 * Check if a moderator has exceeded their term limits.
 */
export async function isTermLimitExceeded(
  prisma: PrismaClient,
  nodeId: string,
  userId: string,
  currentTermNumber: number
): Promise<boolean> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  return currentTermNumber >= charter.modTermsAllowed;
}

/**
 * Get the exploration rate for a node's feed.
 * Per governance.md Section 5.3: Exploration Tax.
 */
export async function getExplorationRate(
  prisma: PrismaClient,
  nodeId: string
): Promise<number> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  return charter.explorationRate;
}

/**
 * Check if a vote meets quorum requirements.
 */
export async function meetsQuorum(
  prisma: PrismaClient,
  nodeId: string,
  voterCount: number,
  totalEligibleVoters: number
): Promise<boolean> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  const quorumNeeded = Math.ceil(totalEligibleVoters * charter.quorumPercent);
  return voterCount >= quorumNeeded;
}

/**
 * Check if a vote meets supermajority requirements.
 */
export async function meetsSupermajority(
  prisma: PrismaClient,
  nodeId: string,
  yesVotes: number,
  totalVotes: number
): Promise<boolean> {
  const charter = await getOrCreateCharter(prisma, nodeId);
  const percentYes = totalVotes > 0 ? yesVotes / totalVotes : 0;
  return percentYes >= charter.supermajorityPercent;
}

/**
 * Get charter amendments history.
 */
export async function getCharterHistory(
  prisma: PrismaClient,
  nodeId: string,
  limit: number = 50
) {
  const charter = await prisma.nodeCharter.findUnique({
    where: { nodeId },
    include: {
      amendments: {
        orderBy: { approvedAt: 'desc' },
        take: limit,
      },
    },
  });

  return charter?.amendments || [];
}

export const charterConstants = {
  DEFAULT_CHARTER,
  GOVERNANCE_STYLES: ['dictatorship', 'republic', 'democracy'] as const,
  AUTO_MOD_LEVELS: ['low', 'medium', 'high'] as const,
  TRUST_TIERS: ['gold', 'silver', 'bronze', 'shadow'] as const,
};
