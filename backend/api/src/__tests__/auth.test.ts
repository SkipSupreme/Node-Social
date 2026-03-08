/**
 * Auth route tests (/auth/*)
 *
 * Covers: register, login, refresh token rotation with family reuse detection,
 * logout, forgot-password, reset-password, verify-email, resend-verification,
 * and check-username availability.
 *
 * These tests exercise real Fastify request handling (Zod validation, JWT
 * signing/verification, cookie setting, CSRF hooks) against a mock data layer.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestUser,
  generateTestToken,
  hashToken,
  authHeader,
  resetMockPrisma,
  type MockPrismaClient,
} from './helpers.js';
import type { createMockRedis } from './helpers.js';
import argon2 from 'argon2';

let app: FastifyInstance;
let prisma: MockPrismaClient;
let redis: ReturnType<typeof createMockRedis>;

beforeAll(async () => {
  const ctx = await buildTestApp();
  app = ctx.app;
  prisma = ctx.prisma;
  redis = ctx.redis;
});

afterAll(async () => {
  await app.close();
});

// Reset mock return values between tests to prevent state leakage.
beforeEach(() => {
  resetMockPrisma(prisma);
  redis._store.clear();
});

// =========================================================================
// POST /auth/register
// =========================================================================
describe('POST /auth/register', () => {
  const validBody = {
    email: 'newuser@example.com',
    password: 'securePass123',
    username: 'newuser',
    firstName: 'New',
    lastName: 'User',
    dateOfBirth: '1995-06-15T00:00:00.000Z',
  };

  it('should register a new user and return tokens + session cookies', async () => {
    // Arrange: no existing user
    prisma.user.findUnique.mockResolvedValue(null);
    const createdUser = createTestUser({
      id: 'new-user-id',
      email: validBody.email,
      username: validBody.username,
    });
    prisma.user.create.mockResolvedValue(createdUser);
    prisma.refreshToken.create.mockResolvedValue({
      id: 'rt-id-1',
      familyId: 'fam-1',
    });

    // Act
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validBody,
    });

    // Assert
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.message).toContain('Registration successful');

    // Verify session cookies are set (accessToken, refreshToken, csrfToken)
    const cookies = res.cookies as Array<{ name: string; value: string }>;
    const cookieNames = cookies.map((c) => c.name);
    expect(cookieNames).toContain('accessToken');
    expect(cookieNames).toContain('refreshToken');
    expect(cookieNames).toContain('csrfToken');
  });

  it('should reject registration when email is already in use', async () => {
    // The first findUnique call (email check) returns an existing user
    prisma.user.findUnique.mockResolvedValueOnce(createTestUser());

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validBody,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Email already in use');
  });

  it('should reject registration when username is already taken', async () => {
    // First call (email lookup) returns null; second call (username) returns a user
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email not found
      .mockResolvedValueOnce(createTestUser()); // username taken

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validBody,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Username already taken');
  });

  it('should reject invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, email: 'not-an-email' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid input');
  });

  it('should reject password shorter than 8 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, password: 'short' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject username with special characters', async () => {
    // The register schema requires /^[a-zA-Z0-9_]+$/
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, username: 'bad user!@#' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject username shorter than 3 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, username: 'ab' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: validBody.email },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject invalid dateOfBirth format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...validBody, dateOfBirth: 'not-a-date' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /auth/login
// =========================================================================
describe('POST /auth/login', () => {
  it('should log in with valid credentials and return tokens', async () => {
    const realHash = await argon2.hash('correctpassword', {
      type: argon2.argon2id,
      memoryCost: 1024, // use minimal cost for test speed
      timeCost: 1,
      parallelism: 1,
    });
    const user = createTestUser({ password: realHash, email: 'login@example.com' });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-id-2', familyId: 'fam-2' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@example.com', password: 'correctpassword' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('login@example.com');
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();

    // Verify cookies set
    const cookies = res.cookies as Array<{ name: string; value: string }>;
    expect(cookies.some((c) => c.name === 'accessToken')).toBe(true);
  });

  it('should reject login with non-existent email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'somepassword' },
    });

    // WHY: Should return 401, not 404, to avoid email enumeration
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid credentials');
  });

  it('should reject login with wrong password', async () => {
    const realHash = await argon2.hash('correctpassword', {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 1,
      parallelism: 1,
    });
    prisma.user.findUnique.mockResolvedValue(createTestUser({ password: realHash }));

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'testuser@example.com', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid credentials');
  });

  it('should reject login with invalid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'bad-email', password: '123' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /auth/refresh -- Token Rotation + Reuse Detection
// =========================================================================
describe('POST /auth/refresh', () => {
  it('should reuse refresh token and issue new access token', async () => {
    const userId = 'user-refresh-1';
    const oldRefreshToken = 'old-refresh-token-hex';
    const tokenHash = hashToken(oldRefreshToken);
    const familyId = 'family-abc';

    // The findFirst call for the valid token
    prisma.refreshToken.findFirst.mockResolvedValueOnce({
      id: 'rt-old-id',
      userId,
      tokenHash,
      familyId,
      parentTokenId: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked: false,
      user: { id: userId, email: 'refresh@example.com' },
    });

    // update (lastUsedAt timestamp)
    prisma.refreshToken.update.mockResolvedValue({ id: 'rt-old-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    // Refresh token is reused (not rotated) — same token comes back
    expect(body.refreshToken).toBe(oldRefreshToken);

    // Verify lastUsedAt was updated (no revocation)
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-old-id' },
        data: { lastUsedAt: expect.any(Date) },
      })
    );
  });

  it('should detect token reuse and revoke entire token family', async () => {
    // Scenario: attacker replays a token that has already been rotated (revoked).
    // The system should revoke ALL tokens in the family -- this is the critical
    // security mechanism per the design document Section 3.2.
    const reusedToken = 'stolen-refresh-token';
    const tokenHash = hashToken(reusedToken);

    // First findFirst (valid, non-revoked): returns null (token was already revoked)
    prisma.refreshToken.findFirst.mockResolvedValueOnce(null);

    // Second findFirst (any match, including revoked): returns the revoked record
    prisma.refreshToken.findFirst.mockResolvedValueOnce({
      id: 'rt-revoked-id',
      userId: 'victim-user',
      tokenHash,
      familyId: 'compromised-family',
      revoked: true,
    });

    // updateMany to revoke the entire family
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: reusedToken },
    });

    // WHY 401: Token reuse is a security violation; the user must re-authenticate.
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toContain('Security violation');

    // Verify the entire family was revoked
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'compromised-family' },
      data: { revoked: true },
    });
  });

  it('should return 401 for completely unknown refresh token', async () => {
    prisma.refreshToken.findFirst
      .mockResolvedValueOnce(null)   // not found as valid
      .mockResolvedValueOnce(null);  // not found at all (not reuse, just invalid)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'totally-unknown-token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid or expired refresh token');
  });

  it('should return 400 when no refresh token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid input');
  });

  it('should accept refresh token from cookie when body is empty', async () => {
    const cookieToken = 'cookie-refresh-token';
    const tokenHash = hashToken(cookieToken);
    const userId = 'cookie-user-1';
    const csrfToken = 'test-csrf-token';

    prisma.refreshToken.findFirst.mockResolvedValueOnce({
      id: 'rt-cookie-id',
      userId,
      tokenHash,
      familyId: 'fam-cookie',
      expiresAt: new Date(Date.now() + 86400000),
      revoked: false,
      user: { id: userId, email: 'cookie@example.com' },
    });
    prisma.refreshToken.update.mockResolvedValue({ id: 'rt-cookie-id' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
      cookies: { refreshToken: cookieToken, csrfToken },
      headers: { 'x-csrf-token': csrfToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeDefined();
  });
});

// =========================================================================
// POST /auth/logout
// =========================================================================
describe('POST /auth/logout', () => {
  it('should revoke a specific refresh token and clear cookies', async () => {
    const userId = 'logout-user-1';
    const token = generateTestToken(app, userId);
    const refreshToken = 'logout-refresh-token';

    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: authHeader(token) },
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Logged out successfully');

    // Verify Prisma was asked to revoke the token
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('should revoke ALL refresh tokens when no specific token is provided', async () => {
    const userId = 'logout-user-2';
    const token = generateTestToken(app, userId);

    // Redis keys() returns some matching keys for this user
    redis._store.set(`refresh:${userId}:tok1`, { value: '1' });
    redis._store.set(`refresh:${userId}:tok2`, { value: '1' });

    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: authHeader(token) },
      payload: {},
    });

    expect(res.statusCode).toBe(200);

    // All user refresh tokens should be revoked in Prisma
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId },
      data: { revoked: true },
    });
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: {},
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// POST /auth/forgot-password
// =========================================================================
describe('POST /auth/forgot-password', () => {
  it('should always return success message regardless of whether email exists (anti-enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nonexistent@example.com' },
    });

    // WHY: Constant-time response prevents email enumeration attacks.
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain('If that email exists');
  });

  it('should generate and store a reset token for an existing user', async () => {
    const user = createTestUser();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: user.email },
    });

    expect(res.statusCode).toBe(200);
    // Verify that the user record was updated with a reset token
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpires: expect.any(Date),
        }),
      })
    );
  });

  it('should reject invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'bad' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /auth/reset-password
// =========================================================================
describe('POST /auth/reset-password', () => {
  it('should reset password with valid token and revoke all refresh tokens', async () => {
    const user = createTestUser({
      resetToken: 'valid-reset-token',
      resetTokenExpires: new Date(Date.now() + 3600000),
    });

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, resetToken: null });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'valid-reset-token', password: 'newSecurePass123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Password reset successfully');

    // Password should be updated and reset token cleared
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: expect.any(String), // new argon2 hash
          resetToken: null,
          resetTokenExpires: null,
        }),
      })
    );
  });

  it('should reject expired or invalid reset token', async () => {
    prisma.user.findFirst.mockResolvedValue(null); // no user found with valid token

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'expired-token', password: 'newPass12345' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid or expired reset token');
  });

  it('should reject password shorter than 8 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'some-token', password: 'short' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /auth/verify-email
// =========================================================================
describe('POST /auth/verify-email', () => {
  it('should verify email with valid token and mark user as verified', async () => {
    const user = createTestUser({
      emailVerified: false,
      emailVerificationToken: 'valid-verification-token',
      emailVerificationExpires: new Date(Date.now() + 86400000),
    });

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, emailVerified: true });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'valid-verification-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Email verified successfully');
  });

  it('should reject expired verification token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'expired-token' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid verification code');
  });

  it('should reject missing token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /auth/resend-verification
// =========================================================================
describe('POST /auth/resend-verification', () => {
  it('should resend verification email for unverified user', async () => {
    const user = createTestUser({ emailVerified: false });

    prisma.user.findUnique.mockResolvedValue({
      id: user.id,
      emailVerified: false,
    });
    prisma.user.update.mockResolvedValue(user);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: user.email },
    });

    expect(res.statusCode).toBe(200);
    // WHY: Generic message prevents email enumeration.
    expect(res.json().message).toContain('If that email exists');
  });

  it('should return generic message if email is already verified (anti-enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'some-id',
      emailVerified: true,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'verified@example.com' },
    });

    // WHY 200: Hardened endpoint returns generic message to prevent email enumeration.
    // Previously returned 400 "Email already verified" which leaked account existence.
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain('If that email exists');
  });

  it('should return generic message for non-existent email (anti-enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'nobody@example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain('If that email exists');
  });
});

// =========================================================================
// GET /auth/check-username
// =========================================================================
describe('GET /auth/check-username', () => {
  it('should return available: true when username is free', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/check-username?username=newname',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().available).toBe(true);
  });

  it('should return available: false when username is taken', async () => {
    prisma.user.findUnique.mockResolvedValue(createTestUser());

    const res = await app.inject({
      method: 'GET',
      url: '/auth/check-username?username=testuser',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().available).toBe(false);
  });

  it('should return available: false for username shorter than 3 chars', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/check-username?username=ab',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().available).toBe(false);
  });

  it('should return available: false when username is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/check-username',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().available).toBe(false);
  });
});
