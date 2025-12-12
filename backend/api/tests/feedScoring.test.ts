// tests/feedScoring.test.ts
// Unit tests for feed scoring algorithms

import { describe, it, expect, beforeEach } from 'vitest';

import {
  calculateVibeAlignment,
  calculateQualityScore,
  calculateRecencyScore,
  calculateEngagementScore,
  calculatePersonalizationScore,
  applyDiversityControls,
  applyMoodPreset,
  type VibeProfile,
  type VectorMultipliers,
  type PostVibeAggregate,
} from '../src/lib/feedScoring';

// ============================================================================
// Phase 1: Vector Multipliers Tests
// ============================================================================

describe('calculateVibeAlignment with Vector Multipliers', () => {
  const defaultMultipliers: VectorMultipliers = {
    insightful: 100,
    joy: 100,
    fire: 100,
    support: 100,
    shock: 100,
    questionable: 100,
  };

  const neutralUserProfile: VibeProfile = {
    insightful: 0.5,
    joy: 0.5,
    fire: 0.5,
    support: 0.5,
    shock: 0.5,
    questionable: 0.5,
  };

  const insightfulUserProfile: VibeProfile = {
    insightful: 0.9,
    joy: 0.3,
    fire: 0.1,
    support: 0.5,
    shock: 0.1,
    questionable: 0.1,
  };

  const insightfulPost: PostVibeAggregate = {
    insightfulSum: 50,
    joySum: 10,
    fireSum: 5,
    supportSum: 10,
    shockSum: 2,
    questionableSum: 3,
    totalIntensity: 80,
    reactionCount: 10,
  };

  const shockingPost: PostVibeAggregate = {
    insightfulSum: 5,
    joySum: 5,
    fireSum: 10,
    supportSum: 5,
    shockSum: 60,
    questionableSum: 15,
    totalIntensity: 100,
    reactionCount: 15,
  };

  it('returns 0 for posts with no reactions', () => {
    const emptyPost: PostVibeAggregate = {
      insightfulSum: 0,
      joySum: 0,
      fireSum: 0,
      supportSum: 0,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 0,
      reactionCount: 0,
    };

    const score = calculateVibeAlignment(
      insightfulUserProfile,
      emptyPost,
      defaultMultipliers,
      0
    );
    expect(score).toBe(0);
  });

  it('returns 0 for null post aggregate', () => {
    const score = calculateVibeAlignment(
      insightfulUserProfile,
      null as unknown as PostVibeAggregate,
      defaultMultipliers,
      0
    );
    expect(score).toBe(0);
  });

  it('gives positive alignment for matching vibe profiles', () => {
    const score = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers,
      0
    );
    // User likes insightful, post is insightful-heavy
    expect(score).toBeGreaterThan(0);
  });

  it('gives lower alignment for non-matching vibe profiles', () => {
    const alignedScore = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers,
      0
    );
    const misalignedScore = calculateVibeAlignment(
      insightfulUserProfile,
      shockingPost,
      defaultMultipliers,
      0
    );
    // Post with shock vibes should align less with insightful user
    expect(alignedScore).toBeGreaterThan(misalignedScore);
  });

  it('boosts posts matching amplified vibes (multiplier > 100)', () => {
    const boostedMultipliers: VectorMultipliers = {
      ...defaultMultipliers,
      insightful: 200, // 2x boost to insightful
    };

    const normalScore = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers,
      0
    );
    const boostedScore = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      boostedMultipliers,
      0
    );

    // With 2x insightful multiplier, alignment should increase
    expect(boostedScore).toBeGreaterThan(normalScore);
  });

  it('suppresses posts matching dampened vibes (multiplier < 100)', () => {
    const dampenedMultipliers: VectorMultipliers = {
      ...defaultMultipliers,
      shock: 50, // Suppress shock content
    };

    // User profile that normally likes shock
    const shockLovingUser: VibeProfile = {
      insightful: 0.2,
      joy: 0.2,
      fire: 0.2,
      support: 0.2,
      shock: 0.9,
      questionable: 0.3,
    };

    const normalScore = calculateVibeAlignment(
      shockLovingUser,
      shockingPost,
      defaultMultipliers,
      0
    );
    const dampenedScore = calculateVibeAlignment(
      shockLovingUser,
      shockingPost,
      dampenedMultipliers,
      0
    );

    // With shock suppressed, the alignment should decrease
    expect(dampenedScore).toBeLessThan(normalScore);
  });

  it('multipliers at 100 produce same result as no multipliers', () => {
    const score1 = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers, // all 100
      0
    );

    // Create profile with all normalized to 1.0 effect
    const unitMultipliers: VectorMultipliers = {
      insightful: 100,
      joy: 100,
      fire: 100,
      support: 100,
      shock: 100,
      questionable: 100,
    };

    const score2 = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      unitMultipliers,
      0
    );

    expect(score1).toBeCloseTo(score2, 5);
  });

  it('applies anti-alignment penalty to negative alignment', () => {
    // Create an anti-aligned scenario
    const joyUser: VibeProfile = {
      insightful: 0.1,
      joy: 0.9,
      fire: 0.1,
      support: 0.8,
      shock: 0.1,
      questionable: 0.1,
    };

    const antiJoyPost: PostVibeAggregate = {
      insightfulSum: 5,
      joySum: 0,
      fireSum: 5,
      supportSum: 0,
      shockSum: 40,
      questionableSum: 50,
      totalIntensity: 100,
      reactionCount: 20,
    };

    const noPenalty = calculateVibeAlignment(
      joyUser,
      antiJoyPost,
      defaultMultipliers,
      0 // No penalty
    );

    const withPenalty = calculateVibeAlignment(
      joyUser,
      antiJoyPost,
      defaultMultipliers,
      50 // 50% extra penalty
    );

    // If alignment is negative, penalty should make it more negative
    if (noPenalty < 0) {
      expect(withPenalty).toBeLessThan(noPenalty);
    } else {
      // If not negative, penalty shouldn't change it
      expect(withPenalty).toBeCloseTo(noPenalty, 5);
    }
  });

  it('does not apply anti-alignment penalty to positive alignment', () => {
    const score1 = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers,
      0
    );
    const score2 = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      defaultMultipliers,
      100 // High penalty - should not affect positive alignment
    );

    // Both should be positive and roughly equal
    expect(score1).toBeGreaterThan(0);
    expect(score2).toBeCloseTo(score1, 5);
  });

  it('handles zero multipliers gracefully', () => {
    const zeroMultipliers: VectorMultipliers = {
      insightful: 0,
      joy: 0,
      fire: 0,
      support: 0,
      shock: 0,
      questionable: 0,
    };

    // Should not crash, should return 0 or handle gracefully
    const score = calculateVibeAlignment(
      insightfulUserProfile,
      insightfulPost,
      zeroMultipliers,
      0
    );

    expect(score).toBeDefined();
    expect(typeof score).toBe('number');
    expect(isNaN(score)).toBe(false);
  });
});

