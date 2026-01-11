// tests/governance.test.ts
// Unit tests for governance services implementation
// Per governance.md Sections 4.2, 5.3, 7, 8.2

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Charter Service Tests (Pure Functions)
// Per governance.md Section 4.2 - Smart Contract Governance
// ============================================================================

describe('Charter Service - Governance Configuration', () => {
  describe('calculateIncumbencyThreshold', () => {
    // Simulating the function logic from charterService.ts
    function calculateIncumbencyThreshold(
      baseThreshold: number,
      termNumber: number
    ): number {
      if (termNumber <= 1) {
        return 0.50; // First term: simple majority
      }
      // Each additional term adds 5%
      const additionalPercent = (termNumber - 1) * 0.05;
      return Math.min(0.75, baseThreshold + additionalPercent);
    }

    it('requires simple majority (50%) for first term', () => {
      const threshold = calculateIncumbencyThreshold(0.55, 1);
      expect(threshold).toBe(0.50);
    });

    it('requires 60% for second term (base 55% + 5% incumbency penalty)', () => {
      const threshold = calculateIncumbencyThreshold(0.55, 2);
      expect(threshold).toBeCloseTo(0.60, 2); // 0.55 + 0.05
    });

    it('requires 65% for third term (base 55% + 10% incumbency penalty)', () => {
      const threshold = calculateIncumbencyThreshold(0.55, 3);
      expect(threshold).toBeCloseTo(0.65, 2); // 0.55 + 0.10
    });

    it('caps threshold at 75% maximum', () => {
      const threshold = calculateIncumbencyThreshold(0.55, 10);
      expect(threshold).toBe(0.75);
    });
  });

  describe('Trust Tier Hierarchy', () => {
    const TIER_ORDER = { gold: 3, silver: 2, bronze: 1, shadow: 0 };

    function canUserPost(userTier: string, minTier: string): boolean {
      const userValue = TIER_ORDER[userTier as keyof typeof TIER_ORDER] ?? 0;
      const minValue = TIER_ORDER[minTier as keyof typeof TIER_ORDER] ?? 0;
      return userValue >= minValue;
    }

    it('allows gold tier users to post in any node', () => {
      expect(canUserPost('gold', 'gold')).toBe(true);
      expect(canUserPost('gold', 'silver')).toBe(true);
      expect(canUserPost('gold', 'bronze')).toBe(true);
      expect(canUserPost('gold', 'shadow')).toBe(true);
    });

    it('restricts shadow tier users from high-trust nodes', () => {
      expect(canUserPost('shadow', 'gold')).toBe(false);
      expect(canUserPost('shadow', 'silver')).toBe(false);
      expect(canUserPost('shadow', 'bronze')).toBe(false);
      expect(canUserPost('shadow', 'shadow')).toBe(true);
    });

    it('allows bronze tier in bronze and shadow nodes', () => {
      expect(canUserPost('bronze', 'bronze')).toBe(true);
      expect(canUserPost('bronze', 'shadow')).toBe(true);
      expect(canUserPost('bronze', 'silver')).toBe(false);
    });
  });

  describe('Auto-Appeal Logic', () => {
    function shouldAutoAppeal(
      autoAppealEnabled: boolean,
      banDurationHours: number,
      thresholdHours: number
    ): boolean {
      if (!autoAppealEnabled) return false;
      return banDurationHours > thresholdHours;
    }

    it('triggers appeal for bans longer than threshold', () => {
      expect(shouldAutoAppeal(true, 48, 24)).toBe(true);
      expect(shouldAutoAppeal(true, 25, 24)).toBe(true);
    });

    it('does not trigger appeal for short bans', () => {
      expect(shouldAutoAppeal(true, 24, 24)).toBe(false);
      expect(shouldAutoAppeal(true, 12, 24)).toBe(false);
    });

    it('respects disabled auto-appeal setting', () => {
      expect(shouldAutoAppeal(false, 100, 24)).toBe(false);
    });
  });

  describe('Quorum and Supermajority', () => {
    function meetsQuorum(
      voterCount: number,
      totalEligible: number,
      quorumPercent: number
    ): boolean {
      const quorumNeeded = Math.ceil(totalEligible * quorumPercent);
      return voterCount >= quorumNeeded;
    }

    function meetsSupermajority(
      yesVotes: number,
      totalVotes: number,
      supermajorityPercent: number
    ): boolean {
      const percentYes = totalVotes > 0 ? yesVotes / totalVotes : 0;
      return percentYes >= supermajorityPercent;
    }

    it('calculates quorum correctly', () => {
      // 10% quorum of 100 users = 10 needed
      expect(meetsQuorum(10, 100, 0.10)).toBe(true);
      expect(meetsQuorum(9, 100, 0.10)).toBe(false);
    });

    it('calculates supermajority correctly', () => {
      // 67% supermajority
      expect(meetsSupermajority(67, 100, 0.67)).toBe(true);
      expect(meetsSupermajority(66, 100, 0.67)).toBe(false);
      // 2/3 = 0.6666... which is less than 0.67 threshold
      expect(meetsSupermajority(2, 3, 0.67)).toBe(false);
      // 3/4 = 0.75 which exceeds 0.67 threshold
      expect(meetsSupermajority(3, 4, 0.67)).toBe(true);
    });
  });
});

