# Advanced Feed Algorithm Design

## Context

Node Social is a social network with a Vibe Validator - a feed algorithm control panel with 4 complexity modes (Simple, Intermediate, Advanced, Expert). The UI and database persistence are complete, but the algorithm doesn't use most of the settings yet.

**Current state:**
- `backend/api/src/lib/feedScoring.ts` has basic scoring with 4 weights
- `UserFeedPreference` table has 40+ fields for all settings (schema complete)
- Frontend saves/loads all settings correctly
- Intermediate filters (timeRange, textOnly, mediaOnly, etc.) work

**What's missing:**
- Vector multipliers not applied
- Sub-signals not used (authorCredWeight, velocity, discussionDepth, etc.)
- Diversity controls not implemented
- Mood presets not applied

## Design Principles

1. **Neutral defaults** - Missing data produces neutral scores (50/100), not zeros
2. **Layered refinement** - Each feature adds precision without breaking simpler modes
3. **Same math, more inputs** - Keep the weighted-sum approach, feed it better component scores
4. **Graceful degradation** - New posts with no reactions still appear, just don't get boosts

## Current Code Structure

### feedScoring.ts Current Interface

```typescript
export interface FeedPreferences {
  qualityWeight: number;        // 0-100, default 35
  recencyWeight: number;        // 0-100, default 30
  engagementWeight: number;     // 0-100, default 20
  personalizationWeight: number; // 0-100, default 15
  recencyHalfLife: string;      // '1h', '6h', '12h', '24h', '7d'
  followingOnly: boolean;
}
```

### Current Scoring Flow

```typescript
calculateFeedScore(post, preferences) {
  recencyScore = calculateRecencyScore(post.createdAt, preferences.recencyHalfLife)
  // qualityScore comes from PostMetric table (pre-calculated)
  // engagementScore comes from PostMetric table (pre-calculated)
  // personalizationScore calculated with following/node affinity/vibe alignment/trust

  return (recencyScore * recencyWeight) +
         (qualityScore * qualityWeight) +
         (engagementScore * engagementWeight) +
         (personalizationScore * personalizationWeight)
}
```

### Database Tables Involved

**UserFeedPreference** - All user settings (already has all fields)
**PostMetric** - Pre-calculated quality/engagement scores per post
**PostVibeAggregate** - Sum of all vibe reactions per post
**VibeReaction** - Individual user reactions with intensities
**User** - Has `cred` field for author credibility
**Vouch** - Trust network relationships

## Implementation Phases

---

### Phase 1: Vector Multipliers

**Purpose:** Let users boost/suppress specific vibe types in their feed.

**Settings used:**
```typescript
vectorMultipliers: {
  insightful: number;   // 0-200, 100 = neutral
  joy: number;
  fire: number;
  support: number;
  shock: number;
  questionable: number;
}
antiAlignmentPenalty: number; // 0-100, how much to penalize anti-aligned posts
```

**Where it applies:** Inside `calculateVibeAlignment()` function.

**Current code (feedScoring.ts:109-156):**
```typescript
function calculateVibeAlignment(userProfile, postAggregate): number {
  // Cosine similarity between user's vibe profile and post's vibes
  const dotProduct =
    userProfile.insightful * postVec.insightful +
    userProfile.joy * postVec.joy +
    // ... etc
  return dotProduct / (userMag * postMag); // -1 to 1
}
```

**New code:**
```typescript
function calculateVibeAlignment(
  userProfile: VibeProfile,
  postAggregate: PostVibeAggregate,
  vectorMultipliers: VectorMultipliers,
  antiAlignmentPenalty: number
): number {
  if (!postAggregate || postAggregate.totalIntensity === 0) return 0; // Neutral

  // Apply multipliers to user profile (what they want to see)
  const weightedUser = {
    insightful: userProfile.insightful * (vectorMultipliers.insightful / 100),
    joy: userProfile.joy * (vectorMultipliers.joy / 100),
    fire: userProfile.fire * (vectorMultipliers.fire / 100),
    support: userProfile.support * (vectorMultipliers.support / 100),
    shock: userProfile.shock * (vectorMultipliers.shock / 100),
    questionable: userProfile.questionable * (vectorMultipliers.questionable / 100),
  };

  // Calculate cosine similarity with weighted profile
  const similarity = cosineSimilarity(weightedUser, postAggregate);

  // Apply anti-alignment penalty if negative
  if (similarity < 0) {
    return similarity * (1 + antiAlignmentPenalty / 100);
  }
  return similarity;
}
```

