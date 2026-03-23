import { classifySessionCheckError } from './sessionError';
import { ApiError } from '@/types/api/common';

describe('classifySessionCheckError', () => {
  it('classifica ApiError 5xx come server', () => {
    expect(classifySessionCheckError(new ApiError('fail', 503))).toBe('server');
  });

  it('classifica ApiError 4xx come session', () => {
    expect(classifySessionCheckError(new ApiError('nope', 401))).toBe('session');
  });

  it('classifica errori di rete per messaggio o code', () => {
    expect(classifySessionCheckError(new Error('Network Error'))).toBe('network');
    expect(classifySessionCheckError({ code: 'ERR_NETWORK' })).toBe('network');
    expect(classifySessionCheckError({ code: 'ECONNREFUSED' })).toBe('network');
  });

  it('default session per errori generici', () => {
    expect(classifySessionCheckError(new Error('qualcosa'))).toBe('session');
  });
});
