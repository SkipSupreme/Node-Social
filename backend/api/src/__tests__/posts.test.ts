/**
 * Post route tests (/posts/*)
 *
 * Covers: creating posts, fetching the feed, fetching a single post,
 * soft-deleting a post, and authorization checks (only author can delete).
 *
 * All routes require authentication; the tests verify that unauthenticated
 * requests are rejected with 401.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestUser,
  createTestPost,
  createTestNode,
  generateTestToken,
  authHeader,
  type MockPrismaClient,
} from './helpers.js';
import type { createMockRedis } from './helpers.js';

let app: FastifyInstance;
let prisma: MockPrismaClient;
let redis: ReturnType<typeof createMockRedis>;

const USER_ID = 'post-test-user-1';
const OTHER_USER_ID = 'post-test-user-2';
let token: string;

beforeAll(async () => {
  const ctx = await buildTestApp();
  app = ctx.app;
  prisma = ctx.prisma;
  redis = ctx.redis;
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
// POST /posts -- Create Post
// =========================================================================
describe('POST /posts', () => {
  it('should create a post and return 201', async () => {
    const post = createTestPost(USER_ID, { id: 'post-1' });
    prisma.post.create.mockResolvedValue(post);
    prisma.linkMetadata.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(token) },
      payload: { content: 'Hello, world!' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().content).toBe('This is a test post.');
  });

  it('should create a post linked to a node', async () => {
    const node = createTestNode(USER_ID, { id: 'node-1' });
    prisma.node.findUnique.mockResolvedValue(node);
    prisma.post.create.mockResolvedValue(
      createTestPost(USER_ID, { nodeId: node.id })
    );
    prisma.linkMetadata.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(token) },
      payload: { content: 'Node post!', nodeId: node.id },
    });

    expect(res.statusCode).toBe(201);
  });

  it('should return 404 when nodeId references a non-existent node', async () => {
    prisma.node.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(token) },
      payload: { content: 'Node post!', nodeId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Node not found');
  });

  it('should reject empty content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(token) },
      payload: { content: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject content exceeding 6000 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: authHeader(token) },
      payload: { content: 'x'.repeat(6001) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'No auth header' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// GET /posts -- Feed
// =========================================================================
describe('GET /posts (feed)', () => {
  it('should return a paginated feed of posts', async () => {
    const posts = [
      createTestPost(USER_ID, { id: 'post-a' }),
      createTestPost(USER_ID, { id: 'post-b' }),
    ];
    prisma.post.findMany.mockResolvedValue(posts);
    prisma.userFeedPreference.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/posts?limit=10',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.posts).toBeInstanceOf(Array);
    expect(body.posts.length).toBe(2);
    expect(body).toHaveProperty('hasMore');
  });

  it('should support filtering by nodeId', async () => {
    prisma.post.findMany.mockResolvedValue([]);
    prisma.userFeedPreference.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/posts?nodeId=00000000-0000-0000-0000-000000000000',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    // Verify the query included nodeId filter
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nodeId: '00000000-0000-0000-0000-000000000000',
        }),
      })
    );
  });

  it('should support filtering by authorId', async () => {
    prisma.post.findMany.mockResolvedValue([]);
    prisma.userFeedPreference.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/posts?authorId=${OTHER_USER_ID}`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authorId: OTHER_USER_ID,
        }),
      })
    );
  });

  it('should exclude soft-deleted posts from the feed', async () => {
    prisma.post.findMany.mockResolvedValue([]);
    prisma.userFeedPreference.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/posts',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    // Verify deletedAt: null filter is applied
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/posts',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject invalid limit parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?limit=200',
      headers: { authorization: authHeader(token) },
    });

    // The Zod schema caps limit at max 50; a value of 200 should fail.
    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// GET /posts/:id -- Single Post
// =========================================================================
describe('GET /posts/:id', () => {
  it('should return a single post with comment count', async () => {
    const post = createTestPost(USER_ID, {
      id: 'single-post-1',
      _count: { comments: 5 },
    });
    prisma.post.findUnique.mockResolvedValue(post);

    const res = await app.inject({
      method: 'GET',
      url: '/posts/single-post-1',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().commentCount).toBe(5);
  });

  it('should return 404 for non-existent post', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/posts/nonexistent-id',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Post not found');
  });

  it('should return 404 for soft-deleted post', async () => {
    // WHY: Soft-deleted posts should be invisible to all users.
    prisma.post.findUnique.mockResolvedValue(
      createTestPost(USER_ID, { deletedAt: new Date() })
    );

    const res = await app.inject({
      method: 'GET',
      url: '/posts/deleted-post-id',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/some-id',
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// DELETE /posts/:id -- Soft Delete
// =========================================================================
describe('DELETE /posts/:id', () => {
  it('should soft-delete a post when requested by the author', async () => {
    const post = createTestPost(USER_ID, { id: 'del-post-1', authorId: USER_ID });
    prisma.post.findUnique.mockResolvedValue(post);
    prisma.post.update.mockResolvedValue({ ...post, deletedAt: new Date() });

    const res = await app.inject({
      method: 'DELETE',
      url: '/posts/del-post-1',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Post deleted successfully');

    // Verify soft delete (deletedAt set, not physically removed)
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-post-1' },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });

  it('should return 403 when non-author tries to delete', async () => {
    // WHY: Authorization -- only the author should be able to delete their post.
    const post = createTestPost(OTHER_USER_ID, { id: 'not-my-post', authorId: OTHER_USER_ID });
    prisma.post.findUnique.mockResolvedValue(post);

    const res = await app.inject({
      method: 'DELETE',
      url: '/posts/not-my-post',
      headers: { authorization: authHeader(token) }, // token is for USER_ID
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Forbidden');
  });

  it('should return 404 for non-existent post', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: '/posts/nope',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/posts/some-id',
    });

    expect(res.statusCode).toBe(401);
  });
});
