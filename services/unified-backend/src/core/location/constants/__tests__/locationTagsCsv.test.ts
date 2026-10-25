/**
 * I tag nel CSV dei seeder (che non può importare il backend) devono stare nel registro:
 * un refuso lì diventerebbe un luogo che il bot non sa trovare.
 *
 *   cd services/unified-backend
 *   npx tsx --test src/core/location/constants/__tests__/locationTagsCsv.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { sanitizeLocationTags } from '../locationTags';

const CSV = join(__dirname, '../../../../../../../scripts/seeders/data/locations.csv');

function rows(): Record<string, string>[] {
  const [header, ...lines] = readFileSync(CSV, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  const fields = (line: string): string[] => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => (m[1] ?? '').replace(/""/g, '"'));
  const keys = fields(header ?? '');
  return lines.map((l) => Object.fromEntries(fields(l).map((v, i) => [keys[i] ?? `c${i}`, v])));
}

describe('locations.csv: colonna tags', () => {
  const all = rows();
  const parents = new Set(all.map((r) => r['parentLocationName']).filter(Boolean));
  const leaves = all.filter((r) => !parents.has(r['name'] ?? ''));

  it('ha la colonna e solo tag del registro', () => {
    assert.ok(all.length > 50 && 'tags' in (all[0] ?? {}));
    for (const row of all) {
      const raw = (row['tags'] ?? '').split(',').filter(Boolean);
      const { invalid } = sanitizeLocationTags(raw);
      assert.deepEqual(invalid, [], `${row['name']}: ${invalid.join(', ')}`);
    }
  });

  it('ogni location foglia (quella a cui si arriva in chat) ha almeno un tag', () => {
    const untagged = leaves.filter((r) => !(r['tags'] ?? '').trim()).map((r) => r['name']);
    assert.deepEqual(untagged, []);
  });
});
