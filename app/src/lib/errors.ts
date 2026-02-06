/**
 * Extract a human-readable error message from an unknown caught value.
 *
 * Usage:
 *   catch (err: unknown) {
 *     const message = getErrorMessage(err);
 *   }
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback ?? 'An unknown error occurred';
}