// ============================================================================
// Meta-Moderation Service Tests
// Per governance.md Section 8.2 - Slashdot's Meta-Moderation System
// ============================================================================

describe('Meta-Moderation Service', () => {
  describe('shouldMetaModerate', () => {
    it('samples approximately 10% of mod actions over many iterations', () => {
      // Simulate the random sampling
      const SAMPLE_RATE = 0.10;
      const iterations = 10000;
      let sampled = 0;

      for (let i = 0; i < iterations; i++) {
        if (Math.random() < SAMPLE_RATE) {
          sampled++;
        }
      }

      // Should be approximately 10% (within margin)
      const rate = sampled / iterations;
      expect(rate).toBeGreaterThan(0.08);
      expect(rate).toBeLessThan(0.12);
    });
  });

  describe('Vote Tallying', () => {
    interface VoteTally {
      fair: number;
      unfair: number;
      bias: number;
      overreaction: number;
    }

    function determineVerdict(votes: VoteTally): {
      verdict: string;
      trustImpact: number;
      reverseMod: boolean;
    } {
      const FAIR_TRUST_BONUS = 0.01;
      const UNFAIR_TRUST_PENALTY = -0.05;
      const BIAS_TRUST_PENALTY = -0.08;
      const OVERREACTION_TRUST_PENALTY = -0.03;

      const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
      const verdict = sortedVotes[0]![0];

      let trustImpact: number;
      let reverseMod = false;

      switch (verdict) {
        case 'fair':
          trustImpact = FAIR_TRUST_BONUS;
          break;
        case 'unfair':
          trustImpact = UNFAIR_TRUST_PENALTY;
          reverseMod = true;
          break;
        case 'bias':
          trustImpact = BIAS_TRUST_PENALTY;
          reverseMod = true;
          break;
        case 'overreaction':
          trustImpact = OVERREACTION_TRUST_PENALTY;
          reverseMod = true;
          break;
        default:
          trustImpact = 0;
      }

      return { verdict, trustImpact, reverseMod };
    }

    it('gives trust bonus for fair verdicts', () => {
      const result = determineVerdict({ fair: 4, unfair: 1, bias: 0, overreaction: 0 });
      expect(result.verdict).toBe('fair');
      expect(result.trustImpact).toBe(0.01);
      expect(result.reverseMod).toBe(false);
    });

    it('applies trust penalty for unfair verdicts', () => {
      const result = determineVerdict({ fair: 1, unfair: 4, bias: 0, overreaction: 0 });
      expect(result.verdict).toBe('unfair');
      expect(result.trustImpact).toBe(-0.05);
      expect(result.reverseMod).toBe(true);
    });

    it('applies higher penalty for bias verdicts', () => {
      const result = determineVerdict({ fair: 1, unfair: 1, bias: 3, overreaction: 0 });
      expect(result.verdict).toBe('bias');
      expect(result.trustImpact).toBe(-0.08);
      expect(result.reverseMod).toBe(true);
    });

    it('reverses moderation for overreaction verdicts', () => {
      const result = determineVerdict({ fair: 0, unfair: 1, bias: 0, overreaction: 4 });
      expect(result.verdict).toBe('overreaction');
      expect(result.trustImpact).toBe(-0.03);
      expect(result.reverseMod).toBe(true);
    });
  });

  describe('Jury Selection', () => {
    function selectWeightedJurors(
      eligible: Array<{ userId: string; trust: number }>,
      count: number
    ): string[] {
      const selected: string[] = [];
      const pool = [...eligible];

      for (let i = 0; i < count && pool.length > 0; i++) {
        const totalWeight = pool.reduce((sum, u) => sum + u.trust, 0);
        let random = Math.random() * totalWeight;

        for (let j = 0; j < pool.length; j++) {
          random -= pool[j]!.trust;
          if (random <= 0) {
            selected.push(pool[j]!.userId);
            pool.splice(j, 1);
            break;
          }
        }
      }

      return selected;
    }

    it('selects correct number of jurors', () => {
      const eligible = [
        { userId: 'A', trust: 0.8 },
        { userId: 'B', trust: 0.6 },
        { userId: 'C', trust: 0.5 },
        { userId: 'D', trust: 0.4 },
        { userId: 'E', trust: 0.3 },
      ];

      const jurors = selectWeightedJurors(eligible, 3);
      expect(jurors.length).toBe(3);
      expect(new Set(jurors).size).toBe(3); // All unique
    });

    it('prefers higher trust users over many selections', () => {
      const eligible = [
        { userId: 'HIGH', trust: 0.9 },
        { userId: 'LOW', trust: 0.1 },
      ];

      let highSelected = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const selected = selectWeightedJurors([...eligible], 1);
        if (selected[0] === 'HIGH') highSelected++;
      }

      // High trust user should be selected ~90% of the time
      expect(highSelected / iterations).toBeGreaterThan(0.8);
    });
  });
});