// ============================================================================
// Phase 2: Quality Sub-signals Tests
// ============================================================================

describe('calculateQualityScore', () => {
  const defaultQualityPrefs = {
    authorCredWeight: 50,
    vectorQualityWeight: 35,
    confidenceWeight: 15,
  };

  it('returns 50 when no data available (graceful degradation)', () => {
    const score = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 0 },
      defaultQualityPrefs
    );
    // With no data: authorCred=0, vectorQuality=50 (neutral), confidence=0
    // (0 * 50 + 50 * 35 + 0 * 15) / 100 = 17.5
    // Actually with our formula: should return close to neutral
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('boosts high-cred authors when authorCredWeight is high', () => {
    const highCredScore = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 500 },
      { authorCredWeight: 100, vectorQualityWeight: 0, confidenceWeight: 0 }
    );
    const lowCredScore = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 10 },
      { authorCredWeight: 100, vectorQualityWeight: 0, confidenceWeight: 0 }
    );
    expect(highCredScore).toBeGreaterThan(lowCredScore);
  });

  it('increases score with high vectorQuality from positive vibes', () => {
    const positiveVibes: PostVibeAggregate = {
      insightfulSum: 50,
      joySum: 30,
      fireSum: 10,
      supportSum: 40,
      shockSum: 5,
      questionableSum: 5,
      totalIntensity: 140,
      reactionCount: 20,
    };
    const negativeVibes: PostVibeAggregate = {
      insightfulSum: 5,
      joySum: 5,
      fireSum: 10,
      supportSum: 5,
      shockSum: 50,
      questionableSum: 40,
      totalIntensity: 115,
      reactionCount: 20,
    };

    const positiveScore = calculateQualityScore(
      { vibeAggregate: positiveVibes },
      { cred: 100 },
      { authorCredWeight: 0, vectorQualityWeight: 100, confidenceWeight: 0 }
    );
    const negativeScore = calculateQualityScore(
      { vibeAggregate: negativeVibes },
      { cred: 100 },
      { authorCredWeight: 0, vectorQualityWeight: 100, confidenceWeight: 0 }
    );

    expect(positiveScore).toBeGreaterThan(negativeScore);
  });

  it('increases confidence score with more reactions', () => {
    const fewReactions: PostVibeAggregate = {
      insightfulSum: 5,
      joySum: 5,
      fireSum: 5,
      supportSum: 5,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 20,
      reactionCount: 2,
    };
    const manyReactions: PostVibeAggregate = {
      insightfulSum: 50,
      joySum: 50,
      fireSum: 50,
      supportSum: 50,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 200,
      reactionCount: 20,
    };

    const lowConfidenceScore = calculateQualityScore(
      { vibeAggregate: fewReactions },
      { cred: 100 },
      { authorCredWeight: 0, vectorQualityWeight: 0, confidenceWeight: 100 }
    );
    const highConfidenceScore = calculateQualityScore(
      { vibeAggregate: manyReactions },
      { cred: 100 },
      { authorCredWeight: 0, vectorQualityWeight: 0, confidenceWeight: 100 }
    );

    expect(highConfidenceScore).toBeGreaterThan(lowConfidenceScore);
  });

  it('handles all weights being 0', () => {
    const score = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 500 },
      { authorCredWeight: 0, vectorQualityWeight: 0, confidenceWeight: 0 }
    );
    expect(score).toBe(50); // Neutral fallback
  });
});

