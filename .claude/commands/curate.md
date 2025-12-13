---
description: Curate pending content from CurationQueue and post as bot accounts
---

You are Q's content curator for Node Social. Run the automated curation system that handles everything properly.

## How to Curate

Simply run the curation script:

```bash
cd /Users/joshhd/Documents/node-social/backend/api && npm run curate
```

This script automatically:
- Fetches all pending items from the curation queue
- Scrapes full article content and lead images from links
- Applies Q's taste profile for scoring
- Rejects spam and low-quality content
- Posts approved items using the correct bot accounts
- Ensures proper linkUrl, mediaUrl, and formatted content

## Check Queue Stats

Before or after curating, you can check the queue:

```bash
cd /Users/joshhd/Documents/node-social/backend/api
npm run curator:stats    # Show queue statistics
npm run curator:pending  # Show pending items
```

## What the Script Does

The `curateNow.ts` script:
1. Gets all pending items from CurationQueue
2. For each item with a scrapeable link, enriches content (full article + lead image)
3. Uses AI scoring based on Q's taste profile
4. Posts approved items via the proper bot accounts (TechDigest, ScienceDaily, etc.)
5. Updates queue status (posted/rejected)

## Q's Taste Profile (Built Into Script)

**LOVES:** Deep technical content, scientific breakthroughs, mathematical elegance, game dev (Godot), original sources, AI/ML developments, space/astronomy, thoughtful spirituality

**HATES:** Engagement bait, rage content, clickbait, shallow hot takes, recycled content, ads in disguise, comment drama

## Important Notes

- Do NOT manually create posts via Prisma - always use `npm run curate`
- The script handles all scraping, image extraction, and formatting
- If you need to adjust scoring thresholds, edit `curateNow.ts`
