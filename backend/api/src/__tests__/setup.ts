/**
 * Global test setup for the Node-Social API test suite.
 *
 * This file runs before every test file. It configures mock implementations
 * for external services (Prisma, Redis, MeiliSearch) so that tests can run
 * in complete isolation without any real database, cache, or search engine.
 *
 * WHY: Integration tests that depend on real infrastructure are slow, flaky,
 * and hard to run in CI. By mocking at the plugin boundary we test our
 * business logic and route handlers while keeping the test suite fast and
 * deterministic.
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub external modules that would fail to import without real connections.
// These must be set up *before* any application code is imported.
// ---------------------------------------------------------------------------

// Mock the email module so registration/password-reset flows never attempt
// real network calls or touch the database email_jobs table.
vi.mock('../lib/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock the email queue so it never starts a polling interval.
vi.mock('../lib/emailQueue.js', () => ({
  registerEmailQueue: vi.fn(),
  enqueueEmailJob: vi.fn().mockResolvedValue(undefined),
}));

// Mock metrics (fire-and-forget calls from post/comment routes).
vi.mock('../lib/metrics.js', () => ({
  initializePostMetrics: vi.fn().mockResolvedValue(undefined),
  updatePostMetrics: vi.fn().mockResolvedValue(undefined),
}));

// Mock searchSync (fire-and-forget calls from post routes + retry processor from index.ts).
vi.mock('../lib/searchSync.js', () => ({
  syncPostToMeili: vi.fn().mockResolvedValue(undefined),
  removePostFromMeili: vi.fn().mockResolvedValue(undefined),
  startRetryProcessor: vi.fn(),
  stopRetryProcessor: vi.fn(),
  isMeiliAvailable: vi.fn().mockResolvedValue(false),
  getSyncHealth: vi.fn().mockResolvedValue({ healthy: true }),
  triggerRetryProcessing: vi.fn().mockResolvedValue(0),
  ensurePostsIndex: vi.fn().mockResolvedValue(undefined),
}));

// Mock moderation logging (fire-and-forget).
vi.mock('../lib/moderation.js', () => ({
  logModAction: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Clear mock call history between tests so state does not leak across test cases.
// Use clearAllMocks (not restoreAllMocks) to preserve mock implementations
// set up in vi.mock() factories above (e.g. mockResolvedValue on module mocks).
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.clearAllMocks();
});
