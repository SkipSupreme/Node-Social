# Node Social - Solo Foundation Plan
## Building the Foundation Before Team Onboarding

**Goal:** Get a solid, working foundation in place so when the team joins, they can hit the ground running without infrastructure blockers.

**Timeline:** 1-2 weeks solo work before team onboarding
**Current Status:** ✅ Auth foundation complete, ✅ JWT working, ✅ Password reset working

---

## Phase 0: Foundation Setup (Solo - Week 1-2)

### ✅ COMPLETED
- [x] Docker infrastructure (Postgres, Redis, Meilisearch)
- [x] Fastify API server with TypeScript
- [x] Prisma ORM with PostgreSQL
- [x] JWT-based authentication (access + refresh tokens)
- [x] Password hashing with Argon2id
- [x] Rate limiting (Redis-backed)
- [x] Password reset with Resend email
- [x] Expo app with SecureStore
- [x] Custom dev build working
- [x] Beautiful auth UI (blue social media theme)

### 🔧 NEEDS FIXING
- [ ] **Node.js Version:** Currently on Node 24.10.0, should be Node 22.11.0 LTS
- [ ] **Deep linking:** Needs rebuild (expo-linking native module)
- [ ] **Environment variables:** Need to document all required .env vars

### 📋 REMAINING FOUNDATION TASKS

#### 1. Node.js Version Fix (Priority: HIGH)
**Issue:** Using Node 24.10.0, plan specifies Node 22.11.0 LTS
**Action:**
```bash
# Install Node 22 LTS using nvm (recommended)
nvm install 22.11.0
nvm use 22.11.0
nvm alias default 22.11.0

# Verify
node --version  # Should show v22.11.0

# Reinstall dependencies
cd backend/api
rm -rf node_modules package-lock.json
npm install
```

**Why:** Node 22 LTS is battle-tested, stable, and matches the plan. Node 24 is too new and causing compatibility issues (like the prebuild error we saw).

#### 2. Complete Authentication System
- [x] Email/password auth ✅
- [x] JWT tokens with refresh ✅
- [x] Password reset ✅
- [ ] **Email verification** (send verification email on register)
- [ ] **Google OAuth** (using expo-auth-session)
- [ ] **Apple Sign-In** (iOS only, requires dev build)

#### 3. Core Database Schema
**Current:** Only User model
**Need to add:**
- Nodes (communities)
- Posts
- Comments
- Vibe Reactions (JSONB)
- UserNodeCred (reputation)
- ModActionLog (transparency)

**Priority:** Start with Posts + Comments for basic feed

#### 4. Basic API Endpoints
**Current:** Only auth endpoints
**Need:**
- `GET /posts` - Feed with pagination
- `POST /posts` - Create post
- `GET /posts/:id` - Get single post
- `POST /posts/:id/comments` - Add comment
- `GET /posts/:id/comments` - Get comments

#### 5. Mobile App Core
**Current:** Auth screens only
**Need:**
- Feed screen (FlatList with posts)
- Post creation screen
- Post detail screen with comments
- Basic navigation (Expo Router or React Navigation)

#### 6. Development Environment
- [x] Docker Compose ✅
- [x] Backend API running ✅
- [x] Mobile app building ✅
- [ ] **Cloudflare Tunnel setup** (for testing on physical devices)
- [ ] **Environment variable documentation**
- [ ] **Database migration strategy**

---

## Week-by-Week Solo Plan

### Week 1: Complete Auth + Basic Feed

**Days 1-2: Fix & Polish Auth**
- [ ] Switch to Node 22.11.0
- [ ] Add email verification
- [ ] Test Google OAuth flow (optional, can defer)
- [ ] Document all environment variables
- [ ] Set up Cloudflare Tunnel for device testing

**Days 3-4: Database Schema**
- [ ] Create Prisma schema for Posts and Comments
- [ ] Add B-tree indexes (author_id, created_at, post_id)
- [ ] Run migrations
- [ ] Test with sample data

**Days 5-7: Basic Feed API**
- [ ] POST /posts endpoint (create post)
- [ ] GET /posts endpoint (paginated feed)
- [ ] GET /posts/:id endpoint (single post)
- [ ] POST /posts/:id/comments (add comment)
- [ ] GET /posts/:id/comments (get comments)
- [ ] Test all endpoints with Postman/curl

### Week 2: Mobile Feed + Polish

**Days 8-10: Mobile Feed UI**
- [ ] Feed screen with FlatList
- [ ] Post creation screen
- [ ] Post detail screen
- [ ] Comment threading UI
- [ ] Pull-to-refresh
- [ ] Loading states

**Days 11-12: Integration & Testing**
- [ ] Connect mobile to feed API
- [ ] Test end-to-end: create post → see in feed → comment
- [ ] Fix any bugs
- [ ] Performance testing (smooth scrolling)

**Days 13-14: Documentation & Handoff Prep**
- [ ] Update STARTUP_GUIDE.md
- [ ] Document API endpoints
- [ ] Create team onboarding checklist
- [ ] Test full flow: register → login → create post → comment

---

## Success Criteria for Foundation

**Before team joins, you should have:**

✅ **Infrastructure:**
- Docker services running smoothly
- Node 22.11.0 installed and working
- Backend API stable and documented
- Database schema for core features (Users, Posts, Comments)
- Redis working for sessions/rate limiting

✅ **Authentication:**
- Email/password working
- JWT tokens with refresh
- Password reset working
- Secure token storage on mobile
- Rate limiting protecting auth endpoints

✅ **Core Features:**
- Can create a text post
- Can view posts in feed
- Can comment on posts
- Mobile app works on iOS and Android
- API endpoints tested and working

✅ **Developer Experience:**
- Clear startup guide
- Environment variables documented
- Database migrations working
- Code is clean and well-organized
- No critical bugs blocking progress

---

## Current Status Check

**What's Working:**
- ✅ Docker infrastructure
- ✅ Fastify API server
- ✅ JWT authentication
- ✅ Password reset with email
- ✅ Mobile app building and running
- ✅ Beautiful UI

**What Needs Work:**
- ⚠️ Node version (24 → 22)
- ⚠️ Deep linking (needs rebuild)
- ⚠️ Missing core features (posts, feed, comments)
- ⚠️ Database schema incomplete

**Blockers:**
- None! Everything is fixable and on track.

---

## Next Immediate Steps

1. **Switch to Node 22** (15 minutes)
2. **Add Posts/Comments schema** (1-2 hours)
3. **Create basic feed API** (2-3 hours)
4. **Build feed UI in mobile** (3-4 hours)
5. **Test end-to-end** (1 hour)

**Total:** ~8-10 hours of focused work to have a working feed.

---

## Team Onboarding Readiness

Once foundation is complete, team can:
- Clone repo and run `docker-compose up -d`
- Follow STARTUP_GUIDE.md to get running
- Start building features immediately (no infrastructure blockers)
- Focus on Vibe Vectors, real-time, search (the fun stuff!)

**Target:** Foundation complete in 2 weeks, then bring team on.

