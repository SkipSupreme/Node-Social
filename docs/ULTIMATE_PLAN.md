# Node Social – Ultimate Plan (code-aligned, Jan 2026)

This plan reflects the current repository state (`backend/api`, `app/`, `docs/`) and replaces outdated claims elsewhere. Treat this as the source of truth; if reality changes, update this file first.

---

## 1) What’s live in code right now (verified)
- **Stack**: Fastify 5 + TypeScript + Prisma + Redis + MeiliSearch; Expo SDK 54 (RN 0.81, React 19) with dev-client, SecureStore, Zustand.
- **Auth**: Email/password with Argon2id, email verification, reset, JWT access (15m) + hashed refresh tokens in DB/Redis with rotation/reuse detection; Google & Apple sign-in flows present in the app and backed by `/auth/google` + `/auth/apple`.
- **Content**: Nodes, Posts (title/content/postType), Comments (threaded), cursor feed with optional node/author/postType filters; metrics upserted on create/delete via `src/lib/metrics.ts`.
- **Search**: MeiliSearch client registered; `/search/posts` exists; posts sync on create/delete via `syncPostToMeili` (updates not yet hooked).
- **Vibes & feed prefs**: Prisma models/tables for Vibe Vectors, Node weights, Vibe Reactions, feed preferences; seed creates global nodes + default vectors. Frontend renders radial wheel and Vibe Validator, feed scoring reads `user_feed_preferences`.
- **Email**: Resend-backed queue with retry/backoff, templates for verification/reset.
- **Web UI**: Desktop web layout (`WebLayout`) toggled by `useResponsive` in `App.tsx`; panel system, left/right sidebars, Vibe Validator, PostCardWeb, radial wheel components exist.

## 2) Known gaps & correctness issues
- **Vibe reactions schema mismatch**: `VibeReaction` model lacks a `vector` relation but `vibeService.getReactionsForContent` includes it, so aggregation will throw/TS fails. Needs schema/query alignment plus aggregation rewrite.
- **Node ID for reactions**: Mobile `PostCard` falls back to `"global"` (string slug) when no nodeId; API expects a UUID, so reactions will 400 unless nodeId is a real UUID. Needs slug→id mapping or backend slug acceptance.
- **Meili sync**: Only create/delete trigger sync; updates/edits won’t refresh the index; no backfill job; errors are fire-and-forget.
- **Feed scoring**: Personalization score is stubbed (50), metrics only include comment-driven engagement; no following graph; postType filtering in backend is present but UI doesn’t expose it on web.
- **Radial wheel wiring**: UI exists, but reaction aggregation/counts and per-node weighting aren’t surfaced; no persistence of user reaction in feed fetch; reaction endpoints lack auth error handling in UI.
- **Moderation/governance**: ModActionLog table exists but no moderator endpoints or UI; Node Court/Expert Gate are unimplemented.
- **Testing/CI**: No automated tests or CI; TypeScript only lint target.

## 3) High-impact next steps (2-week focus)
1) **Stabilize Vibe reactions**  
   - Fix Prisma schema/service alignment; add per-vector aggregation query; expose user’s own reaction in feed/post fetch.  
   - Accept slug for nodeId or map slug→id client-side; block “global” string from reaching API.
2) **Search & indexing completeness**  
   - Add post update sync to Meili; add backfill job + health logging; guard Meili failures so writes don’t crash.  
   - Expose search in app/web UI with filters (node, author, postType).
3) **Feed quality controls**  
   - Wire Vibe Validator sliders to real weights; enforce 100% sum; persist and reflect in feed scoring.  
   - Add postType filter UI; return user reaction + aggregated vibes in feed payload.
4) **Auth polish**  
   - Add account-linking UI (Google/Apple) and backend conflict flows; add `tokenVersion` to users for global revocation; hash refresh tokens only (stop storing raw in Redis).
5) **DevX & safety**  
   - CI: lint + tsc + Prisma format + `docker-compose` health check.  
   - Add minimal API integration tests (auth, posts, comments, reactions) and app smoke test for login/feed.

## 4) Roadmap by phase (pragmatic)
- **Phase A: Reliability & parity (now → 2 wks)**  
  Fix Vibe schema/wiring, Meili sync on update, feed prefs in UI, reaction nodeId bug, surface user reaction in feed/post responses, basic CI/tests.
- **Phase B: Curation foundation (2–6 wks)**  
  PostMetric enrichment (views/likes/shares), per-node vibe weighting in scoring, search UI, feed presets (latest/popular/expert/personal), empty/error/skeleton states, comment threading polish, node-aware reactions.
- **Phase C: Moderation & trust (6–10 wks)**  
  Mod endpoints + dashboard (log actions, soft-delete with reason), report/block/mute in app, ConnoisseurCred scaffolding, Node proposals/dormancy rules draft, audit logging.
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
