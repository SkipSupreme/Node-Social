# Node-Social Code Review

**Date:** 2026-02-05
**Scope:** Full-stack review (backend API + frontend app)
**Severity Key:** CRITICAL | HIGH | MEDIUM | LOW | INFO

---

## Executive Summary

Node-Social is a well-structured full-stack social platform with solid architectural decisions: Fastify + Prisma backend, React Native/Expo frontend, proper token rotation, Argon2id hashing, and CSRF protection. However, there are several security vulnerabilities, bugs, and best-practice gaps that should be addressed before production deployment.

**Critical issues:** 9
**High issues:** 14
**Medium issues:** 17
**Low/Info issues:** 12

---

## CRITICAL Issues

### 1. Server-Side Request Forgery (SSRF) in Metadata Endpoint
**File:** `backend/api/src/routes/metadata.ts:34`

The `/metadata/preview` endpoint fetches any user-supplied URL without restriction. An attacker can use this to scan internal networks, access cloud metadata endpoints (e.g., `http://169.254.169.254/`), or hit internal services.

```typescript
// Current: No URL validation
const response = await fetch(url, { ... });
```

**Fix:** Validate URLs against an allowlist of protocols (http/https only), block private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x), and set a response size limit and timeout.

---

### 2. Hardcoded Default Secrets
**File:** `backend/api/src/index.ts:53,78`

```typescript
secret: process.env.COOKIE_SECRET || 'dev-cookie-secret',  // line 53
secret: process.env.JWT_SECRET || 'dev-secret-change-me',   // line 78
```

If environment variables are not set (common in misconfigured deployments), the app silently falls back to known, hardcoded secrets. This means JWTs and signed cookies can be forged by anyone. The app should **refuse to start** in production without these secrets.

---

### 3. Hardcoded Credentials in docker-compose.yml
**File:** `docker-compose.yml:8,28`

```yaml
POSTGRES_PASSWORD: nodesocialpwd
MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY:-pzhJlt_oRqhn6pAFunQ582WoCo28sWsTFWFxnjAJlXw}
```

The Postgres password is hardcoded with no env-var fallback, and the MeiliSearch master key has a default that will be used if the variable isn't set. These should always come from environment variables or a secrets manager.

---

### 4. Password Reset Token Stored in Plaintext
**File:** `backend/api/src/routes/auth.ts:935-942`

```typescript
const resetToken = randomBytes(32).toString('hex');
// ...
await fastify.prisma.user.update({
  where: { id: user.id },
  data: { resetToken, resetTokenExpires },  // Stored as plain hex
});
```

Refresh tokens are properly hashed with SHA-256 before storage (line 136), but password reset tokens and email verification tokens are stored in plaintext. If the database is compromised, an attacker can use these tokens directly. Apply the same `hashToken()` pattern used for refresh tokens.

---

### 5. Moderation Endpoint Has No Authorization Check
**File:** `backend/api/src/routes/moderation.ts:51-96`

```typescript
// POST /moderation/actions - any authenticated user can execute mod actions
fastify.post('/moderation/actions', {
  onRequest: [fastify.authenticate],  // Only checks auth, not role
}, async (request, reply) => {
  // TODO: Check moderator permissions  <-- This TODO is dangerous
```

Any authenticated user can create moderation actions (delete, hide, warn, ban). While it only logs the action currently, this pattern is dangerous if actual enforcement is added later without the authorization check being remembered.

---

## HIGH Issues

### 6. Race Condition in Vibe Reaction Uniqueness
**File:** `backend/api/src/services/vibeService.ts:76-82`

```typescript
const existingReaction = await prisma.vibeReaction.findFirst({ ... });
// Time gap between check and create - race condition window
if (existingReaction) {
  reaction = await prisma.vibeReaction.update({ ... });
} else {
  reaction = await prisma.vibeReaction.create({ ... });
}
```

