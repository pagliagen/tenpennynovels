import PQueue from 'p-queue';

export class QueueFullError extends Error {
  constructor() {
    super('Coda piena');
  }
}

/**
 * Una generazione alla volta (Ollama locale ne elabora una per volta), con un numero massimo di
 * richieste in attesa: oltre, si rifiuta subito invece di accumulare lavoro che nessuno aspetta più.
 */
export class BoundedQueue {
  private readonly queue = new PQueue({ concurrency: 1 });

  constructor(private readonly maxWaiting: number) {}

  /** Richieste in corso + in attesa. */
  get load(): number {
    return this.queue.pending + this.queue.size;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    // `pending` = in esecuzione (0 o 1), `size` = in attesa.
    if (this.queue.size >= this.maxWaiting && this.queue.pending >= 1) throw new QueueFullError();
    return (await this.queue.add(task)) as T;
  }

  clear(): void {
    this.queue.clear();
  }
}
