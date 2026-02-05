/**
 * Node route tests (/nodes/*)
 *
 * Covers: creating nodes (with slug uniqueness), listing nodes, and
 * fetching a single node by slug or UUID.
 *
 * Key design points:
 * - Node creation is rate-limited (5/hour) and requires auth
 * - Listing is public (no auth required)
 * - Lookup supports both slug and UUID in the same /:idOrSlug param
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestNode,
  generateTestToken,
  authHeader,
  type MockPrismaClient,
} from './helpers.js';

let app: FastifyInstance;
let prisma: MockPrismaClient;

const USER_ID = 'node-test-user-1';
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
  for (const model of Object.values(prisma)) {
    for (const fn of Object.values(model)) {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as any).mockReset();
      }
    }
  }
});

// =========================================================================
// POST /nodes -- Create Node
// =========================================================================
describe('POST /nodes', () => {
  it('should create a node with valid input', async () => {
    prisma.node.findUnique.mockResolvedValue(null); // slug not taken
    const node = createTestNode(USER_ID, {
      id: 'new-node-id',
      slug: 'my-node',
      name: 'My Node',
    });
    prisma.node.create.mockResolvedValue(node);

    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'My Node', slug: 'my-node' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe('my-node');
  });

  it('should return 409 when slug already exists', async () => {
    prisma.node.findUnique.mockResolvedValue(createTestNode(USER_ID));

    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'Duplicate', slug: 'test-node' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain('slug already exists');
  });

  it('should reject slug with uppercase letters', async () => {
    // WHY: Slugs must match /^[a-z0-9-]+$/ to ensure URL-friendly identifiers.
    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'Bad Slug', slug: 'Bad-Slug' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject slug shorter than 3 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'Short', slug: 'ab' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject name shorter than 3 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'No', slug: 'valid-slug' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject slug with special characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: { name: 'Special', slug: 'bad_slug!' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should include optional description', async () => {
    prisma.node.findUnique.mockResolvedValue(null);
    prisma.node.create.mockResolvedValue(
      createTestNode(USER_ID, {
        slug: 'desc-node',
        description: 'A described node',
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      headers: { authorization: authHeader(token) },
      payload: {
        name: 'Described',
        slug: 'desc-node',
        description: 'A described node',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().description).toBe('A described node');
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/nodes',
      payload: { name: 'NoAuth', slug: 'no-auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// GET /nodes -- List Nodes
// =========================================================================
describe('GET /nodes', () => {
  it('should list nodes without requiring authentication', async () => {
    // WHY: Node listing is a public endpoint -- anyone can browse communities.
    prisma.node.findMany.mockResolvedValue([
      createTestNode(USER_ID, { slug: 'node-a' }),
      createTestNode(USER_ID, { slug: 'node-b' }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/nodes',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(2);
  });

  it('should order nodes by createdAt descending', async () => {
    prisma.node.findMany.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/nodes' });

    expect(prisma.node.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

// =========================================================================
// GET /nodes/:idOrSlug -- Get Single Node
// =========================================================================
describe('GET /nodes/:idOrSlug', () => {
  it('should find a node by slug', async () => {
    const node = createTestNode(USER_ID, { slug: 'my-slug' });
    prisma.node.findUnique.mockResolvedValue(node);

    const res = await app.inject({
      method: 'GET',
      url: '/nodes/my-slug',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe('my-slug');
  });

  it('should find a node by UUID when slug lookup fails', async () => {
    const nodeId = '12345678-1234-1234-1234-123456789012';
    prisma.node.findUnique
      .mockResolvedValueOnce(null) // slug lookup fails
      .mockResolvedValueOnce(createTestNode(USER_ID, { id: nodeId })); // id lookup succeeds

    const res = await app.inject({
      method: 'GET',
      url: `/nodes/${nodeId}`,
    });

    expect(res.statusCode).toBe(200);
  });

  it('should return 404 when neither slug nor UUID matches', async () => {
    prisma.node.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/nodes/nonexistent',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Node not found');
  });
});
