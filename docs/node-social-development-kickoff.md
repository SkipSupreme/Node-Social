# Node Social - Development Kickoff
## Let's Build the Social Media That Doesn't Suck

**Date:** November 17, 2025  
**Team:** 4.5 Peeps
**Mission:** Launch alpha to our atomic network in 90 days  
**Motto:** WE ARE NODE. Quality over engagement. Always.

## Our Tech Stack (VERIFIED & PRODUCTION-READY)

### Mobile - React Native + Expo
- **Expo SDK 54** (released Sept 2025)
- React Native 0.81
- React 19.1.0
- Zustand for client state
- TanStack Query for server state
- Expo Router for navigation - open to discussion?

**CRITICAL:** SDK 54 is the LAST version supporting Legacy Architecture. We're enabling **New Architecture from day one**. SDK 55 (Feb 2026) will require it, and 75% of Expo projects already migrated. We're not going to be in the 25% scrambling later.

### Backend - Node.js + Fastify
- **Node.js 22 LTS** (v22.11.0 "Jod") ⚠️ **REQUIRED**
  - Active support until October 2025, Maintenance until April 2027
  - Battle-tested, stable, production-ready
  - **NOT Node 24** (too new, let others find the bugs first)
  - **Current issue:** Using Node 24.10.0 - must switch to 22.11.0
  - **Fix:** See `docs/ENVIRONMENT_SETUP.md`
- **Fastify** (latest) for API
- **Socket.io** for real-time updates
- **PostgreSQL 16** (v16.11) as primary database
- **Redis 7** for sessions, cache, rate limiting
- **MeiliSearch** for search
- **BullMQ** for background jobs

### Database Indexing Strategy (CORRECTED)

I know we debated PostgreSQL indexes. Here's the final answer after research:

**Use B-tree indexes (default) for admin tools and filtering:**
```sql
-- Admin queries need these (fast filtering, sorting, pagination)
CREATE INDEX idx_posts_author ON posts(author_id, created_at);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_mod_actions_node ON mod_action_log(node_id, created_at);
CREATE INDEX idx_users_email ON users(email);
```

**Use GIN indexes ONLY for full-text search and JSONB queries:**
```sql
-- Full-text search (though MeiliSearch will handle most of this)
CREATE INDEX idx_post_content_search ON posts USING GIN (to_tsvector('english', content));

-- Multi-dimensional Vibe Vectors (JSONB column)
CREATE INDEX idx_vibe_reactions ON vibe_reactions USING GIN (reactions);
```

**Why?** GIN indexes are 3x slower to build and terrible for range queries. They're ONLY good for searching INSIDE composite values (arrays, JSONB, full-text). For normal admin filtering by user_id or created_at, B-tree is faster and simpler.

### Infrastructure
- **Home Server** (to start)
- **Cloudflare** (free tier for CDN)
- **BunnyCDN** ($0.01/GB for video/images)
- **Backblaze B2** for object storage
- **Docker** for local development
- **Modular monolith** architecture (NOT microservices)

---

## Team Structure

Here's how we split:

### **Team A - Mobile Core (2 Engineers)** - Fred&Josh
Focus: React Native/Expo app, UI components, gestures, real-time feed

**Responsibilities:**
- Expo SDK 54 setup with New Architecture enabled
- Core UI components (posts, comments, feed)
- Vibe Vectors radial wheel (the killer feature)
- Navigation with Expo Router
- Offline-first with TanStack Query
- Real-time updates via Socket.io client

### **Team B - Backend/Infrastructure (2 Engineers)** - Xenon&Rob
Focus: Fastify API, PostgreSQL, Redis, real-time server, search

**Responsibilities:**
- Fastify + Node.js 22 server
- PostgreSQL schema (Prisma)
- Redis sessions, caching, rate limiting
- Socket.io server for real-time
- MeiliSearch integration
- BullMQ background jobs

### **Josh (Me) - Architecture & Coordination**
Focus: Unblocking, final decisions, moderation system, atomic network

**Responsibilities:**
- Code review and architecture decisions
- Moderation system design
- Atomic network selection and outreach
- Team unblocking (you get stuck, I unstick you)
- Quality control
- Keeping us on track

---

