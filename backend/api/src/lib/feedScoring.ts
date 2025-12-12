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
 * Vector multipliers for boosting/suppressing specific vibe types
 * 100 = neutral, >100 = boost, <100 = suppress
 */
export interface VectorMultipliers {
  insightful: number;
  joy: number;
  fire: number;
  support: number;
  shock: number;
  questionable: number;
}

/**
 * Post vibe aggregate with reaction counts
 */
export interface PostVibeAggregate {
  insightfulSum: number;
  joySum: number;
  fireSum: number;
  supportSum: number;
  shockSum: number;
  questionableSum: number;
  totalIntensity: number;
  reactionCount: number;
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
 * Calculate cosine similarity between user's vibe profile and post's vibe aggregate
 * Returns -1 to 1 (negative = anti-aligned, positive = aligned)
 *
 * With vector multipliers:
 * - Multipliers adjust user's vibe preferences before comparison
 * - 100 = neutral, >100 = boost that vibe's importance, <100 = suppress
 *
 * With anti-alignment penalty:
 * - Negative alignment gets multiplied by (1 + penalty/100)
 * - Makes anti-aligned posts rank even lower
 */
export function calculateVibeAlignment(
  userProfile: VibeProfile,
  postAggregate: PostVibeAggregate | null,
  vectorMultipliers: VectorMultipliers,
  antiAlignmentPenalty: number
): number {
  if (!postAggregate || postAggregate.totalIntensity === 0) return 0;

  // Apply multipliers to user profile (adjusts what they want to see)
  const weightedUser = {
    insightful: userProfile.insightful * (vectorMultipliers.insightful / 100),
    joy: userProfile.joy * (vectorMultipliers.joy / 100),
    fire: userProfile.fire * (vectorMultipliers.fire / 100),
    support: userProfile.support * (vectorMultipliers.support / 100),
    shock: userProfile.shock * (vectorMultipliers.shock / 100),
    questionable: userProfile.questionable * (vectorMultipliers.questionable / 100),
  };

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

  // Cosine similarity with weighted user profile
  const dotProduct =
    weightedUser.insightful * postVec.insightful +
    weightedUser.joy * postVec.joy +
    weightedUser.fire * postVec.fire +
    weightedUser.support * postVec.support +
    weightedUser.shock * postVec.shock +
    weightedUser.questionable * postVec.questionable;

  const userMag = Math.sqrt(
    weightedUser.insightful ** 2 +
    weightedUser.joy ** 2 +
    weightedUser.fire ** 2 +
    weightedUser.support ** 2 +
    weightedUser.shock ** 2 +
    weightedUser.questionable ** 2
  );

  const postMag = Math.sqrt(
    postVec.insightful ** 2 +
    postVec.joy ** 2 +
    postVec.fire ** 2 +
    postVec.support ** 2 +
    postVec.shock ** 2 +
    postVec.questionable ** 2
  );

  // Handle edge case of zero magnitude (all multipliers are 0)
  if (userMag === 0 || postMag === 0) return 0;

  const similarity = dotProduct / (userMag * postMag);

  // Apply anti-alignment penalty if negative
  if (similarity < 0) {
    return similarity * (1 + antiAlignmentPenalty / 100);
  }
  return similarity;
}

/**
 * Legacy calculateVibeAlignment without multipliers (for backwards compatibility)
 */
function calculateVibeAlignmentLegacy(
  userProfile: VibeProfile,
  postAggregate: PostPersonalizationData['vibeAggregate']
): number {
  const defaultMultipliers: VectorMultipliers = {
    insightful: 100,
    joy: 100,
    fire: 100,
    support: 100,
    shock: 100,
    questionable: 100,
  };
  return calculateVibeAlignment(
    userProfile,
    postAggregate as PostVibeAggregate | null,
    defaultMultipliers,
    0
  );
}

// ============================================================================
// Phase 2: Sub-signal Functions
// ============================================================================

/**
 * Quality sub-signal preferences
 */
export interface QualityPreferences {
  authorCredWeight: number;      // 0-100, weight of author credibility
  vectorQualityWeight: number;   // 0-100, weight of vibe quality ratio
  confidenceWeight: number;      // 0-100, weight of reaction count confidence
}

/**
 * Calculate quality score using sub-signals
 * - authorCred: Author's credibility score (capped at 1000 = 100 score)
 * - vectorQuality: Ratio of positive to negative vibes
 * - confidence: How many reactions (more = higher confidence in score)
 */
export function calculateQualityScore(
  post: { vibeAggregate: PostVibeAggregate | null },
  author: { cred: number },
  prefs: QualityPreferences
): number {
  // Author cred component (0-100 scale)
  // Cap at 1000 cred = 100 score
  const authorCredScore = Math.min(100, (author.cred || 0) / 10);

  // Vector quality from PostVibeAggregate
  // High insightful/support/joy = high quality, high shock/questionable = lower
  const vibeAgg = post.vibeAggregate;
  let vectorQualityScore = 50; // Default neutral
  if (vibeAgg && vibeAgg.totalIntensity > 0) {
    const positiveVibes = vibeAgg.insightfulSum + vibeAgg.supportSum + vibeAgg.joySum;
    const negativeVibes = vibeAgg.shockSum + vibeAgg.questionableSum;
    const ratio = positiveVibes / (positiveVibes + negativeVibes + 0.01);
    vectorQualityScore = ratio * 100;
  }

  // Confidence = how many reactions (more reactions = more confidence in the score)
  // 10+ reactions = full confidence
  const reactionCount = vibeAgg?.reactionCount || 0;
  const confidenceScore = Math.min(100, reactionCount * 10);

  // Weighted combination (normalize by sum of weights)
  const totalWeight = prefs.authorCredWeight + prefs.vectorQualityWeight + prefs.confidenceWeight;
  if (totalWeight === 0) return 50; // Neutral if all weights are 0

  return (
    (authorCredScore * prefs.authorCredWeight) +
    (vectorQualityScore * prefs.vectorQualityWeight) +
    (confidenceScore * prefs.confidenceWeight)
  ) / totalWeight;
}

/**
 * Recency sub-signal preferences
 */
export interface RecencyPreferences {
  halfLifeHours: number;         // 1-168, half-life in hours
  decayFunction: 'exponential' | 'linear' | 'step';
  timeDecay: number;             // 0-100, weight of decay component
  velocity: number;              // 0-100, weight of reaction velocity
  freshness: number;             // 0-100, weight of pure newness
}

/**
 * Calculate recency score using sub-signals
 * - timeDecay: How much the score decays over time
 * - velocity: Reactions per hour (trending indicator)
 * - freshness: Pure age score (newest = highest)
 */
export function calculateRecencyScore(
  post: { createdAt: Date; vibeAggregate?: PostVibeAggregate },
  prefs: RecencyPreferences
): number {
  const now = Date.now();
  const ageMs = now - post.createdAt.getTime();
  const halfLifeMs = prefs.halfLifeHours * 60 * 60 * 1000;

  // Time decay component
  let decayScore: number;
  switch (prefs.decayFunction) {
    case 'linear':
      // Linear: 100 at age 0, 0 at age = 2 * halfLife
      decayScore = Math.max(0, 100 - (ageMs / halfLifeMs) * 50);
      break;
    case 'step':
      // Step: 100 if within halfLife, 50 if within 2x, 25 if within 4x, else 0
      if (ageMs < halfLifeMs) decayScore = 100;
      else if (ageMs < halfLifeMs * 2) decayScore = 50;
      else if (ageMs < halfLifeMs * 4) decayScore = 25;
      else decayScore = 0;
      break;
    case 'exponential':
    default:
      // Exponential: score = 2^(-age/halfLife) * 100
      decayScore = Math.pow(2, -ageMs / halfLifeMs) * 100;
  }

  // Velocity component: reactions per hour since posted
  let velocityScore = 0;
  if (post.vibeAggregate && post.vibeAggregate.reactionCount > 0) {
    const ageHours = ageMs / (60 * 60 * 1000);
    const reactionsPerHour = post.vibeAggregate.reactionCount / Math.max(1, ageHours);
    // 10 reactions/hour = 100 score
    velocityScore = Math.min(100, reactionsPerHour * 10);
  }

  // Freshness: pure age score (100 if < 1 hour, decreases)
  const freshnessScore = Math.max(0, 100 - (ageMs / (60 * 60 * 1000)));

  // Weighted combination
  const totalWeight = prefs.timeDecay + prefs.velocity + prefs.freshness;
  if (totalWeight === 0) return decayScore; // Fallback to decay only

  return (
    (decayScore * prefs.timeDecay) +
    (velocityScore * prefs.velocity) +
    (freshnessScore * prefs.freshness)
  ) / totalWeight;
}

/**
 * Engagement sub-signal preferences
 */
export interface EngagementPreferences {
  intensity: number;             // 0-100, weight of vibe intensity
  discussionDepth: number;       // 0-100, weight of comment count
  shareWeight: number;           // 0-100, weight of shares (future)
  expertCommentBonus: number;    // 0-100, weight of expert comments
}

/**
 * Calculate engagement score using sub-signals
 * - intensity: Total vibe reaction intensity
 * - discussionDepth: Comment count
 * - shareWeight: Reserved for future share feature
 * - expertCommentBonus: High-cred users commenting
 */
export function calculateEngagementScore(
  post: {
    commentCount: number;
    vibeAggregate: PostVibeAggregate | null;
    comments?: { author: { cred: number } }[];
  },
  prefs: EngagementPreferences
): number {
  // Intensity: total vibe intensity received
  // 100 total intensity = 100 score
  const vibeIntensity = post.vibeAggregate?.totalIntensity || 0;
  const intensityScore = Math.min(100, vibeIntensity);

  // Discussion depth: comment count
  // 20 comments = 100 score
  const discussionScore = Math.min(100, (post.commentCount || 0) * 5);

  // Share weight: placeholder for future (always 0 for now)
  const shareScore = 0;

  // Expert comment bonus: if high-cred users commented
  let expertScore = 0;
  if (post.comments && post.comments.length > 0) {
    const expertComments = post.comments.filter(c => (c.author?.cred || 0) >= 100);
    // Each expert comment = 20 points, max 100
    expertScore = Math.min(100, expertComments.length * 20);
  }

  // Weighted combination
  const totalWeight = prefs.intensity + prefs.discussionDepth + prefs.shareWeight + prefs.expertCommentBonus;
  if (totalWeight === 0) return 50;

  return (
    (intensityScore * prefs.intensity) +
    (discussionScore * prefs.discussionDepth) +
    (shareScore * prefs.shareWeight) +
    (expertScore * prefs.expertCommentBonus)
  ) / totalWeight;
}

/**
 * Personalization sub-signal preferences
 */
export interface PersonalizationPreferences {
  followingWeight: number;       // 0-100, weight of following relationship
  alignment: number;             // 0-100, weight of vibe alignment
  affinity: number;              // 0-100, weight of node affinity
  trustNetwork: number;          // 0-100, weight of trust network
}

/**
 * Calculate personalization score using sub-signals (ADVANCED version)
 * Overload that accepts vector multipliers and personalization preferences
 */
export function calculatePersonalizationScore(
  post: PostPersonalizationData,
  context: PersonalizationContext,
  vectorMultipliers: VectorMultipliers,
  antiAlignmentPenalty: number,
  prefs: PersonalizationPreferences
): number;

/**
 * Calculate personalization score (LEGACY version without multipliers)
 */
export function calculatePersonalizationScore(
  post: PostPersonalizationData,
  context: PersonalizationContext
): number;

/**
 * Calculate personalization score - implementation
 */
export function calculatePersonalizationScore(
  post: PostPersonalizationData,
  context: PersonalizationContext,
  vectorMultipliers?: VectorMultipliers,
  antiAlignmentPenalty?: number,
  prefs?: PersonalizationPreferences
): number {
  // If no advanced params, use legacy behavior
  if (!vectorMultipliers || !prefs) {
    let score = 50; // Base neutral score

    // 1. Following boost (0-25 points)
    if (context.followingIds.has(post.authorId)) {
      score += 25;
    }

    // 2. Node affinity boost (0-15 points)
    if (post.nodeId && context.userNodeCredScores) {
      const userCredInNode = context.userNodeCredScores[post.nodeId] || 0;
      const affinityBoost = Math.min(userCredInNode / 1000, 1) * 15;
      score += affinityBoost;
    }

    // 3. Vibe alignment (0-10 points or -10 penalty)
    if (context.userVibeProfile && post.vibeAggregate && post.vibeAggregate.totalIntensity > 0) {
      const alignment = calculateVibeAlignmentLegacy(context.userVibeProfile, post.vibeAggregate);
      score += alignment * 10;
    }

    // 4. Trust network bonus (0-10 points)
    if (context.vouchNetwork && context.vouchNetwork.has(post.authorId)) {
      const distance = context.vouchNetwork.get(post.authorId)!;
      const trustBoost = distance === 1 ? 10 : distance === 2 ? 5 : 2;
      score += trustBoost;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Advanced version with sub-signals
  const penalty = antiAlignmentPenalty || 0;

  // Following: 100 if following author, 0 if not
  const followingScore = context.followingIds.has(post.authorId) ? 100 : 0;

  // Alignment: vibe alignment (-100 to 100 scaled from -1 to 1)
  let alignmentScore = 50; // Neutral default
  if (context.userVibeProfile && post.vibeAggregate) {
    const alignment = calculateVibeAlignment(
      context.userVibeProfile,
      post.vibeAggregate as PostVibeAggregate,
      vectorMultipliers,
      penalty
    );
    alignmentScore = (alignment + 1) * 50; // Scale -1..1 to 0..100
  }

  // Affinity: user's cred in post's node
  let affinityScore = 50; // Neutral if no node
  if (post.nodeId && context.userNodeCredScores) {
    const userCredInNode = context.userNodeCredScores[post.nodeId] || 0;
    affinityScore = Math.min(100, userCredInNode / 10); // 1000 cred = 100
  }

  // Trust network: proximity in vouch graph
  let trustScore = 0;
  if (context.vouchNetwork && context.vouchNetwork.has(post.authorId)) {
    const distance = context.vouchNetwork.get(post.authorId)!;
    trustScore = distance === 1 ? 100 : distance === 2 ? 50 : 25;
  }

  // Weighted combination
  const totalWeight = prefs.followingWeight + prefs.alignment + prefs.affinity + prefs.trustNetwork;
  if (totalWeight === 0) return 50;

  return (
    (followingScore * prefs.followingWeight) +
    (alignmentScore * prefs.alignment) +
    (affinityScore * prefs.affinity) +
    (trustScore * prefs.trustNetwork)
  ) / totalWeight;
}

/**
 * Calculate recency score with exponential decay (LEGACY)
 */
function calculateRecencyScoreLegacy(
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
 * Calculate combined feed score for a post (LEGACY)
 */
export function calculateFeedScore(
  post: PostWithScores,
  preferences: FeedPreferences,
  boostMultiplier: number = 1.0
): number {
  const recencyScore = calculateRecencyScoreLegacy(post.createdAt, preferences.recencyHalfLife);

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
 * Calculate detailed score breakdown (LEGACY)
 */
export function calculateScoreBreakdown(
  post: PostWithScores,
  preferences: FeedPreferences,
  boostMultiplier: number = 1.0
) {
  const recencyScore = calculateRecencyScoreLegacy(post.createdAt, preferences.recencyHalfLife);
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

// ============================================================================
// Phase 3: Diversity Controls
// ============================================================================

/**
 * Diversity control preferences
 */
export interface DiversityPreferences {
  maxPostsPerAuthor: number;        // 1-10, max posts from same author
  topicClusteringPenalty: number;   // 0-100, penalty for similar consecutive posts
  textRatio: number;                // 0-100, target % of text posts
  imageRatio: number;               // 0-100, target % of image posts
  videoRatio: number;               // 0-100, target % of video posts
  linkRatio: number;                // 0-100, target % of link posts
}

/**
 * Post with score for diversity processing
 */
export interface ScoredPost {
  id: string;
  authorId: string;
  score: number;
  postType?: string;
  vibeAggregate?: PostVibeAggregate | null;
}

/**
 * Get vibe signature from a post (normalized vibe vector)
 */
function getVibeSignature(post: ScoredPost): number[] {
  const agg = post.vibeAggregate;
  if (!agg || agg.totalIntensity === 0) {
    return [0, 0, 0, 0, 0, 0]; // Neutral signature
  }
  const total = agg.totalIntensity;
  return [
    agg.insightfulSum / total,
    agg.joySum / total,
    agg.fireSum / total,
    agg.supportSum / total,
    agg.shockSum / total,
    agg.questionableSum / total,
  ];
}

/**
 * Calculate cosine similarity between two vectors
 */
function vectorCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) * (a[i] ?? 0);
    magB += (b[i] ?? 0) * (b[i] ?? 0);
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

/**
 * Apply diversity controls to scored posts
 *
 * - Limits posts per author
 * - Applies penalty to similar consecutive posts (topic clustering)
 * - Respects content type ratios (soft preference)
 */
export function applyDiversityControls(
  posts: ScoredPost[],
  prefs: DiversityPreferences,
  limit: number
): ScoredPost[] {
  if (posts.length === 0) return [];

  // Sort by score descending
  const sorted = [...posts].sort((a, b) => b.score - a.score);

  // Track posts per author
  const authorCounts = new Map<string, number>();

  // Track previous post's vibe signature for clustering penalty
  let prevVibeSignature: number[] | null = null;

  const result: ScoredPost[] = [];
  const deferred: ScoredPost[] = []; // Posts that exceeded author limit

  for (const post of sorted) {
    // Check author limit
    const authorCount = authorCounts.get(post.authorId) || 0;
    if (authorCount >= prefs.maxPostsPerAuthor) {
      deferred.push(post);
      continue;
    }

    // Create a copy so we can modify the score
    const processedPost = { ...post };

    // Apply clustering penalty if similar to previous post
    if (prevVibeSignature && prefs.topicClusteringPenalty > 0) {
      const currentSignature = getVibeSignature(processedPost);
      // Only apply penalty if both posts have vibe data
      if (currentSignature.some(v => v !== 0)) {
        const similarity = vectorCosineSimilarity(prevVibeSignature, currentSignature);
        if (similarity > 0.8) {
          // Very similar to prev post - apply penalty
          processedPost.score *= (1 - prefs.topicClusteringPenalty / 100);
        }
      }
    }

    // Add to result
    result.push(processedPost);
    authorCounts.set(post.authorId, authorCount + 1);

    // Update prev signature (only if this post has vibes)
    const currentSig = getVibeSignature(processedPost);
    if (currentSig.some(v => v !== 0)) {
      prevVibeSignature = currentSig;
    }

    if (result.length >= limit) break;
  }

  // If we didn't fill the limit, add deferred posts
  if (result.length < limit) {
    for (const post of deferred) {
      result.push(post);
      if (result.length >= limit) break;
    }
  }

  return result;
}

// ============================================================================
// Phase 4: Mood Presets
// ============================================================================

/**
 * Available mood types
 */
export type MoodType = 'normal' | 'chill' | 'intense' | 'discovery';

/**
 * Mood preset definitions
 * Each mood overrides certain preferences to create a distinct browsing experience
 */
const MOOD_PRESETS: Record<MoodType, Partial<Record<string, number>>> = {
  normal: {}, // No overrides, use user's settings

  chill: {
    // Relaxed browsing - less urgency, longer timeframes
    recencyWeight: 20,
    engagementWeight: 15,
    personalizationWeight: 30,
    halfLifeHours: 48,
    velocity: 10,
    intensity: 20,
    maxPostsPerAuthor: 5,
  },

  intense: {
    // What's hot right now
    recencyWeight: 40,
    engagementWeight: 35,
    qualityWeight: 15,
    personalizationWeight: 10,
    halfLifeHours: 6,
    velocity: 60,
    intensity: 50,
  },

  discovery: {
    // Find new stuff
    personalizationWeight: 5,
    qualityWeight: 40,
    discoveryRate: 50,
    maxPostsPerAuthor: 1,
    followingWeight: 10,
    trustNetwork: 5,
  },
};

/**
 * Apply mood preset overrides to user preferences
 *
 * @param userPrefs - The user's base preferences
 * @param mood - The mood to apply
 * @returns New preferences object with mood overrides applied
 */
export function applyMoodPreset<T extends Record<string, unknown>>(
  userPrefs: T,
  mood: MoodType
): T {
  if (mood === 'normal') return userPrefs;

  const moodOverrides = MOOD_PRESETS[mood];
  return {
    ...userPrefs,
    ...moodOverrides,
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

