import PQueue from 'p-queue';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('Queue');

const queue = new PQueue({ concurrency: 1 });

queue.on('active', () => {
  logger.info(`Processing request (pending: ${queue.pending}, queued: ${queue.size})`);
});

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return queue.add(fn) as Promise<T>;
}

export function getQueueStatus() {
  return { pending: queue.pending, size: queue.size };
}
