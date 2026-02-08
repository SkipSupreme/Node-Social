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

/** Mock method set for each Prisma model. */
interface MockModelMethods {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  [key: string]: any;
}

/** Minimal shape that satisfies the PrismaClient contract used by route handlers. */
export interface MockPrismaClient {
  user: MockModelMethods;
  post: MockModelMethods;
  comment: MockModelMethods;
  node: MockModelMethods;
  refreshToken: MockModelMethods;
  federatedIdentity: MockModelMethods;
  userFeedPreference: MockModelMethods;
  modActionLog: MockModelMethods;
  linkMetadata: MockModelMethods;
  postMetric: MockModelMethods;
  emailJob: MockModelMethods;
  vibeReaction: MockModelMethods;
  vibeVector: MockModelMethods;
  nodeVibeWeight: MockModelMethods;
  notification: MockModelMethods;
  poll: MockModelMethods;
  pollVote: MockModelMethods;
  postVibeAggregate: MockModelMethods;
  credTransaction: MockModelMethods;
  nodeVectorConfig: MockModelMethods;
  userFollow: MockModelMethods;
  userBlock: MockModelMethods;
  userMute: MockModelMethods;
  nodeMute: MockModelMethods;
  savedPost: MockModelMethods;
  userPostView: MockModelMethods;
  userMutedWord: MockModelMethods;
  vouch: MockModelMethods;
  feedPreset: MockModelMethods;
  appeal: MockModelMethods;
  councilVote: MockModelMethods;
  externalPost: MockModelMethods;
  externalSource: MockModelMethods;
  message: MockModelMethods;
  conversation: MockModelMethods;
  conversationParticipant: MockModelMethods;
  nodeSubscription: MockModelMethods;
  externalPostVibeAggregate: MockModelMethods;
  $transaction: ReturnType<typeof vi.fn>;
  [key: string]: any;
}

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
      store.set(key, { value, ...(expiresAt !== undefined ? { expiresAt } : {}) });
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

    /** Simulate Redis SCAN: returns all matching keys in a single pass (cursor '0' = done). */
    async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
      let pattern = '*';
      for (let i = 0; i < args.length; i++) {
        if (String(args[i]).toUpperCase() === 'MATCH' && i + 1 < args.length) {
          pattern = args[i + 1] as string;
        }
      }
      const prefix = pattern.replace(/\*$/, '');
      const matched = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
      return ['0', matched]; // '0' cursor means scan complete
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma: returns an object whose model properties are all vi.fn()
// stubs. Each test configures the stubs for the specific scenario.
// ---------------------------------------------------------------------------

export function createMockPrisma(): MockPrismaClient {
  const makeMethods = () => ({
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  });

  // All known Prisma models — any accessed model returns safe defaults
  const models = [
    'user', 'post', 'comment', 'node', 'refreshToken',
    'federatedIdentity', 'userFeedPreference', 'modActionLog',
    'linkMetadata', 'postMetric', 'emailJob', 'vibeReaction',
    'vibeVector', 'nodeVibeWeight', 'notification', 'poll',
    'pollVote', 'postVibeAggregate', 'credTransaction',
    'nodeVectorConfig', 'userFollow', 'userBlock', 'userMute',
    'nodeMute', 'savedPost', 'userPostView', 'userMutedWord',
    'vouch', 'feedPreset', 'appeal', 'councilVote', 'externalPost',
    'externalSource', 'message', 'conversation', 'conversationParticipant',
    'nodeSubscription', 'externalPostVibeAggregate',
  ];

  const prisma = {} as MockPrismaClient;
  for (const model of models) {
    prisma[model] = makeMethods();
  }

  // $transaction: execute the callback passing prisma itself as the transaction client
  prisma.$transaction = vi.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return await fn(prisma);
    }
    // Array-style transactions: resolve all promises
    return await Promise.all(fn);
  });

  return prisma;
}

/**
 * Reset all prisma mock methods and re-apply safe defaults.
 * Use this in beforeEach instead of manual mockReset loops.
 */
export function resetMockPrisma(prisma: MockPrismaClient): void {
  for (const [key, model] of Object.entries(prisma)) {
    // Skip $transaction -- it's a top-level mock function, not a model
    if (key === '$transaction') continue;
    for (const [_methodName, fn] of Object.entries(model)) {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as any).mockReset();
      }
    }
    // Re-apply safe defaults after reset
    model.findUnique?.mockResolvedValue(null);
    model.findFirst?.mockResolvedValue(null);
    model.findMany?.mockResolvedValue([]);
    model.create?.mockResolvedValue({});
    model.update?.mockResolvedValue({});
    model.updateMany?.mockResolvedValue({ count: 0 });
    model.delete?.mockResolvedValue({});
    model.deleteMany?.mockResolvedValue({ count: 0 });
    model.upsert?.mockResolvedValue({});
    model.count?.mockResolvedValue(0);
  }

  // Re-apply $transaction mock after reset
  if (prisma.$transaction && typeof prisma.$transaction.mockReset === 'function') {
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return await fn(prisma);
      }
      return await Promise.all(fn);
    });
  }
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

  // Replicate the optionalAuthenticate decorator from src/index.ts
  // Sets request.user if token valid, but doesn't fail if not
  app.decorate('optionalAuthenticate', async function (request: any, _reply: any) {
    try {
      await request.jwtVerify();
    } catch (_err) {
      const cookieToken = request.cookies?.accessToken;
      if (cookieToken) {
        try {
          await request.jwtVerify({ token: cookieToken });
          return;
        } catch (_cookieErr) {
          // Silent fail - user stays anonymous
        }
      }
      // Don't set request.user - they're anonymous
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
  // Use '-1s' to create a token that's already 1 second past expiry.
  // '0s' converts to 0ms which fast-jwt interprets as "no expiry" (no exp claim set).
  return app.jwt.sign({ sub: userId, email }, { expiresIn: '-1s' });
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
    expertGateCred: null,
    contentJson: null,
    author: { id: authorId, username: 'testuser', avatar: null },
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
    author: { id: authorId, username: 'testuser', avatar: null, era: 'Mastermind Era', cred: 0 },
    _count: { replies: 0 },
    reactions: [],
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
