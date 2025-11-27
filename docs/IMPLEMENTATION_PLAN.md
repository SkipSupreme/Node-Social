# Node Social Implementation Plan
## Gap Analysis & Prioritized Roadmap

**Generated:** November 26, 2025
**Based on:** master_plan.md vs existing codebase

---

## Executive Summary

The codebase has **strong Phase 1 foundations** with sophisticated features like the radial vibe wheel already implemented. However, several core social features are incomplete or missing entirely. This plan identifies gaps and prioritizes work to achieve MVP completeness.

**Current State:** ~70% of Phase 1, ~30% of Phase 2, ~10% of Phase 3

---

## What's Already Built (Strengths)

### Authentication (100% Complete)
- Email/password with Argon2id
- Google OAuth (web + mobile)
- Apple Sign-In with nonce protection
- Token rotation with family reuse detection
- Email verification & password reset
- CSRF protection

### Vibe System (90% Complete)
- 6 vibe vectors with intensity (0-100%)
- Radial wheel UI (exceeds Phase 1 spec!)
- PostVibeAggregate with velocity tracking
- Vibe-based comment sorting
- VibeBar visualization

### Feed Algorithm (85% Complete)
- 4-component scoring (quality/recency/engagement/personalization)
- 5 preset modes
- Expert rules (suppress/boost)
- Author diversity controls
- Score explanation endpoint

### Content (80% Complete)
- Posts with CRUD, soft-delete, editing
- Threaded comments with collapse/expand
- Polls with voting
- Link metadata caching
- Saved posts

### Infrastructure (90% Complete)
- MeiliSearch integration
- Socket.io real-time
- Redis caching
- Moderation queue foundation
- Notification system

---

## Critical Gaps (Phase 1 Blockers)

### 1. Node Subscriptions - NOT IMPLEMENTED
**Impact:** Users cannot join communities
**Backend:** No subscribe/unsubscribe endpoints
**Frontend:** No subscription UI or state
**Database:** Model exists (`NodeMember` or needs creation)

**Tasks:**
- [ ] Create `NodeSubscription` model (user_id, node_id, role, joined_at)
- [ ] POST `/nodes/:id/subscribe` endpoint
- [ ] DELETE `/nodes/:id/subscribe` endpoint
- [ ] GET `/nodes/:id/members` endpoint
- [ ] Add subscriber_count tracking
- [ ] Frontend: Subscribe button on node pages
- [ ] Frontend: "My Nodes" in sidebar

---

### 2. User Following - INCOMPLETE
**Impact:** Social graph broken
**Backend:** Model exists, endpoint stubbed but not in routes
**Frontend:** UI exists but may not work

**Tasks:**
- [ ] Implement POST `/users/:id/follow` endpoint
- [ ] Implement DELETE `/users/:id/follow` endpoint
- [ ] GET `/users/:id/followers` endpoint
- [ ] GET `/users/:id/following` endpoint
- [ ] Update follower/following counts on User model
- [ ] Wire frontend FollowingScreen

---

### 3. Following-Only Feed - NOT WIRED
**Impact:** Users can't filter to people they follow
**Backend:** `followingOnly` flag exists in preferences but feed doesn't use it
**Frontend:** Toggle exists but does nothing

**Tasks:**
- [ ] Modify `/posts` to filter by followed authors when `followingOnly=true`
- [ ] Test feed filtering end-to-end

---

### 4. User Blocks/Mutes Enforcement - NOT IMPLEMENTED
**Impact:** Block/mute buttons do nothing
**Backend:** Models exist (UserBlock, UserMute), no enforcement
**Frontend:** Buttons exist, call stubbed endpoints

**Tasks:**
- [ ] POST `/users/:id/block` endpoint
- [ ] DELETE `/users/:id/block` endpoint
- [ ] POST `/users/:id/mute` endpoint
- [ ] DELETE `/users/:id/mute` endpoint
- [ ] Filter blocked users from feed results
- [ ] Filter muted users from feed results
- [ ] Hide blocked users' comments
- [ ] Prevent DMs from blocked users

---

### 5. Report Submission - STUBBED
**Impact:** Users can't report bad content
**Backend:** No POST endpoint for reports
**Frontend:** Report button exists but no functionality