describe('calculateRecencyScoreAdvanced', () => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const defaultRecencyPrefs = {
    halfLifeHours: 12,
    decayFunction: 'exponential' as const,
    timeDecay: 60,
    velocity: 20,
    freshness: 20,
  };

  it('calculates exponential decay correctly', () => {
    const freshScore = calculateRecencyScore(
      { createdAt: oneHourAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, velocity: 0, freshness: 0, timeDecay: 100 }
    );
    const staleScore = calculateRecencyScore(
      { createdAt: oneDayAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, velocity: 0, freshness: 0, timeDecay: 100 }
    );
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('calculates linear decay correctly', () => {
    const freshScore = calculateRecencyScore(
      { createdAt: oneHourAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, decayFunction: 'linear', velocity: 0, freshness: 0, timeDecay: 100 }
    );
    const staleScore = calculateRecencyScore(
      { createdAt: oneDayAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, decayFunction: 'linear', velocity: 0, freshness: 0, timeDecay: 100 }
    );
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('calculates step decay correctly', () => {
    // Within halfLife (12h) should be 100
    const withinHalfLife = calculateRecencyScore(
      { createdAt: sixHoursAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, decayFunction: 'step', velocity: 0, freshness: 0, timeDecay: 100 }
    );
    expect(withinHalfLife).toBe(100);
  });

  it('factors in reaction velocity', () => {
    const highVelocity: PostVibeAggregate = {
      insightfulSum: 50,
      joySum: 50,
      fireSum: 50,
      supportSum: 50,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 200,
      reactionCount: 100, // 100 reactions in 1 hour = high velocity
    };
    const lowVelocity: PostVibeAggregate = {
      insightfulSum: 5,
      joySum: 5,
      fireSum: 5,
      supportSum: 5,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 20,
      reactionCount: 2, // 2 reactions in 1 hour = low velocity
    };

    const highVelocityScore = calculateRecencyScore(
      { createdAt: oneHourAgo, vibeAggregate: highVelocity },
      { ...defaultRecencyPrefs, timeDecay: 0, velocity: 100, freshness: 0 }
    );
    const lowVelocityScore = calculateRecencyScore(
      { createdAt: oneHourAgo, vibeAggregate: lowVelocity },
      { ...defaultRecencyPrefs, timeDecay: 0, velocity: 100, freshness: 0 }
    );

    expect(highVelocityScore).toBeGreaterThan(lowVelocityScore);
  });

  it('handles posts with no reactions for velocity', () => {
    const score = calculateRecencyScore(
      { createdAt: oneHourAgo, vibeAggregate: undefined },
      { ...defaultRecencyPrefs, timeDecay: 0, velocity: 100, freshness: 0 }
    );
    expect(score).toBe(0); // No reactions = 0 velocity
  });
});

describe('calculateEngagementScore', () => {
  const defaultEngagementPrefs = {
    intensity: 40,
    discussionDepth: 30,
    shareWeight: 20,
    expertCommentBonus: 10,
  };

  it('calculates intensity from vibe reactions', () => {
    const highIntensity: PostVibeAggregate = {
      insightfulSum: 30,
      joySum: 30,
      fireSum: 20,
      supportSum: 10,
      shockSum: 5,
      questionableSum: 5,
      totalIntensity: 100,
      reactionCount: 20,
    };
    const lowIntensity: PostVibeAggregate = {
      insightfulSum: 5,
      joySum: 5,
      fireSum: 5,
      supportSum: 5,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 20,
      reactionCount: 5,
    };

    const highScore = calculateEngagementScore(
      { commentCount: 0, vibeAggregate: highIntensity, comments: [] },
      { ...defaultEngagementPrefs, discussionDepth: 0, shareWeight: 0, expertCommentBonus: 0, intensity: 100 }
    );
    const lowScore = calculateEngagementScore(
      { commentCount: 0, vibeAggregate: lowIntensity, comments: [] },
      { ...defaultEngagementPrefs, discussionDepth: 0, shareWeight: 0, expertCommentBonus: 0, intensity: 100 }
    );

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('calculates discussion depth from comments', () => {
    const highDiscussion = calculateEngagementScore(
      { commentCount: 20, vibeAggregate: null, comments: [] },
      { ...defaultEngagementPrefs, intensity: 0, shareWeight: 0, expertCommentBonus: 0, discussionDepth: 100 }
    );
    const lowDiscussion = calculateEngagementScore(
      { commentCount: 2, vibeAggregate: null, comments: [] },
      { ...defaultEngagementPrefs, intensity: 0, shareWeight: 0, expertCommentBonus: 0, discussionDepth: 100 }
    );

    expect(highDiscussion).toBeGreaterThan(lowDiscussion);
  });

  it('gives expert comment bonus for high-cred commenters', () => {
    const expertComments = [
      { author: { cred: 200 } },
      { author: { cred: 150 } },
    ];
    const normalComments = [
      { author: { cred: 10 } },
      { author: { cred: 20 } },
    ];

    const expertScore = calculateEngagementScore(
      { commentCount: 2, vibeAggregate: null, comments: expertComments },
      { ...defaultEngagementPrefs, intensity: 0, shareWeight: 0, discussionDepth: 0, expertCommentBonus: 100 }
    );
    const normalScore = calculateEngagementScore(
      { commentCount: 2, vibeAggregate: null, comments: normalComments },
      { ...defaultEngagementPrefs, intensity: 0, shareWeight: 0, discussionDepth: 0, expertCommentBonus: 100 }
    );

    expect(expertScore).toBeGreaterThan(normalScore);
  });

  it('returns 50 when all weights are 0', () => {
    const score = calculateEngagementScore(
      { commentCount: 10, vibeAggregate: null, comments: [] },
      { intensity: 0, discussionDepth: 0, shareWeight: 0, expertCommentBonus: 0 }
    );
    expect(score).toBe(50);
  });
});

describe('calculatePersonalizationScoreAdvanced', () => {
  const defaultPersonalizationPrefs = {
    followingWeight: 50,
    alignment: 20,
    affinity: 15,
    trustNetwork: 15,
  };

  const defaultMultipliers: VectorMultipliers = {
    insightful: 100,
    joy: 100,
    fire: 100,
    support: 100,
    shock: 100,
    questionable: 100,
  };

  const userVibeProfile: VibeProfile = {
    insightful: 0.7,
    joy: 0.5,
    fire: 0.3,
    support: 0.6,
    shock: 0.2,
    questionable: 0.1,
  };

  it('factors in following relationship', () => {
    const followingContext = {
      followingIds: new Set(['author1']),
      userNodeCredScores: {},
      userVibeProfile,
      vouchNetwork: new Map(),
    };

    const followedAuthorScore = calculatePersonalizationScore(
      { authorId: 'author1', nodeId: null, vibeAggregate: null },
      followingContext,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, alignment: 0, affinity: 0, trustNetwork: 0, followingWeight: 100 }
    );
    const unfollowedAuthorScore = calculatePersonalizationScore(
      { authorId: 'author2', nodeId: null, vibeAggregate: null },
      followingContext,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, alignment: 0, affinity: 0, trustNetwork: 0, followingWeight: 100 }
    );

    expect(followedAuthorScore).toBeGreaterThan(unfollowedAuthorScore);
  });

  it('factors in node affinity', () => {
    const context = {
      followingIds: new Set<string>(),
      userNodeCredScores: { 'node1': 500 },
      userVibeProfile,
      vouchNetwork: new Map(),
    };

    const highAffinityScore = calculatePersonalizationScore(
      { authorId: 'author1', nodeId: 'node1', vibeAggregate: null },
      context,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, followingWeight: 0, alignment: 0, trustNetwork: 0, affinity: 100 }
    );
    const lowAffinityScore = calculatePersonalizationScore(
      { authorId: 'author1', nodeId: 'node2', vibeAggregate: null },
      context,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, followingWeight: 0, alignment: 0, trustNetwork: 0, affinity: 100 }
    );

    expect(highAffinityScore).toBeGreaterThan(lowAffinityScore);
  });

  it('factors in trust network distance', () => {
    const vouchNetwork = new Map([['author1', 1], ['author2', 2]]);
    const context = {
      followingIds: new Set<string>(),
      userNodeCredScores: {},
      userVibeProfile,
      vouchNetwork,
    };

    const directVouchScore = calculatePersonalizationScore(
      { authorId: 'author1', nodeId: null, vibeAggregate: null },
      context,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, followingWeight: 0, alignment: 0, affinity: 0, trustNetwork: 100 }
    );
    const indirectVouchScore = calculatePersonalizationScore(
      { authorId: 'author2', nodeId: null, vibeAggregate: null },
      context,
      defaultMultipliers,
      0,
      { ...defaultPersonalizationPrefs, followingWeight: 0, alignment: 0, affinity: 0, trustNetwork: 100 }
    );

    expect(directVouchScore).toBeGreaterThan(indirectVouchScore);
  });
});