**Graceful degradation:**
- Post has no vibe reactions → return 0 (neutral, no boost or penalty)
- User has no vibe profile → use default profile (all 0.5)
- Multipliers at 100 → no change from current behavior

**Test cases:**
1. User sets insightful=200, post has high insightful → boosted
2. User sets shock=50, post has high shock → suppressed
3. Post has no reactions → score is 0, not affected by multipliers
4. antiAlignmentPenalty=50, post is anti-aligned → extra penalty

---

### Phase 2: Sub-signals

**Purpose:** Break each main weight into finer tunable components.

#### 2A: Quality Sub-signals

**Settings used:**
```typescript
authorCredWeight: number;      // 0-100, default 50
vectorQualityWeight: number;   // 0-100, default 35
confidenceWeight: number;      // 0-100, default 15
```

**New function:**
```typescript
function calculateQualityScore(
  post: PostWithMetrics,
  author: { cred: number },
  prefs: { authorCredWeight: number; vectorQualityWeight: number; confidenceWeight: number }
): number {
  // Author cred component (0-100 scale)
  // Cap at 1000 cred = 100 score
  const authorCredScore = Math.min(100, (author.cred || 0) / 10);

  // Vector quality from PostVibeAggregate
  // High insightful/support = high quality, high shock/questionable = lower
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
```

**Graceful degradation:**
- Author has no cred → authorCredScore = 0 (but other signals still count)
- Post has no reactions → vectorQualityScore = 50, confidenceScore = 0
- All sub-signal weights = 0 → return 50 (neutral)

#### 2B: Recency Sub-signals

**Settings used:**
```typescript
halfLifeHours: number;         // 1-168, default 12
decayFunction: string;         // 'exponential' | 'linear' | 'step'
timeDecay: number;             // 0-100, weight of decay component
velocity: number;              // 0-100, weight of reaction velocity
freshness: number;             // 0-100, weight of pure newness
```

**New function:**
```typescript
function calculateRecencyScore(
  post: { createdAt: Date; vibeAggregate?: { reactionCount: number; updatedAt: Date } },
  prefs: { halfLifeHours: number; decayFunction: string; timeDecay: number; velocity: number; freshness: number }
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
```

**Graceful degradation:**
- Post has no reactions → velocity = 0, but timeDecay and freshness still work
- velocity weight = 0 → ignored, doesn't break scoring

#### 2C: Engagement Sub-signals

**Settings used:**
```typescript
intensity: number;             // 0-100, default 40
discussionDepth: number;       // 0-100, default 30
shareWeight: number;           // 0-100, default 20 (future feature)
expertCommentBonus: number;    // 0-100, default 10
```

**New function:**
```typescript
function calculateEngagementScore(
  post: {
    commentCount: number;
    vibeAggregate?: { totalIntensity: number; reactionCount: number };
    comments?: { author: { cred: number } }[];
  },
  prefs: { intensity: number; discussionDepth: number; shareWeight: number; expertCommentBonus: number }
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
```

**Graceful degradation:**
- No reactions → intensityScore = 0
- No comments → discussionScore = 0, expertScore = 0
- All weights 0 → return 50 (neutral)

#### 2D: Personalization Sub-signals

**Settings used:**
```typescript
followingWeight: number;       // 0-100, default 50
alignment: number;             // 0-100, default 20
affinity: number;              // 0-100, default 15
trustNetwork: number;          // 0-100, default 15
```

**Updated function:**
```typescript
function calculatePersonalizationScore(
  post: PostPersonalizationData,
  context: PersonalizationContext,
  vectorMultipliers: VectorMultipliers,
  antiAlignmentPenalty: number,
  prefs: { followingWeight: number; alignment: number; affinity: number; trustNetwork: number }
): number {
  // Following: 100 if following author, 0 if not
  const followingScore = context.followingIds.has(post.authorId) ? 100 : 0;

  // Alignment: vibe alignment (-100 to 100 scaled from -1 to 1)
  let alignmentScore = 50; // Neutral default
  if (context.userVibeProfile && post.vibeAggregate) {
    const alignment = calculateVibeAlignment(
      context.userVibeProfile,
      post.vibeAggregate,
      vectorMultipliers,
      antiAlignmentPenalty
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
```

---

