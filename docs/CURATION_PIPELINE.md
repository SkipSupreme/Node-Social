# Node Social Content Curation Pipeline

## Executive Summary

**Q: Is there ONE pipeline or multiple?**
**A: YES - There is ONE unified curation pipeline.**

The curation system has exactly ONE path for content to reach the platform:

```
External Sources → Harvester → CurationQueue → Curator → Posts
```

There is NO duplicate system. There is NO parallel pipeline. There is only ONE way content gets curated.

---

## System Architecture

```
                              ┌─────────────────────────────────────────────────────────────┐
                              │                    EXTERNAL SOURCES                         │
                              │  Reddit │ HackerNews │ RSS │ Bluesky │ YouTube              │
                              └─────────────────────────┬───────────────────────────────────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    HARVESTER (harvester.ts)                                   │
│                                                                                               │
│  Runs: Every 15 minutes via cron                                                              │
│  Command: npm run harvest                                                                     │
│                                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ RedditHarvester  │  │ HackerNewsHarv   │  │  RSSHarvester    │  │ BlueskyHarvester │       │
│  │ (12 subreddits)  │  │ (top stories)    │  │ (tech feeds)     │  │ (tech feeds)     │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                     │                 │
│           └─────────────────────┴─────────────────────┴─────────────────────┘                 │
│                                          │                                                    │
│                         BaseHarvester.queueItem()                                             │
│                                          │                                                    │
│                         ┌────────────────┴────────────────┐                                   │
│                         │  - Deduplication (sourceId)     │                                   │
│                         │  - English filter               │                                   │
│                         │  - Suggested node assignment    │                                   │
│                         └────────────────┬────────────────┘                                   │
└──────────────────────────────────────────┼────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CURATION QUEUE (Database)                                    │
│                                                                                               │
│  Table: CurationQueue                                                                         │
│  Status: pending | approved | rejected | posted                                               │
│                                                                                               │
│  Fields:                                                                                      │
│  - sourceType, sourceId, sourceUrl, sourceScore                                               │
│  - title, content, linkUrl, mediaUrl                                                          │
│  - suggestedNode, aiScore, aiReason                                                           │
│  - status, needsReview, confidence                                                            │
└───────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CURATOR (curateNow.ts)                                      │
│                                                                                               │
│  Runs: Manually via npm run curate                                                            │
│  Command: npx tsx src/jobs/curateNow.ts                                                       │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐     │
│  │                              evaluateItem() Function                                 │     │
│  │                                                                                      │     │
│  │  1. REJECT patterns (clickbait, spam, personal posts)                               │     │
│  │  2. SCORE content (technical depth, science, AI/ML, quality source)                 │     │
│  │  3. ASSIGN node (subreddit-based, then keyword-based fallback)                      │     │
│  │  4. AI-SPECIFIC filtering (spam patterns, daily limit: 1/day, threshold: 10)        │     │
│  └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐     │
│  │                              postItem() Function                                     │     │
│  │                                                                                      │     │
│  │  1. Find bot user for target node (BOT_MAP)                                         │     │
│  │  2. Clean text (strip HTML, fix entities, remove broken URLs)                       │     │
│  │  3. Enrich content via articleScraper (if linkUrl is scrapeable)                    │     │
│  │  4. Create Post in database                                                         │     │
│  │  5. Update CurationQueue status → 'posted'                                          │     │
│  └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                               │
│  Thresholds:                                                                                  │
│  - AI node: Score >= 10 to auto-post (only 1/day max)                                        │
│  - Other nodes: Score >= 7 to auto-post                                                      │
│  - Score 5-7: Flagged for manual review                                                      │
│  - Score < 5: Rejected                                                                       │
└───────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     POSTS (Database)                                          │
│                                                                                               │
│  Table: posts                                                                                 │
│  Fields: id, title, content, linkUrl, mediaUrl, postType, authorId, nodeId                   │
│                                                                                               │
│  Content is stored WITHOUT limits - full articles saved                                       │
│  Frontend handles display truncation (6000 char limit with "Continue Reading")               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Inventory

### Core Pipeline Files

| File | Purpose | Location |
|------|---------|----------|
| `harvester.ts` | Main harvester entry point, runs all harvesters | backend/api/src/jobs/ |
| `BaseHarvester.ts` | Abstract class with queue logic, dedup, English filter | backend/api/src/jobs/harvesters/ |
| `RedditHarvester.ts` | Fetches from 12+ subreddits | backend/api/src/jobs/harvesters/ |
| `HackerNewsHarvester.ts` | Fetches HN top stories | backend/api/src/jobs/harvesters/ |
| `RSSHarvester.ts` | Fetches from tech RSS feeds | backend/api/src/jobs/harvesters/ |
| `BlueskyHarvester.ts` | Fetches from Bluesky feeds | backend/api/src/jobs/harvesters/ |
| `YouTubeHarvester.ts` | Fetches from YouTube channels | backend/api/src/jobs/harvesters/ |
| `curateNow.ts` | **THE CURATOR** - evaluates and posts content | backend/api/src/jobs/ |
| `curatorHelpers.ts` | CLI helpers for manual curation | backend/api/src/jobs/ |
| `articleScraper.ts` | Scrapes full article content from URLs | backend/api/src/jobs/ |

### Support Files

| File | Purpose |
|------|---------|
| `harvesterConfig.ts` | Configuration for harvesters |
| `fixDevToPosts.ts` | One-time fix script for dev.to posts |
| `testScraper.ts` | Test script for article scraper |

---

## Content Flow Verification

### Step 1: Harvester adds to queue
```
CurationQueue.create({
  sourceType: 'reddit' | 'hackernews' | 'rss' | 'bluesky' | 'youtube',
  sourceId: <unique ID from source>,
  title, content, linkUrl, mediaUrl,
  suggestedNode: <initial guess>,
  status: 'pending'
})
```

### Step 2: Curator evaluates
```
evaluateItem(item) → { score, reason, shouldPost, needsReview, correctNode }
```

### Step 3: Curator posts (if shouldPost=true)
```
postItem(item, correctNode, score, reason) → creates Post
```

---

## Bot Mapping

Posts are created by bot accounts, one per node:

| Node Slug | Bot Username |
|-----------|--------------|
| technology | TechDigest |
| science | ScienceDaily |
| programming | CodeCurator |
| astronomy | CosmicNews |
| math | MathMind |
| ai | AIInsider |
| godot | GodotGuru |
| graphic-design | DesignDaily |
| ui-ux | UXCurator |
| art | ArtStream |
| mtg | MTGDigest |
| blender | BlenderBot |
| spirituality | SoulSeeker |
| youtube | TubeWatch |

---

## Article Scraping (articleScraper.ts)

When curator posts an item with a `linkUrl`:

1. Check if URL is scrapeable (not blocked domain, not media file)
2. Fetch page HTML with timeout
3. Extract lead image from og:image/twitter:image meta tags
4. Use @mozilla/readability to extract article content
5. Extract inline images from article HTML
6. Clean content: remove HTML tags, broken dev.to URLs, normalize whitespace
7. Return: { title, content, excerpt, leadImage }

### Blocked Domains (not scraped)
- twitter.com, x.com, facebook.com, instagram.com, linkedin.com
- youtube.com, reddit.com, github.com, gitlab.com
- v.redd.it, i.redd.it, imgur.com

### Article Domains (known to work well)
- techcrunch.com, arstechnica.com, theverge.com, wired.com
- medium.com, dev.to, bbc.com, reuters.com, nature.com

---

## AI Node Special Handling

The AI node has strict controls to prevent spam:

1. **Daily Limit**: Maximum 1 post per day
2. **Score Threshold**: Only score 10 (perfect) auto-posts
3. **Spam Patterns**: Additional filters for:
   - Hashtag spam (#tech #api #programmer)
   - Course spam (simplilearn, intellipaat, edureka)
   - Clickbait (game-changer, revolutionary)
   - Emoji spam

---

## Content Cleaning (cleanText function)

Applied to all content before posting:

1. Strip HTML tags (robust regex with 's' flag for multiline)
2. Remove broken dev.to image URLs (media2.dev.to, dev-to-uploads.s3)
3. Decode HTML entities (numeric and named)
4. Remove CDATA markers
5. Remove markdown title prefixes
6. Normalize whitespace (max 2 consecutive newlines)
7. Safety check: re-strip any remaining HTML tags

---

## Frontend Display

### Post Cards (Feed.tsx)
- Content truncated at 6000 characters
- "Continue Reading" button shows if content > 6000 chars
- Images from `mediaUrl` displayed
- Links from `linkUrl` shown with domain pill

### Full Post View
- NO content limit
- Full article displayed
- FormattedContent component handles markdown formatting

---

## Current Health Status (Audit Results)

| Metric | Count | Status |
|--------|-------|--------|
| Total Posts | 1242 | - |
| Posts with `<img src=` tags | 4 | Non-critical (RSS/non-dev.to) |
| Posts with media2.dev.to URLs | 0 | Fixed |
| Posts without linkUrl | 13 | Expected (text-only posts) |
| Posts with very short content (<100 chars) | 312 | Normal (link posts, polls) |
| Posts with mediaUrl | 633 | 51% have images |

### Verification: Pipeline is working correctly

---

## Commands Reference

```bash
# Harvest content from all sources
npm run harvest

# Run curation (evaluate and post)
npm run curate

# Check queue stats
npm run curator:stats

# View pending items
npm run curator:pending

# Fix dev.to posts (one-time)
npx tsx src/jobs/fixDevToPosts.ts
```

---

## Conclusion

**THE CURATION PIPELINE IS ONE SYSTEM.**

Content flows through:
1. **Harvester** → collects from external sources
2. **CurationQueue** → holds pending content
3. **Curator** → evaluates, cleans, and posts
4. **Posts** → final destination

There are no duplicate pipelines. There is no parallel system. All content goes through this single path.

The recent dev.to issues were caused by:
1. Stale content in database from before scraper fixes
2. The scraper not removing all broken URL patterns

Both issues have been fixed:
1. `fixDevToPosts.ts` re-scraped all 491 dev.to posts
2. `articleScraper.ts` now properly cleans media2.dev.to URLs
3. `curateNow.ts` cleanText() also strips these URLs

---

*Last Updated: December 13, 2025*
*Posts Audited: 1242*
*Pipeline Status: WORKING*