## ⚠️ UPDATED: Solo Foundation Phase (Current)

**Status:** Josh is building the foundation solo before team onboarding.

**Current Progress:**
- ✅ Auth system complete (JWT, refresh tokens, password reset)
- ✅ Mobile app building and running
- ✅ Docker infrastructure ready
- ⚠️ Node version needs fix (24 → 22)
- ⏳ Posts/Comments schema pending
- ⏳ Feed API pending

**See:** `docs/MASTER_FOUNDATION_PLAN.md` for detailed solo plan.

**Team Onboarding:** Will begin once foundation is complete (target: early December 2025).

---

## Week 1 Sprint - Team Onboarding (After Foundation)

### Day 1 - Foundation Setup

**All Hands Kickoff (30 minutes)**
- Review this document together
- Assign Team A and Team B
- Q&A on tech stack
- First commit goal: 10 AM

**- Environment Setup (Everyone)**

Clone and start infrastructure:
```bash
mkdir node-social && cd node-social
git init

# Start the stack (I'm providing docker-compose.yml)
docker-compose up -d

# Verify everything is running
docker ps
# You should see: postgres, redis, meilisearch all healthy
```

**- Teams Split**

**Team A (Mobile) - Day 1 Tasks:**

Engineer 1 - Auth & Navigation:
```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
cd apps/mobile

# Install navigation and state
npx expo install expo-router react-native-safe-area-context \
  react-native-screens expo-linking expo-constants expo-status-bar

npm install zustand @tanstack/react-query

# CRITICAL: Enable New Architecture in app.json
# Add: "newArchEnabled": true under "expo" section

npx expo start
```

Engineer 2 - Radial Wheel POC:
```bash
# In apps/mobile
npm install react-native-gesture-handler react-native-reanimated
npm install react-native-svg

# Create POC component
mkdir -p src/components/VibeWheel
touch src/components/VibeWheel/index.tsx

# Start building the radial gesture menu
# This is our patent-worthy feature - make it smooth
```

**Team B (Backend) - Day 1 Tasks:**

Engineer 1 - API Foundation:
```bash
mkdir -p apps/api
cd apps/api
npm init -y

# Core dependencies
npm install fastify @fastify/cors @fastify/jwt @fastify/rate-limit \
  @prisma/client bcrypt jsonwebtoken
  
npm install --save-dev @types/node @types/bcrypt @types/jsonwebtoken \
  prisma typescript tsx nodemon

# Initialize Prisma
npx prisma init

# I'll provide the schema - copy it into prisma/schema.prisma
# Then run:
npx prisma generate
npx prisma migrate dev --name init
```

Engineer 2 - Redis & Socket.io:
```bash
# In apps/api
npm install redis socket.io ioredis
npm install --save-dev @types/redis

# Test Redis connection
node -e "const redis = require('redis'); \
  const client = redis.createClient({url: 'redis://localhost:6379'}); \
  client.connect().then(() => console.log('✅ Redis connected!'))"
```

### Day 2-3 - Core Authentication Flow

**Team A Goals:**
- Login/register screens (UI only first)
- Connect to backend auth endpoints
- Store tokens with Expo SecureStore
- Basic navigation between screens

**Team B Goals:**
- Auth endpoints functional:
  - POST /api/v1/auth/register
  - POST /api/v1/auth/login
  - POST /api/v1/auth/refresh
  - POST /api/v1/auth/logout
- JWT tokens + Redis sessions
- Rate limiting with Redis
- Password hashing with bcrypt

**Success Criteria by EOD Day 3:**
- Can register a user from mobile app
- Can login from mobile app
- Token stored and persists on app restart
- Basic error handling

---

### Day 4-5 - Content & Feed Basics

**Team A Goals:**
- Feed screen with FlatList
- Post creation screen (text only)
- Pull-to-refresh
- Infinite scroll with TanStack Query
- Loading states and skeletons

**Team B Goals:**
- Post CRUD endpoints:
  - GET /api/v1/posts (with pagination)
  - POST /api/v1/posts
  - GET /api/v1/posts/:id
  - POST /api/v1/posts/:id/comments
- Basic feed ranking algorithm (chronological + score)
- Comment threading
- B-tree indexes on posts and comments

