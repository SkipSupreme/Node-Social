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
  personalizationScore: number;
}

/**
 * Context needed to calculate personalization score
 */
export interface PersonalizationContext {
  followingIds: Set<string>;  // Users the current user follows
  userNodeCredScores: Record<string, number>;  // User's cred per node
  userVibeProfile?: VibeProfile;  // User's average vibe preferences
  vouchNetwork?: Map<string, number>;  // Trust network distances
}

/**
 * User's historical vibe preferences (average intensities they give)
 */
export interface VibeProfile {
  insightful: number;
  joy: number;
  fire: number;
  support: number;
  shock: number;
  questionable: number;
}

/**
 * Post data needed for personalization
 */
export interface PostPersonalizationData {
  authorId: string;
  nodeId: string | null;
  vibeAggregate?: {
    insightfulSum: number;
    joySum: number;
    fireSum: number;
    supportSum: number;
    shockSum: number;
    questionableSum: number;
    totalIntensity: number;
  } | null;
}

/**
 * Calculate personalization score for a post
 * Returns 0-100 based on how well the post matches user preferences
 */
export function calculatePersonalizationScore(
  post: PostPersonalizationData,
  context: PersonalizationContext
): number {
  let score = 50; // Base neutral score

  // 1. Following boost (0-25 points)
  if (context.followingIds.has(post.authorId)) {
    score += 25;
  }

  // 2. Node affinity boost (0-15 points)
  // Users with more cred in a node see more content from that node
  if (post.nodeId && context.userNodeCredScores) {
    const userCredInNode = context.userNodeCredScores[post.nodeId] || 0;
    // Cap at 1000 cred for max boost
    const affinityBoost = Math.min(userCredInNode / 1000, 1) * 15;
    score += affinityBoost;
  }

  // 3. Vibe alignment (0-10 points or -10 penalty)
  // Posts that match user's vibe preferences get boosted
  if (context.userVibeProfile && post.vibeAggregate && post.vibeAggregate.totalIntensity > 0) {
    const alignment = calculateVibeAlignment(context.userVibeProfile, post.vibeAggregate);
    // alignment is -1 to 1, scale to -10 to +10
    score += alignment * 10;
  }

  // 4. Trust network bonus (0-10 points)
  // Posts from vouched users or friends-of-friends
  if (context.vouchNetwork && context.vouchNetwork.has(post.authorId)) {
    const distance = context.vouchNetwork.get(post.authorId)!;
    // Closer = better: distance 1 = 10 points, distance 2 = 5, distance 3+ = 2
    const trustBoost = distance === 1 ? 10 : distance === 2 ? 5 : 2;
    score += trustBoost;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate cosine similarity between user's vibe profile and post's vibe aggregate
 * Returns -1 to 1 (negative = anti-aligned, positive = aligned)
 */
function calculateVibeAlignment(
  userProfile: VibeProfile,
  postAggregate: PostPersonalizationData['vibeAggregate']
): number {
  if (!postAggregate || postAggregate.totalIntensity === 0) return 0;

  // Normalize post aggregate to unit vector
  const total = postAggregate.totalIntensity;
  const postVec = {
    insightful: postAggregate.insightfulSum / total,
    joy: postAggregate.joySum / total,
    fire: postAggregate.fireSum / total,
    support: postAggregate.supportSum / total,
    shock: postAggregate.shockSum / total,
    questionable: postAggregate.questionableSum / total,
  };

  // Cosine similarity
  const dotProduct =
    userProfile.insightful * postVec.insightful +
    userProfile.joy * postVec.joy +
    userProfile.fire * postVec.fire +
    userProfile.support * postVec.support +
    userProfile.shock * postVec.shock +
    userProfile.questionable * postVec.questionable;

  const userMag = Math.sqrt(
    userProfile.insightful ** 2 +
    userProfile.joy ** 2 +
    userProfile.fire ** 2 +
    userProfile.support ** 2 +
    userProfile.shock ** 2 +
    userProfile.questionable ** 2
  );

  const postMag = Math.sqrt(
    postVec.insightful ** 2 +
    postVec.joy ** 2 +
    postVec.fire ** 2 +
    postVec.support ** 2 +
    postVec.shock ** 2 +
    postVec.questionable ** 2
  );

  if (userMag === 0 || postMag === 0) return 0;

  return dotProduct / (userMag * postMag);
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
  preferences: FeedPreferences,
  boostMultiplier: number = 1.0
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

  return score * boostMultiplier;
}

/**
 * Calculate detailed score breakdown
 */
export function calculateScoreBreakdown(
  post: PostWithScores,
  preferences: FeedPreferences,
  boostMultiplier: number = 1.0
) {
  const recencyScore = calculateRecencyScore(post.createdAt, preferences.recencyHalfLife);
  const normalizedQuality = Math.max(0, Math.min(100, post.qualityScore));
  const normalizedEngagement = Math.max(0, Math.min(100, post.engagementScore / 10));
  const normalizedPersonalization = Math.max(0, Math.min(100, post.personalizationScore));

  const weightedRecency = recencyScore * preferences.recencyWeight;
  const weightedQuality = normalizedQuality * preferences.qualityWeight;
  const weightedEngagement = normalizedEngagement * preferences.engagementWeight;
  const weightedPersonalization = normalizedPersonalization * preferences.personalizationWeight;

  const rawScore = weightedRecency + weightedQuality + weightedEngagement + weightedPersonalization;
  const finalScore = rawScore * boostMultiplier;

  return {
    components: {
      recency: { raw: recencyScore, weight: preferences.recencyWeight, contribution: weightedRecency },
      quality: { raw: normalizedQuality, weight: preferences.qualityWeight, contribution: weightedQuality },
      engagement: { raw: normalizedEngagement, weight: preferences.engagementWeight, contribution: weightedEngagement },
      personalization: { raw: normalizedPersonalization, weight: preferences.personalizationWeight, contribution: weightedPersonalization },
    },
    boostMultiplier,
    rawScore,
    finalScore,
  };
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

/**
 * Build user's vibe profile from their recent reactions
 * Returns normalized average intensities across all vectors
 */
export function buildVibeProfileFromReactions(
  reactions: Array<{ intensities: Record<string, number> }>
): VibeProfile {
  const profile: VibeProfile = {
    insightful: 0,
    joy: 0,
    fire: 0,
    support: 0,
    shock: 0,
    questionable: 0,
  };

  if (reactions.length === 0) return profile;

  // Sum all intensities
  for (const reaction of reactions) {
    const intensities = reaction.intensities || {};
    profile.insightful += intensities.insightful || 0;
    profile.joy += intensities.joy || 0;
    profile.fire += intensities.fire || 0;
    profile.support += intensities.support || 0;
    profile.shock += intensities.shock || 0;
    profile.questionable += intensities.questionable || 0;
  }

  // Normalize to average
  const count = reactions.length;
  profile.insightful /= count;
  profile.joy /= count;
  profile.fire /= count;
  profile.support /= count;
  profile.shock /= count;
  profile.questionable /= count;

  return profile;
}

/**
 * Build trust network from vouch relationships
 * Returns map of userId -> distance (1 = direct vouch, 2 = friend-of-friend, etc.)
 * Limited to maxHops to prevent performance issues
 */
export function buildTrustNetwork(
  vouches: Array<{ voucherId: string; voucheeId: string; active: boolean }>,
  userId: string,
  maxHops: number = 3
): Map<string, number> {
  const network = new Map<string, number>();

  // BFS from user
  const queue: Array<{ id: string; distance: number }> = [{ id: userId, distance: 0 }];
  const visited = new Set<string>([userId]);

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;

    if (distance >= maxHops) continue;

    // Find all users this user has vouched for
    for (const vouch of vouches) {
      if (vouch.voucherId === id && vouch.active && !visited.has(vouch.voucheeId)) {
        visited.add(vouch.voucheeId);
        network.set(vouch.voucheeId, distance + 1);
        queue.push({ id: vouch.voucheeId, distance: distance + 1 });
      }
    }
  }

  return network;
}

