# Node Social – Final Plan (Single Source of Truth)

This document replaces every other file that was living in `docs/`. All legacy references now live under `docs/archive/`. The information below is verified against the current codebase (`backend/api`, `app/`, and `docker-compose.yml`) so everyone is working from the same version.

---

## 1. Current Implementation Snapshot (code-verified)

- **Repositories**
  - `backend/api`: Fastify 5 + TypeScript monolith with Prisma, Redis, and Resend integration. (`package.json`)
  - `app/`: Expo SDK 54 (React Native 0.81.5, React 19.1) with New Architecture enabled, dev-client ready, Zustand + React Query, SecureStore token storage. (`app/app.json`, `src/store/auth.ts`)
- **Runtime services (`docker-compose.yml`)**
  - PostgreSQL 16 @ `localhost:5433`
  - Redis 7 @ `localhost:6379`
  - MeiliSearch (running but not yet wired into the API) @ `localhost:7700`
- **Backend features implemented**
  - Email/password registration, login, refresh, logout, forgot/reset password, and email verification with Resend deep links (`backend/api/src/routes/auth.ts`, `src/lib/email.ts`)
  - JWT access tokens (15 min) + refresh tokens stored/rotated in Redis (`backend/api/src/routes/auth.ts`)
  - Rate limits on auth + content routes via `@fastify/rate-limit`
  - Node CRUD (basic), Post CRUD + cursor feed, Comment threading with parent/child, soft deletes (`src/routes/nodes.ts`, `src/routes/posts.ts`, `src/routes/comments.ts`)
  - Prisma schema includes `User`, `Node`, `Post`, `Comment`, and `PostMetric` with B-tree indexes ready for feed queries (`backend/api/prisma/schema.prisma`)
- **Mobile features implemented**
  - Auth stack: login, register, forgot password, manual token entry, deep-link driven reset (`app/src/screens/*`)
  - App stack: feed with pagination/refresh, create post, post detail with comment composer (wired to REST endpoints)
  - Secure token persistence + refresh handling (`src/lib/storage.ts`, `src/lib/api.ts`)
  - Deep link handling for password reset tokens (scheme `nodesocial://`) (`App.tsx`)
  - Google sign-in (Android/dev builds) via `expo-auth-session` + backend `/auth/google` issuing the same JWT pair as email/password flows.
  - Apple Sign-In (iOS/dev builds) via `expo-apple-authentication` + backend `/auth/apple` backed by `jose` + Apple JWKS verification.
- **Known gaps vs documentation**
  - Google iOS/web linking still pending (needs additional client IDs and UI for users to attach multiple providers).
  - Feed is chronological only; Vibe Vectors, Vibe Validator sliders, metrics aggregation, and search are not yet built.
  - PostMetric table exists but values aren’t updated anywhere yet.
  - Moderator tooling, Node Court, and Node governance features are specified but not implemented.

---

## 2. Environment, Tooling & Workflow (from ENVIRONMENT_SETUP, NODE_VERSION_FIX, STARTUP_GUIDE, BUILD_GUIDE, SEED_DB, Cloudflare Tunnel plan)

### 2.1 Required versions & setup
- **Node.js**: 22.11.0 LTS (“Jod”). Install via:
  - `nvm install 22.11.0 && nvm use 22.11.0 && nvm alias default 22.11.0`, or
  - `brew install node@22 && brew link node@22 --force`
- **After switching Node**: `cd backend/api && rm -rf node_modules package-lock.json && npm install`, then `cd app && npm install`, then rebuild the Expo dev client (`npm run build:ios:local` / `npm run build:android:local`) to fix native modules + deep linking.
- **Global CLIs**: `eas-cli` for cloud/dev builds (`npm install -g eas-cli`). Expo CLI ships with the repo.
- **Mac requirements**: Xcode + Cocoapods for iOS; Android Studio + SDK 36 for Android (per `docs/react-native-expo-team-guide-reference.md`).

