/**
 * Test helpers: reusable factories for creating a mock Fastify application,
 * test users, JWT tokens, and mock data objects.
 *
 * The philosophy is "thin mocks" -- we build a *real* Fastify instance, register
 * the *real* route plugins, but replace the data-layer decorations (prisma,
 * redis, meilisearch) with lightweight in-memory fakes.  This means route
 * handlers, Zod validation, JWT verification, cookie handling, and the CSRF
 * hook all execute exactly as they would in production, giving us high-fidelity
 * integration tests without any infrastructure.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { randomUUID, createHash } from 'crypto';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Minimal shape that satisfies the PrismaClient contract used by route handlers. */
export type MockPrismaClient = {
  user: Record<string, any>;
  post: Record<string, any>;
  comment: Record<string, any>;
  node: Record<string, any>;
  refreshToken: Record<string, any>;
  federatedIdentity: Record<string, any>;
  userFeedPreference: Record<string, any>;
  modActionLog: Record<string, any>;
  linkMetadata: Record<string, any>;
  postMetric: Record<string, any>;
  emailJob: Record<string, any>;
  vibeReaction: Record<string, any>;
  vibeVector: Record<string, any>;
  nodeVibeWeight: Record<string, any>;
};

// ---------------------------------------------------------------------------
// Mock Redis: thin wrapper around a JS Map that exposes the subset of the
// ioredis API that the application actually uses (set, get, del, keys).
// ---------------------------------------------------------------------------

export function createMockRedis() {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    /** Internal store -- useful in assertions. */
    _store: store,

    async set(key: string, value: string, ...args: any[]) {
      let expiresAt: number | undefined;
      // Handle SET key value EX seconds
      if (args[0] === 'EX' && typeof args[1] === 'number') {
        expiresAt = Date.now() + args[1] * 1000;
      }
      store.set(key, { value, expiresAt });
      return 'OK';
    },

    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },

    async del(...keys: string[]) {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
      }
      return deleted;
    },

    async keys(pattern: string) {
      // Simple glob matching (only supports trailing *)
      const prefix = pattern.replace(/\*$/, '');
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma: returns an object whose model properties are all vi.fn()
// stubs. Each test configures the stubs for the specific scenario.
// ---------------------------------------------------------------------------

export function createMockPrisma(): MockPrismaClient {
  const makeMethods = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });

  return {
    user: makeMethods(),
    post: makeMethods(),
    comment: makeMethods(),
    node: makeMethods(),
    refreshToken: makeMethods(),
    federatedIdentity: makeMethods(),
    userFeedPreference: makeMethods(),
    modActionLog: makeMethods(),
    linkMetadata: makeMethods(),
    postMetric: makeMethods(),
    emailJob: makeMethods(),
    vibeReaction: makeMethods(),
    vibeVector: makeMethods(),
    nodeVibeWeight: makeMethods(),
  };
}

// ---------------------------------------------------------------------------
// Mock MeiliSearch client
// ---------------------------------------------------------------------------

export function createMockMeiliSearch() {
  return {
    index: vi.fn().mockReturnValue({
      search: vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
      addDocuments: vi.fn().mockResolvedValue({ taskUid: 1 }),
      deleteDocument: vi.fn().mockResolvedValue({ taskUid: 2 }),
      updateSettings: vi.fn().mockResolvedValue({ taskUid: 3 }),
    }),
    health: vi.fn().mockResolvedValue({ status: 'available' }),
  };
}

// ---------------------------------------------------------------------------
// Build a test-ready Fastify app with real route handlers + mock data layer
// ---------------------------------------------------------------------------

