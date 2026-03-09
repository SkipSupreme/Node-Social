import type { FastifyRequest } from 'fastify';

/**
 * Extract bearer token from Authorization header or accessToken cookie.
 * Returns the raw token string, or null if no token found.
 */
export function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return request.cookies?.accessToken ?? null;
}
