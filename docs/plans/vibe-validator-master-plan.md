# Vibe Validator Master Plan

**Goal:** Make every slider, toggle, and setting in the Vibe Validator actually work. No more UI theater.

**Philosophy:** Fast, responsive, real. Users should feel the algorithm respond to their choices instantly.

---

## Current State: The Honest Truth

### What Actually Works (5 things)
1. **5 Presets** - Latest, Balanced, Trending, Expert, Network → applies different weight distributions
2. **Time Range** - 1h/6h/24h/7d/all → filters posts by age
3. **Content Type Filters** - text-only, media-only, links-only → filters by postType
4. **Has Discussion** - filters to posts with ≥1 comment
5. **Basic 4 Weights** - quality/recency/engagement/personalization → used in scoring

### What's Stubbed (functions exist, not wired)
- All Advanced mode sub-signals (12+ settings)
- Vector multipliers (boost/suppress specific vibes)
- Anti-alignment penalty
- Diversity controls (max posts per author, topic clustering)
- Mood presets (chill/intense/discovery)

### What Doesn't Exist Yet
- Video vs image vs GIF detection
- Text length/density scoring
- Muted words filtering
- Seen posts tracking
- Discovery rate mixing
- Content preloading system
- Time-based profiles
- A/B experiments

---

## Phase 1: Foundation - Make What Exists Work

### 1.1 Wire Up the Scoring Functions
**Status:** Functions written in `feedScoring.ts`, just not called from feed endpoint

| Function | What It Does | Effort |
|----------|--------------|--------|
| `calculateQualityScore()` | Author cred + vibe quality ratio + confidence | 2h |
| `calculateRecencyScore()` | Decay functions + velocity + freshness | 2h |
| `calculateEngagementScore()` | Intensity + discussion depth + expert bonus | 2h |
| `calculatePersonalizationScore()` (advanced) | Following + alignment + affinity + trust | 1h |

**Implementation:**
```typescript
// In posts.ts feed endpoint, replace simple scoring with:
const qualityScore = calculateQualityScore(post, author, settings.advanced);
const recencyScore = calculateRecencyScore(post, settings.advanced);
const engagementScore = calculateEngagementScore(post, settings.advanced);
const personalizationScore = calculatePersonalizationScore(post, user, settings.advanced);

const finalScore =
  (qualityScore * settings.weights.quality / 100) +
  (recencyScore * settings.weights.recency / 100) +
  (engagementScore * settings.weights.engagement / 100) +
  (personalizationScore * settings.weights.personalization / 100);
```

### 1.2 Wire Up Vector Multipliers
**What it does:** Users can boost or suppress specific vibe types
- insightful: 150 = 1.5x boost to posts with insightful vibes
- questionable: 50 = 0.5x penalty to posts with questionable vibes

**Implementation:**
- Already calculated in `calculateVibeAlignment()`
- Pass `settings.advanced.vectorMultipliers` to the function
- Use result in personalization score

### 1.3 Wire Up Diversity Controls
**What it does:**
- Max 3 posts from same author (prevents feed domination)
- Topic clustering penalty (variety in consecutive posts)

**Implementation:**
- `applyDiversityControls()` exists
- Call it on sorted results before returning
- Pass `settings.expert.maxPostsPerAuthor` and `topicClusteringPenalty`

### 1.4 Wire Up Mood Presets
**What it does:** Quick mood switches that temporarily override settings
- **Chill:** Low engagement weight, high recency, relaxed content
- **Intense:** High engagement, trending content
- **Discovery:** High personalization penalty, more random

**Implementation:**
- `applyMoodPreset()` exists
- Call it when `settings.expert.moodToggle !== 'normal'`
- Override weights before scoring

---

## Phase 2: Content Intelligence - Know What's In Each Post

### 2.1 Text Length/Density Scoring
**Problem:** No way to prefer short tweets vs long essays

**Solution:** Add `textLength` and `textDensity` to posts

```prisma
model Post {
  // ... existing fields
  textLength     Int?      // Character count
  textDensity    String?   // 'micro' (<50), 'short' (50-280), 'medium' (280-1000), 'long' (1000+)
}
```

**Implementation:**
1. On post create, calculate and store text length
2. Derive density category from length
3. Add filter: `textDensity: 'short'` to get tweet-like content
4. Backfill existing posts with migration

**UI Addition:**
- "Post Length" filter: Any | Micro | Short | Medium | Long
- Or slider: "Prefer shorter ←→ Prefer longer"

