# Feed Implementation Plan
## Building the Core Social Feed (Phase 1 MVP)

**Goal:** Implement a working feed where users can create posts, view posts, and comment on them.

**Timeline:** 2-3 days of focused work
**Priority:** HIGH - Core feature for MVP

---

## 📋 Overview

Based on the Master Plan Phase 1 requirements:
- ✅ Text posts (required for MVP)
- ⏳ Link posts with preview (can defer to Phase 2)
- ✅ Comments with threading (basic threading for MVP)
- ✅ Chronological feed (algorithmic comes later with Vibe Vectors)
- ✅ Basic Node structure (simplified - single "global" node for MVP)

**Success Criteria:**
- User can create a text post
- User can see posts in chronological feed
- User can comment on posts
- User can see comments on a post
- Everything works on mobile (iOS/Android)
- Load time < 2 seconds

---

## 🗄️ Database Schema

### Post Model
```prisma
model Post {
  id          String   @id @default(uuid())
  authorId    String
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  content     String   // Text content (for now, text only)
  nodeId      String?  // Optional: which Node/community (null = global feed)
  node        Node?    @relation(fields: [nodeId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime? // Soft delete for moderation
  
  // Relations
  comments    Comment[]
  reactions   VibeReaction[] // For later - Vibe Vectors
  
  // Indexes (B-tree for fast filtering/sorting)
  @@index([authorId, createdAt(sort: Desc)])
  @@index([nodeId, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@map("posts")
}
```

### Comment Model
```prisma
model Comment {
  id          String   @id @default(uuid())
  authorId    String
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  postId      String
  post        Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentId    String?  // For threading (null = top-level comment)
  parent      Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  replies     Comment[] @relation("CommentReplies")
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime? // Soft delete
  
  // Indexes
  @@index([postId, createdAt(sort: Desc)])
  @@index([parentId, createdAt(sort: Desc)])
  @@index([authorId, createdAt(sort: Desc)])
  @@map("comments")
}
```

### Node Model (Simplified for MVP)
```prisma
model Node {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  
  // Relations
  posts       Post[]
  
  @@map("nodes")
}
```

### Update User Model
```prisma
model User {
  // ... existing fields ...
  
  // Relations
  posts       Post[]
  comments    Comment[]
  
  // ... rest of model ...
}
```

**Migration Strategy:**
1. Create Post model
2. Create Comment model
3. Create Node model (with default "global" node)
4. Add indexes
5. Run migration

---

## 🔌 API Endpoints

### Posts Endpoints

#### `POST /posts` - Create Post
**Auth:** Required
**Rate Limit:** 10 posts per minute
**Request:**
```json
{
  "content": "This is my first post!",
  "nodeId": "optional-node-id" // null for global feed
}
```
**Response:**
```json
{
  "id": "uuid",
  "content": "This is my first post!",
  "authorId": "user-uuid",
  "author": {
    "id": "user-uuid",
    "email": "user@example.com"
  },
  "createdAt": "2025-11-18T...",
  "commentCount": 0
}
```

