# Cross-Platform Social Media Aggregator Research

**Date:** 2026-02-02
**Goal:** Turn Node Social into a TweetDeck replacement that aggregates multiple social platforms with vibe validator filtering

---

## Executive Summary

The social media API landscape has bifurcated sharply:

| Platform | Third-Party Client Viability | Why |
|----------|------------------------------|-----|
| **Bluesky** | ✅ Excellent | Open AT Protocol, same API access as official app |
| **Mastodon** | ✅ Excellent | Open ActivityPub, many successful third-party clients |
| **Threads** | ⚠️ Moderate | ActivityPub federation available, Meta approval painful |
| **Twitter/X** | ❌ Dead | $200-$42k/month, killed all major third-party clients |
| **Reddit** | ❌ Dead | Killed Apollo, RIF, Sync, Boost - enterprise pricing only |

**Recommendation:** Focus on Bluesky and Mastodon/Fediverse first. These are the only platforms where building a TweetDeck-style client is actually possible without burning money or getting shut down.

---

## Platform Deep Dives

### Bluesky (AT Protocol) — PRIMARY TARGET

**Why it's perfect:**
- Same APIs available to third-party devs as the official app uses
- No approval process, no rate limit surprises
- 28+ million monthly active users and growing rapidly
- Designed explicitly to support third-party clients
- Data portability and algorithm transparency built into the protocol

**API Capabilities:**
- Read home timeline, profile feeds, custom feeds
- Post, reply, like, repost, quote
- Full search
- Real-time firehose subscription
- Custom feed algorithms (could sync with vibe validator!)

**Technical Integration:**
- REST API + WebSocket firehose
- JWT authentication
- `@atproto/api` npm package available
- Well-documented: https://docs.bsky.app