The check-then-insert pattern without a transaction or unique constraint allows duplicate reactions if two requests arrive simultaneously. Use a Prisma transaction with `$transaction()` or add a database-level unique index on `(userId, postId, nodeId)`.

---

### 7. Redis `KEYS` Command Used in Production Code
**File:** `backend/api/src/routes/auth.ts:891,1016`

```typescript
const keys = await fastify.redis.keys(`refresh:${userId}:*`);
```

`KEYS` scans the entire Redis keyspace and blocks the server. In production with many users, this will cause latency spikes. Use `SCAN` with an iterator pattern instead, or better yet, store a Redis SET of refresh token keys per user.

---

### 8. No `return` After Sending Error in Authenticate Decorator
**File:** `backend/api/src/index.ts:88-104`

```typescript
app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) {
      try {
        await request.jwtVerify({ token: cookieToken });
        return;  // Only returns on cookie success
      } catch (cookieErr) { ... }
    }
    reply.status(401).send({ error: 'Unauthorized' });
    // BUG: No return here - route handler continues executing
  }
});
```

When authentication fails, the reply is sent but the function doesn't `return`. Fastify may continue to the route handler. Add `return reply.status(401).send(...)`.

---

### 9. Nonce Validation Not Implemented for Apple Sign-In
**File:** `backend/api/src/routes/auth.ts:577-583`

```typescript
if (clientNonce && payload.nonce) {
  // For now, we accept if nonce is present in token
  fastify.log.debug({ clientNonce, tokenNonce: payload.nonce }, 'Nonce validation');
}
```

The nonce is logged but never actually validated. This leaves the Apple Sign-In flow vulnerable to replay attacks. The server should verify that the hashed client nonce matches the token nonce.

---

### 10. Refresh Token Returned in Response Body
**File:** `backend/api/src/routes/auth.ts:261-266`

```typescript
return reply.send({
  user,
  token: accessToken,
  refreshToken,  // Leaked in body, also set in httpOnly cookie
});
```

The refresh token is sent both as an httpOnly cookie (correct) AND in the response body (problematic for web). On web, the response body is accessible to JavaScript, which defeats the purpose of httpOnly cookies. The body should only include the refresh token for native mobile clients.

---

### 11. `console.error` Used Instead of Logger
**File:** `backend/api/src/services/vibeService.ts:134,298`

```typescript
console.error(`Failed to update metrics for post ${postId}:`, err);
```

Using `console.error` bypasses the Pino logger configured in Fastify. These errors won't appear in structured logs and won't include request context. Use `fastify.log.error()` consistently (a reference to the Fastify instance would need to be passed or the service restructured).

---

### 12. Username Not URL-Encoded in Query Parameter
**File:** `app/src/lib/api.ts:231`

```typescript
return request<{ available: boolean }>(`/auth/check-username?username=${username}`, ...);
```

The username is interpolated directly into the URL without encoding. If a username contains special characters (though unlikely given the regex validation), it could break the URL. Use `encodeURIComponent(username)`.

---

### 13. MeiliSearch Filter Injection
**File:** `backend/api/src/routes/search.ts:33-34`

```typescript
if (nodeId) filters.push(`nodeId = "${nodeId}"`);
if (authorId) filters.push(`authorId = "${authorId}"`);
```

While Zod validates these as UUIDs, the pattern of string-interpolating user input into filter queries is fragile. If validation were ever relaxed or another filter added without UUID validation, this becomes injectable.

---

## MEDIUM Issues

### 14. No Pagination Limit on Reactions Query
**File:** `backend/api/src/services/vibeService.ts:179-198`

```typescript
const reactions = await prisma.vibeReaction.findMany({
  where: { ... },
  // No `take` limit - returns ALL reactions for a post
});
```

A viral post with thousands of reactions would return an unbounded result set, causing memory pressure and slow responses. Add a `take` limit and pagination.

---

### 15. Email Leakage in API Responses
**File:** `backend/api/src/routes/posts.ts:66-68`, `comments.ts:60-64`

