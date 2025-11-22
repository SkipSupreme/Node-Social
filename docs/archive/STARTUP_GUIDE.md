# Quick Startup Guide

## Daily Development Workflow

### 1. Start Backend Services
```bash
# Start Docker containers (Postgres, Redis, Meilisearch)
cd /Users/joshhd/Documents/node-social
docker-compose up -d

# Start the API server
cd backend/api
npm run dev
```
✅ You should see: `API running on http://localhost:3000`

### 2. Start Mobile App

**Option A: If you have a custom dev build installed:**
```bash
cd app
npm start
# Then open the app on your simulator/device
```

**Option B: If you need to rebuild:**
```bash
cd app
npm run build:ios:local  # For iOS
# OR
npm run build:android:local  # For Android
```

### 3. Verify Everything is Running

- ✅ Docker containers: `docker ps` (should show 3 containers)
- ✅ API server: `curl http://localhost:3000/health` (should return `{"ok":true}`)
- ✅ Metro bundler: Check terminal for "Metro waiting on..."
- ✅ App: Should load in simulator/device

## Quick Commands Reference

```bash
# Backend
cd backend/api && npm run dev          # Start API
cd backend/api && npx prisma studio   # Open DB viewer

# Frontend
cd app && npm start                    # Start Metro
cd app && npm run build:ios:local     # Build iOS
cd app && npm run build:android:local # Build Android

# Docker
docker-compose up -d                   # Start services
docker-compose down                    # Stop services
docker ps                              # Check running containers
```

## Troubleshooting

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Metro bundler not connecting:**
- Make sure `npm start` is running in the `app` directory
- Reload app: Press `Cmd+R` in simulator or shake device

**App can't reach API:**
- Simulator/Emulator: Use `localhost:3000` ✅
- Physical device: Update `LOCAL_DEV_IP` in `app/src/config.ts` to your Mac's IP

**Need to reset everything:**
```bash
# Stop all services
docker-compose down
pkill -f "tsx src/index.ts"  # Kill API
pkill -f "expo start"        # Kill Metro

# Then restart from step 1
```

## Testing Auth Flow

1. **Register**: Tap "Create account" → Enter email/password → Should see success
2. **Login**: Enter credentials → Should navigate to main screen
3. **Logout**: Tap logout button → Should return to login
4. **Token Refresh**: Wait 15+ minutes, make API call → Should auto-refresh
5. **Persist**: Close app, reopen → Should stay logged in

## Environment Variables

**Backend** (`backend/api/.env`):
```
JWT_SECRET=your-secret-here
DATABASE_URL=postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public
REDIS_URL=redis://localhost:6379
PORT=3000
```

**Frontend** (`app/src/config.ts`):
- Simulator/Emulator: `localhost`
- Physical device: Your Mac's local IP address