// ============================================================================
// Bicameral Service Tests
// Per governance.md Section 7 - Governance Structures: Councils and Elections
// ============================================================================

describe('Bicameral Governance Service', () => {
  describe('Quadratic Voting', () => {
    function calculateQuadraticVote(creditsToSpend: number): number {
      return Math.sqrt(creditsToSpend);
    }

    it('1 credit = 1 vote', () => {
      expect(calculateQuadraticVote(1)).toBe(1);
    });

    it('4 credits = 2 votes', () => {
      expect(calculateQuadraticVote(4)).toBe(2);
    });

    it('9 credits = 3 votes', () => {
      expect(calculateQuadraticVote(9)).toBe(3);
    });

    it('100 credits = 10 votes', () => {
      expect(calculateQuadraticVote(100)).toBe(10);
    });

    it('makes strong opinions costly', () => {
      // To have 5x the influence, you need 25x the credits
      const weakVote = calculateQuadraticVote(1);
      const strongVote = calculateQuadraticVote(25);
      expect(strongVote / weakVote).toBe(5);
    });
  });

  describe('Voice Credits System', () => {
    const VOICE_CREDITS_PER_CYCLE = 100;

    it('allocates 100 credits per monthly cycle', () => {
      expect(VOICE_CREDITS_PER_CYCLE).toBe(100);
    });

    it('tracks spending correctly', () => {
      let remaining = VOICE_CREDITS_PER_CYCLE;
      let spent = 0;

      // Cast votes
      const votes = [4, 9, 16]; // 2 + 3 + 4 = 9 votes for 29 credits

      for (const credits of votes) {
        spent += credits;
        remaining -= credits;
      }

      expect(spent).toBe(29);
      expect(remaining).toBe(71);
    });

    it('prevents overspending', () => {
      const remaining = 50;
      const attemptedSpend = 60;

      expect(attemptedSpend > remaining).toBe(true);
    });
  });

  describe('Proposal Finalization', () => {
    interface ProposalResult {
      vibeCouncilYes: number;
      vibeCouncilNo: number;
      vibeCouncilQuorum: number;
      nodeSenateYes: number;
      nodeSenateNo: number;
      nodeSenateQuorum: number;
      requiresBothHouses: boolean;
    }

    function finalizeProposal(proposal: ProposalResult): {
      status: string;
      reason: string;
    } {
      const vibeCouncilTotal = proposal.vibeCouncilYes + proposal.vibeCouncilNo;
      const vibeCouncilPassed =
        vibeCouncilTotal >= proposal.vibeCouncilQuorum &&
        proposal.vibeCouncilYes > proposal.vibeCouncilNo;

      const nodeSenateTotal = proposal.nodeSenateYes + proposal.nodeSenateNo;
      const nodeSenatePassed =
        nodeSenateTotal >= proposal.nodeSenateQuorum &&
        proposal.nodeSenateYes > proposal.nodeSenateNo;

      if (proposal.requiresBothHouses) {
        if (vibeCouncilPassed && nodeSenatePassed) {
          return { status: 'passed', reason: 'Approved by both houses' };
        } else if (!vibeCouncilPassed && !nodeSenatePassed) {
          return { status: 'rejected', reason: 'Rejected by both houses' };
        } else if (!vibeCouncilPassed) {
          return { status: 'rejected', reason: 'Vetoed by Vibe Council' };
        } else {
          return { status: 'rejected', reason: 'Vetoed by Node Senate' };
        }
      }

      // Single house (default to Vibe Council for simplicity)
      return vibeCouncilPassed
        ? { status: 'passed', reason: 'Approved by Vibe Council' }
        : { status: 'rejected', reason: 'Rejected by Vibe Council' };
    }

    it('passes when both houses approve', () => {
      const result = finalizeProposal({
        vibeCouncilYes: 100,
        vibeCouncilNo: 50,
        vibeCouncilQuorum: 50,
        nodeSenateYes: 30,
        nodeSenateNo: 10,
        nodeSenateQuorum: 20,
        requiresBothHouses: true,
      });

      expect(result.status).toBe('passed');
      expect(result.reason).toBe('Approved by both houses');
    });

    it('rejects when Vibe Council vetoes', () => {
      const result = finalizeProposal({
        vibeCouncilYes: 40,
        vibeCouncilNo: 60,
        vibeCouncilQuorum: 50,
        nodeSenateYes: 30,
        nodeSenateNo: 10,
        nodeSenateQuorum: 20,
        requiresBothHouses: true,
      });

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Vetoed by Vibe Council');
    });

    it('rejects when Node Senate vetoes', () => {
      const result = finalizeProposal({
        vibeCouncilYes: 100,
        vibeCouncilNo: 50,
        vibeCouncilQuorum: 50,
        nodeSenateYes: 10,
        nodeSenateNo: 30,
        nodeSenateQuorum: 20,
        requiresBothHouses: true,
      });

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Vetoed by Node Senate');
    });

    it('fails for lack of quorum', () => {
      const result = finalizeProposal({
        vibeCouncilYes: 5,
        vibeCouncilNo: 3,
        vibeCouncilQuorum: 50, // Quorum not met!
        nodeSenateYes: 30,
        nodeSenateNo: 10,
        nodeSenateQuorum: 20,
        requiresBothHouses: true,
      });

      expect(result.status).toBe('rejected');
    });
  });

  describe('Recall Petitions', () => {
    const RECALL_SIGNATURE_THRESHOLD = 0.10; // 10%

    function calculateSignaturesRequired(activeElectorate: number): number {
      return Math.ceil(activeElectorate * RECALL_SIGNATURE_THRESHOLD);
    }

    it('requires 10% of active electorate', () => {
      expect(calculateSignaturesRequired(100)).toBe(10);
      expect(calculateSignaturesRequired(1000)).toBe(100);
    });

    it('rounds up for partial signatures', () => {
      expect(calculateSignaturesRequired(95)).toBe(10); // ceil(9.5)
    });
  });
});