### 2.2 Media Type Detection
**Problem:** `postType` is 'image' for both photos and videos. No GIF detection.

**Solution:** Add `mediaType` field with proper detection

```prisma
model Post {
  // ... existing fields
  mediaType      String?   // 'photo', 'video', 'gif', 'audio', null
  mediaDuration  Int?      // seconds, for video/audio
  mediaWidth     Int?      // for aspect ratio calculations
  mediaHeight    Int?
}
```

**Detection Logic:**
```typescript
function detectMediaType(url: string, contentType?: string): MediaType {
  // By extension
  if (/\.(mp4|webm|mov|m4v)$/i.test(url)) return 'video';
  if (/\.(gif)$/i.test(url)) return 'gif';
  if (/\.(mp3|wav|m4a|ogg)$/i.test(url)) return 'audio';
  if (/\.(jpg|jpeg|png|webp|avif)$/i.test(url)) return 'photo';

  // By content-type header (for URLs without extensions)
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType === 'image/gif') return 'gif';
  if (contentType?.startsWith('image/')) return 'photo';
  if (contentType?.startsWith('audio/')) return 'audio';

  return null;
}
```

**Implementation:**
1. Call detection on post create (when mediaUrl is set)
2. For link posts, fetch headers to detect embedded media type
3. Store in `mediaType` field
4. Update content type ratios to use `mediaType`

**UI Addition:**
- Replace generic "Media only" with: Photos | Videos | GIFs | Any media
- Content ratio sliders now actually work

### 2.3 Link Metadata Enrichment
**Problem:** We store `linkMeta` but don't use it for scoring

**What to extract:**
- Domain (for domain-based filtering/boosting)
- Is paywall? (detect common paywall patterns)
- Has embedded media? (og:video, og:image)
- Article length estimate (from og:description length or fetch)

**Implementation:**
1. Enhance link preview fetching to store more metadata
2. Add `linkDomain`, `isPaywall`, `hasEmbeddedMedia` fields
3. Filter: "Hide paywalled articles"
4. Boost: "Prefer articles from domains I read"

---

## Phase 3: User Context - Know What They've Seen

### 3.1 Seen Posts Tracking
**Problem:** Users see same posts repeatedly, no freshness

**Solution:** Track views

```prisma
model UserPostView {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  viewedAt  DateTime @default(now())
  duration  Int?     // ms spent viewing (optional, for engagement)

  user      User     @relation(fields: [userId], references: [id])
  post      Post     @relation(fields: [postId], references: [id])

  @@unique([userId, postId])
  @@index([userId, viewedAt])
}
```

**Implementation:**
1. Track view when post is scrolled into viewport for >1 second
2. Batch send views to backend every 30 seconds
3. Filter: `showSeenPosts: false` → exclude posts in UserPostView
4. Or: heavily penalize score for seen posts instead of excluding

**UI:** "Show seen posts" toggle now works

### 3.2 Muted Words
**Problem:** Users can't filter out topics they don't want

**Solution:**

```prisma
model UserMutedWord {
  id        String   @id @default(cuid())
  userId    String
  word      String   // lowercase, trimmed
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, word])
  @@index([userId])
}
```

**Implementation:**
1. Settings screen to manage muted words
2. On feed fetch, get user's muted words
3. Filter posts where `content.toLowerCase()` contains any muted word
4. Case-insensitive, whole-word matching preferred

**UI:** "Hide muted words" toggle + "Manage muted words" link

### 3.3 Discovery Rate Mixing
**Problem:** Feed is either all following or all global, no mixing

**What it should do:** "15% discovery rate" means 15% of posts come from outside your network