### 2.2 Environment variables (`backend/api/.env`)
```
JWT_SECRET=64-byte-hex
DATABASE_URL=postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public
REDIS_URL=redis://localhost:6379
PORT=3000
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
FRONTEND_URL=http://localhost:3000 (fallback for email links)
# Google OAuth audiences (min: Android; add others as they come online)
GOOGLE_OAUTH_ANDROID_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_IOS_CLIENT_ID=...apps.googleusercontent.com      # optional until Apple enrollment clears
GOOGLE_OAUTH_WEB_CLIENT_ID=...apps.googleusercontent.com      # optional web/dev fallback
# Alternative: GOOGLE_OAUTH_CLIENT_IDS=androidId,iosId,webId
# Apple Sign-In audiences (App ID + optional Service IDs)
APPLE_SIGNIN_CLIENT_ID=com.nodesocial.app
# Alternative: APPLE_SIGNIN_CLIENT_IDS=com.nodesocial.app,com.nodesocial.web
```
- Expo app reads `EXPO_PUBLIC_API_URL`; default is `http://localhost:3000` (`app/src/config.ts`).
- Expo app also expects `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (and optionally the iOS/web/Expo Go IDs) so `expo-auth-session` can mint the ID token that hits `/auth/google`.
- `EXPO_PUBLIC_DEV_HOST` overrides the auto-selected host (`localhost` on iOS, `10.0.2.2` on Android emulators) when pointing at another machine/IP.
- iOS dev builds ship with `expo-apple-authentication`; no extra Expo env vars are required—just rebuild after toggling the entitlement in Apple Developer.

### 2.3 Running the stack (daily workflow)
1. `docker-compose up -d` (Postgres/Redis/Meili)
2. `cd backend/api && npm run dev` → Fastify on `http://localhost:3000`
3. `cd app && npm start` (or `npm run build:ios:local` for simulator install)
4. Verify:
   - `docker ps` shows three containers
   - `curl http://localhost:3000/health` returns `{ "ok": true }`
   - Expo Metro bundler running (“Metro waiting on …”)
   - App loads in simulator/device
- Troubleshooting shortcuts (from STARTUP_GUIDE + NODE_VERSION docs):
  - Kill port 3000: `lsof -ti:3000 | xargs kill -9`
  - Reset stack: `docker-compose down`, `pkill -f "tsx src/index.ts"`, `pkill -f "expo start"`
  - Rebuild native app if SecureStore/deep linking breaks: `cd app && npm run build:ios:local`

### 2.4 Database seeding
```
cd backend/api
npx prisma db seed   # requires Node 22 and Docker Postgres running
```
Creates the default `global` node and a demo post if `test@example.com` exists.

### 2.5 Cloudflare Tunnel for device testing (from Infrastructure plan)
1. `cloudflared login` then `cloudflared tunnel create node-social-dev`
2. Configure `~/.cloudflared/config.yml` to route `https://dev.api.node-social.com` → `http://localhost:3000`
3. `cloudflared tunnel route dns node-social-dev dev.api.node-social.com`
4. `cloudflared tunnel run node-social-dev`
5. Set `EXPO_PUBLIC_API_URL=https://dev.api.node-social.com` so physical devices use HTTPS without port forwarding.

### 2.6 Build & deploy options
- **Dev builds**: `npm run build:ios` / `npm run build:android` (EAS development profiles) → required for SecureStore, deep linking, future Google/Apple auth libs.
- **Local prebuild**: `npm run prebuild` then `expo run:ios` / `expo run:android` for faster iteration when Xcode/Android Studio are installed.
- **Expo Go**: fine for UI iterations but cannot use SecureStore or native auth; rely on dev builds for anything auth-related.

---

## 3. Authentication & Security (from zero-cost-authentication-plan, jwt-implementation-summary, Node Infrastructure plan)

### 3.1 Responsibilities split
- **Expo app**
  - Uses `expo-auth-session` (planned) or native SDKs for OAuth
  - Stores access + refresh tokens in SecureStore (`src/lib/storage.ts`)
  - Handles deep links for reset/verification (already wired for reset)
  - Uses Axios-style fetch wrapper to auto-refresh tokens on 401 (`src/lib/api.ts`)
- **Fastify backend**
  - Argon2id hashing for passwords (`routes/auth.ts`)
  - JWT issuance/verification via `@fastify/jwt` with short-lived access tokens
  - Refresh token rotation stored in Redis (`refresh:userId:token` keys)
  - Rate limiting for register/login/forgot/reset/resend/refresh
  - Email verification + password reset via Resend with deep links and manual token fallback
  - `/me` protected route uses JWT decorator (`src/index.ts`)

### 3.2 Email & deep linking
- Verification emails use `nodesocial://verify-email?token=...` plus web fallback; reset emails use `nodesocial://reset-password?token=...`. (`src/lib/email.ts`)
- App handles both reset and verification tokens (manual entry + deep link) with dedicated screens.

### 3.3 Password reset & logout hygiene
- Reset tokens expire after 1 hour; successful reset clears token + revokes all refresh tokens.
- Logout optionally revokes a single refresh token or all tokens for the user.

