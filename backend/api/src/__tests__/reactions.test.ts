/**
 * Reaction route tests (/reactions/*)
 *
 * Covers the Phase 0.1 Vibe Vector reaction system:
 * - Creating/updating intensity-based reactions on posts and comments
 * - Fetching aggregated reactions for content
 * - Deleting reactions
 * - Input validation (intensities range, nodeId existence, etc.)
 *
 * WHY test reactions separately from posts: reactions have their own complex
 * validation logic (multi-vector intensities, node context weighting) and a
 * separate service layer (vibeService).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestPost,
  createTestComment,
  createTestNode,
  generateTestToken,
  authHeader,
  type MockPrismaClient,
} from './helpers.js';

let app: FastifyInstance;
let prisma: MockPrismaClient;

const USER_ID = 'reaction-test-user-1';
const POST_ID = 'reaction-test-post-1';
const COMMENT_ID = 'reaction-test-comment-1';
const NODE_ID = '11111111-1111-1111-1111-111111111111';
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
// POST /reactions/posts/:postId -- Create/Update Reaction on Post
// =========================================================================
describe('POST /reactions/posts/:postId', () => {
  it('should create a reaction with valid intensities', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.node.findUnique.mockResolvedValue(createTestNode(USER_ID, { id: NODE_ID }));

    // vibeService calls: findFirst (existing check), create (new reaction)
    prisma.vibeReaction.findFirst.mockResolvedValue(null);
    prisma.vibeReaction.create.mockResolvedValue({
      id: 'reaction-1',
      userId: USER_ID,
      postId: POST_ID,
      nodeId: NODE_ID,
      intensities: { funny: 0.8, insightful: 0.3 },
      totalIntensity: 1.1,
      user: { id: USER_ID, email: 'test@example.com' },
      node: { id: NODE_ID, slug: 'test-node', name: 'Test Node' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 0.8, insightful: 0.3 },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().intensities.funny).toBe(0.8);
  });

  it('should update an existing reaction (upsert behavior)', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.node.findUnique.mockResolvedValue(createTestNode(USER_ID, { id: NODE_ID }));

    // Existing reaction found
    prisma.vibeReaction.findFirst.mockResolvedValue({
      id: 'existing-reaction',
      userId: USER_ID,
      postId: POST_ID,
      nodeId: NODE_ID,
    });

    prisma.vibeReaction.update.mockResolvedValue({
      id: 'existing-reaction',
      userId: USER_ID,
      postId: POST_ID,
      nodeId: NODE_ID,
      intensities: { funny: 0.5 },
      totalIntensity: 0.5,
      user: { id: USER_ID, email: 'test@example.com' },
      node: { id: NODE_ID, slug: 'test-node', name: 'Test Node' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(201);
    // Verify update was called (not create)
    expect(prisma.vibeReaction.update).toHaveBeenCalled();
  });

  it('should return 404 if post does not exist', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/reactions/posts/nonexistent-post',
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Post not found');
  });

  it('should return 404 if post is soft-deleted', async () => {
    prisma.post.findUnique.mockResolvedValue(
      createTestPost(USER_ID, { id: POST_ID, deletedAt: new Date() })
    );

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return 404 if node does not exist', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.node.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: '00000000-0000-0000-0000-000000000000',
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Node not found');
  });

  it('should reject intensity values outside 0-1 range', async () => {
    // WHY: Intensities must be clamped to [0, 1] per the Vibe Vector spec.
    // Zod catches values > 1 at the route level.
    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 1.5 },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject negative intensity values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: -0.5 },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject missing nodeId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reactions/posts/${POST_ID}`,
      payload: {
        nodeId: NODE_ID,
        intensities: { funny: 0.5 },
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// POST /reactions/comments/:commentId -- Create/Update Reaction on Comment
// =========================================================================
describe('POST /reactions/comments/:commentId', () => {
  it('should create a reaction on a comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(
      createTestComment(USER_ID, POST_ID, { id: COMMENT_ID })
    );
    prisma.node.findUnique.mockResolvedValue(createTestNode(USER_ID, { id: NODE_ID }));
    prisma.vibeReaction.findFirst.mockResolvedValue(null);
    prisma.vibeReaction.create.mockResolvedValue({
      id: 'comment-reaction-1',
      userId: USER_ID,
      commentId: COMMENT_ID,
      nodeId: NODE_ID,
      intensities: { insightful: 1.0 },
      totalIntensity: 1.0,
      user: { id: USER_ID, email: 'test@example.com' },
      node: { id: NODE_ID, slug: 'test-node', name: 'Test Node' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/comments/${COMMENT_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { insightful: 1.0 },
      },
    });

    expect(res.statusCode).toBe(201);
  });

  it('should return 404 for deleted comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(
      createTestComment(USER_ID, POST_ID, {
        id: COMMENT_ID,
        deletedAt: new Date(),
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: `/reactions/comments/${COMMENT_ID}`,
      headers: { authorization: authHeader(token) },
      payload: {
        nodeId: NODE_ID,
        intensities: { insightful: 0.5 },
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

// =========================================================================
// GET /reactions/posts/:postId -- Get Reactions
// =========================================================================
describe('GET /reactions/posts/:postId', () => {
  it('should return reactions and aggregated data for a post', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.vibeReaction.findMany.mockResolvedValue([
      {
        id: 'r1',
        intensities: { funny: 0.8, insightful: 0.2 },
        user: { id: USER_ID, email: 'u1@test.com' },
        node: { id: NODE_ID, slug: 'test', name: 'Test' },
      },
    ]);
    prisma.vibeVector.findMany.mockResolvedValue([
      { slug: 'funny', name: 'Funny', emoji: null },
      { slug: 'insightful', name: 'Insightful', emoji: null },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reactions).toBeInstanceOf(Array);
    expect(body.aggregated).toBeInstanceOf(Array);
  });

  it('should return 404 for non-existent post', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/reactions/posts/no-such-post',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/reactions/posts/${POST_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// DELETE /reactions/posts/:postId -- Delete Reaction
// =========================================================================
describe('DELETE /reactions/posts/:postId', () => {
  it('should delete a reaction successfully', async () => {
    prisma.vibeReaction.findFirst.mockResolvedValue({
      id: 'reaction-to-delete',
      userId: USER_ID,
      postId: POST_ID,
    });
    prisma.vibeReaction.delete.mockResolvedValue({ id: 'reaction-to-delete' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Reaction deleted successfully');
  });

  it('should return 404 when no reaction exists to delete', async () => {
    prisma.vibeReaction.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/reactions/posts/${POST_ID}`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/reactions/posts/${POST_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// GET /reactions/vectors -- Get All Vibe Vectors
// =========================================================================
describe('GET /reactions/vectors', () => {
  it('should return all enabled vibe vectors', async () => {
    prisma.vibeVector.findMany.mockResolvedValue([
      { id: 'v1', slug: 'funny', name: 'Funny', emoji: null, order: 1, enabled: true },
      { id: 'v2', slug: 'insightful', name: 'Insightful', emoji: null, order: 2, enabled: true },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/reactions/vectors',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().vectors).toHaveLength(2);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reactions/vectors',
    });

    expect(res.statusCode).toBe(401);
  });
});