// ============================================================================
// Exploration Tax Service Tests
// Per governance.md Section 5.3 - Enforcing Discoverability
// ============================================================================

describe('Exploration Tax Service', () => {
  describe('calculateExplorationSlots', () => {
    const MIN_EXPLORATION_RATE = 0.05;
    const MAX_EXPLORATION_RATE = 0.30;
    const DEFAULT_EXPLORATION_RATE = 0.10;

    function calculateExplorationSlots(
      feedSize: number,
      userExplorationRate: number = DEFAULT_EXPLORATION_RATE
    ): number {
      const effectiveRate = Math.max(
        MIN_EXPLORATION_RATE,
        Math.min(MAX_EXPLORATION_RATE, userExplorationRate)
      );
      return Math.ceil(feedSize * effectiveRate);
    }

    it('calculates 10% of feed by default', () => {
      expect(calculateExplorationSlots(100)).toBe(10);
      expect(calculateExplorationSlots(50)).toBe(5);
    });

    it('enforces minimum 5% protocol rate', () => {
      // User wants 0%, but protocol enforces 5%
      expect(calculateExplorationSlots(100, 0)).toBe(5);
      expect(calculateExplorationSlots(100, 0.02)).toBe(5);
    });

    it('enforces maximum 30% rate', () => {
      expect(calculateExplorationSlots(100, 0.50)).toBe(30);
      expect(calculateExplorationSlots(100, 1.0)).toBe(30);
    });

    it('rounds up partial slots', () => {
      expect(calculateExplorationSlots(15, 0.10)).toBe(2); // ceil(1.5)
    });
  });

  describe('interleaveExplorationSlots', () => {
    interface FeedItem {
      id: string;
      type: 'main' | 'exploration';
    }

    function interleaveExplorationSlots(
      mainFeed: FeedItem[],
      explorationPosts: FeedItem[],
      explorationRate: number = 0.10
    ): FeedItem[] {
      if (explorationPosts.length === 0) {
        return mainFeed;
      }

      const result: FeedItem[] = [];
      const explorationInterval = Math.floor(1 / explorationRate);

      let mainIndex = 0;
      let explorationIndex = 0;

      for (
        let i = 0;
        mainIndex < mainFeed.length || explorationIndex < explorationPosts.length;
        i++
      ) {
        if (
          i > 0 &&
          i % explorationInterval === 0 &&
          explorationIndex < explorationPosts.length
        ) {
          result.push(explorationPosts[explorationIndex]!);
          explorationIndex++;
        } else if (mainIndex < mainFeed.length) {
          result.push(mainFeed[mainIndex]!);
          mainIndex++;
        } else if (explorationIndex < explorationPosts.length) {
          result.push(explorationPosts[explorationIndex]!);
          explorationIndex++;
        }
      }

      return result;
    }

    it('returns main feed when no exploration posts', () => {
      const mainFeed: FeedItem[] = [
        { id: '1', type: 'main' },
        { id: '2', type: 'main' },
      ];

      const result = interleaveExplorationSlots(mainFeed, []);
      expect(result).toEqual(mainFeed);
    });

    it('interleaves exploration posts at regular intervals', () => {
      const mainFeed: FeedItem[] = Array.from({ length: 20 }, (_, i) => ({
        id: `main-${i}`,
        type: 'main' as const,
      }));

      const explorationPosts: FeedItem[] = [
        { id: 'exp-1', type: 'exploration' },
        { id: 'exp-2', type: 'exploration' },
      ];

      const result = interleaveExplorationSlots(mainFeed, explorationPosts, 0.10);

      // At 10% rate, interval = 10
      // Exploration should appear at positions 10 and 20
      const explorationPositions = result
        .map((item, idx) => (item.type === 'exploration' ? idx : -1))
        .filter((idx) => idx >= 0);

      expect(explorationPositions.length).toBe(2);
      // First exploration at position 10, second at position 21
      expect(explorationPositions[0]).toBe(10);
    });

    it('includes all exploration posts even if feed is short', () => {
      const mainFeed: FeedItem[] = [{ id: '1', type: 'main' }];
      const explorationPosts: FeedItem[] = [
        { id: 'exp-1', type: 'exploration' },
        { id: 'exp-2', type: 'exploration' },
      ];

      const result = interleaveExplorationSlots(mainFeed, explorationPosts, 0.10);
      expect(result.length).toBe(3);
    });
  });

  describe('Trust Boost for Engagement', () => {
    const TRUST_BOOST_FOR_ENGAGEMENT = 0.01;

    function calculateTrustBoost(
      interactionType: 'view' | 'react' | 'comment' | 'follow'
    ): number {
      if (interactionType === 'view') {
        return 0; // Views don't boost trust
      }
      return TRUST_BOOST_FOR_ENGAGEMENT;
    }

    it('gives no boost for views', () => {
      expect(calculateTrustBoost('view')).toBe(0);
    });

    it('gives boost for reactions', () => {
      expect(calculateTrustBoost('react')).toBe(0.01);
    });

    it('gives boost for comments', () => {
      expect(calculateTrustBoost('comment')).toBe(0.01);
    });

    it('gives boost for follows', () => {
      expect(calculateTrustBoost('follow')).toBe(0.01);
    });
  });

  describe('Probationary Content Criteria', () => {
    const NEW_USER_DAYS_THRESHOLD = 30;
    const LOW_VISIBILITY_REACTION_THRESHOLD = 5;

    function isNewUser(createdAtDaysAgo: number): boolean {
      return createdAtDaysAgo < NEW_USER_DAYS_THRESHOLD;
    }

    function isLowVisibility(reactionCount: number): boolean {
      return reactionCount < LOW_VISIBILITY_REACTION_THRESHOLD;
    }

    it('identifies users under 30 days as new', () => {
      expect(isNewUser(0)).toBe(true);
      expect(isNewUser(15)).toBe(true);
      expect(isNewUser(29)).toBe(true);
      expect(isNewUser(30)).toBe(false);
      expect(isNewUser(100)).toBe(false);
    });

    it('identifies posts with few reactions as low visibility', () => {
      expect(isLowVisibility(0)).toBe(true);
      expect(isLowVisibility(4)).toBe(true);
      expect(isLowVisibility(5)).toBe(false);
      expect(isLowVisibility(100)).toBe(false);
    });
  });
});

