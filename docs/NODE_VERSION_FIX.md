# Fix Node.js Version - Quick Guide

## Current Issue
- **Current:** Node 24.10.0
- **Required:** Node 22.11.0 LTS ("Jod")
- **Why:** Node 24 is too new and causing compatibility issues with Expo builds

## Solution: Install Node 22 LTS

### Option 1: Using nvm (Recommended)

**Step 1: Install nvm** (if not already installed)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

**Step 2: Restart your terminal** (or run):
```bash
source ~/.zshrc
```

**Step 3: Install and use Node 22**
```bash
nvm install 22.11.0
nvm use 22.11.0
nvm alias default 22.11.0
```

**Step 4: Verify**
```bash
node --version  # Should show v22.11.0
```

**Step 5: Reinstall dependencies**
```bash
cd backend/api
rm -rf node_modules package-lock.json
npm install

cd ../../app
npm install
```

### Option 2: Using Homebrew

```bash
# Install Node 22
brew install node@22

# Link it (may require --force)
brew link node@22 --force

# Verify
node --version  # Should show v22.x.x
```

### Option 3: Direct Download

1. Go to https://nodejs.org/en/download/
2. Download Node.js 22.x LTS for macOS
3. Install the .pkg file
4. Verify: `node --version`

## After Switching

Once Node 22 is installed:

1. **Rebuild the mobile app** (fixes deep linking):
   ```bash
   cd app
   npm run build:ios:local
   ```

2. **Restart the backend**:
   ```bash
   cd backend/api
   npm run dev
   ```

3. **Test everything works**:
   - Backend starts without errors
   - Mobile app builds successfully
   - Can register/login

## Troubleshooting

**"Command not found: nvm"**
- Restart terminal or run: `source ~/.zshrc`

**"Port 3000 already in use"**
```bash
lsof -ti:3000 | xargs kill -9
```

**"Cannot find native module"**
- Rebuild the app after switching Node versions

