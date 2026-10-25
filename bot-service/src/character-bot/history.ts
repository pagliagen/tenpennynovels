import type { Redis } from 'ioredis';
import type { HistoryLine } from './prompt';

const KEY_PREFIX = 'botservice:history:';
const MAX_STORED = 50;

/** Ultimi messaggi pubblici per location, su Redis: sopravvivono ai riavvii. */
export class History {
  constructor(private readonly redis: Redis) {}

  async push(locationId: string, line: HistoryLine): Promise<void> {
    const key = KEY_PREFIX + locationId;
    await this.redis.multi().lpush(key, JSON.stringify(line)).ltrim(key, 0, MAX_STORED - 1).exec();
  }

  /** In ordine cronologico (dal più vecchio). */
  async recent(locationId: string, size: number): Promise<HistoryLine[]> {
    const raw = await this.redis.lrange(KEY_PREFIX + locationId, 0, size - 1);
    return raw
      .map((r) => {
        try { return JSON.parse(r) as HistoryLine; } catch { return null; }
      })
      .filter((l): l is HistoryLine => l !== null)
      .reverse();
  }
}