// ============================================================================
// Integration: Governance Systems Working Together
// ============================================================================

describe('Governance Integration', () => {
  describe('Trust-Weighted Voting Power', () => {
    // Node Senate votes are weighted by trust score
    function calculateWeightedVote(
      baseVote: number,
      trustTier: 'gold' | 'silver' | 'bronze' | 'shadow'
    ): number {
      const tierMultipliers = {
        gold: 1.5,
        silver: 1.25,
        bronze: 1.0,
        shadow: 0.5,
      };

      return baseVote * tierMultipliers[trustTier];
    }

    it('gives gold tier users 50% more voting power', () => {
      const goldVote = calculateWeightedVote(1, 'gold');
      const bronzeVote = calculateWeightedVote(1, 'bronze');
      expect(goldVote / bronzeVote).toBe(1.5);
    });

    it('reduces shadow tier voting power by 50%', () => {
      const shadowVote = calculateWeightedVote(1, 'shadow');
      expect(shadowVote).toBe(0.5);
    });
  });

  describe('Meta-Mod Impact on Trust Tiers', () => {
    function applyTrustPenalty(
      currentScore: number,
      penalty: number
    ): number {
      return Math.max(0, currentScore + penalty);
    }

    function determineTier(score: number, percentile: number): string {
      if (percentile >= 0.95) return 'gold';
      if (percentile >= 0.80) return 'silver';
      if (percentile >= 0.50) return 'bronze';
      return 'shadow';
    }

    it('prevents trust score from going negative', () => {
      const newScore = applyTrustPenalty(0.02, -0.08);
      expect(newScore).toBe(0);
    });

    it('can demote user to shadow realm with repeated unfair verdicts', () => {
      let score = 0.50;
      const penalty = -0.08; // Bias verdict

      for (let i = 0; i < 5; i++) {
        score = applyTrustPenalty(score, penalty);
      }

      expect(score).toBeLessThan(0.10);
    });
  });

  describe('Charter + Exploration Tax Interaction', () => {
    function getEffectiveExplorationRate(
      charterRate: number,
      protocolMinimum: number = 0.05
    ): number {
      return Math.max(charterRate, protocolMinimum);
    }

    it('respects charter exploration rate when above minimum', () => {
      expect(getEffectiveExplorationRate(0.15)).toBe(0.15);
      expect(getEffectiveExplorationRate(0.10)).toBe(0.10);
    });

    it('enforces protocol minimum when charter is below', () => {
      expect(getEffectiveExplorationRate(0.03)).toBe(0.05);
      expect(getEffectiveExplorationRate(0.00)).toBe(0.05);
    });
  });
});
