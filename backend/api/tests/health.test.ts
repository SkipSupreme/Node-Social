// tests/health.test.ts
// Basic health check tests

import { describe, it, expect, afterAll } from 'vitest';
import { getTestApp, closeTestApp, makeRequest } from './setup.js';

describe('Health Endpoint', () => {
  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /health returns 200 with ok: true', async () => {
    const response = await makeRequest('GET', '/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('GET /health returns correct content type', async () => {
    const response = await makeRequest('GET', '/health');

    expect(response.headers['content-type']).toContain('application/json');
  });
});

describe('404 Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const response = await makeRequest('GET', '/this-route-does-not-exist');

    expect(response.status).toBe(404);
  });
});
