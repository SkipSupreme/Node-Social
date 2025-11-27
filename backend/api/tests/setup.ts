// tests/setup.ts
// Test utilities for API integration tests

import { build } from '../src/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.CSRF_SECRET = 'test-csrf-secret';

    // Build the app
    app = await build();
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

export async function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    token?: string;
  }
) {
  const testApp = await getTestApp();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await testApp.inject({
    method,
    url,
    headers,
    payload: options?.body,
  });

  return {
    status: response.statusCode,
    body: response.json(),
    headers: response.headers,
  };
}
