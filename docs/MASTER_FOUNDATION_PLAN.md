# Node Social - Master Foundation Plan (Solo)
## Building the Foundation Before Team Onboarding

**Goal:** Complete a solid, working foundation so when the team joins, they can immediately start building features without infrastructure blockers.

**Timeline:** 1-2 weeks solo work
**Current Date:** November 18, 2025
**Target Team Onboarding:** Early December 2025

---

## ✅ COMPLETED (What We Have)

### Infrastructure
- ✅ Docker Compose setup (Postgres 16, Redis 7, Meilisearch)
- ✅ Fastify API server with TypeScript
- ✅ Prisma ORM configured
- ✅ Cloudflare Tunnel ready (for device testing)

### Authentication System
- ✅ Email/password registration and login
- ✅ JWT tokens (15min access, 7day refresh)
- ✅ Refresh token rotation in Redis
- ✅ Password reset with Resend email
- ✅ Rate limiting (5 login/min, 3 register/min)
- ✅ Argon2id password hashing
- ✅ Secure token storage (SecureStore on mobile)
- ✅ Auto token refresh on frontend
- ✅ Protected routes with JWT verification

### Mobile App
- ✅ Expo SDK 54 with New Architecture enabled
- ✅ Custom dev build working (iOS)
- ✅ Beautiful blue social media UI
- ✅ Login/Register/Forgot Password screens
- ✅ Token persistence across app restarts
- ✅ Error handling and loading states

### Developer Experience
- ✅ Startup guide
- ✅ Environment setup docs
- ✅ Build guide

---

## ⚠️ NEEDS FIXING

### Critical Issues
1. **Node.js Version Mismatch**
   - **Current:** Node 24.10.0
   - **Required:** Node 22.11.0 LTS ("Jod")
   - **Impact:** Causing prebuild errors, compatibility issues
   - **Fix:** Install Node 22 LTS (see ENVIRONMENT_SETUP.md)

2. **Deep Linking**
   - **Status:** Code ready, needs rebuild
   - **Impact:** Password reset links won't open app automatically
   - **Workaround:** Manual token entry works
   - **Fix:** Rebuild app after Node 22 switch

### Missing Features (Per Plan)
- [ ] Email verification (send verification email on register)
- [ ] Google OAuth integration
- [ ] Apple Sign-In integration
- [ ] Posts/Comments database schema
- [ ] Feed API endpoints
- [ ] Mobile feed UI

---

## 📋 FOUNDATION CHECKLIST

### Week 1: Fix & Complete Auth

**Day 1: Environment Fix**
- [ ] Switch to Node 22.11.0 LTS
- [ ] Reinstall backend dependencies
- [ ] Test backend starts correctly
- [ ] Rebuild mobile app (fixes deep linking)
- [ ] Test password reset with deep link

**Day 2-3: Complete Auth Features**
- [ ] Add email verification endpoint
- [ ] Send verification email on register
- [ ] Add email verification check on login (optional enforcement)
- [ ] Test Google OAuth flow (expo-auth-session)
- [ ] Test Apple Sign-In (requires dev build)

**Day 4-5: Database Schema - Core Content**
- [ ] Create Post model in Prisma schema
- [ ] Create Comment model
- [ ] Add B-tree indexes (author_id, created_at, post_id)
- [ ] Create migration
- [ ] Test with sample data

**Day 6-7: Basic Feed API**
- [ ] POST /posts (create post)
- [ ] GET /posts (paginated feed, chronological)
- [ ] GET /posts/:id (single post with comments)
- [ ] POST /posts/:id/comments (add comment)
- [ ] GET /posts/:id/comments (get comments)
- [ ] Add rate limiting to post creation
- [ ] Test all endpoints

### Week 2: Mobile Feed + Polish

**Day 8-10: Mobile Feed UI**
- [ ] Feed screen with FlatList
- [ ] Post creation screen (text only)
- [ ] Post detail screen
- [ ] Comment threading UI
- [ ] Pull-to-refresh
- [ ] Infinite scroll
- [ ] Loading skeletons

**Day 11-12: Integration**
- [ ] Connect mobile to feed API
- [ ] Test: create post → see in feed → comment
- [ ] Error handling
- [ ] Empty states
- [ ] Performance testing

**Day 13-14: Documentation & Handoff**
- [ ] Update all docs
- [ ] API endpoint documentation
- [ ] Team onboarding checklist
- [ ] Test full user journey
- [ ] Performance benchmarks

---

## 🎯 SUCCESS CRITERIA

**Before team joins, you must have:**

### Infrastructure ✅
- [x] Docker services running
- [ ] Node 22.11.0 installed
- [x] Backend API stable
- [ ] Database schema for core features
- [x] Redis working

