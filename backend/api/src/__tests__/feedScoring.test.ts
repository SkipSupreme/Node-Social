/**
 * Unit tests for the feed scoring algorithm (src/lib/feedScoring.ts).
 *
 * The feed scoring system computes a weighted score for each post using four
 * dimensions: quality, recency, engagement, and personalization. Users control
 * the weights via preset modes or custom sliders ("Vibe Validator").
 *
 * These tests verify:
 * 1. Recency decay behaves correctly across different half-life settings
 * 2. Weight combinations produce expected relative ordering
 * 3. Score normalization keeps values in a predictable range
 * 4. Edge cases (zero weights, future dates, very old posts)
 * 5. Default preferences return the documented "balanced" values
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFeedScore,
  getDefaultPreferences,
  type FeedPreferences,
  type PostWithScores,
} from '../lib/feedScoring.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a PostWithScores object with convenient defaults. */
function makePost(overrides: Partial<PostWithScores> = {}): PostWithScores {
  return {
    id: 'test-post',
    createdAt: new Date(),
    engagementScore: 0,
    qualityScore: 50,
    personalizationScore: 50,
    ...overrides,
  };
}

/** Create FeedPreferences with overrides from defaults. */
function makePrefs(overrides: Partial<FeedPreferences> = {}): FeedPreferences {
  return {
    ...getDefaultPreferences(),
    ...overrides,
  };
}

// =========================================================================
// Default Preferences
// =========================================================================
describe('getDefaultPreferences', () => {
  it('should return the documented "balanced" weights summing to 100', () => {
    const prefs = getDefaultPreferences();
    const total =
      prefs.qualityWeight +
      prefs.recencyWeight +
      prefs.engagementWeight +
      prefs.personalizationWeight;

    expect(total).toBe(100);
    expect(prefs.recencyHalfLife).toBe('12h');
    expect(prefs.followingOnly).toBe(false);
  });
});