**Success Criteria by EOD Day 5:**
- Can create a text post from mobile
- Can see posts in feed
- Can scroll through feed smoothly
- Can comment on posts

**Week 1 Exit Criteria (Friday 5 PM):**
✅ Mobile app runs on both iOS and Android  
✅ Can register and login  
✅ Can create and view posts  
✅ Can comment on posts  
✅ Database working with proper indexes  
✅ Redis sessions working  
✅ All code reviewed and merged  
✅ Zero critical bugs blocking Week 2  

---

## Week 2-4 Roadmap

### Week 2: Vibe Vectors & Real-Time

**Team A:**
- Radial wheel menu fully functional
- Multiple Vibe Vectors in one gesture
- Intensity controls (tap + drag)
- Polish animations with Reanimated
- Socket.io client for real-time updates

**Team B:**
- Vibe Reactions endpoint (POST /api/v1/posts/:id/reactions)
- Store multi-dimensional reactions (JSONB + GIN index)
- Calculate aggregate Vibe Vectors
- Socket.io server pushing live updates
- Feed recalculation with Vibe scores

**My Focus:**
- Finalize atomic network selection
- Design moderation dashboard
- Begin interviewing professional moderators
- Set up analytics (Mixpanel or PostHog)

### Week 3: Vibe Validator & Search

**Team A:**
- Vibe Validator slider UI
- Real-time feed filtering as you drag sliders
- Chronological vs algorithmic toggle
- Basic accessibility (screen reader support)
- Error boundaries and crash reporting

**Team B:**
- MeiliSearch integration
- Full-text search on posts and comments
- User and Node search
- BullMQ for background feed recalculation
- Rate limiting refinement

**My Focus:**
- Write moderation guidelines v1.0
- Set up error tracking (Sentry)
- First 50 beta user invitations
- Load testing (can we handle 1000 concurrent users?)

### Week 4: Polish & Alpha Launch

**Whole Team:**
- Bug bash (find and fix everything)
- Performance optimization
- Loading time < 2 seconds on mobile
- First user feedback session
- Emergency response drill (what if servers crash?)
- Documentation sprint
- Deploy to production

**Alpha Launch Criteria:**
- 50 beta users invited
- Moderation team operational
- Core features working smoothly
- Can handle 500 concurrent users
- Basic analytics tracking
- Emergency runbook ready

---

## Critical Infrastructure (Provided Tomorrow)

Let's work on these tomorrow and let's commit ;)

### 1. Docker Compose (Development Environment)
```yaml
# Spins up PostgreSQL 16, Redis 7, MeiliSearch
# One command: docker-compose up -d
# Everything you need for local development
```

### 2. Prisma Schema (Database Structure)
```prisma
// Complete schema with:
// - Users (with Era system)
// - Nodes (communities with hierarchy)
// - Posts & Comments
// - Vibe Reactions (JSONB)
// - UserNodeCred (reputation)
// - ModActionLog (public transparency)
// - Vouch system (Web of Trust)
```

### 3. API Structure Template
```
apps/api/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── posts.ts
│   │   ├── comments.ts
│   │   └── reactions.ts
│   ├── services/
│   ├── middleware/
│   └── server.ts
└── package.json
```

---

## Development Workflow

### Daily Standup (15 minutes max)
Format:
1. What did you ship yesterday?
2. What are you shipping today?
3. What's blocking you?

No long discussions - blockers get solved after standup.

### Code Review Policy
- All code goes through Pull Requests
- Minimum 1 approval required
- I review everything initially
- Focus on: correctness, performance, security
- No merging broken code - tests must pass

### Git Workflow
```bash
# Branch naming
feature/vibe-wheel-gesture
fix/auth-token-refresh
refactor/feed-algorithm

# Commit messages
feat: add radial wheel gesture for Vibe Vectors
fix: prevent token refresh loop
refactor: optimize feed query with indexes

# Always reference why
feat: add radial wheel gesture for Vibe Vectors

- Implements multi-dimensional reactions
- Smooth drag gesture with Reanimated
- Set multiple Vibe Vectors in one motion
- Refs: #12 (Vibe System Epic)
```

### Testing Strategy (Week 1)
- Manual testing is fine for now
- Focus on shipping, not perfect tests
- Add tests for critical paths (auth, payments when we add them)
- Week 3 we'll add automated tests

