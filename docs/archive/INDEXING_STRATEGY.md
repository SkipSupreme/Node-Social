# Database Indexing Strategy: B-tree vs Meilisearch

## TL;DR: Use Both, But For Different Things

**B-tree indexes** = Fast feed queries, filtering, pagination (needed NOW)  
**Meilisearch** = Full-text search, semantic search (comes later in Phase 2)

They complement each other, not replace each other.

---

## When to Use B-tree Indexes (PostgreSQL)

### Use For:
- ✅ **Feed queries** - "Get posts by author, sorted by date"
- ✅ **Filtering** - "Get all posts by user X"
- ✅ **Sorting** - "Get posts ordered by created_at DESC"
- ✅ **Pagination** - "Get next 20 posts after cursor"
- ✅ **Range queries** - "Get posts from last 7 days"
- ✅ **Foreign key lookups** - "Get all comments for post X"

### Examples:
```sql
-- Feed query (what we need NOW)
SELECT * FROM posts 
WHERE author_id = ? 
ORDER BY created_at DESC 
LIMIT 20;

-- Comments for a post
SELECT * FROM comments 
WHERE post_id = ? 
ORDER BY created_at ASC;

-- User's posts
SELECT * FROM posts 
WHERE author_id = ? 
ORDER BY created_at DESC;
```

**Why B-tree?**
- Fast for exact matches and range queries
- Perfect for sorting and pagination
- Low overhead (3x faster to build than GIN)
- Standard PostgreSQL indexes (no extra infrastructure)

---

## When to Use Meilisearch

### Use For:
- ✅ **Full-text search** - "Find posts containing 'javascript'"
- ✅ **Semantic search** - "Find posts about coding"
- ✅ **User search** - "Find users named 'John'"
- ✅ **Node/community search** - "Find communities about 'tech'"
- ✅ **Tag search** - "Find posts tagged #react"
- ✅ **Advanced filters** - "Posts with high 'funny' Vibe Vector"

### Examples:
```javascript
// Search posts (Phase 2)
meilisearch.index('posts').search('javascript', {
  filter: ['nodeId = tech'],
  sort: ['createdAt:desc']
});

// Search users (Phase 2)
meilisearch.index('users').search('john smith');
```

**Why Meilisearch?**
- Optimized for full-text search
- Typo tolerance ("javascrit" → "javascript")
- Ranking and relevance scoring
- Fast search across millions of documents
- But: Requires separate service, sync overhead

---

## When to Use GIN Indexes (PostgreSQL)

### Use For:
- ✅ **Full-text search INSIDE PostgreSQL** (if not using Meilisearch)
- ✅ **JSONB queries** - "Find posts with Vibe Vector containing 'funny'"
- ✅ **Array queries** - "Find posts with tags containing 'react'"

### Examples:
```sql
-- Full-text search (if not using Meilisearch)
CREATE INDEX idx_post_content_search 
ON posts USING GIN (to_tsvector('english', content));

-- JSONB Vibe Vectors (Phase 2)
CREATE INDEX idx_vibe_reactions 
ON vibe_reactions USING GIN (reactions);
```

**Why GIN?**
- Fast for searching INSIDE composite values
- But: 3x slower to build than B-tree
- Terrible for range queries
- Only use when you need to search inside JSONB/arrays

---

## Our Strategy for Feed Implementation

### Phase 1: MVP Feed (NOW)
**Use B-tree indexes ONLY**

```prisma
model Post {
  // ... fields ...
  
  @@index([authorId, createdAt(sort: Desc)])  // B-tree
  @@index([nodeId, createdAt(sort: Desc)])    // B-tree
  @@index([createdAt(sort: Desc)])              // B-tree
}

model Comment {
  // ... fields ...
  
  @@index([postId, createdAt(sort: Desc)])    // B-tree
  @@index([parentId, createdAt(sort: Desc)])  // B-tree
  @@index([authorId, createdAt(sort: Desc)])   // B-tree
}
```

**Why?**
- Feed queries need to be FAST (< 100ms)
- We're doing filtering/sorting/pagination (B-tree's strength)
- No search needed yet (that's Phase 2)
- Simple, proven, no extra infrastructure

### Phase 2: Search (Later)
**Add Meilisearch**

1. Sync posts to Meilisearch on create/update
2. Use Meilisearch for search queries
3. Keep B-tree indexes for feed queries
4. Use both together:
   - B-tree: Fast feed pagination
   - Meilisearch: Fast search

### Phase 3: Vibe Vectors (Later)
**Add GIN indexes for JSONB**

```prisma
model VibeReaction {
  reactions JsonB  // Multi-dimensional reactions
  
  @@index([reactions], type: Gin)  // GIN for JSONB queries
}
```

---

## Performance Comparison

### Feed Query (B-tree wins)
```sql
-- B-tree: ~5-10ms for 1M posts
SELECT * FROM posts 
ORDER BY created_at DESC 
LIMIT 20;

-- Meilisearch: ~50-100ms (overkill for simple feed)
-- Plus sync overhead, network latency
```

### Search Query (Meilisearch wins)
```sql
-- PostgreSQL full-text: ~100-500ms, no typo tolerance
SELECT * FROM posts 
WHERE to_tsvector('english', content) @@ to_tsquery('javascript');

-- Meilisearch: ~20-50ms, typo tolerance, better ranking
meilisearch.search('javascrit');  // Finds "javascript"
```

---

## Architecture Decision

### Current (Phase 1 MVP)
```
PostgreSQL (B-tree indexes)
  ↓
Fast feed queries
  ↓
GET /posts?cursor=...&limit=20
```

### Future (Phase 2)
```
PostgreSQL (B-tree) ──┐
                      ├──> Fast feed queries
                      │
Meilisearch ──────────┼──> Fast search queries
                      │
                      └──> Use both together
```

---

## Recommendation

**For Feed Implementation (NOW):**
✅ **Use B-tree indexes** - They're perfect for what we need:
- Fast feed pagination
- Filtering by author/node
- Sorting by date
- No extra infrastructure
- Simple and proven

**For Search (Phase 2):**
✅ **Add Meilisearch** - When we need search:
- Full-text search
- User/Node search
- Typo tolerance
- Better ranking

**For Vibe Vectors (Phase 3):**
✅ **Add GIN indexes** - For JSONB queries:
- Search inside Vibe Vector reactions
- Multi-dimensional filtering

---

## Summary

| Use Case | Solution | When |
|----------|----------|------|
| Feed pagination | B-tree | NOW (Phase 1) |
| Filtering by author/node | B-tree | NOW (Phase 1) |
| Sorting by date | B-tree | NOW (Phase 1) |
| Full-text search | Meilisearch | Phase 2 |
| User/Node search | Meilisearch | Phase 2 |
| JSONB queries (Vibe Vectors) | GIN | Phase 3 |

**Bottom line:** B-tree indexes are essential for the feed to work fast. Meilisearch is for search, which comes later. Use both, but for different purposes! 🚀