```typescript
author: {
  select: {
    id: true,
    email: true,  // Exposes user emails in feed
  },
},
```

User emails are included in every post and comment response. This is a privacy concern. Use `username` instead, which you already have on the User model.

---

### 16. No Post Update Route
**File:** `backend/api/src/routes/posts.ts`

The route file has create, read, and delete, but no update (PUT) endpoint, despite the schema having `updatedAt` and a `PUT /posts/:id` being a standard expectation. The Prisma schema also defines `updatedAt @updatedAt` on posts, suggesting updates were planned.

---

### 17. Feed Scoring Fetches 3x Posts Without Cursor Handling
**File:** `backend/api/src/routes/posts.ts:205-213`

```typescript
const fetchLimit = Math.min(limit * 3, 100);
// ...
...(cursor ? { cursor: { id: cursor } } : {}),
```

Fetching 3x posts, scoring, sorting, and slicing is a valid MVP approach, but the cursor-based pagination breaks down because the cursor is based on `createdAt` ordering, while the final order is by score. Subsequent pages may contain duplicates or skip posts.

---

### 18. `resend-verification` Leaks Email Existence
**File:** `backend/api/src/routes/auth.ts:1101-1103`

```typescript
if (user.emailVerified) {
  return reply.status(400).send({ error: 'Email already verified' });
}
```

While `forgot-password` correctly doesn't reveal email existence, the `resend-verification` endpoint returns a different response for verified vs. unverified emails, allowing email enumeration.

---

### 19. No Content Sanitization
**Files:** Post and comment creation routes

User-submitted content (post body, comments) is length-validated but not sanitized for XSS. If content is ever rendered as HTML (e.g., in a web view or email digest), stored XSS becomes possible. While React Native auto-escapes, the web version and any future email notifications are at risk.

---

### 20. Email Queue Polling is Inefficient
**File:** `backend/api/src/lib/emailQueue.ts:127-131`

```typescript
queueTimer = setInterval(() => {
  processPendingJobs(fastify).catch(...);
}, PROCESS_INTERVAL_MS);  // Every 5 seconds
```

Polling the database every 5 seconds is wasteful. Consider using Redis pub/sub or PostgreSQL LISTEN/NOTIFY to trigger processing only when new jobs are enqueued.

---

### 21. Redundant Federated Identity Lookup
**File:** `backend/api/src/routes/auth.ts:427-439`

In the Google sign-in flow, if a user is found by email but not by federated identity, the code queries `federatedIdentity.findUnique()` **again** to check for conflicts. This is the same query that was already executed at line 375-387. The result of the first query already tells us whether the Google ID is linked.

---

### 22. No Graceful Shutdown Handler
**File:** `backend/api/src/index.ts:148-156`

```typescript
app.listen({ port, host: '0.0.0.0' }).then(...).catch(...);
```

There are no SIGTERM/SIGINT handlers for graceful shutdown. In containerized environments (Docker, Kubernetes), the process may be killed mid-request. Fastify has `app.close()` for this purpose.

---

### 23. Feed Weights Not Validated to Sum to 100 on Read
**File:** `backend/api/src/lib/feedScoring.ts:76-81`

The feed scoring uses weights directly from the database without verifying they sum to 100. While the PUT endpoint validates this for custom presets, database drift or manual edits could lead to nonsensical scores. Normalize weights at scoring time.

---

## LOW / INFO Issues

### 24. Duplicate `@fastify/cookie` Import
**File:** `backend/api/src/index.ts:7`

```typescript
import cookie from '@fastify/cookie';
import '@fastify/cookie';  // Duplicate side-effect import
```

---

### 25. `any` Types Throughout
**Files:** Multiple backend route files

Heavy use of `any` types (`request.user as { sub: string }`, `where: any`, `as any`) weakens TypeScript's type safety. Consider using Fastify's generic request types and Prisma's generated types.

---

### 26. Inconsistent Error Handling Patterns
Some routes use try/catch with 500 responses, others let Fastify's default error handler catch. Some fire-and-forget operations use `.catch()`, while `console.error` is used in vibeService. Standardize on a single pattern.

