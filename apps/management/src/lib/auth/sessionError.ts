import { ApiError } from '@/types/api/common';

export type SessionErrorClass = 'network' | 'session' | 'server';

/**
 * Classifica errori dopo fallimento di /auth/session (api.get normalizza in ApiError).
 */
export function classifySessionCheckError(err: unknown): SessionErrorClass {
  if (err instanceof ApiError) {
    if (err.statusCode != null && err.statusCode >= 500) {
      return 'server';
    }
  }

  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: string }).code
      : undefined;

  if (
    msg.includes('Network') ||
    code === 'ECONNREFUSED' ||
    code === 'ERR_NETWORK'
  ) {
    return 'network';
  }

  return 'session';
}
