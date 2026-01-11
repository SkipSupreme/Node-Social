/**
 * Bicameral Governance Service
 * Per governance.md Section 7 - Governance Structures: Councils and Elections
 *
 * House 1: Vibe Council (The Commons) - one-person-one-vote
 *   Representing the general user base
 *   Mandate: User experience, "Fun" initiatives, feature requests
 *
 * House 2: Node Senate (The Lords) - weighted by Trust + Quadratic Voting
 *   Representing Node Operators and High-Trust contributors
 *   Mandate: Technical stability, Protocol parameters, Economic security
 *
 * Checks and Balances: Major changes require majority in BOTH houses.
 */

import type { PrismaClient } from '@prisma/client';

// Configuration
const VOICE_CREDITS_PER_CYCLE = 100;
const CYCLE_LENGTH_DAYS = 30;
const VIBE_COUNCIL_SIZE = 11;
const NODE_SENATE_SIZE = 9;
const DEFAULT_VOTING_PERIOD_DAYS = 7;

// Term limits (per Section 7.3)
const TERM_LENGTH_DAYS = 180; // 6 months
const RECALL_SIGNATURE_THRESHOLD = 0.10; // 10% of active electorate

export type House = 'vibe_council' | 'node_senate';
export type ProposalType = 'feature' | 'policy' | 'protocol' | 'emergency';
export type ProposalStatus = 'draft' | 'voting' | 'passed' | 'rejected' | 'vetoed';
export type VoteDirection = 'yes' | 'no' | 'abstain';

/**
 * Get or create voice credits for the current cycle.
 */
export async function getVoiceCredits(
  prisma: PrismaClient,
  userId: string
): Promise<{ allocated: number; spent: number; remaining: number }> {
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // End of month

  let credits = await prisma.voiceCredits.findUnique({
    where: {
      userId_cycleStart: { userId, cycleStart },
    },
  });

  if (!credits) {
    credits = await prisma.voiceCredits.create({
      data: {
        userId,
        cycleStart,
        cycleEnd,
        allocated: VOICE_CREDITS_PER_CYCLE,
        spent: 0,
        remaining: VOICE_CREDITS_PER_CYCLE,
      },
    });
  }

  return {
    allocated: credits.allocated,
    spent: credits.spent,
    remaining: credits.remaining,
  };
}

/**
 * Calculate quadratic vote weight.
 * Per governance.md Section 7.2: Cost = (Votes)²
 * 1 vote = 1 credit, 2 votes = 4 credits, 10 votes = 100 credits
 */
export function calculateQuadraticVote(creditsToSpend: number): number {
  return Math.sqrt(creditsToSpend);
}

/**
 * Create a governance proposal.
 */
export async function createProposal(
  prisma: PrismaClient,
  proposerId: string,
  title: string,
  description: string,
  proposalType: ProposalType,
  votingPeriodDays: number = DEFAULT_VOTING_PERIOD_DAYS
): Promise<string> {
  // Protocol changes require both houses
  const requiresBothHouses = proposalType === 'protocol' || proposalType === 'emergency';

  const now = new Date();
  const votingStartsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Starts tomorrow
  const votingEndsAt = new Date(votingStartsAt.getTime() + votingPeriodDays * 24 * 60 * 60 * 1000);

  // Calculate quorum requirements
  const totalUsers = await prisma.user.count();
  const vibeCouncilQuorum = Math.ceil(totalUsers * 0.05); // 5% of users

  const highTrustCount = await prisma.trustScore.count({
    where: { tier: { in: ['gold', 'silver'] } },
  });
  const nodeSenateQuorum = highTrustCount * 0.10; // 10% of high-trust users

  const proposal = await prisma.governanceProposal.create({
    data: {
      title,
      description,
      proposerId,
      proposalType,
      requiresBothHouses,
      votingStartsAt,
      votingEndsAt,
      status: 'draft',
      vibeCouncilQuorum,
      nodeSenateQuorum,
    },
  });

  return proposal.id;
}

/**
 * Start voting on a proposal.
 */
export async function startProposalVoting(
  prisma: PrismaClient,
  proposalId: string
): Promise<void> {
  await prisma.governanceProposal.update({
    where: { id: proposalId },
    data: { status: 'voting' },
  });
}

/**
 * Cast a vote on a proposal.
 */