### 3.4 Pending work
- **Google OAuth**: Android/dev-client flow is live. Next steps once client IDs exist: wire iOS/web IDs, add account-linking UI, and harden token storage (hash stored refresh tokens, add tokenVersion).
- **Apple Sign-In**: ship UI/account linking for additional App/Service IDs if we expand beyond `com.nodesocial.app`, and add optional relay-email normalization.
- **Biometric unlock / MFA**: optional, powered by `expo-local-authentication`.
- **Token hardening**: consider adding `tokenVersion` on `User` for forced revocation, store refresh tokens hashed instead of plain hex, and expand audit logging per jwt summary.
- **Monitoring**: capture auth events (logins, resets) in centralized logs; add tests for auth flows (currently `npm test` placeholder).

### 3.5 Security checklist highlights
- Argon2id w/ memory hardness, strong JWT secrets, HTTPS via Cloudflare Tunnel, `@fastify/rate-limit`, Redis-backed refresh rotation, Resend transactional emails, secrets stored via env vars, no sensitive info in logs, plan for moderator/legal workflows.

---

## 4. Feed, Data & Application Architecture (from INDEXING_STRATEGY, FEED_IMPLEMENTATION_PLAN, feeds v1, feed insights, FEED_IMPLEMENTATION_PROGRESS)

### 4.1 Data model (Prisma)
- `User`: email auth + optional `googleId` / `appleId`, reset + verification tokens.
- `Node`: slugged communities, optional creator link. (Future: nested hierarchy, charters, dormancy rules, ConnoisseurCred per node.)
- `Post`: text posts with optional node + title, `postType`, `visibility`, `deletedAt`, B-tree indexes on author/node/createdAt (for feed).
- `Comment`: threaded replies w/ parent relation and indexes for `postId`, `parentId`.
- `PostMetric`: pre-defined table for like/comment/share/save counts, engagement + quality scores (currently unused in API).
- Future models from feeds v1 + master plan: `UserNodeCred`, `VibeReactionEvent`, `PostVibeAggregate`, `user_feed_preferences`, `node proposals`, `ModActionLog`, etc.

### 4.2 Feed + API
- REST endpoints implemented:
  - `POST /posts` (auth, rate limited to 10/min)
  - `GET /posts` (cursor, limit max 50, optional `nodeId`/`authorId`)
  - `GET /posts/:id`, `DELETE /posts/:id` (soft delete by author)
  - `POST /posts/:postId/comments`, `GET /posts/:postId/comments` (threaded), `DELETE /comments/:id`
  - `POST /nodes`, `GET /nodes`, `GET /nodes/:slug|id`
- Remaining from FEED_IMPLEMENTATION_PLAN:
  - Metrics endpoints, search filters, `DELETE /posts/:id` for mods, `GET /nodes/:id/posts`, `GET /posts/:id/comments` with pagination + nested replies, rate limiting for feed reading, etc.

