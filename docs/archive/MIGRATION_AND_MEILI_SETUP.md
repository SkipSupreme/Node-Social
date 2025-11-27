# Migration and MeiliSearch Setup

## Migration Issue Resolution

**The Error:** Prisma detected that migration `20251121120000_add_refresh_tokens` was modified after it was applied.

**What "All data will be lost" means:**
- Only affects the **development database** (`nodesocial_dev`)
- Does NOT affect production data
- Does NOT affect your code
- Will delete test users, posts, comments in dev

### Option 1: Reset (Recommended for Dev)

If you don't need existing dev data:

```bash
cd backend/api
npx prisma migrate reset
```

This will:
1. Drop the database
2. Recreate it
3. Apply all migrations (including new UserFeedPreference and ModActionLog tables)

### Option 2: Keep Data (If you have important dev data)

If you need to preserve data, we can manually resolve the migration conflict. Contact me if you need this option.

---

## MeiliSearch Master Key Setup

### 1. Add to `.env` file

Add this to `backend/api/.env`:

```env
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=pzhJlt_oRqhn6pAFunQ582WoCo28sWsTFWFxnjAJlXw
```

**Important:** For production, generate a new secure master key and store it securely.

### 2. Restart MeiliSearch with the key

The `docker-compose.yml` has been updated to use the master key. Restart the container:

```bash
docker-compose restart meilisearch
```

Or if starting fresh:

```bash
docker-compose down
docker-compose up -d
```

### 3. Verify Connection

The backend will automatically connect to MeiliSearch on startup. Check the logs:

```bash
cd backend/api
npm run dev
```

You should see: `MeiliSearch connected` and `MeiliSearch posts index configured`

---

## Quick Setup Commands

```bash
# 1. Reset database (if okay to lose dev data)
cd backend/api
npx prisma migrate reset

# 2. Add MeiliSearch key to .env (see above)

# 3. Restart MeiliSearch
cd ../..
docker-compose restart meilisearch

# 4. Start backend (will connect to MeiliSearch)
cd backend/api
npm run dev
```

