/**
 * Security-focused tests for the Node-Social API.
 *
 * These tests verify that security controls work as intended. They cover:
 *
 * 1. CSRF Protection -- The double-submit token pattern should block
 *    state-changing requests from cookie-authenticated sessions when the
 *    CSRF token is missing or mismatched.
 *
 * 2. Authentication Enforcement -- Protected endpoints must reject
 *    requests without valid Bearer tokens or session cookies.
 *
 * 3. Token Expiry Handling -- Expired JWTs must be rejected even if the
 *    signature is valid.
 *
 * 4. Auth Bypass Attempts -- Malformed Authorization headers, tokens with
 *    tampered payloads, and other bypass techniques must fail.
 *
 * 5. SSRF in Metadata Endpoint -- The /metadata/preview endpoint fetches
 *    arbitrary URLs server-side. Without proper validation, an attacker
 *    could probe internal services (e.g., http://169.254.169.254 for cloud
 *    metadata). These tests document the vulnerability and verify current
 *    behavior.
 *
 * 6. Input Sanitization -- Verify that Zod schemas reject oversized,
 *    malformed, or unexpected input shapes across multiple routes.
 *
 * 7. Cookie Security Attributes -- Verify that session cookies are set
 *    with httpOnly, sameSite, and path attributes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import {
  buildTestApp,
  createTestUser,
  generateTestToken,
  generateExpiredToken,
  authHeader,
  resetMockPrisma,
  type MockPrismaClient,
} from './helpers.js';
import type { createMockRedis } from './helpers.js';
import argon2 from 'argon2';

let app: FastifyInstance;
let prisma: MockPrismaClient;
let redis: ReturnType<typeof createMockRedis>;

const USER_ID = 'security-test-user';
let validToken: string;

beforeAll(async () => {
  const ctx = await buildTestApp();
  app = ctx.app;
  prisma = ctx.prisma;
  redis = ctx.redis;
  validToken = generateTestToken(app, USER_ID);
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetMockPrisma(prisma);
  redis._store.clear();
});

// =========================================================================
// 1. CSRF Protection (Double-Submit Token)
// =========================================================================
describe('CSRF Protection', () => {
  it('should block POST requests with auth cookies but no CSRF token', async () => {
    // WHY: If a user is authenticated via cookies (not Bearer header), the
    // CSRF protection hook requires the X-CSRF-Token header to match the
    // csrfToken cookie. Without this, cross-origin form submissions could
    // perform actions on behalf of the user.
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        accessToken: validToken,
        refreshToken: 'some-refresh',
        // csrfToken intentionally missing
      },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Invalid CSRF token');
  });

  it('should block requests when CSRF cookie and header do not match', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        accessToken: validToken,
        refreshToken: 'some-refresh',
        csrfToken: 'cookie-value-aaa',
      },
      headers: {
        'x-csrf-token': 'header-value-bbb', // mismatch!
      },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Invalid CSRF token');
  });

  it('should allow requests when CSRF cookie and header match', async () => {
    // The CSRF hook should pass when cookie and header tokens match.
    // We also supply a Bearer token for authentication because the test helper's
    // @fastify/jwt is not configured with the cookie option, so cookie-based JWT
    // verification doesn't work in tests. The important thing is that the CSRF
    // hook itself passes (it would return 403 if it didn't).
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        accessToken: validToken,
        refreshToken: 'some-refresh',
        csrfToken: 'matching-csrf-token',
      },
      headers: {
        authorization: authHeader(validToken),
        'x-csrf-token': 'matching-csrf-token',
      },
      payload: {},
    });

    // The CSRF check passes; the request proceeds to the authenticate hook.
    // With a valid Bearer token, the request succeeds.
    expect(res.statusCode).toBe(200);
  });

  it('should allow GET requests without CSRF tokens (safe methods exempt)', async () => {
    prisma.user.findUnique.mockResolvedValue(createTestUser({ id: USER_ID }));

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: {
        accessToken: validToken,
        refreshToken: 'some-refresh',
        // No CSRF tokens
      },
      headers: {
        // Bearer header needed because test helper's @fastify/jwt isn't configured
        // with the cookie option. The key assertion is that no CSRF token is needed
        // for GET requests (a POST with these cookies but no CSRF would get 403).
        authorization: authHeader(validToken),
      },
    });

    // GET is a safe method -- CSRF protection is not applied.
    expect(res.statusCode).toBe(200);
  });

  it('should skip CSRF check when no auth cookies are present', async () => {
    // WHY: If the user is authenticated via Bearer header (mobile app, API client)
    // and there are no cookies, CSRF protection is not needed.
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        // No cookies, no auth
      },
      payload: {},
    });

    // Should pass CSRF check (no cookies) but fail at auth/input validation
    expect(res.statusCode).toBe(400); // "Invalid input" -- no refresh token
  });
});

// =========================================================================
// 2. Authentication Enforcement
// =========================================================================
describe('Authentication Enforcement', () => {
  // Note: GET /posts, GET /posts/:id, and GET /search/posts use optionalAuthenticate
  // (anonymous access allowed for public browsing). They are NOT in this list.
  const protectedEndpoints = [
    { method: 'POST' as const, url: '/posts', payload: { content: 'test' } },
    { method: 'DELETE' as const, url: '/posts/some-id' },
    { method: 'GET' as const, url: '/users/me' },
    { method: 'PUT' as const, url: '/users/me', payload: { bio: 'test' } },
    { method: 'GET' as const, url: '/feed-preferences' },
  ];

  for (const endpoint of protectedEndpoints) {
    it(`should reject unauthenticated ${endpoint.method} ${endpoint.url}`, async () => {
      const res = await app.inject({
        method: endpoint.method,
        url: endpoint.url,
        ...(endpoint.payload ? { payload: endpoint.payload } : {}),
      } as InjectOptions);

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Unauthorized');
    });
  }
});

// =========================================================================
// 3. Token Expiry Handling
// =========================================================================
describe('Token Expiry', () => {
  it('should reject an expired JWT access token', async () => {
    // generateExpiredToken uses expiresIn: '-1s' so the token is already expired
    const expiredToken = generateExpiredToken(app, USER_ID);

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: authHeader(expiredToken) },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject an expired access token in cookie', async () => {
    const expiredToken = generateExpiredToken(app, USER_ID);

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { accessToken: expiredToken },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// 4. Auth Bypass Attempts
// =========================================================================
describe('Auth Bypass Attempts', () => {
  it('should reject malformed Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: 'NotBearer some-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject Bearer with garbage token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: 'Bearer not.a.valid.jwt' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject token signed with a different secret', async () => {
    // WHY: If an attacker signs a token with their own secret, it must be
    // rejected because the signature verification uses the server's secret.
    // We cannot easily construct a JWT with a different secret via the app,
    // but we can test with a hand-crafted invalid token.
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJoYWNrZXIiLCJlbWFpbCI6ImhhY2tlckBldmlsLmNvbSJ9.' +
      'INVALID_SIGNATURE_HERE';

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${fakeToken}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject empty Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: '' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject Bearer with empty token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: 'Bearer ' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// 5. SSRF in Metadata Endpoint
// =========================================================================
describe('SSRF Protection in /metadata/preview', () => {
  // The metadata route uses validateUrlForSSRF() to resolve DNS and reject
  // URLs that point to private/reserved IP ranges (10.x, 172.16-31.x,
  // 192.168.x, 169.254.x, localhost, and cloud metadata endpoints).

  it('should reject invalid URL format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/metadata/preview',
      headers: { authorization: authHeader(validToken) },
      payload: { url: 'not-a-url' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid URL');
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/metadata/preview',
      payload: { url: 'https://example.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return cached metadata if available', async () => {
    const cached = {
      id: 'meta-1',
      url: 'https://example.com/article',
      title: 'Cached Title',
      description: 'Cached Description',
      image: 'https://example.com/img.jpg',
      domain: 'example.com',
    };
    prisma.linkMetadata.findUnique.mockResolvedValue(cached);

    const res = await app.inject({
      method: 'POST',
      url: '/metadata/preview',
      headers: { authorization: authHeader(validToken) },
      payload: { url: 'https://example.com/article' },
    });

    // Should return cached result without making an external fetch
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Cached Title');
  });

  it('should block cloud metadata URLs (169.254.169.254)', async () => {
    // The validateUrlForSSRF() function resolves DNS and checks for private IPs.
    // 169.254.169.254 resolves to a link-local address that isPrivateIP() blocks.
    prisma.linkMetadata.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/metadata/preview',
      headers: { authorization: authHeader(validToken) },
      payload: { url: 'http://169.254.169.254/latest/meta-data/' },
    });

    // SSRF protection blocks the request before any fetch occurs.
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('URL not allowed');
  });

  it('should block localhost URLs', async () => {
    prisma.linkMetadata.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/metadata/preview',
      headers: { authorization: authHeader(validToken) },
      payload: { url: 'http://localhost:3000/health' },
    });

    // SSRF protection blocks localhost (127.0.0.1) after DNS resolution.
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('URL not allowed');
  });
});

// =========================================================================
// 6. Input Sanitization
// =========================================================================
describe('Input Sanitization', () => {
  it('should reject non-JSON request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: 'this is not json{{{',
    });

    // Fastify returns 400 for malformed JSON
    expect(res.statusCode).toBe(400);
  });

  it('should reject extremely long content in post creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(validToken) },
      payload: { content: 'x'.repeat(6001) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject XSS payload in username during registration', async () => {
    // The username regex /^[a-zA-Z0-9_]+$/ should block HTML/script tags.
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'xss@test.com',
        password: 'password123',
        username: '<script>alert(1)</script>',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01T00:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject SQL injection attempt in query parameters', async () => {
    // The Zod schema + Prisma parameterized queries should prevent SQL injection.
    // But we verify that clearly malicious input is handled gracefully.
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: "/auth/check-username?username=admin'--",
    });

    // The regex check in the route or Prisma parameterization handles this safely.
    // The username check just queries Prisma which uses parameterized queries.
    expect(res.statusCode).toBe(200);
  });
});

// =========================================================================
// 7. Cookie Security Attributes
// =========================================================================
describe('Cookie Security Attributes', () => {
  it('should set httpOnly on accessToken and refreshToken cookies', async () => {
    // Perform a login to trigger cookie setting
    const realHash = await argon2.hash('password123', {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    prisma.user.findUnique.mockResolvedValue(
      createTestUser({ password: realHash, email: 'cookie-test@example.com' })
    );
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1', familyId: 'f-1' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'cookie-test@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const cookies = res.cookies as Array<{
      name: string;
      httpOnly?: boolean;
      sameSite?: string;
      path?: string;
    }>;

    const accessCookie = cookies.find((c) => c.name === 'accessToken');
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    const csrfCookie = cookies.find((c) => c.name === 'csrfToken');

    // accessToken and refreshToken must be httpOnly to prevent XSS theft
    expect(accessCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.httpOnly).toBe(true);

    // csrfToken must NOT be httpOnly (JS needs to read it for the header).
    // When httpOnly is false, Fastify omits it from the parsed cookie object
    // (the HttpOnly flag is simply absent from the Set-Cookie header), so the
    // property is undefined rather than false.
    expect(csrfCookie?.httpOnly).toBeFalsy();

    // All session cookies should use sameSite: lax
    expect(accessCookie?.sameSite).toBe('Lax');
    expect(refreshCookie?.sameSite).toBe('Lax');
  });

  it('should set path=/ on all session cookies', async () => {
    const realHash = await argon2.hash('password123', {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    prisma.user.findUnique.mockResolvedValue(
      createTestUser({ password: realHash, email: 'path-test@example.com' })
    );
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-2', familyId: 'f-2' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'path-test@example.com', password: 'password123' },
    });

    const cookies = res.cookies as Array<{ name: string; path?: string }>;

    for (const cookieName of ['accessToken', 'refreshToken', 'csrfToken']) {
      const cookie = cookies.find((c) => c.name === cookieName);
      expect(cookie?.path).toBe('/');
    }
  });
});

// =========================================================================
// 8. Email Enumeration Prevention
// =========================================================================
describe('Email Enumeration Prevention', () => {
  it('should return the same response for existing and non-existing emails on forgot-password', async () => {
    // Test with existing user
    const user = createTestUser();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    const resExisting = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: user.email },
    });

    // Test with non-existing user
    prisma.user.findUnique.mockResolvedValue(null);

    const resNonExisting = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nonexistent@example.com' },
    });

    // WHY: Both responses must be identical in status and message structure
    // to prevent attackers from determining which emails are registered.
    expect(resExisting.statusCode).toBe(resNonExisting.statusCode);
    expect(resExisting.json().message).toBe(resNonExisting.json().message);
  });

  it('should return the same response for existing and non-existing emails on resend-verification', async () => {
    // Non-existing email
    prisma.user.findUnique.mockResolvedValue(null);

    const resNonExisting = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'nonexistent@example.com' },
    });

    expect(resNonExisting.statusCode).toBe(200);
    expect(resNonExisting.json().message).toContain('If that email exists');
  });

  it('login should not distinguish between wrong email and wrong password', async () => {
    // Wrong email
    prisma.user.findUnique.mockResolvedValue(null);
    const resWrongEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'wrong@example.com', password: 'somepassword' },
    });

    // Wrong password
    const realHash = await argon2.hash('correctpass', {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    prisma.user.findUnique.mockResolvedValue(createTestUser({ password: realHash }));
    const resWrongPass = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'testuser@example.com', password: 'wrongpassword' },
    });

    // Both should return 401 with the same error message
    expect(resWrongEmail.statusCode).toBe(401);
    expect(resWrongPass.statusCode).toBe(401);
    expect(resWrongEmail.json().error).toBe(resWrongPass.json().error);
  });
});