export async function castVote(
  prisma: PrismaClient,
  proposalId: string,
  voterId: string,
  house: House,
  vote: VoteDirection,
  creditsToSpend: number = 1
): Promise<void> {
  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  if (proposal.status !== 'voting') {
    throw new Error('Proposal is not in voting phase');
  }

  const now = new Date();
  if (now < proposal.votingStartsAt || now > proposal.votingEndsAt) {
    throw new Error('Voting period is not active');
  }

  // Validate house eligibility
  if (house === 'node_senate') {
    const trustScore = await prisma.trustScore.findUnique({
      where: { userId: voterId },
    });

    if (!trustScore || !['gold', 'silver'].includes(trustScore.tier)) {
      throw new Error('Must be Gold or Silver tier to vote in Node Senate');
    }
  }

  // For Node Senate, use quadratic voting
  let voteWeight = 1;
  if (house === 'node_senate' && creditsToSpend > 1) {
    // Check and deduct voice credits
    const credits = await getVoiceCredits(prisma, voterId);

    if (credits.remaining < creditsToSpend) {
      throw new Error(`Insufficient voice credits. Have: ${credits.remaining}, Need: ${creditsToSpend}`);
    }

    voteWeight = calculateQuadraticVote(creditsToSpend);

    // Deduct credits
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    await prisma.voiceCredits.update({
      where: {
        userId_cycleStart: { userId: voterId, cycleStart },
      },
      data: {
        spent: { increment: creditsToSpend },
        remaining: { decrement: creditsToSpend },
      },
    });
  }

  // Record vote
  await prisma.governanceVote.upsert({
    where: {
      proposalId_voterId_house: { proposalId, voterId, house },
    },
    update: {
      vote,
      voiceCreditsSpent: creditsToSpend,
      voteWeight,
    },
    create: {
      proposalId,
      voterId,
      house,
      vote,
      voiceCreditsSpent: creditsToSpend,
      voteWeight,
    },
  });

  // Update proposal tallies
  await updateProposalTallies(prisma, proposalId);
}

/**
 * Update the vote tallies for a proposal.
 */
async function updateProposalTallies(
  prisma: PrismaClient,
  proposalId: string
): Promise<void> {
  // Vibe Council (simple count)
  const vibeCouncilVotes = await prisma.governanceVote.groupBy({
    by: ['vote'],
    where: { proposalId, house: 'vibe_council' },
    _count: true,
  });

  let vibeCouncilYes = 0;
  let vibeCouncilNo = 0;
  for (const v of vibeCouncilVotes) {
    if (v.vote === 'yes') vibeCouncilYes = v._count;
    if (v.vote === 'no') vibeCouncilNo = v._count;
  }

  // Node Senate (weighted sum)
  const nodeSenateVotes = await prisma.governanceVote.findMany({
    where: { proposalId, house: 'node_senate' },
    select: { vote: true, voteWeight: true },
  });

  let nodeSenateYes = 0;
  let nodeSenateNo = 0;
  for (const v of nodeSenateVotes) {
    if (v.vote === 'yes') nodeSenateYes += v.voteWeight;
    if (v.vote === 'no') nodeSenateNo += v.voteWeight;
  }

  await prisma.governanceProposal.update({
    where: { id: proposalId },
    data: {
      vibeCouncilYes,
      vibeCouncilNo,
      nodeSenateYes,
      nodeSenateNo,
    },
  });
}

/**
 * Finalize a proposal after voting ends.
 */
export async function finalizeProposal(
  prisma: PrismaClient,
  proposalId: string
): Promise<{ status: ProposalStatus; reason: string }> {
  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  // Check Vibe Council result
  const vibeCouncilTotal = proposal.vibeCouncilYes + proposal.vibeCouncilNo;
  const vibeCouncilPassed =
    vibeCouncilTotal >= proposal.vibeCouncilQuorum &&
    proposal.vibeCouncilYes > proposal.vibeCouncilNo;

  // Check Node Senate result
  const nodeSenateTotal = proposal.nodeSenateYes + proposal.nodeSenateNo;
  const nodeSenatePassed =
    nodeSenateTotal >= proposal.nodeSenateQuorum &&
    proposal.nodeSenateYes > proposal.nodeSenateNo;

  // Determine final status
  let status: ProposalStatus;
  let reason: string;

  if (proposal.requiresBothHouses) {
    if (vibeCouncilPassed && nodeSenatePassed) {
      status = 'passed';
      reason = 'Approved by both houses';
    } else if (!vibeCouncilPassed && !nodeSenatePassed) {
      status = 'rejected';
      reason = 'Rejected by both houses';
    } else if (!vibeCouncilPassed) {
      status = 'rejected';
      reason = 'Vetoed by Vibe Council';
    } else {
      status = 'rejected';
      reason = 'Vetoed by Node Senate';
    }
  } else {
    // Single house proposals (default to Vibe Council for features, Node Senate for technical)
    if (proposal.proposalType === 'feature' || proposal.proposalType === 'policy') {
      status = vibeCouncilPassed ? 'passed' : 'rejected';
      reason = vibeCouncilPassed ? 'Approved by Vibe Council' : 'Rejected by Vibe Council';
    } else {
      status = nodeSenatePassed ? 'passed' : 'rejected';
      reason = nodeSenatePassed ? 'Approved by Node Senate' : 'Rejected by Node Senate';
    }
  }

  await prisma.governanceProposal.update({
    where: { id: proposalId },
    data: {
      status,
      vibeCouncilPassed,
      nodeSenatePassed,
    },
  });

  return { status, reason };
}