export async function buildTestApp(): Promise<{
  app: FastifyInstance;
  prisma: MockPrismaClient;
  redis: ReturnType<typeof createMockRedis>;
  meili: ReturnType<typeof createMockMeiliSearch>;
}> {
  const prisma = createMockPrisma();
  const redis = createMockRedis();
  const meili = createMockMeiliSearch();

  const app = Fastify({ logger: false });

  // Register cookie plugin (used by auth for refresh tokens and CSRF)
  await app.register(cookie, {
    secret: 'test-cookie-secret',
  });

  // Register JWT plugin (used by authenticate decorator + token signing)
  await app.register(jwt, {
    secret: 'test-jwt-secret-that-is-long-enough',
  });

  // Decorate with mock services
  app.decorate('prisma', prisma as any);
  app.decorate('redis', redis as any);
  app.decorate('meilisearch', meili as any);

  // Replicate the authenticate decorator from src/index.ts
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (_err) {
      const cookieToken = request.cookies?.accessToken;
      if (cookieToken) {
        try {
          await request.jwtVerify({ token: cookieToken });
          return;
        } catch (_cookieErr) {
          // Cookie verification also failed
        }
      }
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Replicate the CSRF hook from src/index.ts
  app.addHook('onRequest', async (request, reply) => {
    const method = request.method.toUpperCase();
    const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const hasAuthCookie = Boolean(
      request.cookies?.accessToken || request.cookies?.refreshToken
    );

    if (!isSafe && hasAuthCookie) {
      const csrfCookie = request.cookies?.csrfToken;
      const csrfHeader = request.headers['x-csrf-token'];
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return reply.status(403).send({ error: 'Invalid CSRF token' });
      }
    }
  });

  // Import and register the actual route handlers
  const { default: authRoutes } = await import('../routes/auth.js');
  const { default: postRoutes } = await import('../routes/posts.js');
  const { default: commentRoutes } = await import('../routes/comments.js');
  const { default: reactionRoutes } = await import('../routes/reactions.js');
  const { default: nodeRoutes } = await import('../routes/nodes.js');
  const { default: usersRoutes } = await import('../routes/users.js');
  const { default: searchRoutes } = await import('../routes/search.js');
  const { default: feedPreferenceRoutes } = await import('../routes/feedPreferences.js');
  const { default: moderationRoutes } = await import('../routes/moderation.js');
  const { default: metadataRoutes } = await import('../routes/metadata.js');

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(postRoutes, { prefix: '/posts' });
  await app.register(commentRoutes, { prefix: '/' });
  await app.register(reactionRoutes, { prefix: '/reactions' });
  await app.register(nodeRoutes, { prefix: '/nodes' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(searchRoutes, { prefix: '/' });
  await app.register(feedPreferenceRoutes, { prefix: '/' });
  await app.register(moderationRoutes, { prefix: '/' });
  await app.register(metadataRoutes, { prefix: '/metadata' });

  // Health check
  app.get('/health', async () => ({ ok: true }));

  await app.ready();

  return { app, prisma, redis, meili };
}

// ---------------------------------------------------------------------------
// Factory helpers for common test data
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-jwt-secret-that-is-long-enough';

/** Generate a signed JWT access token for a test user. */
export function generateTestToken(
  app: FastifyInstance,
  userId: string,
  email: string = 'test@example.com'
): string {
  return app.jwt.sign({ sub: userId, email }, { expiresIn: '15m' });
}

/** Generate an expired JWT access token for testing expiration handling. */
export function generateExpiredToken(
  app: FastifyInstance,
  userId: string,
  email: string = 'test@example.com'
): string {
  return app.jwt.sign({ sub: userId, email }, { expiresIn: '0s' });
}

/** A standard test user object matching the User model shape. */
export function createTestUser(overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    email: 'testuser@example.com',
    password: '$argon2id$v=19$m=65536,t=3,p=1$AAAA$BBBB', // fake argon2 hash
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    resetToken: null,
    resetTokenExpires: null,
    createdAt: new Date(),
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: new Date('1995-06-15'),
    bio: null,
    avatar: null,
    connoisseurCred: 0,
    era: 'Mastermind Era',
    theme: null,
    ...overrides,
  };
}

/** A standard test post object. */
export function createTestPost(authorId: string, overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    content: 'This is a test post.',
    title: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    authorId,
    nodeId: null,
    linkUrl: null,
    linkMetaId: null,
    postType: 'text',
    visibility: 'public',
    author: { id: authorId, email: 'testuser@example.com' },
    node: null,
    _count: { comments: 0 },
    metrics: null,
    reactions: [],
    comments: [],
    ...overrides,
  };
}

/** A standard test comment object. */
export function createTestComment(
  authorId: string,
  postId: string,
  overrides: Record<string, any> = {}
) {
  return {
    id: randomUUID(),
    content: 'This is a test comment.',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    authorId,
    postId,
    parentId: null,
    author: { id: authorId, email: 'testuser@example.com' },
    _count: { replies: 0 },
    ...overrides,
  };
}

/** A standard test node object. */
export function createTestNode(creatorId: string, overrides: Record<string, any> = {}) {
  return {
    id: randomUUID(),
    slug: 'test-node',
    name: 'Test Node',
    description: 'A node for testing.',
    color: null,
    createdAt: new Date(),
    creatorId,
    ...overrides,
  };
}

/** Hash a token the same way the auth route does (SHA-256). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Create an Authorization header value. */
export function authHeader(token: string): string {
  return `Bearer ${token}`;
}
