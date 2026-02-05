# Node-Social Code Review

**Date:** 2026-02-05
**Scope:** Full-stack review (backend API + frontend app)
**Severity Key:** CRITICAL | HIGH | MEDIUM | LOW | INFO

---

## Executive Summary

Node-Social is a well-structured full-stack social platform with solid architectural decisions: Fastify + Prisma backend, React Native/Expo frontend, proper token rotation, Argon2id hashing, and CSRF protection. However, there are several security vulnerabilities, bugs, and best-practice gaps that should be addressed before production deployment.

**Critical issues:** 5
**High issues:** 8
**Medium issues:** 10
**Low/Info issues:** 9

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

1. **Fix the SSRF vulnerability** in the metadata endpoint immediately
2. **Fail-fast on missing secrets** in production (JWT_SECRET, COOKIE_SECRET)
3. **Hash reset/verification tokens** before database storage
4. **Add authorization to moderation endpoints** (role-based access)
5. **Fix the password reset token revocation** to include database records
6. **Replace `KEYS` with `SCAN`** or a per-user token set in Redis
7. **Stop exposing emails** in post/comment responses; use usernames
8. **Add pagination to reactions queries**
9. **Validate Apple nonce** properly for replay protection
10. **Add graceful shutdown** handlers for production readiness