/**
 * Add a council member.
 */
export async function addCouncilMember(
  prisma: PrismaClient,
  userId: string,
  house: House,
  representingNodeId?: string
): Promise<void> {
  const now = new Date();
  const termEndsAt = new Date(now.getTime() + TERM_LENGTH_DAYS * 24 * 60 * 60 * 1000);

  // Check existing membership
  const existing = await prisma.councilMember.findUnique({
    where: {
      userId_house: { userId, house },
    },
  });

  const termNumber = existing ? existing.termNumber + 1 : 1;

  await prisma.councilMember.upsert({
    where: {
      userId_house: { userId, house },
    },
    update: {
      electedAt: now,
      termEndsAt,
      termNumber,
      active: true,
      recalledAt: null,
    },
    create: {
      userId,
      house,
      electedAt: now,
      termEndsAt,
      termNumber,
      representingNodeId: representingNodeId ?? null,
    },
  });
}

/**
 * Create a recall petition.
 * Per governance.md Section 7.3: 10% of active electorate triggers snap election.
 */
export async function createRecallPetition(
  prisma: PrismaClient,
  targetUserId: string,
  house: House,
  reason: string,
  initiatedBy: string
): Promise<string> {
  // Calculate signatures required (10% of active electorate)
  const activeElectorate = await prisma.user.count({
    where: {
      lastActiveAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Active in last 30 days
      },
    },
  });

  const signaturesRequired = Math.ceil(activeElectorate * RECALL_SIGNATURE_THRESHOLD);

  const petition = await prisma.recallPetition.create({
    data: {
      targetUserId,
      house,
      reason,
      initiatedBy,
      signaturesRequired,
    },
  });

  // First signature from initiator
  await signRecallPetition(prisma, petition.id, initiatedBy);

  return petition.id;
}

/**
 * Sign a recall petition.
 */
export async function signRecallPetition(
  prisma: PrismaClient,
  petitionId: string,
  signerId: string
): Promise<{ triggered: boolean }> {
  const petition = await prisma.recallPetition.findUnique({
    where: { id: petitionId },
  });

  if (!petition) {
    throw new Error('Petition not found');
  }

  if (petition.status !== 'collecting') {
    throw new Error('Petition is no longer accepting signatures');
  }

  // Get signer's trust weight
  const trustScore = await prisma.trustScore.findUnique({
    where: { userId: signerId },
  });
  const signatureWeight = trustScore?.decayedScore || 1;

  // Add signature
  await prisma.recallSignature.upsert({
    where: {
      petitionId_signerId: { petitionId, signerId },
    },
    update: { signatureWeight },
    create: {
      petitionId,
      signerId,
      signatureWeight,
    },
  });

  // Update count
  const totalSignatures = await prisma.recallSignature.count({
    where: { petitionId },
  });

  await prisma.recallPetition.update({
    where: { id: petitionId },
    data: { signaturesCollected: totalSignatures },
  });

  // Check if threshold reached
  if (totalSignatures >= petition.signaturesRequired) {
    await prisma.recallPetition.update({
      where: { id: petitionId },
      data: {
        status: 'triggered',
        electionTriggeredAt: new Date(),
      },
    });

    // Recall the council member
    await prisma.councilMember.update({
      where: {
        userId_house: { userId: petition.targetUserId, house: petition.house },
      },
      data: {
        active: false,
        recalledAt: new Date(),
      },
    });

    return { triggered: true };
  }

  return { triggered: false };
}

/**
 * Get active council members.
 */
export async function getActiveCouncilMembers(
  prisma: PrismaClient,
  house?: House
): Promise<Array<{
  userId: string;
  house: string;
  termNumber: number;
  electedAt: Date;
  termEndsAt: Date;
}>> {
  const where: { active: boolean; house?: string } = { active: true };
  if (house) {
    where.house = house;
  }

  return prisma.councilMember.findMany({
    where,
    select: {
      userId: true,
      house: true,
      termNumber: true,
      electedAt: true,
      termEndsAt: true,
    },
    orderBy: { electedAt: 'desc' },
  });
}

/**
 * Get proposals by status.
 */
export async function getProposals(
  prisma: PrismaClient,
  status?: ProposalStatus,
  limit: number = 50
) {
  const where: { status?: string } = {};
  if (status) {
    where.status = status;
  }

  return prisma.governanceProposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      proposer: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

export const bicameralConstants = {
  VOICE_CREDITS_PER_CYCLE,
  CYCLE_LENGTH_DAYS,
  VIBE_COUNCIL_SIZE,
  NODE_SENATE_SIZE,
  DEFAULT_VOTING_PERIOD_DAYS,
  TERM_LENGTH_DAYS,
  RECALL_SIGNATURE_THRESHOLD,
};