### Phase 3: Diversity Controls

**Purpose:** Ensure feed variety - not 10 posts from same author, balanced content types.

**Settings used:**
```typescript
maxPostsPerAuthor: number;        // 1-10, default 3
topicClusteringPenalty: number;   // 0-100, default 20
textRatio: number;                // 0-100, target % of text posts
imageRatio: number;               // 0-100, target % of image posts
videoRatio: number;               // 0-100, target % of video posts
linkRatio: number;                // 0-100, target % of link posts
```

**New function (post-processing after scoring):**
```typescript
function applyDiversityControls(
  posts: ScoredPost[],
  prefs: {
    maxPostsPerAuthor: number;
    topicClusteringPenalty: number;
    textRatio: number;
    imageRatio: number;
    videoRatio: number;
    linkRatio: number;
  },
  limit: number
): ScoredPost[] {
  // Sort by score descending
  const sorted = [...posts].sort((a, b) => b.score - a.score);

  // Track posts per author
  const authorCounts = new Map<string, number>();

  // Track content types for ratio balancing
  const typeCounts = { text: 0, image: 0, video: 0, link: 0 };
  const typeTargets = {
    text: prefs.textRatio,
    image: prefs.imageRatio,
    video: prefs.videoRatio,
    link: prefs.linkRatio,
  };

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

    // Apply clustering penalty if similar to previous post
    if (prevVibeSignature && prefs.topicClusteringPenalty > 0) {
      const currentSignature = getVibeSignature(post);
      const similarity = cosineSimilarity(prevVibeSignature, currentSignature);
      if (similarity > 0.8) {
        // Very similar to prev post - apply penalty
        post.score *= (1 - prefs.topicClusteringPenalty / 100);
      }
    }

    // Add to result
    result.push(post);
    authorCounts.set(post.authorId, authorCount + 1);
    typeCounts[post.postType as keyof typeof typeCounts]++;
    prevVibeSignature = getVibeSignature(post);

    if (result.length >= limit) break;
  }

  // If we didn't fill the limit, add deferred posts
  if (result.length < limit) {
    for (const post of deferred) {
      result.push(post);
      if (result.length >= limit) break;
    }
  }

  // Content type ratio balancing (soft preference)
  // This is a soft reordering, not filtering
  // Future enhancement: could swap posts to better hit ratios

  return result;
}

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
```

**Graceful degradation:**
- Few posts available → don't filter, just return what we have
- maxPostsPerAuthor = 10 → effectively no limit
- topicClusteringPenalty = 0 → no clustering adjustment
- All ratios = 0 → no type balancing

---

### Phase 4: Mood Presets

**Purpose:** Quick switches between feed "moods" without adjusting individual sliders.

**Settings used:**
```typescript
moodToggle: 'normal' | 'chill' | 'intense' | 'discovery';
```

**Mood definitions:**
```typescript
const MOOD_PRESETS = {
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
```

**Implementation:**
```typescript
function applyMoodPreset(
  userPrefs: FullFeedPreferences,
  mood: 'normal' | 'chill' | 'intense' | 'discovery'
): FullFeedPreferences {
  if (mood === 'normal') return userPrefs;

  const moodOverrides = MOOD_PRESETS[mood];
  return {
    ...userPrefs,
    ...moodOverrides,
  };
}
```

---

## Updated FeedPreferences Interface

```typescript
export interface FullFeedPreferences {
  // Main weights (must sum to 100)
  qualityWeight: number;
  recencyWeight: number;
  engagementWeight: number;
  personalizationWeight: number;

  // Quality sub-signals
  authorCredWeight: number;
  vectorQualityWeight: number;
  confidenceWeight: number;

  // Recency sub-signals
  halfLifeHours: number;
  decayFunction: 'exponential' | 'linear' | 'step';
  timeDecay: number;
  velocity: number;
  freshness: number;

  // Engagement sub-signals
  intensity: number;
  discussionDepth: number;
  shareWeight: number;
  expertCommentBonus: number;

  // Personalization sub-signals
  followingWeight: number;
  alignment: number;
  affinity: number;
  trustNetwork: number;

  // Vector multipliers
  vectorMultipliers: {
    insightful: number;
    joy: number;
    fire: number;
    support: number;
    shock: number;
    questionable: number;
  };
  antiAlignmentPenalty: number;

  // Diversity controls
  maxPostsPerAuthor: number;
  topicClusteringPenalty: number;
  textRatio: number;
  imageRatio: number;
  videoRatio: number;
  linkRatio: number;

  // Mood
  moodToggle: 'normal' | 'chill' | 'intense' | 'discovery';

  // Filters (already implemented)
  followingOnly: boolean;
  timeRange: string;
  textOnly: boolean;
  mediaOnly: boolean;
  linksOnly: boolean;
  hasDiscussion: boolean;
}
```

