/**
 * Comment route tests (/posts/:postId/comments, /comments/:id)
 *
 * Covers: creating comments (top-level and threaded replies), fetching
 * comments for a post, and soft-deleting comments with authorization.
 *
 * Key edge cases:
 * - Threading: parentId must belong to the same post
 * - Authorization: only the comment author can delete
 * - Soft delete: deletedAt is set, record is not physically removed
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createTestPost,
  createTestComment,
  generateTestToken,
  authHeader,
  type MockPrismaClient,
} from './helpers.js';

let app: FastifyInstance;
let prisma: MockPrismaClient;

const USER_ID = 'comment-test-user-1';
const OTHER_USER_ID = 'comment-test-user-2';
const POST_ID = 'comment-test-post-1';
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
// POST /posts/:postId/comments
// =========================================================================
describe('POST /posts/:postId/comments', () => {
  it('should create a top-level comment on a post', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    const comment = createTestComment(USER_ID, POST_ID);
    prisma.comment.create.mockResolvedValue(comment);

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: { content: 'Great post!' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().content).toBe(comment.content);
  });

  it('should create a threaded reply to an existing comment', async () => {
    const parentComment = createTestComment(OTHER_USER_ID, POST_ID, {
      id: 'parent-comment-1',
      postId: POST_ID,
    });

    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.comment.findUnique.mockResolvedValue(parentComment);
    prisma.comment.create.mockResolvedValue(
      createTestComment(USER_ID, POST_ID, {
        parentId: parentComment.id,
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: { content: 'Nice reply!', parentId: parentComment.id },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().parentId).toBe(parentComment.id);
  });

  it('should return 404 if parent comment does not exist', async () => {
    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.comment.findUnique.mockResolvedValue(null); // parent not found

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: {
        content: 'Reply to nothing',
        parentId: '00000000-0000-0000-0000-000000000000',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Parent comment not found');
  });

  it('should return 400 if parent comment belongs to a different post', async () => {
    // WHY: Threading integrity -- a reply's parent must be on the same post.
    const wrongPostParent = createTestComment(OTHER_USER_ID, 'different-post-id', {
      id: 'wrong-parent',
      postId: 'different-post-id',
    });

    prisma.post.findUnique.mockResolvedValue(createTestPost(USER_ID, { id: POST_ID }));
    prisma.comment.findUnique.mockResolvedValue(wrongPostParent);

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: { content: 'Cross-post reply', parentId: wrongPostParent.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Parent comment belongs to a different post');
  });

  it('should return 404 if post does not exist', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/posts/nonexistent/comments',
      headers: { authorization: authHeader(token) },
      payload: { content: 'Comment on nothing' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Post not found');
  });

  it('should reject empty comment content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: { content: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should reject comment content exceeding 2000 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
      payload: { content: 'x'.repeat(2001) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${POST_ID}/comments`,
      payload: { content: 'No auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// GET /posts/:postId/comments
// =========================================================================
describe('GET /posts/:postId/comments', () => {
  it('should return top-level comments for a post (parentId is null)', async () => {
    const comments = [
      createTestComment(USER_ID, POST_ID, { id: 'c1' }),
      createTestComment(OTHER_USER_ID, POST_ID, { id: 'c2' }),
    ];
    prisma.comment.findMany.mockResolvedValue(comments);

    const res = await app.inject({
      method: 'GET',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(2);
  });

  it('should filter by parentId to fetch threaded replies', async () => {
    const parentId = 'parent-comment-for-replies';
    prisma.comment.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: `/posts/${POST_ID}/comments?parentId=${parentId}`,
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          postId: POST_ID,
          parentId,
        }),
      })
    );
  });

  it('should exclude soft-deleted comments', async () => {
    prisma.comment.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: `/posts/${POST_ID}/comments`,
      headers: { authorization: authHeader(token) },
    });

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
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
      url: `/posts/${POST_ID}/comments`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// =========================================================================
// DELETE /comments/:id
// =========================================================================
describe('DELETE /comments/:id', () => {
  it('should soft-delete a comment when author requests it', async () => {
    const comment = createTestComment(USER_ID, POST_ID, { id: 'del-comment-1' });
    prisma.comment.findUnique.mockResolvedValue(comment);
    prisma.comment.update.mockResolvedValue({ ...comment, deletedAt: new Date() });

    const res = await app.inject({
      method: 'DELETE',
      url: '/comments/del-comment-1',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Comment deleted successfully');

    expect(prisma.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-comment-1' },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });

  it('should return 403 when non-author tries to delete a comment', async () => {
    const comment = createTestComment(OTHER_USER_ID, POST_ID, {
      id: 'not-my-comment',
      authorId: OTHER_USER_ID,
    });
    prisma.comment.findUnique.mockResolvedValue(comment);

    const res = await app.inject({
      method: 'DELETE',
      url: '/comments/not-my-comment',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Forbidden');
  });

  it('should return 404 for non-existent comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: '/comments/no-such-comment',
      headers: { authorization: authHeader(token) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/comments/any-id',
    });

    expect(res.statusCode).toBe(401);
  });
});