**Tasks:**
- [ ] Create `Report` model if not exists
- [ ] POST `/reports` endpoint (target_type, target_id, reason, details)
- [ ] Auto-increment flag score on reported content
- [ ] Frontend: Report modal with reason selection
- [ ] Notification to moderators

---

### 6. Cred Earning - NOT WIRED
**Impact:** Reputation system non-functional
**Backend:** CredTransaction model exists, no earning logic
**Formula defined:** Insightful 3x, Support 2.5x, Fire 2x, Joy 1.5x

**Tasks:**
- [ ] On reaction create: Calculate cred earned for post author
- [ ] Weight by reactor's cred (normalized, capped at 2000)
- [ ] Create CredTransaction record
- [ ] Update user's `cred` field
- [ ] Update per-node cred (`UserNodeCred` model needed)
- [ ] Cred loss on Questionable reactions
- [ ] Cred loss on upheld reports

---

## Medium Priority Gaps (Phase 2)

### 7. Node Hierarchy
**Status:** parent_id field exists, unused
**Tasks:**
- [ ] GET `/nodes/:id/children` endpoint
- [ ] Breadcrumb navigation in UI
- [ ] Content syndication to parent nodes
- [ ] Appeal escalation follows hierarchy

### 8. Web of Trust (Vouching)
**Status:** Not started
**Tasks:**
- [ ] Create `Vouch` model (voucher_id, vouchee_id, stake, active)
- [ ] POST `/users/:id/vouch` endpoint (requires min cred)
- [ ] DELETE `/users/:id/vouch` endpoint
- [ ] Vouched users earn cred faster (1.5x multiplier)
- [ ] Vouch stake burn if vouchee becomes bad actor
- [ ] Trust propagation calculation (EigenTrust-like)
- [ ] Frontend: Vouch button, vouch stats on profile

### 9. Expert Gate Posts
**Status:** `expertGateCred` field exists on Post, unused
**Tasks:**
- [ ] UI to set cred threshold when creating post
- [ ] Enforce threshold on top-level comments
- [ ] Allow replies to experts regardless of cred
- [ ] [Expert Gate] flair display
- [ ] Frontend: Gate selector in CreatePostModal

### 10. Activity Multiplier
**Status:** Not started
**Tasks:**
- [ ] Track `lastActiveAt` on user actions
- [ ] Calculate multiplier: 100% (7d) → 50% (60d+)
- [ ] Apply to governance weight, not base cred
- [ ] Display on profile

### 11. Council of Node
**Status:** Not started
**Tasks:**
- [ ] Calculate top 5-10 active high-cred users per node
- [ ] "Active" = action in last 30 days
- [ ] Public council member list
- [ ] Council voting on proposals
- [ ] Automatic rotation on inactivity

### 12. Appeals System (Node Court)
**Status:** Not started
**Tasks:**
- [ ] `Appeal` model (target, stake, status, verdict)
- [ ] POST `/appeals` endpoint (with cred stake)
- [ ] Jury selection (random high-cred users)
- [ ] POST `/appeals/:id/vote` endpoint
- [ ] Vote tallying with cred weighting
- [ ] Verdict execution (restore/uphold)
- [ ] Stake return/burn based on outcome

---

## Lower Priority Gaps (Phase 3+)

### 13. Media Uploads
**Status:** URL-only support
**Tasks:**
- [ ] Backblaze B2 integration
- [ ] POST `/uploads` endpoint
- [ ] Image resizing/optimization
- [ ] Video transcoding pipeline
- [ ] CDN delivery (BunnyCDN)

### 14. Theme Marketplace
**Status:** CustomCSS field exists, no marketplace
**Tasks:**
- [ ] n/themes special node
- [ ] Theme upload and voting
- [ ] Theme gallery
- [ ] One-click theme application

### 15. Starter Packs
**Status:** Not started
**Tasks:**
- [ ] StarterPack model (users, nodes, description)
- [ ] One-click follow all in pack
- [ ] Shareable pack links
- [ ] Pack discovery