**Sources:**
- [Bluesky Developer Docs](https://docs.bsky.app)
- [Bluesky Community Showcase](https://docs.bsky.app/showcase)
- [Using the Bluesky API](https://www.raymondcamden.com/2024/02/09/using-the-bluesky-api)
- [Bluesky API Guide](https://zuplo.com/blog/2025/03/12/bluesky-api)

---

### Mastodon (ActivityPub/Fediverse) — SECONDARY TARGET

**Why it works:**
- Fully open protocol (ActivityPub)
- No corporate restrictions
- Many successful third-party clients: Ivory (Tapbots), Mammoth, Woolly
- Multi-instance means resilience

**API Capabilities:**
- Full read/write access
- Real-time streaming
- Instance-agnostic (user picks their server)
- Federated timelines

**Challenges:**
- User must have/create Mastodon account on some instance
- Different instances = different communities
- ActivityPub complexity vs AT Protocol simplicity

**Sources:**
- [TechCrunch: Social Networks API Landscape](https://techcrunch.com/2024/02/09/social-network-api-apps-twitter-reddit-threads-mastodon-bluesky/)

---

### Threads — MAYBE LATER

**Current State:**
- Has an API (launched 2024)
- Requires Meta app approval (notoriously painful process)
- ActivityPub federation with Mastodon instances

**The Catch:**
- "Be prepared to be rejected numerous times" - developers report
- Limited to publishing and insights initially
- Full read access may require enterprise agreement

**Strategy:** Wait until ActivityPub federation matures, then Threads content becomes accessible through Mastodon integration for free.

**Sources:**
- [Top 10 Social Media APIs](https://getlate.dev/blog/top-10-social-media-apis-for-developers)

---

### Twitter/X — NOT VIABLE

**Current Pricing (2025):**
| Tier | Cost | Limits |
|------|------|--------|
| Free | $0 | 500 posts/month read, severely limited |
| Basic | $200/month | 15k read, 50k write |
| Pro | $5,000/month | Higher limits |
| Enterprise | $42,000/month | Full access |

**What Happened:**
- January 2023: Killed all third-party clients overnight
- Twitterific, Tweetbot, Fenix - all dead
- Microsoft, Sony, Nintendo removed Twitter integrations
- 9,900% price increase for enterprise access since 2022

**New Pricing Model (July 2025):**
- Moving to revenue share + pay-per-use
- $500 voucher for beta testers
- Still prohibitively expensive for indie apps

**Bottom Line:** Unless you're willing to spend $2,400+/year minimum for basic access (which gets you almost nothing), or you're an enterprise with $500k/year budget, Twitter is off the table.

**Sources:**
- [X API Pricing 2025](https://twitterapi.io/blog/twitter-api-pricing-2025)
- [Twitter API Pricing Breakdown](https://getlate.dev/blog/twitter-api-pricing)
- [Yahoo: X API costs $42K/month](https://tech.yahoo.com/articles/x-api-costs-developers-42k-170210147.html)

---

### Reddit — NOT VIABLE

**Current Pricing:**
- $0.24 per 1,000 API calls
- Free tier: 100 queries/minute (OAuth), 10 queries/minute (no OAuth)
- Enterprise: "thousands of dollars monthly minimum commitment"

**What Happened:**
- July 2023: Apollo (iOS) shut down - would have cost $20M/year
- Also killed: Reddit Is Fun, Sync, Boost, BaconReader
- Only accessibility apps (RedReader) got exemptions

**Bottom Line:** Reading Reddit feeds at any real scale = thousands/month. Not viable for indie TweetDeck clone.

**Sources:**
- [Reddit API Cost 2025](https://sellbery.com/blog/how-much-does-the-reddit-api-cost-in-2025/)
- [Apollo Shutdown](https://appleinsider.com/articles/23/06/08/reddit-app-apollo-is-shutting-down-over-reddits-expensive-api-prices)

---

## Proposed Architecture

### Phase 1: Foundation (Cleanup + Bluesky)

```
┌─────────────────────────────────────────────────────────────┐
│                    Node Social Client                        │
├─────────────────────────────────────────────────────────────┤
│  Multi-Column Container                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Column  │ │  Column  │ │  Column  │ │  Column  │       │
│  │  (Node   │ │ (Bluesky │ │ (Mastodon│ │ (Search) │       │
│  │  Social) │ │   Feed)  │ │   Feed)  │ │          │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │              │
│       ▼            ▼            ▼            ▼              │
│  ┌─────────────────────────────────────────────────┐       │
│  │            Unified Post Adapter                  │       │
│  │  (normalizes posts from all platforms)           │       │
│  └─────────────────────────────────────────────────┘       │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Vibe Validator                      │       │
│  │  (scores/filters based on unified signals)       │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Platform Adapters

Each platform needs an adapter that:
1. Authenticates (OAuth for Bluesky/Mastodon)
2. Fetches posts
3. Normalizes to unified `UnifiedPost` schema
4. Maps platform signals → vibe validator inputs

```typescript
interface UnifiedPost {
  // Core identity
  id: string;
  platformId: 'node-social' | 'bluesky' | 'mastodon' | 'threads';
  originalId: string;
  uri: string;

  // Author
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatar: string;
    platformVerified: boolean;
  };

  // Content
  content: string;
  contentWarning?: string;
  media: Array<{type: 'image' | 'video' | 'link'; url: string; alt?: string}>;

  // Engagement (for vibe scoring)
  likes: number;
  reposts: number;
  replies: number;

  // Timestamps
  createdAt: Date;
  indexedAt: Date;

  // Platform-specific (for actions)
  platformData: Record<string, unknown>;

  // Vibe scoring (computed locally)
  vibeScores?: {
    estimated: boolean; // true if AI-estimated, false if real vibe data
    quality: number;
    engagement: number;
    recency: number;
    // ... other signals
  };
}
```

### Vibe Validator Adaptation

**Problem:** External posts don't have Node Social vibe reactions.

**Solutions:**

1. **Engagement-based scoring (simple)**
   - Map likes → engagement signal
   - Map replies → discussion signal
   - Map reposts → reach signal
   - Use recency as time signal

2. **AI-estimated vibes (advanced)**
   - Send post content to Claude
   - Get back estimated vibe vector (insightful/joy/fire/etc.)
   - Cache results to avoid re-scoring

3. **Hybrid (recommended)**
   - Use engagement signals for initial ranking
   - Allow users to vibe-react to external posts
   - Store vibe reactions in Node Social DB
   - Over time, external posts get real vibe data from NS users

---

## Column Types After Integration

Current:
- `global`, `node`, `discovery`, `following`, `search`, `notifications`, `profile`, `trending`, `node-info`

New:
- `bluesky-home` — User's Bluesky following feed
- `bluesky-feed` — Specific Bluesky custom feed
- `bluesky-search` — Bluesky search results
- `bluesky-profile` — Bluesky user profile
- `mastodon-home` — User's Mastodon home timeline
- `mastodon-local` — Instance local timeline
- `mastodon-federated` — Federated timeline
- `mastodon-search` — Mastodon search

---

## Implementation Phases

### Phase 0: Cleanup (This Week)
- Remove dead code identified in audit
- Unify VibeValidatorSettings interfaces
- Extract post mapping to shared utility
- Remove debug console.logs
- Remove mock velocity data

### Phase 1: Bluesky Read-Only (2-3 weeks)
1. Add Bluesky authentication (OAuth / app password)
2. Create Bluesky adapter service
3. Add `bluesky-home` and `bluesky-search` column types
4. Map Bluesky engagement → vibe validator signals
5. Display Bluesky posts in columns with "View on Bluesky" action

### Phase 2: Bluesky Write + Interactions (2 weeks)
1. Like/repost/reply from Node Social
2. Post to Bluesky from compose modal
3. Cross-post to Node Social + Bluesky simultaneously

### Phase 3: Mastodon Integration (2-3 weeks)
1. Mastodon OAuth (instance-aware)
2. Mastodon adapter service
3. Column types for Mastodon
4. Write actions

### Phase 4: Unified Experience (2 weeks)
1. Cross-platform search
2. Unified notifications column
3. Platform indicators in UI
4. Settings for default post destinations

---

## Technical Decisions Needed

1. **Where to store platform credentials?**
   - Backend DB (encrypted) — allows server-side fetching, syncing
   - Client-only (secure storage) — simpler, user controls data
   - Recommendation: Backend, since we want server-side feed aggregation

2. **Rate limiting strategy?**
   - Bluesky: 3000 requests/5 min per user
   - Mastodon: Varies by instance (usually 300/5 min)
   - Need per-user rate limit tracking

3. **Caching strategy?**
   - Cache external posts in Node Social DB?
   - Or fetch fresh every time?
   - Recommendation: Cache with TTL, reduces API calls

4. **Cross-post attribution?**
   - When user posts to Node Social + Bluesky, how to link them?
   - Store mapping in DB for thread continuity

---

## Risks

1. **Platform policy changes** — AT Protocol is decentralized, so Bluesky Inc. can't really block us. Mastodon is also safe. Only Threads (Meta) is a policy risk.

2. **Scaling costs** — If we cache posts server-side, storage grows. Could be expensive at scale.

3. **Complexity** — Multi-platform auth, different APIs, unified UX. Significant engineering effort.

4. **User confusion** — "Where does this post live?" needs clear UI.

---

## Competitive Landscape

| App | Platforms | Status |
|-----|-----------|--------|
| **TweetDeck** | X only | Dead (absorbed into X Premium) |
| **Ivory** | Mastodon only | Active, $14.99/year |
| **Graysky** | Bluesky only | Active, open source |
| **Buffer/Hootsuite** | Multi-platform posting | Active, $$$, no unified reading |
| **Phanpy** | Mastodon only | Active, web-based |
| **Deck.blue** | Bluesky only | Active, TweetDeck-style |

**Gap:** No good multi-platform TweetDeck exists. The ones that did (TweetDeck) died when platforms closed APIs. Bluesky + Mastodon being open creates the opportunity.

---

## Conclusion

The TweetDeck dream is achievable, but only with the open platforms. Focus on:

1. **Bluesky first** — Fastest growing, best API, most similar to Twitter UX
2. **Mastodon second** — Large existing user base, open protocol
3. **Threads via ActivityPub** — When federation matures
4. **Skip Twitter/X and Reddit** — Not worth the cost or headache

The vibe validator becomes the differentiator: instead of just aggregating feeds, Node Social lets users apply intelligent filtering that no platform provides natively.