// =========================================================================
// Recency Scoring
// =========================================================================
describe('recency scoring', () => {
  it('should give a brand-new post a high recency score', () => {
    // A post created just now should have near-maximum recency contribution.
    const post = makePost({ createdAt: new Date() });
    const prefs = makePrefs({
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const score = calculateFeedScore(post, prefs);
    // With 100% recency weight and a brand-new post, score should be near 100*100 = 10000
    expect(score).toBeGreaterThan(9000);
  });

  it('should give an old post a low recency score', () => {
    // A post from 30 days ago with 12h half-life should have nearly zero recency.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const post = makePost({ createdAt: thirtyDaysAgo });
    const prefs = makePrefs({
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const score = calculateFeedScore(post, prefs);
    // 30 days / 12h half-life = 60 half-lives, so decay factor = 2^(-60) ~ 0
    expect(score).toBeLessThan(1);
  });

  it('should decay by half at exactly one half-life', () => {
    // With a 12h half-life, a post that is exactly 12h old should have
    // a recency score of approximately 50 (i.e., 100 * 0.5).
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const post = makePost({ createdAt: twelveHoursAgo });
    const prefs = makePrefs({
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const score = calculateFeedScore(post, prefs);
    // Expected: ~50 * 100 = 5000
    expect(score).toBeGreaterThan(4500);
    expect(score).toBeLessThan(5500);
  });

  it('should support different half-life values', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const post = makePost({ createdAt: sixHoursAgo });

    // With 6h half-life, a 6h-old post is exactly at the half-life point
    const prefs6h = makePrefs({
      recencyHalfLife: '6h',
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });
    const score6h = calculateFeedScore(post, prefs6h);

    // With 1h half-life, a 6h-old post is 6 half-lives in
    const prefs1h = makePrefs({
      recencyHalfLife: '1h',
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });
    const score1h = calculateFeedScore(post, prefs1h);

    // 6h half-life should produce a much higher score than 1h half-life
    // for the same 6-hour-old post
    expect(score6h).toBeGreaterThan(score1h * 10);
  });
});

// =========================================================================
// Weight Combinations
// =========================================================================
describe('weight combinations', () => {
  it('should rank a high-quality post above a low-quality post when quality weight dominates', () => {
    const prefs = makePrefs({
      qualityWeight: 90,
      recencyWeight: 0,
      engagementWeight: 5,
      personalizationWeight: 5,
    });

    const highQuality = makePost({ qualityScore: 95 });
    const lowQuality = makePost({ qualityScore: 10 });

    const highScore = calculateFeedScore(highQuality, prefs);
    const lowScore = calculateFeedScore(lowQuality, prefs);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should rank a high-engagement post above a low-engagement post when engagement weight dominates', () => {
    const prefs = makePrefs({
      qualityWeight: 5,
      recencyWeight: 0,
      engagementWeight: 90,
      personalizationWeight: 5,
    });

    const highEngagement = makePost({ engagementScore: 500 });
    const lowEngagement = makePost({ engagementScore: 0 });

    const highScore = calculateFeedScore(highEngagement, prefs);
    const lowScore = calculateFeedScore(lowEngagement, prefs);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should allow personalization weight to influence ranking', () => {
    const prefs = makePrefs({
      qualityWeight: 5,
      recencyWeight: 5,
      engagementWeight: 5,
      personalizationWeight: 85,
    });

    const highPersonal = makePost({ personalizationScore: 100 });
    const lowPersonal = makePost({ personalizationScore: 0 });

    expect(calculateFeedScore(highPersonal, prefs)).toBeGreaterThan(
      calculateFeedScore(lowPersonal, prefs)
    );
  });
});

// =========================================================================
// Normalization & Edge Cases
// =========================================================================
describe('normalization and edge cases', () => {
  it('should clamp quality score to 0-100 range', () => {
    // WHY: A quality score of -10 or 200 should be clamped, not create
    // negative or unreasonably high feed scores.
    const prefs = makePrefs({
      qualityWeight: 100,
      recencyWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const negativeQuality = makePost({ qualityScore: -10, createdAt: new Date() });
    const excessQuality = makePost({ qualityScore: 200, createdAt: new Date() });

    const negScore = calculateFeedScore(negativeQuality, prefs);
    const excessScore = calculateFeedScore(excessQuality, prefs);

    // Both should be clamped: negative to 0, excess to 100
    expect(negScore).toBe(0);
    expect(excessScore).toBe(10000); // 100 * 100 weight
  });

  it('should handle zero weights gracefully', () => {
    // All weights at zero means the score should be zero
    const prefs = makePrefs({
      qualityWeight: 0,
      recencyWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const post = makePost({ qualityScore: 100, engagementScore: 1000 });
    expect(calculateFeedScore(post, prefs)).toBe(0);
  });

  it('should scale down engagement score for normalization', () => {
    // The implementation divides engagementScore by 10 before clamping to 0-100.
    // This means an engagementScore of 1000 normalizes to 100 (the max).
    const prefs = makePrefs({
      qualityWeight: 0,
      recencyWeight: 0,
      engagementWeight: 100,
      personalizationWeight: 0,
    });

    const moderate = makePost({ engagementScore: 500 }); // normalizes to 50
    const high = makePost({ engagementScore: 1500 }); // normalizes to 100 (clamped)

    const modScore = calculateFeedScore(moderate, prefs);
    const highScore = calculateFeedScore(high, prefs);

    expect(modScore).toBeLessThan(highScore);
    // Very high engagement is capped at normalized 100
    expect(highScore).toBe(10000); // 100 normalized * 100 weight
  });

  it('should use 12h default when half-life is unknown', () => {
    const prefs = makePrefs({
      recencyHalfLife: 'unknown' as any,
      recencyWeight: 100,
      qualityWeight: 0,
      engagementWeight: 0,
      personalizationWeight: 0,
    });

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const post = makePost({ createdAt: twelveHoursAgo });

    const score = calculateFeedScore(post, prefs);
    // Should behave like 12h half-life: ~50 * 100 = 5000
    expect(score).toBeGreaterThan(4500);
    expect(score).toBeLessThan(5500);
  });
});