---

## Updated Main Scoring Function

```typescript
export function calculateFeedScore(
  post: PostWithFullData,
  prefs: FullFeedPreferences,
  context: PersonalizationContext,
  boostMultiplier: number = 1.0
): number {
  // Apply mood preset first
  const effectivePrefs = applyMoodPreset(prefs, prefs.moodToggle);

  // Calculate each component using sub-signals
  const qualityScore = calculateQualityScore(post, post.author, {
    authorCredWeight: effectivePrefs.authorCredWeight,
    vectorQualityWeight: effectivePrefs.vectorQualityWeight,
    confidenceWeight: effectivePrefs.confidenceWeight,
  });

  const recencyScore = calculateRecencyScore(post, {
    halfLifeHours: effectivePrefs.halfLifeHours,
    decayFunction: effectivePrefs.decayFunction,
    timeDecay: effectivePrefs.timeDecay,
    velocity: effectivePrefs.velocity,
    freshness: effectivePrefs.freshness,
  });

  const engagementScore = calculateEngagementScore(post, {
    intensity: effectivePrefs.intensity,
    discussionDepth: effectivePrefs.discussionDepth,
    shareWeight: effectivePrefs.shareWeight,
    expertCommentBonus: effectivePrefs.expertCommentBonus,
  });

  const personalizationScore = calculatePersonalizationScore(
    post,
    context,
    effectivePrefs.vectorMultipliers,
    effectivePrefs.antiAlignmentPenalty,
    {
      followingWeight: effectivePrefs.followingWeight,
      alignment: effectivePrefs.alignment,
      affinity: effectivePrefs.affinity,
      trustNetwork: effectivePrefs.trustNetwork,
    }
  );

  // Weighted combination (weights should sum to 100)
  const score =
    (qualityScore * effectivePrefs.qualityWeight / 100) +
    (recencyScore * effectivePrefs.recencyWeight / 100) +
    (engagementScore * effectivePrefs.engagementWeight / 100) +
    (personalizationScore * effectivePrefs.personalizationWeight / 100);

  return score * boostMultiplier;
}
```

---

## Integration with posts.ts

The feed endpoint already loads `UserFeedPreference`. Changes needed:

1. Pass full preferences to `calculateFeedScore()` instead of just the 4 main weights
2. After scoring all posts, call `applyDiversityControls()` before pagination
3. Load additional data needed for sub-signals (author cred, expert comments)

```typescript
// In GET /posts handler

// 1. Load full preferences (already done, just need to use all fields)
const userPrefs = await fastify.prisma.userFeedPreference.findUnique({
  where: { userId },
});

// 2. Build personalization context (already exists)
const context = {
  followingIds,
  userNodeCredScores,
  userVibeProfile,
  vouchNetwork,
};

// 3. Score all posts with full preferences
const scoredPosts = posts.map(post => ({
  ...post,
  score: calculateFeedScore(post, userPrefs, context),
}));

// 4. Apply diversity controls (NEW)
const diversifiedPosts = applyDiversityControls(scoredPosts, {
  maxPostsPerAuthor: userPrefs.maxPostsPerAuthor,
  topicClusteringPenalty: userPrefs.topicClusteringPenalty,
  textRatio: userPrefs.textRatio,
  imageRatio: userPrefs.imageRatio,
  videoRatio: userPrefs.videoRatio,
  linkRatio: userPrefs.linkRatio,
}, limit);

// 5. Return paginated results
return diversifiedPosts.slice(0, limit);
```

---

## Testing Strategy

### Unit Tests (feedScoring.test.ts)

