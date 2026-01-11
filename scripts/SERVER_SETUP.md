# Node Social Dev Server Setup (Windows)

This guide sets up a shared development server on Windows with auto-deploy from GitHub.

## Prerequisites

Install these on the Windows server:

1. **Docker Desktop for Windows** - https://docker.com/products/docker-desktop
   - Enable WSL2 backend when prompted
   - After install, verify: `docker --version`

2. **Node.js 22** - https://nodejs.org (LTS version)
   - Verify: `node --version` (should show v22.x.x)

3. **Git for Windows** - https://git-scm.com/download/win
   - Include Git Bash in PATH during install

4. **PM2** - Run in PowerShell:
   ```powershell
   npm install -g pm2
   pm2 install pm2-windows-startup
   ```

5. **Tailscale** - https://tailscale.com/download/windows
   - Note your Tailscale IP (100.x.x.x)

---

## Step 1: Clone and Set Up

```powershell
# Create project directory
mkdir C:\Projects
cd C:\Projects

# Clone the repo (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/node-social.git
cd node-social
```

---

## Step 2: Start Docker Services

```powershell
# Start PostgreSQL, Redis, and MeiliSearch
docker-compose up -d

# Verify all 3 containers are running
docker ps
```

You should see:
- `nodesocial_postgres` on port 5433
- `nodesocial_redis` on port 6379
- `nodesocial_meili` on port 7700

---

## Step 3: Configure Environment

Create the file `backend/api/.env`:

```powershell
# Open notepad to create the file
notepad backend\api\.env
```

Paste this content (update secrets!):

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MeiliSearch
MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_MASTER_KEY="pzhJlt_oRqhn6pAFunQ582WoCo28sWsTFWFxnjAJlXw"

# Security - GENERATE NEW RANDOM STRINGS FOR THESE!
JWT_SECRET="replace-with-random-32-char-string"
COOKIE_SECRET="replace-with-another-random-string"

# CORS - replace 100.x.x.x with your actual Tailscale IPs
ALLOWED_ORIGINS="http://localhost:8081,http://100.x.x.x:8081"
FRONTEND_URL="http://localhost:8081"
```

To generate random secrets, run in PowerShell:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

---

## Step 4: Initialize Database

```powershell
cd C:\Projects\node-social\backend\api

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed with demo data
npx prisma db seed
```

---

## Step 5: Start the API Server

```powershell
cd C:\Projects\node-social\backend\api

# Start with PM2 (keeps running after you close terminal)
pm2 start npm --name "nodesocial-api" -- run dev

# Save PM2 config (auto-starts on reboot)
pm2 save

# Verify it's running
pm2 status
```

Test the API:
```powershell
curl http://localhost:3000/health
# Should return: {"ok":true}
```

---

## Step 6: Set Up Auto-Deploy

The deploy script uses **adaptive polling**:
- **Idle mode**: Checks every 10 minutes (saves resources when nobody's working)
- **Active mode**: Checks every 60 seconds (fast deploys when someone pushes)
- **Auto-switch**: Goes back to idle after 60 min of no changes

Copy the script to a convenient location:

```powershell
Copy-Item C:\Projects\node-social\scripts\windows-deploy.ps1 C:\Projects\deploy-nodesocial.ps1
```

Create the scheduled task (run as Admin):

```powershell
# Task runs every 60 seconds, but the script manages its own timing internally
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Projects\deploy-nodesocial.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Seconds 60) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "NodeSocial-AutoDeploy" -Action $action -Trigger $trigger -Settings $settings -Principal $principal
```

Verify it's running:
```powershell
Get-ScheduledTask -TaskName "NodeSocial-AutoDeploy"

# Check current mode (idle or active)
Get-Content C:\Projects\deploy-state.json
```

---

## Step 7: Verify Everything Works

1. **Check Docker containers:**
   ```powershell
   docker ps
   ```

2. **Check API is responding:**
   ```powershell
   curl http://localhost:3000/health
   ```

3. **From another machine on Tailscale:**
   ```bash
   curl http://100.x.x.x:3000/health
   ```

4. **Test auto-deploy:** Push a commit to main, wait 60 seconds, check:
   ```powershell
   Get-Content C:\Projects\deploy-log.txt -Tail 10
   ```

---

## Useful Commands

```powershell
# View API logs
pm2 logs nodesocial-api

# Restart API manually
pm2 restart nodesocial-api

# Stop API
pm2 stop nodesocial-api

# View deploy logs
Get-Content C:\Projects\deploy-log.txt -Tail 20

# Restart Docker services
docker-compose restart

# Check Docker container logs
docker logs nodesocial_postgres
```

---

## Troubleshooting

**"Cannot connect to Docker daemon"**
- Make sure Docker Desktop is running

**"Connection refused" on port 3000**
- Check PM2: `pm2 status`
- Check logs: `pm2 logs nodesocial-api`

**Auto-deploy not working**
- Check scheduled task: `Get-ScheduledTask -TaskName "NodeSocial-AutoDeploy"`
- Check deploy log: `Get-Content C:\Projects\deploy-log.txt -Tail 20`
- Try running manually: `powershell -File C:\Projects\deploy-nodesocial.ps1`

**Database connection errors**
- Verify Postgres is running: `docker ps | findstr postgres`
- Check DATABASE_URL in .env matches docker-compose settings