---

### 27. No Input Length Limit on `theme` Field
**File:** `backend/api/src/routes/users.ts:44`

```typescript
theme: z.string().optional(),  // No max length
```

Unlike `bio` (max 500) and `avatar` (url validated), the `theme` field accepts any string with no length limit.

---

### 28. Docker Redis Has No Password
**File:** `docker-compose.yml:17-21`

Redis is exposed on port 6379 with no authentication. In production, Redis should require a password and ideally not be exposed on a public port.

---

### 29. Search Results Lose MeiliSearch Ordering
**File:** `backend/api/src/routes/search.ts:90-91`

After fetching post IDs from MeiliSearch (ranked by relevance), the Prisma query re-orders by `createdAt: 'desc'`, discarding the relevance ranking.

---

### 30. `getCookie` Regex Doesn't Escape Cookie Name
**File:** `app/src/lib/cookies.ts:7`

```typescript
const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
```

The cookie name is interpolated into a regex without escaping special characters. If the cookie name contained regex metacharacters, the match would fail or produce unexpected results.

---

### 31. Stale User Cache in Auth Store
**File:** `app/src/store/auth.ts:52-78`

The auth store loads user from local storage, sets it as state, then calls `getMe()` in the background. During the gap, the UI shows stale data (e.g., old email verification status). The `getMe()` call can also silently fail, leaving stale data indefinitely.

---

### 32. Password Reset Doesn't Revoke DB Refresh Tokens
**File:** `backend/api/src/routes/auth.ts:1015-1019`

```typescript
// Revoke all refresh tokens for security
const keys = await fastify.redis.keys(`refresh:${user.id}:*`);
if (keys.length > 0) {
  await fastify.redis.del(...keys);
}
// BUG: Only revokes Redis entries, not the database RefreshToken records
```

After password reset, Redis refresh keys are deleted but the database `RefreshToken` records are NOT revoked. Since the refresh endpoint checks the database (not Redis), existing refresh tokens remain valid after password reset.

---

---

# DEEP DIVE: Additional Findings (Pass 2)

---

## CRITICAL Issues (Continued)

### 33. `/check-username` Endpoint: No Auth, No Rate Limit
**File:** `backend/api/src/routes/auth.ts:126-132`

```typescript
fastify.get('/check-username', async (request, reply) => {
  const { username } = request.query as { username: string };
  if (!username || username.length < 3) return reply.send({ available: false });
  const user = await fastify.prisma.user.findUnique({ where: { username } });
  return reply.send({ available: !user });
});
```

This endpoint is **completely public** (no authentication) with **no rate limiting**. An attacker can:
- Enumerate every valid username on the platform at machine speed
- DoS the database with rapid sequential lookups
- Build a complete user directory for targeted attacks

**Fix:** Add rate limiting (1-2 req/sec per IP) and consider returning a generic response after auth.

---

### 34. Password Validation Is Dangerously Weak
**File:** `backend/api/src/routes/auth.ts:96, 105, 971`

```typescript
password: z.string().min(8),  // Only constraint: 8 characters minimum
```

The password policy is the same across register, login, and reset: just `min(8)`. No uppercase, lowercase, number, or special character requirements. An 8-character lowercase password has only ~2x10^11 possibilities.

Per NIST SP 800-63B, you should at minimum check passwords against known breach databases (e.g., HaveIBeenPwned k-anonymity API) and enforce a minimum of 12+ characters.

---

### 35. `/refresh` Endpoint Has No Rate Limiting
**File:** `backend/api/src/routes/auth.ts:770`

The token refresh endpoint has **no rate limit**. If an attacker obtains a valid refresh token, they can generate unlimited access tokens as fast as the server can respond. While token rotation provides some protection, the window between obtaining a token and its revocation is exploitable.

**Fix:** Add rate limiting (e.g., max 10 per minute per user/IP).

---