```typescript
describe('calculateQualityScore', () => {
  it('returns 50 when no data available', () => {
    const score = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 0 },
      { authorCredWeight: 50, vectorQualityWeight: 35, confidenceWeight: 15 }
    );
    expect(score).toBeCloseTo(50, 1);
  });

  it('boosts high-cred authors when authorCredWeight is high', () => {
    const highCred = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 500 },
      { authorCredWeight: 100, vectorQualityWeight: 0, confidenceWeight: 0 }
    );
    const lowCred = calculateQualityScore(
      { vibeAggregate: null },
      { cred: 10 },
      { authorCredWeight: 100, vectorQualityWeight: 0, confidenceWeight: 0 }
    );
    expect(highCred).toBeGreaterThan(lowCred);
  });
});

describe('calculateVibeAlignment with multipliers', () => {
  it('boosts posts matching amplified vibes', () => {
    const userProfile = { insightful: 0.8, joy: 0.2, fire: 0, support: 0, shock: 0, questionable: 0 };
    const postVibes = { insightfulSum: 10, joySum: 2, fireSum: 0, supportSum: 0, shockSum: 0, questionableSum: 0, totalIntensity: 12 };

    const normalMultipliers = { insightful: 100, joy: 100, fire: 100, support: 100, shock: 100, questionable: 100 };
    const boostedMultipliers = { insightful: 200, joy: 100, fire: 100, support: 100, shock: 100, questionable: 100 };

    const normalScore = calculateVibeAlignment(userProfile, postVibes, normalMultipliers, 0);
    const boostedScore = calculateVibeAlignment(userProfile, postVibes, boostedMultipliers, 0);

    expect(boostedScore).toBeGreaterThan(normalScore);
  });
});

describe('applyDiversityControls', () => {
  it('limits posts per author', () => {
    const posts = [
      { id: '1', authorId: 'a', score: 100 },
      { id: '2', authorId: 'a', score: 90 },
      { id: '3', authorId: 'a', score: 80 },
      { id: '4', authorId: 'b', score: 70 },
    ];

    const result = applyDiversityControls(posts, { maxPostsPerAuthor: 2, ...defaults }, 10);

    const authorAPosts = result.filter(p => p.authorId === 'a');
    expect(authorAPosts.length).toBe(2);
  });

  it('returns all posts when fewer than limit', () => {
    const posts = [{ id: '1', authorId: 'a', score: 100 }];
    const result = applyDiversityControls(posts, { maxPostsPerAuthor: 1, ...defaults }, 10);
    expect(result.length).toBe(1);
  });
});
```

### Integration Tests

```typescript
describe('Feed with Expert Voices preset', () => {
  it('surfaces high-cred authors first', async () => {
    // Setup: Create posts from high-cred and low-cred authors
    // Set preset to 'expert' (high quality weight, authorCredWeight)
    // Fetch feed
    // Assert: High-cred author posts appear first
  });
});

describe('Feed with mood=discovery', () => {
  it('shows posts from unfollowed authors', async () => {
    // Setup: User follows author A, not author B
    // Set mood to 'discovery' (low followingWeight)
    // Fetch feed
    // Assert: Author B posts have similar ranking to Author A
  });
});
```

---

## Success Criteria

1. **All sliders affect feed** - Changing any Vibe Validator setting changes post ordering
2. **New posts appear** - Posts with no reactions still show up (neutral score, not zero)
3. **"Expert Voices" works** - High-cred authors surface when preset is selected
4. **"What's Hot" works** - High-engagement recent posts surface
5. **Diversity works** - No more than N posts from same author in feed page
6. **Graceful degradation** - Empty feed doesn't crash, sparse data produces sensible results

---

## File Changes Summary

| File | Changes |
|------|---------|
| `backend/api/src/lib/feedScoring.ts` | Add sub-signal functions, update interfaces, add diversity controls |
| `backend/api/src/routes/posts.ts` | Pass full prefs to scoring, call diversity controls |
| `backend/api/tests/feedScoring.test.ts` | New test file for scoring functions |

---

## Implementation Order

1. **Phase 1: Vector Multipliers** (~1 hour)
   - Update `calculateVibeAlignment()`
   - Add tests

2. **Phase 2: Sub-signals** (~2 hours)
   - Add `calculateQualityScore()`, `calculateEngagementScore()`, etc.
   - Update `calculateFeedScore()` to use them
   - Update `posts.ts` to pass full prefs
   - Add tests

3. **Phase 3: Diversity Controls** (~1 hour)
   - Add `applyDiversityControls()`
   - Integrate into `posts.ts`
   - Add tests

4. **Phase 4: Mood Presets** (~30 min)
   - Add `applyMoodPreset()`
   - Add mood definitions
   - Add tests

Total: ~4-5 hours of implementation
