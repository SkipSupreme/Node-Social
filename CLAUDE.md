# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Node Social is a full-stack social networking app with a Fastify + Prisma backend (`backend/api/`) and an Expo React Native client (`app/`). The source of truth for product scope and roadmap is `docs/ULTIMATE_PLAN.md`.

**Node version:** 22.11.0 (pinned in `.nvmrc`)

## Commands

### Backend (`backend/api/`)
```bash
npm run dev          # Start Fastify dev server (tsx src/index.ts)
npm run lint         # TypeScript type check (tsc --noEmit)
npx prisma migrate dev   # Create/apply database migrations
npx prisma db seed       # Seed database with global node + demo content
npx prisma studio        # Open Prisma GUI
```

### Frontend (`app/`)
```bash
npm start                    # Start Metro bundler
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run web                  # Run in web browser
npm run build:ios:local      # Local iOS build
npm run build:android:local  # Local Android build
npm run lint                 # TypeScript type check
```

### Infrastructure
```bash
docker-compose up -d    # Start Postgres (5433), Redis (6379), MeiliSearch (7700)
docker-compose down     # Stop containers
```

## Architecture

### Backend (`backend/api/src/`)
- **`index.ts`** - Fastify server entry with CORS, helmet, JWT, rate limiting, CSRF
- **`routes/`** - REST endpoints: auth, posts, comments, nodes, users, notifications, reactions, moderation, search
- **`services/`** - Business logic: vibeService (reactions), moderationService, expertService, socketService
- **`lib/`** - Utilities: feedScoring (algorithm), emailQueue (Resend), searchSync (MeiliSearch)
- **`plugins/`** - Fastify plugins: prisma, redis, meilisearch, socket.io
- **`prisma/schema.prisma`** - Database models (25+ entities)

### Frontend (`app/src/`)
- **`App.tsx`** - Root component with auth state, navigation, QueryClient
- **`screens/`** - Full screen flows: Feed, PostDetail, Profile, Login, Register, Messages, etc.
- **`components/ui/`** - Reusable components: Feed, PostCard, CreatePostModal, VibeValidator
- **`web/`** - Desktop-specific 3-column layout components
- **`lib/api.ts`** - API client with typed endpoints
- **`store/auth.ts`** - Zustand auth store

### Key Tech Stack
- **Backend:** Fastify, Prisma, PostgreSQL, Redis, MeiliSearch, Socket.io, Zod, Argon2
- **Frontend:** Expo SDK 54, React 19, React Query, Zustand, Socket.io-client

### Authentication
Three auth methods: email/password (Argon2), Google OAuth, Apple Sign-In. JWT access tokens (15min) + httpOnly refresh cookies (7 days).

### Feed System
Posts ranked by `lib/feedScoring.ts` using configurable weights (quality, recency, engagement, personalization). Users customize via `UserFeedPreference` and can use/share `FeedPreset` configurations.

### Vibe Vectors
Multi-dimensional reaction system replacing simple likes. Defined in `vibes.ts` (frontend) and `vibeService.ts` (backend). Aggregated per-post in `PostVibeAggregate`.

## API Health Check
```bash
curl http://localhost:3000/health  # Returns { "ok": true }
```

## Key Endpoints
- `/auth/*` - Authentication flows
- `/posts/*` - Post CRUD with feed filters
- `/nodes/*` - Community/topic management
- `/api/v1/reactions/*` - Vibe vector reactions
- `/search/posts` - MeiliSearch full-text search