### 4.3 Mobile UI plan
- Already shipped screens: Feed, Create Post, Post Detail, Auth stack.
- TODO from FEED plan: Vibe Validator UI (sliders + presets), PostCard states (skeletons, error, empty), comment threading UI (indentation, replies), Node selector, Expert Gate indicator, theme alignment (#2563EB palette).
- Design references: Post card mockup, comment thread ASCII, FAB interactions from FEED doc.

### 4.4 Indexing & search strategy
- **Now**: rely on Postgres B-tree indexes for chronological feed (already in schema).
- **Phase 2**: integrate MeiliSearch for keyword/semantic search, user/node/tag filters, ranking combinations with `engagementScore`.
- **Phase 3**: add GIN indexes for JSONB (Vibe vectors) and advanced filtering.
- Implementation guidelines from INDEXING_STRATEGY: keep feed queries on Postgres, use Meili strictly for search, add GIN only for JSONB arrays.

### 4.5 Performance & caching roadmap
- Short-term: implement Prisma-level selects to avoid `_count`, keep responses lean, consider `select` vs `include`.
- Mid-term: Postgres partial indexes for active posts, `post_metrics` denormalization, Redis caching tiers (hot/warm) per feed insights doc, SSE for realtime updates, hybrid fan-out strategy (fan-out-on-write <5k followers, fan-out-on-read for larger).

### 4.6 Testing checklist (from FEED plan)
- API: create post (valid/invalid), rate limit, feed pagination, comment threading, deletion auth, etc.
- Mobile: feed load + infinite scroll, create post, post detail, comments, error/loading/empty states, performance (60 fps).
- Add automated tests + manual QA steps before shipping feed MVP.

### 4.7 Current progress (from FEED_IMPLEMENTATION_PROGRESS)
- Phase 1.1–1.4 (schema + Node/Post/Comment APIs) ✅
- Phase 1.5 (mobile feed UI) ✅ for basics; still need Node selection + design polish.
- Next: metrics/reactions (Phase 2), Vibe Validator + preferences store, Meili search, SSE or websockets.

---

## 5. Moderation, Governance & Community Systems (from MASTER_FOUNDATION_PLAN v3, SOLO_PLAN, feeds v1, master plan.txt)

### 5.1 Philosophy (“Zen of Node”)
- Active, Optimistic Curation > pessimistic filtering
- Transparent governance, public ModActionLog, actions have consequences
- Meritocracy via ConnoisseurCred + Vibe Vectors
- Communities must be earned (Node proposals, dormancy rules)

### 5.2 Governance mechanics
- **Active Seat**: Council membership automatically rotates to highest-cred users active in last 30 days. Reputation permanent; governance requires current activity. Includes wellness safeguards (break reminders, “tap out”, support budget).
- **Node Court** (three tiers):
  1. **Stake**: users stake Cred to appeal; frivolous appeals burn Cred, valid appeals refund + bonus.
  2. **Community Jury**: high-cred members vote (Uphold / Overturn / Abstain / Question) with weighted Cred.
  3. **Hub Court**: parent Node council finalizes binding judgments.
- **ModActionLog**: public immutable log of every moderation action, feeding analytics dashboards.

### 5.3 Vibe economy & curation tools
- **Vibe Vectors**: multi-dimensional reactions with intensity via radial wheel; counts mostly hidden to minimize bias.
- **Vibe Validator**: per-user sliders (Recency / Engagement / Quality / Personalization) + presets (Latest, Balanced, Popular, Custom). Needs “Why am I seeing this?” + correction controls.
- **Expert Gate Posts**: restrict top-level comments to high-cred/vouched experts while keeping read/reply access for others; includes novice threads + mentorship paths.
- **Cred Faucets/Sinks**: new Cred minted through quality reactions; sinks include appeal stakes, vouch penalties, node proposal fees, username changes.
- **Theme Marketplace**: CSS themes shared in `n/themes`, rewarded by Vibe Vector votes; ensure safety review for custom CSS.
- **Chaos Node**: dedicated low-rules community to contain “cursed” content.

### 5.4 Moderation infrastructure & wellness
- Budget **20–25%** of total costs on moderation (AI + humans + wellness programs).
- Hybrid AI + human workflow (spam, CSAM, harassment detection).
- Moderator wellness: counseling access, rotation schedules, peer groups, telemetry for burnout, “tap out” control.
- Reporting & harassment defenses: block/mute, report buttons everywhere, private profiles, anti-block-evasion systems.
- Data export & portability must be first-class (GDPR compliance, trust builder).

---

## 6. Roadmap & Milestones (condensed from Solo Plan Week-by-Week, Master Plan Phases 0–5, Node Social Development Kickoff)

### 6.1 Immediate decisions (Phase 0 / upcoming team meeting)
1. **Atomic network** (pilot community 5k–50k members) – pick one before building features for everyone.
2. **Mobile strategy** – determine whether modular panels adapt to mobile or require bespoke mobile UX (simplicity + <2 s load).
3. **Monetization mix** – freemium core + creator subs (10–15% cut) + premium features + optional ads with user control; revenue live by month 6.
4. **Moderation plan** – partner vs build-in-house, wellness funding, geo coverage, AI vendor selection.
5. **Federation/portability** – ActivityPub/AT compatibility, data export formats, account portability.

### 6.2 MVP (Months 1–3)
- Ship: auth, profiles (Era auto-assigned), text/link posts, comments, basic Nodes, Vibe Vectors (initial), Vibe Validator (default + sliders), chronological + algorithmic toggle, search (Postgres FTS), notifications (replies/mentions), DMs (1:1), blocking/reporting, data export, accessibility basics, ModActionLog, professional moderation, onboarding “Curation Gauntlet”.
- Targets: 60% D1 retention, 30% D7, 15% D30, load <2 s, 5+ connections/user.

### 6.3 Community & Curation (Months 3–6)
- ConnoisseurCred + Web of Trust, Node hierarchy/charters/dormancy, Active Seat councils, Node proposals, better discovery (Starter Packs, Meili search, tag system), Chaos Node, open API & developer portal.

### 6.4 Expert Tools (Months 6–9)
- Node Court, appeal staking, Expert Gate posts, Cred Sort, fast-track programs, theme marketplace, community health dashboard, advanced AI moderation, multilingual support.

### 6.5 Scale & Events (Months 9–12)
- Events (Vibe Quilt), Node syndication/shunting, cross-community feeds, CDN/caching hardening, high availability. KPIs: 100k+ MAU, 1k+ Nodes, profitable or clear path, 90% uptime.

### 6.6 Ecosystem (Year 2+)
- Advanced curation (labelers, AI assistance, deepfake detection), monetization expansion (creator tooling, fundraising, premium analytics), internationalization, federation, and long-term goal: 1 M+ MAU with sustainable moderation + profitability.

### 6.7 Team structure (Kickoff doc)
- **Team A (Mobile)**: UI components, gestures, Vibe wheel, Expo Router, offline-first.
- **Team B (Backend/Infra)**: Fastify, Prisma, Redis, Meili, Socket.io, background jobs.
- **BDFL / Platform lead**: architecture decisions, moderation design, network selection, unblocking.
- Additional roles: Trust & Safety lead, moderator wellness coordinator, legal/compliance, community manager, marketing/growth, devrel, data analyst.

---

## 7. Risks & Mitigation (from Master Plan Part 8)

1. **Viral growth overload** – enable waitlists, auto-scale infra, add temporary feature flags, bring in contractor moderators, clear comms.
2. **Moderation crisis** – publish transparent reports within 24 h, escalate to Node Court, reinforce guidelines, increase professional support, track moderator workload.
3. **Feature copycat** – lean on culture + transparency (moats), move fast on iterations, invest in developer ecosystem and trust.
4. **Monetization shortfall** – diversify revenue early, maintain 18–24 mo runway, trim non-core features, explore partnerships.
5. **Regulatory pressure** – build DSA/GDPR compliance now, maintain legal relationships, strong CSAM tooling, documented LE request process.
6. **Context collapse** – provide clear visibility indicators, watermarks, intended audience labels, multi-account support, education on sharing etiquette.

---

## 8. Immediate Next Steps (actionable, code-aware)

### Recently Completed (Nov 19, 2025)
- Added `.nvmrc` pinning Node 22.11.0 and updated the README with reinstall guidance.
- Top-level README now documents Docker port 5433 plus startup/build troubleshooting, so this plan can stay higher level.
- Delivered the full auth verification loop: Expo now shows a verify-email screen with deep link handling + manual token entry, and the backend pushes emails through a retrying Resend job queue with structured logging.
- Google Sign-In (Android/dev client) now flows through `expo-auth-session` → `/auth/google` backed by `google-auth-library`, marking users verified and issuing the standard JWT pair.
- Apple Sign-In (iOS/dev client) now flows through `expo-apple-authentication` → `/auth/apple`, with tokens verified via `jose` against Apple’s JWKS.

1. **Wire PostMetric + reactions**
   - Add service updating `post_metrics` on comment creation and future Vibe reactions.
2. **Implement user feed preferences**
   - Add `user_feed_preferences` schema, REST endpoints, and integrate with feed query (Recency/Engagement/Quality weights).
3. **Introduce Meili search scaffold**
   - Seed Meili (`/posts` index), add background sync on post create/update/delete, expose `/search/posts`.
4. **Moderation groundwork**
   - Add `ModActionLog` table + event emitter hooking into deletes, gating forthcoming Node Court.
   - Document moderator runbooks + start wellness provider research.
5. **Mobile UI polish**
   - Flesh out PostDetail comment threading, Node filters, feed empty/error states, design parity with brand colors.
6. **Documentation & automation**
   - Add CI (GitHub Actions) for lint, tsc, Prisma format, and `docker-compose` health check.

---

### Source Mapping

- Code references: `backend/api/src/routes/*.ts`, `backend/api/src/lib/email.ts`, `backend/api/prisma/schema.prisma`, `backend/api/prisma/seed.ts`, `app/src/*.tsx`, `app/src/lib/*.ts`, `docker-compose.yml`.
- Archived documents: see `docs/archive/` for historical context (Master Plan v3, Solo Plan, Feed plans, Zero-Cost Auth plan, React Native guide, etc.).

This `FINAL_PLAN.md` is now the single source of truth; update this file whenever reality changes.

