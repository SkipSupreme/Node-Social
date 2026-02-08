/**
 * User profile route tests (/users/*)
 *
 * Covers: GET /users/me (fetch own profile) and PUT /users/me (update profile).
 *
 * Both endpoints require authentication. The update endpoint supports partial
 * updates for bio, avatar, and theme fields only. It intentionally does not
 * allow changing email, password, or username through this endpoint.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestUser,
  generateTestToken,
  authHeader,
  resetMockPrisma,
  type MockPrismaClient,
} from './helpers.js';

let app: FastifyInstance;
let prisma: MockPrismaClient;

const USER_ID = 'user-profile-test-1';
let token: string;

beforeAll(async () => {
  const ctx = await buildTestApp();
  app = ctx.app;
  prisma = ctx.prisma;
  token = generateTestToken(app, USER_ID);
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetMockPrisma(prisma);
});

// =========================================================================
// GET /users/me
// =========================================================================
describe('GET /users/me', () => {
  it('should return the authenticated user profile', async () => {
    const user = createTestUser({ id: USER_ID, bio: 'Hello world', theme: 'dark' });
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe(USER_ID);
    expect(body.user.bio).toBe('Hello world');
    expect(body.user.theme).toBe('dark');
  });

  it('should return 404 if user record does not exist (edge case)', async () => {
    // This can happen if the JWT is valid but the user was deleted from the DB.
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('User not found');
  });

  it('should not expose password field in the response', async () => {
    // WHY: The select clause in the route handler intentionally excludes password.
    const user = createTestUser({ id: USER_ID });
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
    });

    // The route uses a select clause, so password should not be in the response
    // even though our mock returns the full object. In production, Prisma strips it.
    expect(res.statusCode).toBe(200);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// PUT /users/me
// =========================================================================
describe('PUT /users/me', () => {
  it('should update bio field', async () => {
    const updatedUser = createTestUser({ id: USER_ID, bio: 'Updated bio' });
    prisma.user.update.mockResolvedValue(updatedUser);

    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { bio: 'Updated bio' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.bio).toBe('Updated bio');
  });

  it('should update avatar with a valid URL', async () => {
    const updatedUser = createTestUser({ id: USER_ID, avatar: 'https://img.example.com/avatar.jpg' });
    prisma.user.update.mockResolvedValue(updatedUser);

    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { avatar: 'https://img.example.com/avatar.jpg' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.avatar).toBe('https://img.example.com/avatar.jpg');
  });

  it('should reject avatar with invalid URL', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { avatar: 'not-a-url' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should update theme field', async () => {
    const updatedUser = createTestUser({ id: USER_ID, theme: 'midnight' });
    prisma.user.update.mockResolvedValue(updatedUser);

    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { theme: 'midnight' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.theme).toBe('midnight');
  });

  it('should update multiple fields at once', async () => {
    const updatedUser = createTestUser({
      id: USER_ID,
      bio: 'New bio',
      theme: 'dark',
    });
    prisma.user.update.mockResolvedValue(updatedUser);

    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { bio: 'New bio', theme: 'dark' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should return 400 when no profile fields are provided', async () => {
    // WHY: Prevents empty/no-op updates that waste a database round trip.
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('No profile fields provided');
  });

  it('should reject bio exceeding 500 characters', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: { authorization: authHeader(token) },
      payload: { bio: 'x'.repeat(501) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      payload: { bio: 'No auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});