### 16. Public API & Bot Support
**Status:** No API keys or rate limiting for external apps
**Tasks:**
- [ ] API key generation
- [ ] Bot account type
- [ ] Documentation (OpenAPI spec)
- [ ] Webhook support

---

## Recommended Implementation Order

### Sprint 1: Core Social Graph (1-2 weeks)
1. **Node Subscriptions** - Critical for community
2. **User Following** - Complete the social graph
3. **Following-Only Feed** - Wire the toggle

### Sprint 2: Safety & Moderation (1 week)
4. **User Blocks/Mutes** - Enforce in feed
5. **Report Submission** - Enable content flagging

### Sprint 3: Reputation (1-2 weeks)
6. **Cred Earning** - Wire reaction → cred flow
7. **Per-Node Cred** - Track community contributions

### Sprint 4: Expert Features (1-2 weeks)
8. **Expert Gate Posts** - Enable quality discussions
9. **Activity Multiplier** - Reward active contributors

### Sprint 5: Governance Foundation (2 weeks)
10. **Council of Node** - Community leadership
11. **Web of Trust** - Vouching system

### Sprint 6: Appeals (2 weeks)
12. **Appeals System** - Three-tier court

### Future Sprints
13. Node Hierarchy
14. Media Uploads
15. Theme Marketplace
16. Starter Packs
17. Public API

---

## Quick Wins (Can Do Today)

1. **Wire followingOnly feed filter** - Just need WHERE clause
2. **Create Report endpoint** - Simple POST with validation
3. **Add subscriber_count to Node** - Field + increment logic
4. **Basic cred earning on reactions** - Hook into vibeService

---

## Database Migrations Needed

```prisma
// 1. Node Subscriptions
model NodeSubscription {
  id        String   @id @default(uuid())
  userId    String
  nodeId    String
  role      String   @default("member") // member, moderator, admin
  joinedAt  DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  node      Node     @relation(fields: [nodeId], references: [id])
  @@unique([userId, nodeId])
}

// 2. User Node Cred (per-community reputation)
model UserNodeCred {
  userId  String
  nodeId  String
  cred    Int      @default(0)
  user    User     @relation(fields: [userId], references: [id])
  node    Node     @relation(fields: [nodeId], references: [id])
  @@id([userId, nodeId])
}

// 3. Reports
model Report {
  id          String   @id @default(uuid())
  reporterId  String
  targetType  String   // post, comment, user
  targetId    String
  reason      String
  details     String?
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  reporter    User     @relation(fields: [reporterId], references: [id])
}

// 4. Vouches (Web of Trust)
model Vouch {
  id        String   @id @default(uuid())
  voucherId String
  voucheeId String
  stake     Int
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  voucher   User     @relation("VouchesGiven", fields: [voucherId], references: [id])
  vouchee   User     @relation("VouchesReceived", fields: [voucheeId], references: [id])
  @@unique([voucherId, voucheeId])
}

// 5. Appeals
model Appeal {
  id          String   @id @default(uuid())
  appellantId String
  targetType  String   // post, comment, modAction
  targetId    String
  stake       Int
  reason      String
  status      String   @default("pending") // pending, voting, upheld, overturned
  verdict     String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  appellant   User     @relation(fields: [appellantId], references: [id])
}

model AppealVote {
  id        String   @id @default(uuid())
  appealId  String
  jurorId   String
  vote      String   // uphold, overturn, abstain, question
  weight    Float
  createdAt DateTime @default(now())
  appeal    Appeal   @relation(fields: [appealId], references: [id])
  juror     User     @relation(fields: [jurorId], references: [id])
  @@unique([appealId, jurorId])
}
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Users can subscribe to nodes
- [ ] Users can follow each other
- [ ] Following-only feed works
- [ ] Blocks/mutes are enforced
- [ ] Reports can be submitted
- [ ] Cred is earned from reactions

### Phase 2 Complete When:
- [ ] Vouching system functional
- [ ] Expert gate posts work
- [ ] Activity multiplier affects governance
- [ ] Council of Node displays

### Phase 3 Complete When:
- [ ] Appeals system functional
- [ ] Node hierarchy navigable
- [ ] Media uploads work
- [ ] Public API available

---

**Let's start with Sprint 1: Core Social Graph!**