### 36. Empty `onSuccessLogin` Callback in App.tsx
**File:** `app/App.tsx:380`

```typescript
<LoginScreen
  onSuccessLogin={() => { }}  // Empty callback - login does nothing!
  goToRegister={() => setCurrentScreen('register')}
/>
```

The login success handler is an empty function. After successful authentication via LoginScreen, nothing happens - the screen transition to the authenticated state appears to rely solely on the Zustand auth store state change, but this empty callback suggests the component's contract expects explicit navigation. This could cause the user to appear stuck on the login screen.

---

### 37. Password Reset Doesn't Revoke Database Refresh Tokens (Expanded)
**File:** `backend/api/src/routes/auth.ts:1015-1019`

This was noted as issue #32, but the deep dive confirms it's **more critical than initially assessed**. The refresh flow at line 786-799 checks the **database** (not Redis) for token validity:

```typescript
// In /refresh handler:
const storedToken = await fastify.prisma.refreshToken.findFirst({
  where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
});
```

Since password reset only clears Redis keys but NOT database records, a stolen refresh token **remains fully valid** after password reset. Compare with the logout handler (line 895-897) which correctly does both:

```typescript
// In /logout - correct:
await fastify.prisma.refreshToken.updateMany({
  where: { userId },
  data: { revoked: true },
});
```

The password reset handler is missing this exact line.

---

## HIGH Issues (Continued)

### 38. No Error Boundary in Frontend
**File:** `app/App.tsx`

The entire application has **no React Error Boundary**. If any component throws during rendering, the entire app crashes with an unrecoverable white screen. This is especially dangerous for a social app where user-generated content could trigger unexpected rendering errors.

**Fix:** Wrap the root component tree in an ErrorBoundary with a fallback UI.

---

### 39. Timing Attack on Email Enumeration
**File:** `backend/api/src/routes/auth.ts:931`

While `forgot-password` returns a generic message ("If that email exists..."), the database lookup timing differs based on whether the email exists. An attacker can measure response times to determine valid emails. The Argon2 hash comparison only happens after the user is found, creating an even larger timing gap.

**Fix:** Always perform a constant-time operation (e.g., a dummy Argon2 hash) even when the user doesn't exist.

---

### 40. Cookie `sameSite` Should Be `strict` Not `lax`
**File:** `backend/api/src/routes/auth.ts:54,63,72`

```typescript
sameSite: 'lax' as const,  // For access, refresh, AND CSRF tokens
```

All three cookies use `sameSite: 'lax'`, which allows cookies to be sent on top-level GET navigations from external sites. For auth tokens, `'strict'` provides better CSRF protection. The CSRF cookie in particular should be `'strict'` since the double-submit pattern is already in place.

---

### 41. CSRF Token Has 7-Day Lifetime
**File:** `backend/api/src/routes/auth.ts:76`

```typescript
maxAge: 7 * 24 * 60 * 60,  // CSRF token valid for 7 days
```

CSRF tokens are typically short-lived (minutes to hours). A 7-day CSRF token significantly expands the attack window. If a CSRF token is leaked, an attacker has a full week to exploit it.

---

### 42. Redis and Database Token State Can Diverge
**File:** `backend/api/src/routes/auth.ts:162,178`

Refresh tokens are stored in BOTH Redis (7-day TTL) and PostgreSQL (database expiration). There's no synchronization mechanism:
- Redis TTL can expire before the database record
- Database revocation doesn't clear Redis entries (except on explicit logout)
- The refresh handler checks the database, making Redis entries informational-only but still consuming memory

---

### 43. Sensitive Tokens Stored in React Component State
**File:** `app/App.tsx:334-335`

```typescript
const [resetToken, setResetToken] = useState<string | null>(null);
const [verifyToken, setVerifyToken] = useState<string | null>(null);
```

Password reset and email verification tokens from deep links are stored in React state, making them:
- Visible in React DevTools
- Persistent in memory for the component's lifetime
- Accessible to any XSS attack that can read React fiber internals
- Never explicitly cleared after use