---

## Decision Framework

Some things I decide (BDFL energy), some things we discuss:

### I Decide (Come to me if unclear):
- Product direction and features
- Architecture patterns
- Tech stack choices
- Atomic network selection
- Moderation policies

### We Discuss (Team input required):
- Implementation approaches
- API endpoint design
- Database schema details
- UI/UX patterns
- Performance optimizations

### You Decide (Just tell me after):
- Component structure
- Variable naming
- Code organization within your domain
- CSS/styling choices
- Minor bug fixes

**Rule:** If you're blocked for more than 90 minutes, message me

---

## Week 1 Risks & Mitigation

### If Mobile Team Blocks:
**Problem:** Radial wheel is too complex  
**Solution:** Ship with simple tap-to-react first, add radial wheel Week 2

**Problem:** Expo SDK 54 issues  
**Solution:** Drop to SDK 53 temporarily (but lose some features)

**Problem:** Too many features for Week 1  
**Solution:** Cut DMs and notifications, focus on core feed

### If Backend Team Blocks:
**Problem:** Prisma migration issues  
**Solution:** Use raw SQL temporarily, fix migrations later

**Problem:** Redis connection problems  
**Solution:** Use in-memory sessions for dev, fix Redis later

**Problem:** Socket.io complexity  
**Solution:** Ship without real-time first week, add Week 2

### If I Block:
**Problem:** Can't pick atomic network  
**Solution:** Default to "Indie Hackers on Twitter" as starting point

**Problem:** Moderation unclear  
**Solution:** Start with basic report system, hire moderators Week 2

**Problem:** Budget concerns  
**Solution:** Cut scope, not quality. Ship less but ship well.

---

## Tools We're Using

### Project Management
Let's talk about project management

### Development
- **GitHub** for code
more to be added soon!


### Communication
- **Discord** for daily communication
- **Bugs channel** for production issues

---

## Success Metrics (What "Winning" Looks Like)

### Week 1:
- ✅ All infrastructure running
- ✅ Team can develop without blocking each other
- ✅ Basic auth + posts working end-to-end
- ✅ No one burned out
- ✅ Excited for Week 2

### Week 4 (Alpha Launch):
- ✅ 50 beta users invited
- ✅ 60% retention after Day 1
- ✅ 30% retention after Day 7
- ✅ Core features working smoothly
- ✅ < 2 second load time on mobile
- ✅ Average 5+ connections per user

### Month 3 (Product-Market Fit):
- ✅ 1000+ active users
- ✅ 15% retention after Day 30
- ✅ Positive feedback from atomic network
- ✅ Users inviting their friends organically
- ✅ Moderation team sustainable
- ✅ Clear path to monetization

---

## The Mission (Why We're Doing This)

50% of consumers are abandoning social media because it sucks. It's all engagement-over-experience, rage bait, algorithmic manipulation, and opaque moderation.

We're building the alternative:
- **Quality over engagement** - We optimize for user satisfaction, not time-on-platform
- **Transparent governance** - Public mod logs, community juries, no black boxes
- **User control** - Vibe Validator lets YOU decide what you see
- **Meritocratic curation** - Best content wins, not most controversial
- **Sustainable moderation** - We treat moderators like partners, not exploited labor

Every line of code we write is in service of this mission. When you're debugging at 11 PM, remember: we're not building another Instagram clone. We're building the social media we wish existed.

**We are Node. Quality over engagement. Always.**

---

## Final Notes

**Energy level:** We're building something important. Bring your A game, but don't burn out but also YOLO

**Communication:** Over-communicate. If you're stuck, say it. If you need help, ask. If you're making a big decision, share it. We move fast, but we move together.

**Quality:** Ship fast, but ship well. Broken code slows us down more than taking an extra hour to do it right. Test your changes. Think about edge cases.

**Celebrate wins:** When something works, share it in Discord. When you solve a hard problem, tell the team. We're building something from nothing - that's fucking hard and worth celebrating.

**Trust the process:** I've researched every competitor, read the academic papers, tested the tech stack. We're not guessing - we're executing a well-researched plan. Trust it.


🚀 WE ARE NODE 🚀

— Josh (BDFL)