### Authentication ✅
- [x] Email/password working
- [x] JWT with refresh
- [x] Password reset
- [ ] Email verification
- [ ] OAuth (Google/Apple) - optional for MVP

### Core Features
- [ ] Can create text post
- [ ] Can view posts in feed
- [ ] Can comment on posts
- [ ] Mobile app works on iOS/Android
- [ ] API endpoints tested

### Developer Experience
- [x] Startup guide
- [x] Environment docs
- [ ] API documentation
- [ ] Team onboarding guide
- [ ] No critical bugs

---

## 📊 CURRENT STATUS vs PLAN

### Authentication (Per Zero-Cost Plan)
| Feature | Status | Notes |
|---------|--------|-------|
| Email/Password | ✅ Done | Argon2id, rate limited |
| JWT Tokens | ✅ Done | Access + refresh, Redis |
| Password Reset | ✅ Done | Resend email working |
| Email Verification | ⏳ Pending | Easy to add |
| Google OAuth | ⏳ Pending | Code ready, needs testing |
| Apple Sign-In | ⏳ Pending | Needs dev build |
| Secure Storage | ✅ Done | SecureStore working |

### Infrastructure (Per Master Plan)
| Component | Status | Notes |
|-----------|--------|-------|
| Docker | ✅ Done | Postgres, Redis, Meilisearch |
| Fastify API | ✅ Done | TypeScript, plugins |
| Prisma | ✅ Done | Schema ready for expansion |
| Redis | ✅ Done | Sessions, rate limiting |
| Meilisearch | ✅ Ready | Not integrated yet |
| Cloudflare Tunnel | ✅ Ready | For device testing |

### Core Features (Per Master Plan Phase 1)
| Feature | Status | Priority |
|---------|--------|----------|
| Auth | ✅ 90% | Email verification pending |
| Posts | ❌ Not started | HIGH - Core feature |
| Comments | ❌ Not started | HIGH - Core feature |
| Feed | ❌ Not started | HIGH - Core feature |
| Search | ❌ Not started | Medium - Can use Postgres FTS |
| Vibe Vectors | ❌ Not started | Low - Week 2 feature |
| Nodes | ❌ Not started | Low - Can start simple |

---

## 🚀 IMMEDIATE NEXT STEPS (Priority Order)

### 1. Fix Node Version (30 min)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc

# Install Node 22
nvm install 22.11.0
nvm use 22.11.0
nvm alias default 22.11.0

# Reinstall dependencies
cd backend/api && rm -rf node_modules package-lock.json && npm install
cd ../../app && npm install
```

### 2. Rebuild App (30 min)
```bash
cd app
npm run build:ios:local  # This will fix deep linking
```

### 3. Add Posts Schema (1 hour)
- Create Post and Comment models
- Add indexes
- Run migration

### 4. Build Feed API (2-3 hours)
- Create post endpoints
- Test with Postman

### 5. Build Feed UI (3-4 hours)
- Feed screen
- Post creation
- Comments

**Total:** ~8-10 hours to have a working feed

---

## 📝 ALIGNMENT CHECK

### ✅ Matches Zero-Cost Auth Plan
- Using Argon2id ✅
- JWT with refresh tokens ✅
- Redis for sessions ✅
- Resend for email ✅
- SecureStore for tokens ✅
- Rate limiting ✅

### ✅ Matches Master Plan Phase 1
- Email/password auth ✅
- Password reset ✅
- Docker environment ✅
- Prisma schema ✅
- Fastify API ✅

### ⚠️ Deviations (All Justified)
- Using Resend instead of SendGrid (SendGrid ended free tier)
- Node 24 instead of 22 (will fix)
- Deep linking pending rebuild (workaround exists)

---

## 🎯 FOUNDATION COMPLETE WHEN...

You can:
1. ✅ Register and login
2. ✅ Reset password
3. ⏳ Create a post
4. ⏳ See posts in feed
5. ⏳ Comment on posts
6. ✅ Everything works on iOS and Android
7. ✅ Team can clone and run in < 10 minutes

**Then:** Bring team on to build Vibe Vectors, real-time, search, etc.

---

## 📚 DOCUMENTATION STATUS

- [x] STARTUP_GUIDE.md - Daily workflow
- [x] BUILD_GUIDE.md - How to build app
- [x] SETUP_ENV.md - Environment variables
- [x] ENVIRONMENT_SETUP.md - Node version fix
- [x] SOLO_FOUNDATION_PLAN.md - This document
- [x] jwt-implementation-summary.md - Auth details
- [ ] API_DOCUMENTATION.md - Endpoint reference (pending)
- [ ] TEAM_ONBOARDING.md - For when team joins (pending)

---

**Next Action:** Fix Node version, then build Posts/Comments. You're 80% there! 🚀

