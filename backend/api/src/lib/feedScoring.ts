// src/lib/feedScoring.ts
// Feed scoring logic based on Vibe Validator weights

export interface FeedPreferences {
  qualityWeight: number;
  recencyWeight: number;
  engagementWeight: number;
  personalizationWeight: number;
  recencyHalfLife: string;
  followingOnly: boolean;
}

export interface PostWithScores {
  id: string;
  createdAt: Date;
  engagementScore: number;
  qualityScore: number;
  // For personalization (future: following relationships, vibe alignment)
  personalizationScore: number;
}

/**
 * Calculate recency score with exponential decay
 */
function calculateRecencyScore(
  createdAt: Date,
  halfLife: string
): number {
  const now = Date.now();
  const postTime = createdAt.getTime();
  const ageMs = now - postTime;

  // Convert half-life to milliseconds
  let halfLifeMs: number;
  switch (halfLife) {
    case '1h':
      halfLifeMs = 60 * 60 * 1000;
      break;
    case '6h':
      halfLifeMs = 6 * 60 * 60 * 1000;
      break;
    case '12h':
      halfLifeMs = 12 * 60 * 60 * 1000;
      break;
    case '24h':
      halfLifeMs = 24 * 60 * 60 * 1000;
      break;
    case '7d':
      halfLifeMs = 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      halfLifeMs = 12 * 60 * 60 * 1000; // Default 12h
  }

  // Exponential decay: score = 2^(-age/halfLife)
  // Normalize to 0-100 range
  const decayFactor = Math.pow(2, -ageMs / halfLifeMs);
  return Math.max(0, Math.min(100, decayFactor * 100));
}

/**
 * Calculate combined feed score for a post
 */
export function calculateFeedScore(
  post: PostWithScores,
  preferences: FeedPreferences
): number {
  const recencyScore = calculateRecencyScore(post.createdAt, preferences.recencyHalfLife);
  
  // Normalize scores to 0-100 range (they should already be in this range)
  const normalizedQuality = Math.max(0, Math.min(100, post.qualityScore));
  const normalizedEngagement = Math.max(0, Math.min(100, post.engagementScore / 10)); // Scale down engagement (can be > 100)
  const normalizedPersonalization = Math.max(0, Math.min(100, post.personalizationScore));

  // Weighted combination
  const score =
    (recencyScore * preferences.recencyWeight) +
    (normalizedQuality * preferences.qualityWeight) +
    (normalizedEngagement * preferences.engagementWeight) +
    (normalizedPersonalization * preferences.personalizationWeight);

  return score;
}

/**
 * Get default feed preferences
 */
export function getDefaultPreferences(): FeedPreferences {
  return {
    qualityWeight: 35.0,
    recencyWeight: 30.0,
    engagementWeight: 20.0,
    personalizationWeight: 15.0,
    recencyHalfLife: '12h',
    followingOnly: false,
  };
}