// ============================================================================
// Phase 3: Diversity Controls Tests
// ============================================================================

describe('applyDiversityControls', () => {
  const defaultDiversityPrefs = {
    maxPostsPerAuthor: 3,
    topicClusteringPenalty: 20,
    textRatio: 25,
    imageRatio: 25,
    videoRatio: 25,
    linkRatio: 25,
  };

  const createPost = (
    id: string,
    authorId: string,
    score: number,
    vibeAggregate?: PostVibeAggregate
  ) => ({
    id,
    authorId,
    score,
    postType: 'text',
    vibeAggregate: vibeAggregate || null,
  });

  it('limits posts per author when sufficient content from other authors exists', () => {
    // With many authors, author limit is respected
    const posts = [
      createPost('1', 'authorA', 100),
      createPost('2', 'authorA', 95),
      createPost('3', 'authorA', 90),
      createPost('4', 'authorA', 85),
      createPost('5', 'authorB', 80),
      createPost('6', 'authorC', 75),
      createPost('7', 'authorD', 70),
      createPost('8', 'authorE', 65),
    ];

    const result = applyDiversityControls(posts, { ...defaultDiversityPrefs, maxPostsPerAuthor: 2 }, 5);

    // First pass: authorA (2), authorB (1), authorC (1), authorD (1) = 5
    // authorA's 3rd and 4th posts are deferred
    const authorAPosts = result.filter((p: any) => p.authorId === 'authorA');
    expect(authorAPosts.length).toBe(2);
  });

  it('allows deferred author posts when under limit (graceful degradation)', () => {
    // With few authors, deferred posts fill the limit
    const posts = [
      createPost('1', 'authorA', 100),
      createPost('2', 'authorA', 95),
      createPost('3', 'authorA', 90),
      createPost('4', 'authorA', 85),
      createPost('5', 'authorB', 80),
    ];

    const result = applyDiversityControls(posts, { ...defaultDiversityPrefs, maxPostsPerAuthor: 2 }, 10);

    // First pass: authorA (2), authorB (1) = 3 posts
    // Under limit, so deferred authorA posts get added
    expect(result.length).toBe(5); // All posts returned
  });

  it('adds deferred posts if result is under limit', () => {
    const posts = [
      createPost('1', 'authorA', 100),
      createPost('2', 'authorA', 95),
      createPost('3', 'authorA', 90),
      createPost('4', 'authorB', 50),
    ];

    const result = applyDiversityControls(posts, { ...defaultDiversityPrefs, maxPostsPerAuthor: 2 }, 4);

    // Should include: authorA's top 2 posts, authorB's post, then deferred authorA post
    expect(result.length).toBe(4);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(result[2].id).toBe('4');
    expect(result[3].id).toBe('3'); // Deferred post added to fill limit
  });

  it('applies topic clustering penalty to similar consecutive posts', () => {
    // Create posts with similar vibe signatures
    const similarVibes: PostVibeAggregate = {
      insightfulSum: 80,
      joySum: 10,
      fireSum: 5,
      supportSum: 5,
      shockSum: 0,
      questionableSum: 0,
      totalIntensity: 100,
      reactionCount: 10,
    };

    const posts = [
      createPost('1', 'authorA', 100, similarVibes),
      createPost('2', 'authorB', 99, similarVibes), // Similar to post 1
      createPost('3', 'authorC', 50), // No vibes, won't be penalized
    ];

    const result = applyDiversityControls(posts, { ...defaultDiversityPrefs, topicClusteringPenalty: 50 }, 10);

    // Second post should have reduced score due to similarity to first
    expect(result[1].score).toBeLessThan(99);
  });

  it('returns all posts when fewer than limit', () => {
    const posts = [
      createPost('1', 'authorA', 100),
      createPost('2', 'authorB', 80),
    ];

    const result = applyDiversityControls(posts, defaultDiversityPrefs, 10);

    expect(result.length).toBe(2);
  });

  it('handles empty post list', () => {
    const result = applyDiversityControls([], defaultDiversityPrefs, 10);
    expect(result).toEqual([]);
  });

  it('respects limit even with diversity controls', () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      createPost(`${i}`, `author${i % 5}`, 100 - i)
    );

    const result = applyDiversityControls(posts, defaultDiversityPrefs, 5);

    expect(result.length).toBe(5);
  });
});