**Implementation:**
1. Fetch N posts from following
2. Fetch M posts from non-following (discovery)
3. Mix at specified ratio
4. Interleave (don't just append discovery at end)

```typescript
function mixFeedWithDiscovery(
  networkPosts: Post[],
  discoveryPosts: Post[],
  discoveryRate: number // 0-100
): Post[] {
  const total = networkPosts.length;
  const discoveryCount = Math.floor(total * (discoveryRate / 100));
  const networkCount = total - discoveryCount;

  const network = networkPosts.slice(0, networkCount);
  const discovery = discoveryPosts.slice(0, discoveryCount);

  // Interleave: every ~(100/discoveryRate) posts, insert a discovery post
  return interleave(network, discovery, discoveryRate);
}
```

---

## Phase 4: Performance - Make It Feel Instant

### 4.1 Precomputed Scores
**Problem:** Calculating scores for 100 posts on every request is slow

**Solution:** Pre-calculate and cache scores

```prisma
model PostScore {
  id              String   @id @default(cuid())
  postId          String   @unique

  // Pre-calculated base scores (not user-specific)
  qualityScore    Float
  engagementScore Float

  // Time-sensitive (recalculate periodically)
  recencyScore    Float
  velocityScore   Float

  // Aggregates for quick filtering
  totalVibes      Int
  commentCount    Int

  updatedAt       DateTime @updatedAt

  post            Post     @relation(fields: [postId], references: [id])
}
```

**Implementation:**
1. Background job recalculates scores every 5 minutes for recent posts
2. Feed query joins PostScore instead of calculating
3. Only personalization score calculated per-user (it requires user context)
4. Result: 10x faster feed queries

### 4.2 Feed Prefetching
**Problem:** Bluesky/Mastodon feel slow because content loads on scroll

**Solution:** Prefetch next page before user reaches it

**Frontend Implementation:**
```typescript
// In Feed component
const [posts, setPosts] = useState<Post[]>([]);
const [prefetchedPosts, setPrefetchedPosts] = useState<Post[]>([]);
const [nextCursor, setNextCursor] = useState<string>();
const [prefetchCursor, setPrefetchCursor] = useState<string>();

// When user scrolls past 70% of current posts, prefetch next batch
useEffect(() => {
  if (scrollPosition > posts.length * 0.7 && !prefetchedPosts.length && nextCursor) {
    fetchPosts(nextCursor).then(data => {
      setPrefetchedPosts(data.posts);
      setPrefetchCursor(data.nextCursor);
    });
  }
}, [scrollPosition]);

// When user reaches end, instantly append prefetched posts
const handleLoadMore = () => {
  if (prefetchedPosts.length) {
    setPosts([...posts, ...prefetchedPosts]);
    setNextCursor(prefetchCursor);
    setPrefetchedPosts([]);
    // Immediately start prefetching next batch
    fetchPosts(prefetchCursor).then(data => {
      setPrefetchedPosts(data.posts);
      setPrefetchCursor(data.nextCursor);
    });
  }
};
```

### 4.3 Image/Media Preloading
**Problem:** Images pop in as you scroll

**Solution:** Preload images for upcoming posts

```typescript
// Preload images for posts that will be visible soon
function preloadMedia(posts: Post[], startIndex: number, count: number = 5) {
  const upcoming = posts.slice(startIndex, startIndex + count);
  upcoming.forEach(post => {
    if (post.mediaUrl) {
      Image.prefetch(post.mediaUrl);
    }
    if (post.author.avatar) {
      Image.prefetch(post.author.avatar);
    }
    if (post.linkMeta?.image) {
      Image.prefetch(post.linkMeta.image);
    }
  });
}

// Call when scroll position changes
useEffect(() => {
  const visibleEnd = Math.ceil(scrollPosition / POST_HEIGHT);
  preloadMedia(posts, visibleEnd, 10); // Preload next 10 posts' media
}, [scrollPosition]);
```

### 4.4 Optimistic UI Updates
**Problem:** Actions feel slow (like, save, react)

**Solution:** Update UI immediately, sync in background

```typescript
// Already partially implemented, but ensure:
// 1. Vibe reactions update UI instantly
// 2. Save/unsave updates UI instantly
// 3. Hide/delete updates UI instantly
// 4. Background sync with retry on failure
// 5. Show subtle error if sync fails (don't revert unless critical)
```

---

## Phase 5: External Platform Integration Prep

### 5.1 Unified Post Schema
Before connecting Bluesky/Mastodon, we need a schema that works for all:

```typescript
interface UnifiedPost {
  // Identity
  id: string;                    // Node Social internal ID
  platform: 'node' | 'bluesky' | 'mastodon';
  externalId?: string;           // Original platform ID
  externalUri?: string;          // Original platform URI

  // Author (normalized)
  author: {
    id: string;
    platform: 'node' | 'bluesky' | 'mastodon';
    handle: string;              // @user or @user@instance.social
    displayName: string;
    avatar: string;
    // Node Social specific
    era?: string;
    cred?: number;
  };

  // Content
  content: string;
  textLength: number;
  textDensity: 'micro' | 'short' | 'medium' | 'long';

  // Media
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'gif' | 'audio';
  mediaDuration?: number;

  // Links
  linkUrl?: string;
  linkMeta?: LinkMeta;

  // Engagement (platform-native)
  likes: number;
  reposts: number;
  replies: number;

  // Engagement (Node Social overlay)
  vibeAggregate?: VibeAggregate;  // Only for posts with NS reactions
  nodeVibes?: boolean;            // Has been reacted to on Node Social

  // Scoring (computed)
  scores: {
    quality: number;
    recency: number;
    engagement: number;
    personalization: number;
    final: number;
  };

  // Timestamps
  createdAt: Date;
  indexedAt: Date;                // When Node Social saw it
}
```

### 5.2 Platform-Agnostic Scoring
The vibe validator needs to work even without Node Social vibe data:

**For external posts without vibes:**
1. **Quality:** Estimate from author reputation (follower ratio, account age)
2. **Recency:** Same as Node Social (age-based decay)
3. **Engagement:** Map platform metrics → our scale
   - Bluesky likes → engagement intensity
   - Mastodon boosts → share weight
   - Reply count → discussion depth
4. **Personalization:** Limited until user reacts
   - Following boost still works
   - Vibe alignment = 0 (neutral) until reacted

**Over time:** As users react to external posts with Node Social vibes, those posts accumulate vibe data and scoring becomes richer.

---

## Implementation Priority

### Tier 1: Quick Wins (This Week)
1. ✅ Wire up `calculateQualityScore()`
2. ✅ Wire up `calculateRecencyScore()`
3. ✅ Wire up `calculateEngagementScore()`
4. ✅ Wire up diversity controls
5. ✅ Wire up mood presets
6. ✅ Wire up vector multipliers

**Result:** Advanced mode actually works

### Tier 2: Content Intelligence (Next Week)
1. Add `textLength` and `textDensity` fields
2. Add `mediaType` detection (photo/video/gif)
3. Backfill existing posts
4. Add UI filters for new fields

**Result:** Users can filter by content type precisely

### Tier 3: User Context (Week 3)
1. Implement seen posts tracking
2. Implement muted words
3. Implement discovery rate mixing

**Result:** Feed feels personalized and fresh

### Tier 4: Performance (Week 4)
1. Implement feed prefetching
2. Implement image preloading
3. Add precomputed scores table
4. Background score recalculation job

**Result:** Feed feels instant, no loading jank

### Tier 5: External Platforms (Week 5+)
1. Bluesky OAuth + adapter
2. Mastodon OAuth + adapter
3. Unified post normalization
4. Platform-agnostic scoring
5. Cross-platform columns

**Result:** Node Social becomes the TweetDeck that works

---

## Success Metrics

### Functional
- [ ] Every slider in Advanced mode produces measurably different results
- [ ] Every toggle in Intermediate mode works
- [ ] Mood presets feel noticeably different
- [ ] Text/media filters are precise

### Performance
- [ ] Feed loads in <500ms
- [ ] Infinite scroll never shows loading spinner (prefetch works)
- [ ] Images are pre-loaded before scrolling to them
- [ ] Algorithm changes apply in <200ms

### User Experience
- [ ] Users can successfully hide topics they don't want
- [ ] Users don't see the same posts repeatedly (unless they want to)
- [ ] Discovery rate actually introduces new content
- [ ] Vibe multipliers noticeably affect feed composition

---

## Testing Strategy

### For Each Feature
1. **Unit test** the scoring function with mock data
2. **Integration test** the API endpoint accepts and uses the parameter
3. **Manual verification** that changing the setting produces different results
4. **A/B comparison** screenshots showing before/after

### Verification Checklist Template
```markdown
## Feature: [Name]

### Settings Used
- Parameter: value

### Before
- Screenshot or post list
- Score calculation shown

### After
- Screenshot or post list
- Score calculation shown

### Verified By
- [ ] Developer tested
- [ ] Q approved
```

---

## Notes for Q

This is a lot. But the good news:
1. **Most backend logic exists** - it's just not wired up
2. **Schema is already there** - UserFeedPreference has all the fields
3. **UI is done** - VibeValidator already shows all these controls

The work is mostly:
1. **Wiring** - connecting existing functions to the feed endpoint
2. **Detection** - adding text length and media type analysis
3. **Tracking** - seen posts and muted words
4. **Performance** - prefetching and preloading

Pick a tier and let's start making it real.
