import { buildQueryString } from '@/lib/api/client';

describe('buildQueryString', () => {
  it('omette null, undefined e stringa vuota', () => {
    expect(buildQueryString({ a: 1, b: '', c: undefined, d: null })).toBe('?a=1');
  });

  it('restituisce stringa vuota se nessun parametro', () => {
    expect(buildQueryString({})).toBe('');
  });
});
