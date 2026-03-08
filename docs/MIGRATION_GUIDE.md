# Node Social - Machine Migration Guide

How to migrate Node Social to a new development machine. Written from real experience migrating Mac to Windows 10 (March 2026). Most steps apply to any OS.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | LTS (v22+) | https://nodejs.org or `winget install OpenJS.NodeJS.LTS` |
| Git | Latest | https://git-scm.com or `winget install Git.Git` |
| Docker Desktop | Latest | https://docker.com or `winget install Docker.DockerDesktop` |
| cloudflared | Latest | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ or `winget install Cloudflare.cloudflared` |

**Windows-specific**: Docker Desktop requires WSL2. If it fails to start, run `wsl --update` and restart your PC.

**PostgreSQL** is optional locally — the project uses Docker for Postgres. Only install it natively if you need `pg_dump`/`pg_restore` outside Docker.

---

## Step 1: Clone and Install

```bash
git clone https://github.com/SkipSupreme/Node-Social.git "Node Social"
cd "Node Social"

# Backend
cd backend/api
npm install --legacy-peer-deps

# Frontend
cd ../../app
npm install --legacy-peer-deps
```

> **Why `--legacy-peer-deps`?** `fastify-socket.io` declares a peer dep on Fastify 4.x but works fine with 5.x, and some TipTap packages have loose React type deps. This flag is safe here.

---

## Step 2: Environment Variables

Copy the template and fill in your values:

```bash
cp backend/api/.env.example backend/api/.env
```

Required variables (see `.env.example` for the full list):

```env
DATABASE_URL=postgresql://nodesocial:nodesocialpwd@localhost:5433/nodesocial_dev?schema=public
REDIS_URL=redis://localhost:6379
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your_meili_master_key
JWT_SECRET=your_jwt_secret
COOKIE_SECRET=your_cookie_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
RESEND_API_KEY=your_resend_api_key
```

> **Important**: `DATABASE_URL` uses port **5433** (Docker-mapped port), not the default 5432.

---

## Step 3: Start Docker Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5433
- **Redis 7** on port 6379
- **MeiliSearch** on port 7700

Verify all three are healthy:

```bash
docker ps
```

All containers should show `Up` status.

---

## Step 4: Database

### Option A: Fresh Start (migrations only, no old data)

```bash
cd backend/api
npx prisma generate
npx prisma db push
```

This creates all tables from the Prisma schema. You'll have an empty database.

### Option B: Migrate Data from Another Machine

#### On the source machine

If Postgres runs in Docker (check with `docker ps`):

```bash
docker exec nodesocial_postgres pg_dump -Fc -U nodesocial nodesocial_dev > nodesocial.dump
```

If Postgres runs natively:

```bash
pg_dump -Fc -h localhost -p 5432 -U nodesocial nodesocial_dev > nodesocial.dump
```

Transfer `nodesocial.dump` to the new machine (USB, cloud drive, scp, etc.).

#### On the new machine

1. Copy the dump file into the Docker container:

```bash
docker cp nodesocial.dump nodesocial_postgres:/tmp/nodesocial.dump
```

> **Git Bash on Windows gotcha**: Git Bash auto-converts Unix paths like `/tmp/` to Windows paths. Prefix with `MSYS_NO_PATHCONV=1`:
> ```bash
> MSYS_NO_PATHCONV=1 docker cp nodesocial.dump nodesocial_postgres:/tmp/nodesocial.dump
> ```

2. Restore the database:

```bash
docker exec nodesocial_postgres pg_restore -U nodesocial -d nodesocial_dev --clean --if-exists /tmp/nodesocial.dump
```

> Same Git Bash note — prefix with `MSYS_NO_PATHCONV=1` if paths get mangled.