---

### 44. Deep Link Tokens Not Validated Before Use
**File:** `app/App.tsx:343-348`

```typescript
if (path === 'reset-password' && queryParams?.token) {
  setResetToken(queryParams.token as string);  // No format validation
  setCurrentScreen('reset-password');
}
```

Tokens from deep link URLs are accepted without any format validation (length, character set, etc.). Malformed tokens are passed directly to child screens, potentially causing errors or unexpected behavior.

---

### 45. `algoSettings` State Never Connected to Feed API
**File:** `app/App.tsx:38-41`

```typescript
const [algoSettings, setAlgoSettings] = useState({
  preset: 'balanced',
  weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 }
});
```

The VibeValidator settings panel lets users adjust weights, but these settings are **never sent to the API**. The `getFeed()` call at line 70 doesn't use `algoSettings`. Users will think they're customizing their feed, but nothing actually changes.

---

### 46. Migration Data Loss: Columns Dropped and Re-Added
**File:** `backend/api/prisma/migrations/20251123203126_.../migration.sql`

```sql
-- WARNING: data loss
ALTER TABLE "posts" DROP COLUMN "postType",
DROP COLUMN "title",
DROP COLUMN "visibility",
```

Followed immediately by another migration that re-adds them with defaults:

```sql
ALTER TABLE "posts" ADD COLUMN "postType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN "title" TEXT,
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
```

If these migrations ran against a populated database, all post titles, types, and visibility settings were permanently lost and replaced with defaults.

---

## MEDIUM Issues (Continued)

### 47. `/verify-email` Has No Rate Limiting
**File:** `backend/api/src/routes/auth.ts:1026`

The email verification endpoint has no rate limit. While the 32-byte token has sufficient entropy to resist brute force, the lack of rate limiting allows an attacker to spray verification attempts rapidly, consuming database resources.

---

### 48. `/logout` Has No Rate Limiting
**File:** `backend/api/src/routes/auth.ts:869`

An authenticated user (or attacker with a stolen access token) can spam the logout endpoint, causing excessive database writes and Redis deletions.

---

### 49. `useEffect` Missing Dependencies
**File:** `app/App.tsx:161-164`

```typescript
useEffect(() => {
  fetchNodes();
  fetchFeed();
}, []);  // Missing fetchNodes and fetchFeed in dependency array
```

This causes stale closure warnings and means the functions capture initial values of state variables, not current ones. While it "works" for the initial load pattern, it's a footgun if these functions are ever called conditionally.

---

### 50. Missing `useCallback` on All Handler Functions
**File:** `app/App.tsx:49-159`

Functions like `fetchNodes`, `fetchFeed`, `handleNodeSelect`, `handleSearch` are redefined on every render without `useCallback`. Since they're passed as props to child components (Sidebar, Feed, VibeValidator), every parent re-render forces child re-renders, even when props haven't meaningfully changed.

---

### 51. Soft Delete Not Enforced at Schema Level
**File:** `backend/api/prisma/schema.prisma:66`

The `deletedAt` field enables soft deletion, but enforcement is entirely at the application level. Every query that fetches posts or comments must remember to add `deletedAt: null` to the WHERE clause. A single missed filter exposes "deleted" content.

Consider adding a Prisma middleware that automatically filters soft-deleted records.

---

### 52. VibeReaction Uniqueness Not Enforced at Database Level
**File:** `backend/api/prisma/schema.prisma:308-309`

```
// Note: Unique constraint handled at application level since Prisma
// doesn't support conditional uniques
```

This is related to issue #6 (race condition). The database itself has no constraint preventing duplicate reactions. A partial unique index could be created at the SQL level even if Prisma doesn't natively support it.

---

### 53. No Test Suite
**File:** `backend/api/package.json:9`

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

There are zero tests. For a security-critical application handling authentication, payments of "ConnoisseurCred", and moderation actions, this is a significant gap.

---

