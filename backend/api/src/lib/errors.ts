/**
 * Type-safe error utilities for catch blocks using `error: unknown`.
 */

/** Application error that carries an HTTP status code. */
export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

/** Extract a message string from an unknown thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/** Type guard: Fastify errors with a statusCode property. */
export function hasFastifyStatusCode(error: unknown): error is { statusCode: number } {
  if (error instanceof AppError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
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
