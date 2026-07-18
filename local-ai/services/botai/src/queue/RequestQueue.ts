import PQueue from 'p-queue';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('Queue');

// P2-4: Per-bot queues — each bot processes sequentially (concurrency: 1)
// but different bots can process in parallel to avoid cross-location latency.
const queues = new Map<string, PQueue>();

function getOrCreateQueue(botId: string): PQueue {
  if (!queues.has(botId)) {
    const q = new PQueue({ concurrency: 1 });
    q.on('active', () => {
      logger.info(`[${botId}] Processing request (pending: ${q.pending}, queued: ${q.size})`);
    });
    queues.set(botId, q);
  }
  return queues.get(botId)!;
}

export function enqueue<T>(fn: () => Promise<T>, botId?: string): Promise<T> {
  const q = botId ? getOrCreateQueue(botId) : getOrCreateQueue('_global');
  return q.add(fn) as Promise<T>;
}

export function getQueueStatus() {
  let totalPending = 0;
  let totalSize = 0;
  for (const q of queues.values()) {
    totalPending += q.pending;
    totalSize += q.size;
  }
  return { pending: totalPending, size: totalSize, activeBots: queues.size };
}
