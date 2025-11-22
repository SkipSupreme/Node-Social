# Environment Setup & Verification

## Node.js Version Management

**REQUIRED:** Node.js 22.11.0 LTS ("Jod")
**CURRENT:** Node 24.10.0 (too new, causing compatibility issues)

### Install Node 22 LTS

**Option 1: Using nvm (Recommended)**
```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source it
source ~/.zshrc  # or ~/.bashrc

# Install Node 22 LTS
nvm install 22.11.0
nvm use 22.11.0
nvm alias default 22.11.0

# Verify
node --version  # Should show v22.11.0
npm --version
```

**Option 2: Using Homebrew**
```bash
# Install Node 22
brew install node@22

# Link it
brew link node@22 --force

# Verify
node --version  # Should show v22.x.x
```

**Option 3: Direct Download**
- Download from https://nodejs.org/en/download/
- Choose LTS version (22.x)
- Install and verify

### After Switching Node Versions

```bash
# Backend
cd backend/api
rm -rf node_modules package-lock.json
npm install

# Frontend (should be fine, but verify)
cd app
npm install
```

---

## Required Environment Variables

### Backend (`backend/api/.env`)
```bash
# JWT Secret (64-byte hex string)
JWT_SECRET=5beb2844c1dfc9cc674199205ac0245e29add2cf9206dbdac24d56162e78f2b01371babea2b648b959edda715d31796c8f010becd937fd540b2da3835881dbfb

# Database
DATABASE_URL=postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3000

# Resend Email
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

### Frontend (`app/.env` or `app/src/config.ts`)
Currently using `app/src/config.ts`:
- `LOCAL_DEV_IP` - Set to `localhost` for simulator, your Mac's IP for physical device

---

## Verification Checklist

- [ ] Node version is 22.11.0 (not 24.x)
- [ ] Docker containers running (postgres, redis, meilisearch)
- [ ] Backend API starts without errors
- [ ] Mobile app builds and runs
- [ ] Can register a user
- [ ] Can login
- [ ] Password reset works
- [ ] JWT tokens refresh automatically

---

## Common Issues

**"Cannot find native module" errors:**
- Solution: Rebuild the app after adding native modules
- Run: `cd app && npm run build:ios:local` or `npm run build:android:local`

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Database connection errors:**
- Check Docker: `docker ps` (should see postgres on port 5433)
- Verify DATABASE_URL port matches docker-compose.yml (5433, not 5432)

**Redis connection errors:**
- Check Docker: `docker ps` (should see redis on port 6379)
- Test: `redis-cli ping` (should return PONG)

