# Feed Implementation Progress & Plan

**Goal:** Implement the "Ultimate Vibe Validator / Feed / Search Master Plan v0.1"
**Base Documents:** `docs/feeds v1.md`, `docs/feed insights.md`
**Status:** In Progress

---

## 📅 Phased Implementation Plan

### Phase 1: Core Schema & Basic Feed (Nodes + Posts)
- [x] **Step 1.1:** Update Prisma Schema
    - Define `Node` model (slug, name, description)
    - Define `Post` model (author, node, title, content, type, visibility)
    - Define `Comment` model (threaded)
    - Define `PostMetric` model (denormalized counts)
    - Add B-tree indexes for feed queries
- [x] **Step 1.2:** Run Database Migration
- [x] **Step 1.3:** Implement Node API
    - `POST /nodes` (Create node)
    - `GET /nodes` (List nodes)
    - `GET /nodes/:id` (Get node details)
- [x] **Step 1.4:** Implement Post API (Basic)
    - `POST /posts` (Create post in a node)
    - `GET /nodes/:id/posts` (Feed: via GET /posts?nodeId=...)
    - `GET /posts/:id` (Single post)
- [ ] **Step 1.5:** Implement Mobile Feed UI (Basic)
    - Node selection/list screen
    - Feed screen (FlashList/FlatList)
    - Post creation screen

### Phase 2: Metrics & Basic Reactions
- [ ] **Step 2.1:** Update Schema for Metrics
    - Ensure `PostMetric` is robust
    - Add `VibeReactionEvent` table (log)
    - Add `PostVibeAggregate` table (fast reads)
- [ ] **Step 2.2:** API for Reactions
    - `POST /posts/:id/reaction` (Simple like/save for now)
- [ ] **Step 2.3:** Metrics Update Logic
    - Create service/trigger to update `PostMetric` on reaction
- [ ] **Step 2.4:** Update Feed Endpoint
    - Include metric counts (likes, comments) in response

### Phase 3: Vibe Validator v1 (The Logic)
- [ ] **Step 3.1:** Schema for User Preferences
    - `UserFeedPreference` table (JSONB)
    - GIN indexes
- [ ] **Step 3.2:** Preference API
    - `GET /me/feed-preferences`
    - `PATCH /me/feed-preferences`
- [ ] **Step 3.3:** Scoring Logic (The "Feed Algorithm")
    - Implement weighted scoring query (Quality, Recency, Engagement, Personalization)
    - Update `GET /nodes/:id/posts` to accept weights (or read from DB)

### Phase 4: Mobile Vibe Validator UI
- [ ] **Step 4.1:** Feed Controls Component
    - Presets (Latest, Balanced, etc.)
    - Sliders (Quality, Recency, Engagement, Personal)
- [ ] **Step 4.2:** State Management
    - Store preferences in Zustand
    - Debounce updates to backend
- [ ] **Step 4.3:** Connect to Feed API

### Phase 5: Meilisearch Integration (Search)
- [ ] **Step 5.1:** Meilisearch Setup
    - Ensure Docker container is running/accessible
- [ ] **Step 5.2:** Indexing Service
    - Sync new posts to Meili
    - Sync updates to Meili
- [ ] **Step 5.3:** Search API
    - `GET /search/posts`
- [ ] **Step 5.4:** Mobile Search UI

---

## 📝 Execution Log

*(Updates every 8 steps)*

### Batch 1 (Completed)
1.  Reading documentation (Done)
2.  Creating Progress Plan (Done)
3.  Update Prisma Schema (Phase 1.1) (Done)
4.  Run Database Migration (Phase 1.2) (Done)
5.  Implement Node API (Phase 1.3) (Done)
6.  Implement Post API (Phase 1.4) (Done)
7.  Implement Comments API (Phase 1.4 extension) (Done)
8.  **Next:** Mobile UI Implementation (Phase 1.5)

### Batch 2 (Completed)
1.  Update API client in mobile app (`app/src/lib/api.ts`) (Done)
2.  Create Feed Screen (UI) (Done)
3.  Create Post Card (UI) (Done)
4.  Create Create Post Screen (UI) (Done)
5.  Create Post Detail Screen (UI) (Done)
6.  Connect UI to API (Done)
7.  Launch Simulator (In Progress)
8.  **Next:** Test Feed Flow, then Phase 2 (Metrics)