### 54. Deep Link Race Condition With Auth Loading
**File:** `app/App.tsx:339-362`

The deep link handler (lines 339-358) and `loadFromStorage()` (lines 360-362) are in separate `useEffect` hooks with empty dependency arrays. They execute concurrently with no synchronization. If a deep link arrives while auth is still loading, the screen may transition to a reset/verify screen before auth state is established, potentially showing the wrong UI.

---

### 55. Required `username` Column Added With cuid() Default
**File:** `backend/api/prisma/schema.prisma:23`

```
username String @unique @default(cuid())
```

The comment says "Default for migration, should be set by user." Any users created before the migration get auto-generated usernames like `clz1a2b3c4d5e6f7`. There's no mechanism to prompt them to choose a real username.

---

## LOW / INFO Issues (Continued)

### 56. `any[]` Types in Frontend State
**File:** `app/App.tsx:34,47`

```typescript
useState<any[]>([])  // Nodes and search results
```

Loses all type safety. Should use the `Node[]` and `Post[]` types already defined in `api.ts`.

---

### 57. `console.log` Left in Auth Store
**File:** `app/src/store/auth.ts:77`

```typescript
console.log('getMe() returned:', { emailVerified: me.user.emailVerified });
```

Debug logging left in production code. This leaks user verification status to the browser/device console.

---

### 58. No Response Size Limit on Metadata Fetch
**File:** `backend/api/src/routes/metadata.ts:44`

```typescript
const html = await response.text();
```

The entire HTML response is loaded into memory with no size limit. A malicious URL could return gigabytes of data, causing an out-of-memory crash. Add a response size check and streaming limit.

---

## Security Summary

| Area | Rating | Notes |
|------|--------|-------|
| Authentication | Good | Argon2id, token rotation, family reuse detection |
| Authorization | Needs Work | Missing role checks on moderation, no ownership verification patterns |
| Input Validation | Good | Consistent Zod usage, but missing sanitization |
| CSRF Protection | Good | Double-submit token pattern implemented |
| Secrets Management | Needs Work | Hardcoded fallbacks, plaintext reset tokens |
| SSRF | Critical | Unrestricted URL fetching in metadata endpoint |
| Data Exposure | Medium | Email leaks in responses, refresh tokens in body |
| Infrastructure | Needs Work | Hardcoded passwords, no Redis auth, no graceful shutdown |

---

## Top Recommendations (Priority Order)

### Tier 1: Fix Before Any Production Deployment
1. **Fix the SSRF vulnerability** in the metadata endpoint - block private IPs, add timeout/size limits
2. **Fail-fast on missing secrets** in production (JWT_SECRET, COOKIE_SECRET) - crash on startup
3. **Fix password reset token revocation** to include database records (not just Redis)
4. **Add authorization to moderation endpoints** - role-based access control
5. **Rate-limit `/check-username`** and `/refresh` - both are currently wide open
6. **Hash reset/verification tokens** before database storage (match refresh token pattern)
7. **Add `return` to authenticate decorator** after 401 response

### Tier 2: Fix Before Public Beta
8. **Strengthen password policy** - minimum 12 chars, check against breach databases
9. **Validate Apple nonce** properly for replay protection
10. **Stop exposing emails** in post/comment responses; use usernames
11. **Fix cookie `sameSite` to `strict`** for auth tokens
12. **Add Error Boundary** to frontend - currently any render error crashes the entire app
13. **Replace Redis `KEYS` with `SCAN`** or per-user token sets
14. **Connect VibeValidator settings to feed API** - users think they're changing settings but nothing happens
15. **Add pagination to reactions queries**

### Tier 3: Before Scaling
16. **Write tests** - zero test coverage on a security-critical app
17. **Add graceful shutdown** handlers (SIGTERM/SIGINT)
18. **Implement Prisma middleware** for soft-delete filtering
19. **Add database-level unique constraints** on VibeReaction
20. **Move email queue** to event-driven (Redis pub/sub or PG LISTEN/NOTIFY)