You may see some warnings about `pg_restore: warning: errors ignored on restore` — this is normal if the database was empty (the `--clean` flag tries to drop objects that don't exist yet).

3. Generate Prisma client and mark migrations as applied:

```bash
cd backend/api
npx prisma generate
npx prisma migrate resolve --applied <migration_name>
```

Run `npx prisma migrate resolve --applied` for each migration in `prisma/migrations/` in order. Or if you just want to mark them all:

```bash
for dir in prisma/migrations/*/; do
  migration=$(basename "$dir")
  if [[ "$migration" != "migration_lock.toml" ]]; then
    npx prisma migrate resolve --applied "$migration"
  fi
done
```

---

## Step 5: Start the App

```bash
# Terminal 1 - Backend
cd backend/api
npm run dev

# Terminal 2 - Frontend (web)
cd app
npx expo start --web --port 8081 --clear
```

The `--clear` flag clears Metro's cache, which avoids stale bundle issues after migration.

Verify:
- Backend health: http://localhost:3000/health should return `{"ok":true}`
- Frontend: http://localhost:8081 should load the app
- Posts: http://localhost:3000/posts?limit=2 should return post data

---

## Step 6: Cloudflare Tunnel (Optional — for domain access)

If you want `node-social.com` and `api.node-social.com` pointing at your dev machine:

### First-time setup

```bash
cloudflared tunnel login          # Opens browser to authenticate
cloudflared tunnel create nodesocial-tunnel
```

Note the tunnel ID from the output (e.g., `277d79f1-537b-49b1-b34a-18aa5f6ae35d`).

### Config file

Create the config file:
- **Windows**: `C:\Users\<you>\.cloudflared\config.yml`
- **Mac/Linux**: `~/.cloudflared/config.yml`

```yaml
tunnel: <your-tunnel-id>
credentials-file: <path-to-credentials-json>

ingress:
  - hostname: api.node-social.com
    service: http://localhost:3000
  - hostname: node-social.com
    service: http://localhost:8081
  - service: http_status:404
```

The credentials file path:
- **Windows**: `C:\Users\<you>\.cloudflared\<tunnel-id>.json`
- **Mac/Linux**: `~/.cloudflared/<tunnel-id>.json`

### DNS routes

```bash
cloudflared tunnel route dns <tunnel-name> api.node-social.com
cloudflared tunnel route dns <tunnel-name> node-social.com
```

### Run the tunnel

```bash
cloudflared tunnel run nodesocial-tunnel
```

> **Switching machines**: Only one tunnel can serve a hostname at a time. If the old machine's tunnel is still running, either stop it or delete and recreate the tunnel on the new machine:
> ```bash
> cloudflared tunnel delete <old-tunnel-name>
> cloudflared tunnel create <new-tunnel-name>
> ```

---

## Known Platform Gotchas

### Windows: Git Bash path conversion

Git Bash (MSYS2) auto-converts Unix-style paths to Windows paths. This breaks Docker commands that need literal Unix paths inside containers.

**Fix**: Prefix commands with `MSYS_NO_PATHCONV=1`:

```bash
MSYS_NO_PATHCONV=1 docker exec container_name command /unix/path
```

### Windows: `import.meta.url` path format

Node.js on Windows uses backslashes in `process.argv[1]` but forward slashes in `import.meta.url`. The main module detection in `src/index.ts` uses `pathToFileURL()` to normalize this:

```typescript
import { pathToFileURL } from 'url';
const isMainModule = import.meta.url === pathToFileURL(process.argv[1]).href;
```

If you see the server "start" but never actually listen on a port, this check is likely failing.

### Port conflicts

If you get `EADDRINUSE`, find and kill the process holding the port:

```bash
# Windows (PowerShell)
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Mac/Linux
lsof -i :3000
kill <pid>
```

> **Never run `taskkill /IM node.exe /F`** — this kills ALL Node processes, including your editor, Claude Code, etc.

### Metro cache issues

After pulling major code changes (especially Expo Router migrations), clear Metro's cache:

```bash
npx expo start --web --port 8081 --clear
```

---

## Quick Reference

| What | Command | Where |
|------|---------|-------|
| Start Docker services | `docker compose up -d` | project root |
| Stop Docker services | `docker compose down` | project root |
| Start backend | `npm run dev` | `backend/api/` |
| Start frontend (web) | `npm run web` or `npx expo start --web --port 8081` | `app/` |
| Run tests | `npm test` | `backend/api/` |
| Generate Prisma client | `npx prisma generate` | `backend/api/` |
| Push schema to DB | `npx prisma db push` | `backend/api/` |
| Open Prisma Studio | `npx prisma studio` | `backend/api/` |
| Run tunnel | `cloudflared tunnel run nodesocial-tunnel` | anywhere |
| Health check | `curl http://localhost:3000/health` | anywhere |

---

## Checklist

- [ ] Node.js installed (`node --version`)
- [ ] Docker Desktop running (`docker ps`)
- [ ] Repo cloned
- [ ] `npm install --legacy-peer-deps` in both `backend/api/` and `app/`
- [ ] `.env` created in `backend/api/`
- [ ] Docker services up (`docker compose up -d`)
- [ ] Database restored or migrations run
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Backend starts and health check passes
- [ ] Frontend starts and loads in browser
- [ ] (Optional) Cloudflare tunnel configured and running
- [ ] Posts load on the feed
