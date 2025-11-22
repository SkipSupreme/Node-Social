# Node Social

Node Social is a Fastify + Prisma backend with an Expo (React Native) client. This repository mirrors the state captured in `docs/FINAL_PLAN.md`, which is the source of truth for product scope, architecture, and roadmap. Update that plan whenever implementation details change.

## Requirements
- Node.js 22.11.0 (pinned via `.nvmrc`).
- Docker + Docker Compose (Postgres 16 on port **5433**, Redis 7, MeiliSearch 1.6+).
- Xcode + Cocoapods for iOS builds; Android Studio + SDK 36 for Android.
- `eas-cli` installed globally for Expo dev/client builds.

## Setup
1. Use the pinned Node version:
   ```bash
   nvm install 22.11.0
   nvm use
   ```
2. After switching Node, reinstall dependencies to avoid ABI issues:
   ```bash
   cd backend/api && rm -rf node_modules package-lock.json && npm install
   cd ../../app && npm install
   ```
3. Rebuild the Expo development client after dependency reinstalls:
   ```bash
   cd app
   npm run build:ios:local   # or npm run build:android:local
   ```

## Local API URLs / Emulators
- By default the app points to `http://localhost:3000` on iOS and `http://10.0.2.2:3000` on Android emulators (thanks to `app/src/config.ts`).
- Override the host/port with `EXPO_PUBLIC_API_URL` when you need a different base URL (e.g., Cloudflare tunnel for physical devices).
- Alternatively, set `EXPO_PUBLIC_DEV_HOST=your-lan-ip` to keep the auto-generated `http://<host>:3000` pattern.

## Google OAuth (Android / Dev Client)
1. Create OAuth client IDs in Google Cloud Console:
   - Android (package `com.nodesocial.app`)
   - Optional iOS / Web / Expo Go client IDs for future platforms
2. Backend `.env` additions (values can also be provided via the comma-separated `GOOGLE_OAUTH_CLIENT_IDS`):
   ```
   GOOGLE_OAUTH_ANDROID_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_IOS_CLIENT_ID=...apps.googleusercontent.com   # optional for later
   GOOGLE_OAUTH_WEB_CLIENT_ID=...apps.googleusercontent.com   # optional for later
   ```
3. Expo app env (set via `app.config`/`app.json` or `eas.json`):
   ```
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com     # optional for later
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com     # optional for web/dev fallback
   EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=...apps.googleusercontent.com    # optional for Expo Go
   ```
4. Rebuild the Expo dev client after changing OAuth configs so the Android keystore hash updates.

## Apple Sign-In (iOS / dev builds)
1. In Apple Developer → Certificates, Identifiers & Profiles:
   - Enable **Sign in with Apple** for the App ID `com.nodesocial.app`.
   - (Optional) create additional App/Service IDs if you intend to support web authentication later; add them to the env list below.
2. Backend `.env` additions (comma-separated helper works too):
   ```
   APPLE_SIGNIN_CLIENT_ID=com.nodesocial.app
   # or APPLE_SIGNIN_CLIENT_IDS=com.nodesocial.app,your.service.id
   ```
3. Ensure `app/app.json` has `"usesAppleSignIn": true` (already checked in) and rebuild the iOS development client so the native entitlement is present:
   ```bash
   cd app
   npm run build:ios:local
   ```
4. No custom domain is required for native Sign in with Apple; HTTPS domain mapping only matters for web flows. Just make sure the Expo app points at a reachable API URL (`EXPO_PUBLIC_API_URL` or Cloudflare tunnel) when testing on physical hardware.

## Running the stack
1. Start infrastructure:
   ```bash
   docker-compose up -d
   ```
   This brings up Postgres on `localhost:5433`, Redis on `localhost:6379`, and MeiliSearch on `localhost:7700`.
2. Start the Fastify API:
   ```bash
   cd backend/api
   npm run dev
   ```
3. Start the Expo app (Metro bundler):
   ```bash
   cd app
   npm start
   ```
4. Verify:
   - `curl http://localhost:3000/health` → `{ "ok": true }`
   - Docker containers are healthy (`docker ps`).
   - Expo dev client/devices load the app (deep links use `nodesocial://`).

## Database seeding
```bash
cd backend/api
npx prisma db seed
```
The seed creates the default `global` node and demo content (requires Docker services running).

## Troubleshooting
- Kill anything blocking port 3000: `lsof -ti:3000 | xargs kill -9`.
- Reset the stack quickly: `docker-compose down` then stop any lingering `tsx src/index.ts` or `expo start` processes.
- If SecureStore or deep links break, rebuild the Expo dev client (`npm run build:ios:local`).

## More documentation
- Full architecture, roadmap, and implementation details: `docs/FINAL_PLAN.md`.
- Historical references live in `docs/archive/`.
