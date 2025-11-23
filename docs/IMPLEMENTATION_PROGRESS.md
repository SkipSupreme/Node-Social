# Implementation Progress (truthful snapshot – Jan 2026)

This replaces older claims. For roadmap and priorities, see `docs/ULTIMATE_PLAN.md`.

## Backend
- **Done**: Auth (email/pass, Google, Apple), JWT + refresh rotation with reuse detection, email verification/reset with Resend queue, Nodes/Posts/Comments CRUD + cursor feed, feed prefs table read by feed scoring, PostMetric upserts on post/comment create/delete, Meili client + `/search/posts`, seed for nodes + vibe vectors.
- **In progress / gaps**:
  - Vibe reactions: Prisma model lacks `vector` relation but service queries it; aggregation broken until schema/query are aligned. Reaction endpoints otherwise present.
  - Reactions require a UUID nodeId; clients currently send `"global"` when node is missing.
  - Meili sync only on create/delete; updates/backfill/health not wired.
  - ModActionLog table exists; no moderator endpoints yet.

## Mobile (Expo app)
- **Done**: Email/password auth flows (login/register/reset/verify), deep-link handling for reset/verify, Google + Apple sign-in flows, feed with pagination/node filter, create post, post detail + comments, token storage/refresh queue.
- **In progress / gaps**: Vibe reactions UI calls API but sends `"global"` for nodeId; no display of aggregated reactions; feed doesn’t surface user reaction state; error handling for reactions minimal.

## Web interface
- **Done**: Responsive switch to `WebLayout` on desktop, panel system with sidebars, Vibe Validator UI with presets, radial wheel + reaction button components, PostCardWeb, Node list.
- **In progress / gaps**: Drag/drop/resize not implemented; Vibe Validator sliders are read-only visuals; feed lacks postType filter UI; reactions not showing counts/aggregation; multi-column feeds not built.

## DevEx / Testing
- **Current**: TypeScript lint (`tsc --noEmit`) only; no CI; no automated tests.
- **Needed next**: CI pipeline for lint/tsc/prisma format/docker health; API integration tests (auth, posts, comments, reactions); app smoke test for login/feed.