#### `GET /posts` - Get Feed
**Auth:** Required
**Query Params:**
- `cursor` (optional): Pagination cursor (createdAt timestamp)
- `limit` (optional): Number of posts (default: 20, max: 50)
- `nodeId` (optional): Filter by Node (null = global feed)

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "content": "Post content",
      "author": { "id": "...", "email": "..." },
      "createdAt": "...",
      "commentCount": 5,
      "updatedAt": "..."
    }
  ],
  "nextCursor": "2025-11-18T...", // null if no more posts
  "hasMore": true
}
```

**Implementation Notes:**
- Chronological order (newest first)
- Cursor-based pagination using `createdAt`
- Include author info (id, email for now)
- Include comment count
- Filter deleted posts (`deletedAt IS NULL`)
- **Use B-tree indexes** for fast queries (see INDEXING_STRATEGY.md)
- Meilisearch comes later for search (Phase 2)

#### `GET /posts/:id` - Get Single Post
**Auth:** Required
**Response:**
```json
{
  "id": "uuid",
  "content": "Post content",
  "author": { "id": "...", "email": "..." },
  "createdAt": "...",
  "updatedAt": "...",
  "commentCount": 5,
  "comments": [
    // Top-level comments only (threading handled separately)
  ]
}
```

#### `DELETE /posts/:id` - Delete Post (Soft Delete)
**Auth:** Required (must be author or mod)
**Response:**
```json
{
  "message": "Post deleted successfully"
}
```

### Comments Endpoints

#### `POST /posts/:postId/comments` - Create Comment
**Auth:** Required
**Rate Limit:** 20 comments per minute
**Request:**
```json
{
  "content": "This is a comment",
  "parentId": "optional-parent-comment-id" // null for top-level
}
```
**Response:**
```json
{
  "id": "uuid",
  "content": "This is a comment",
  "author": { "id": "...", "email": "..." },
  "postId": "post-uuid",
  "parentId": null,
  "createdAt": "...",
  "replyCount": 0
}
```

#### `GET /posts/:postId/comments` - Get Comments
**Auth:** Required
**Query Params:**
- `parentId` (optional): Get replies to a specific comment (null = top-level)
- `limit` (optional): Number of comments (default: 50)

**Response:**
```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "Comment text",
      "author": { "id": "...", "email": "..." },
      "parentId": null,
      "createdAt": "...",
      "replyCount": 3,
      "replies": [
        // Nested replies (limit depth to 2-3 levels for MVP)
      ]
    }
  ]
}
```

**Implementation Notes:**
- Return top-level comments first
- Include nested replies (limit depth to prevent infinite recursion)
- Order by createdAt (newest first)
- Filter deleted comments

#### `DELETE /comments/:id` - Delete Comment
**Auth:** Required (must be author or mod)
**Response:**
```json
{
  "message": "Comment deleted successfully"
}
```

---

## 📱 Mobile UI Implementation

### Screen Structure

#### 1. Feed Screen (`FeedScreen.tsx`)
**Location:** `app/src/screens/FeedScreen.tsx`

**Features:**
- FlatList with posts
- Pull-to-refresh
- Infinite scroll (load more on scroll)
- Loading skeleton while fetching
- Empty state ("No posts yet")
- Error state with retry button
- Post card component

**Post Card Component:**
- Author info (email for now, username later)
- Post content (text)
- Timestamp (relative: "2h ago")
- Comment count
- Tap to view post detail

**Navigation:**
- Floating action button (FAB) to create post
- Tap post → PostDetailScreen

#### 2. Create Post Screen (`CreatePostScreen.tsx`)
**Location:** `app/src/screens/CreatePostScreen.tsx`

**Features:**
- Text input (multiline)
- Character counter (optional, max 5000 chars)
- Submit button (disabled if empty)
- Loading state while posting
- Success → navigate back to feed
- Error handling

#### 3. Post Detail Screen (`PostDetailScreen.tsx`)
**Location:** `app/src/screens/PostDetailScreen.tsx`

**Features:**
- Full post content
- Comments list (FlatList)
- Comment input at bottom
- Reply button on comments
- Threading UI (indent replies)
- Load more replies button
- Pull-to-refresh

#### 4. Comment Input Component
**Location:** `app/src/components/CommentInput.tsx`

**Features:**
- Text input
- Submit button
- Optional: parent comment context ("Replying to @user")
- Character limit

---

## 🎨 UI/UX Design

### Design System (Match Existing Auth Screens)
- **Primary Color:** #2563EB (blue)
- **Background:** #FFFFFF
- **Text:** #1E293B (dark gray)
- **Secondary Text:** #64748B (medium gray)
- **Border:** #E2E8F0 (light gray)
- **Card Shadow:** Subtle elevation

### Post Card Design
```
┌─────────────────────────────────┐
│ @user@example.com       2h ago  │
├─────────────────────────────────┤
│ This is the post content. It    │
│ can be multiple lines of text.  │
│                                 │
│ Users can write as much as they │
│ want (within limits).           │
├─────────────────────────────────┤
│ 💬 5 comments                   │
└─────────────────────────────────┘
```

### Comment Thread Design
```
┌─────────────────────────────────┐
│ @user1              1h ago      │
│ This is a top-level comment     │
│   └─ @user2          30m ago    │
│      This is a reply            │
│      └─ @user1       15m ago    │
│         This is a nested reply  │
└─────────────────────────────────┘
```

---

## 🚀 Implementation Order

### Phase 1: Database & API (Day 1)
1. ✅ Update Prisma schema (Post, Comment, Node models)
2. ✅ Create migration
3. ✅ Create default "global" Node
4. ✅ Implement `POST /posts` endpoint
5. ✅ Implement `GET /posts` endpoint (with pagination)
6. ✅ Implement `GET /posts/:id` endpoint
7. ✅ Test with Postman/curl

### Phase 2: Comments API (Day 1-2)
1. ✅ Implement `POST /posts/:postId/comments`
2. ✅ Implement `GET /posts/:postId/comments` (with threading)
3. ✅ Implement `DELETE /comments/:id`
4. ✅ Test comment threading

### Phase 3: Mobile UI - Feed (Day 2)
1. ✅ Create FeedScreen component
2. ✅ Create PostCard component
3. ✅ Integrate with API (fetch posts)
4. ✅ Add pull-to-refresh
5. ✅ Add infinite scroll
6. ✅ Add loading states
7. ✅ Add error handling

### Phase 4: Mobile UI - Create Post (Day 2-3)
1. ✅ Create CreatePostScreen
2. ✅ Add navigation from FeedScreen
3. ✅ Integrate with POST /posts API
4. ✅ Handle success/error states
5. ✅ Refresh feed after creating post

### Phase 5: Mobile UI - Comments (Day 3)
1. ✅ Create PostDetailScreen
2. ✅ Create CommentCard component
3. ✅ Implement comment threading UI
4. ✅ Add comment input
5. ✅ Integrate with comments API
6. ✅ Add reply functionality

### Phase 6: Polish & Testing (Day 3)
1. ✅ Test full flow: create post → see in feed → comment
2. ✅ Fix any bugs
3. ✅ Add empty states
4. ✅ Performance testing (smooth scrolling)
5. ✅ Test on both iOS and Android

---

## 📝 Code Structure

### Backend
```
backend/api/src/
├── routes/
│   ├── auth.ts (existing)
│   ├── posts.ts (new)
│   └── comments.ts (new)
├── lib/
│   └── email.ts (existing)
└── index.ts (register new routes)
```

### Frontend
```
app/src/
├── screens/
│   ├── FeedScreen.tsx (new)
│   ├── CreatePostScreen.tsx (new)
│   └── PostDetailScreen.tsx (new)
├── components/
│   ├── PostCard.tsx (new)
│   ├── CommentCard.tsx (new)
│   └── CommentInput.tsx (new)
├── lib/
│   └── api.ts (add post/comment functions)
└── App.tsx (add navigation)
```

---

## 🧪 Testing Checklist

### API Testing
- [ ] Create post (valid)
- [ ] Create post (empty content - should fail)
- [ ] Create post (rate limit - should fail after 10)
- [ ] Get feed (first page)
- [ ] Get feed (pagination - next page)
- [ ] Get feed (empty - no posts)
- [ ] Get single post
- [ ] Delete post (as author)
- [ ] Delete post (as non-author - should fail)
- [ ] Create comment (top-level)
- [ ] Create comment (reply)
- [ ] Get comments (with threading)
- [ ] Delete comment

### Mobile Testing
- [ ] Feed loads posts
- [ ] Pull-to-refresh works
- [ ] Infinite scroll loads more posts
- [ ] Create post works
- [ ] Post appears in feed after creation
- [ ] View post detail
- [ ] Add comment
- [ ] View comment replies
- [ ] Reply to comment
- [ ] Error states display correctly
- [ ] Loading states show
- [ ] Empty states show
- [ ] Smooth scrolling (60fps)

---

## 🔒 Security & Rate Limiting

### Rate Limits
- **Create Post:** 10 per minute
- **Create Comment:** 20 per minute
- **Get Feed:** 100 per minute (already covered by global)

### Authorization
- All endpoints require authentication (except public feed - but we'll require auth for MVP)
- Users can only delete their own posts/comments (mods can delete any - later)

### Input Validation
- Post content: 1-5000 characters
- Comment content: 1-2000 characters
- Sanitize HTML (if we add rich text later)

---

## 📊 Performance Considerations

### Database
- Use indexes (already defined in schema)
- Limit query results (pagination)
- Use `select` to only fetch needed fields
- Avoid N+1 queries (use Prisma `include`)

### API
- Cache feed in Redis (optional for MVP, can add later)
- Compress responses (Fastify handles this)
- Limit response size (pagination)

### Mobile
- Virtualize lists (FlatList does this)
- Lazy load images (when we add them)
- Debounce search (when we add search)
- Cache feed locally (TanStack Query handles this)

---

## 🎯 Success Metrics

**MVP Complete When:**
- ✅ User can create a text post
- ✅ User can see posts in chronological feed
- ✅ User can comment on posts
- ✅ User can reply to comments
- ✅ Feed loads in < 2 seconds
- ✅ Smooth scrolling (60fps)
- ✅ Works on iOS and Android

**Then:** Move to Vibe Vectors, real-time updates, search, etc.

---

## 🚧 Future Enhancements (Post-MVP)

- Link posts with preview
- Image posts
- Edit posts/comments
- Rich text formatting
- Mentions (@username)
- Hashtags
- Post search
- Algorithmic feed (with Vibe Vectors)
- Real-time updates (Socket.io)
- Post reactions (Vibe Vectors)
- Post sharing
- Post reporting

---

## 📚 References

- Master Plan Phase 1: Core Content requirements
- Solo Foundation Plan: Feed implementation checklist
- Database Indexing Strategy: B-tree indexes for filtering/sorting
- Zero-Cost Auth Plan: Security best practices

---

**Ready to start?** Begin with Phase 1: Database & API! 🚀

