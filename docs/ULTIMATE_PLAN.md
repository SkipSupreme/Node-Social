# Node Social – Ultimate Plan (code-aligned, Nov 2025)

This plan reflects the current repository state (`backend/api`, `app/`, `docs/`) and replaces outdated claims elsewhere. Treat this as the source of truth; if reality changes, update this file first.

**Last Updated:** November 26, 2025

---

## 1) What's live in code right now (verified)
- **Stack**: Fastify 5 + TypeScript + Prisma + Redis + MeiliSearch; Expo SDK 54 (RN 0.81, React 19) with dev-client, SecureStore, Zustand.
- **Auth**: Email/password with Argon2id, email verification, reset, JWT access (15m) + hashed refresh tokens in DB/Redis with rotation/reuse detection; Google & Apple sign-in flows present in the app and backed by `/auth/google` + `/auth/apple`.
- **Content**: Nodes, Posts (title/content/postType), Comments (threaded), cursor feed with optional node/author/postType filters; metrics upserted on create/delete via `src/lib/metrics.ts`.
- **Search**: MeiliSearch client registered; `/search/posts` exists; posts sync on create/update/delete via `syncPostToMeili`. Backfill script at `scripts/backfillMeili.ts`.
- **Vibes & feed prefs**: Full Vibe Vector system with intensity-based reactions, PostVibeAggregate for efficient querying, per-node weighting. Feed scoring uses real personalization (following, node affinity, vibe alignment, trust network).
- **Cred System**: CredTransaction logging, User.cred and nodeCredScores updated on reactions. Earning formula uses weighted positive vectors (Insightful 3x, Support 2.5x, Fire 2x, Joy 1.5x).
- **Email**: Resend-backed queue with retry/backoff, templates for verification/reset.
- **Web UI**: Desktop web layout (`WebLayout`) toggled by `useResponsive` in `App.tsx`; panel system, left/right sidebars, Vibe Validator, PostCardWeb, radial wheel components exist.

## 2) Known gaps & correctness issues (UPDATED)
- ~~**Vibe reactions schema mismatch**~~: ✅ FIXED - Service correctly uses intensities JSON, aggregates from VibeVector table.
- ~~**Node ID for reactions**~~: ✅ FIXED - Backend resolves "global" slug to UUID automatically.
- ~~**Meili sync**~~: ✅ FIXED - Now syncs on create/update/delete with improved error handling and health monitoring.
- ~~**Feed scoring personalization**~~: ✅ FIXED - Real personalization using following, node affinity, vibe alignment, trust network.
- **Radial wheel wiring**: UI exists, reaction aggregation works, user's own reaction returned in feed. Frontend may need polish.
- **Moderation/governance**: ModActionLog table exists but no moderator endpoints or UI; Node Court/Expert Gate schema exists but UI unimplemented.
- **Testing/CI**: No automated tests or CI; TypeScript only lint target.

## 3) High-impact next steps (Phase 2 focus)
1) **Frontend Polish**
   - Wire Vibe Validator sliders to real weights in UI; show user's reaction in post cards.
   - Surface vibe aggregates visually (mini charts/bars on posts).
   - Add postType filter UI on web.
2) **Search UI**
   - Expose search in app/web UI with filters (node, author, postType).
3) **Auth polish**
   - Add account-linking UI (Google/Apple) and backend conflict flows.
4) **DevX & safety**
   - CI: lint + tsc + Prisma format + `docker-compose` health check.
   - Add minimal API integration tests (auth, posts, comments, reactions).
5) **Moderation MVP**
   - Basic moderator dashboard to view/action ModQueueItems.
   - Report flow from frontend.

## 4) Roadmap by phase (pragmatic)
- **Phase A: Reliability & parity (now → 2 wks)**  
  Fix Vibe schema/wiring, Meili sync on update, feed prefs in UI, reaction nodeId bug, surface user reaction in feed/post responses, basic CI/tests.
- **Phase B: Curation foundation (2–6 wks)**  
  PostMetric enrichment (views/likes/shares), per-node vibe weighting in scoring, search UI, feed presets (latest/popular/expert/personal), empty/error/skeleton states, comment threading polish, node-aware reactions.
- **Phase C: Moderation & trust (6–10 wks)**  
  Mod endpoints + dashboard (log actions, soft-delete with reason), report/block/mute in app, Cred scaffolding, Node proposals/dormancy rules draft, audit logging.
- **Phase D: Growth & ecosystem (10+ wks)**  
  Notifications, DMs, Starter Packs, theme marketplace, ActivityPub/AT exploration, analytics dashboards, waitlist/feature flags, monetization experiments (creator subs, premium analytics).

## 5) Testing & ops checklist
- Stand up Postgres/Redis/Meili via `docker-compose up -d`; seed with `npx prisma db seed`.
- Run `npm run dev` (API) + `npm start` (app) on Node 22.11.0; rebuild dev client after dependency reinstalls.
- Add GitHub Actions (or similar) for: `npm run lint` (api/app), `prisma format`, `docker-compose` health, and a small vitest/supertest suite for auth/feed.
- Observability: add structured logs for auth events, Meili sync failures, reaction errors; consider Sentry for app/API.

## 6) Documentation hygiene
- This file is the canonical plan.  
- `docs/FINAL_PLAN.md` now points here.  
- `docs/IMPLEMENTATION_PROGRESS.md` reflects current truthful status; update alongside code.  
- Keep redirects/OAuth notes synced with `app/src/config.ts` and `LoginScreen`.

---

When you pick up a task, sync it with this plan; if reality differs, update this file before shipping.***