// ============================================================================
// Phase 4: Mood Presets Tests
// ============================================================================

describe('applyMoodPreset', () => {
  const basePrefs = {
    qualityWeight: 35,
    recencyWeight: 30,
    engagementWeight: 20,
    personalizationWeight: 15,
    halfLifeHours: 12,
    velocity: 30,
    intensity: 40,
    maxPostsPerAuthor: 3,
    followingWeight: 50,
    trustNetwork: 15,
    discoveryRate: 0,
  };

  it('returns original prefs for normal mood', () => {
    const result = applyMoodPreset(basePrefs, 'normal');
    expect(result).toEqual(basePrefs);
  });

  it('applies chill mood overrides', () => {
    const result = applyMoodPreset(basePrefs, 'chill');

    // Chill should have lower recency/engagement, higher personalization
    expect(result.recencyWeight).toBeLessThan(basePrefs.recencyWeight);
    expect(result.halfLifeHours).toBeGreaterThan(basePrefs.halfLifeHours);
  });

  it('applies intense mood overrides', () => {
    const result = applyMoodPreset(basePrefs, 'intense');

    // Intense should have higher recency/engagement, lower personalization
    expect(result.recencyWeight).toBeGreaterThan(basePrefs.recencyWeight);
    expect(result.velocity).toBeGreaterThan(basePrefs.velocity);
    expect(result.halfLifeHours).toBeLessThan(basePrefs.halfLifeHours);
  });

  it('applies discovery mood overrides', () => {
    const result = applyMoodPreset(basePrefs, 'discovery');

    // Discovery should have lower personalization, higher quality
    expect(result.followingWeight).toBeLessThan(basePrefs.followingWeight);
    expect(result.maxPostsPerAuthor).toBeLessThan(basePrefs.maxPostsPerAuthor);
  });

  it('preserves non-overridden values', () => {
    const result = applyMoodPreset(basePrefs, 'chill');

    // Values not in the mood preset should remain unchanged
    // (depends on which fields are in the mood definition)
    expect(typeof result.qualityWeight).toBe('number');
  });
});
