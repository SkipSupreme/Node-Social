/**
 * Type-safe error utilities for catch blocks using `error: unknown`.
 */

/** Extract a message string from an unknown thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/** Type guard: Fastify errors with a statusCode property. */
export function hasFastifyStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as any).statusCode === 'number'
  );
}

/** Type guard: Prisma client-known-request errors with a code property. */
export function isPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}
