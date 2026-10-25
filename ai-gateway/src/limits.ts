import type { IncomingMessage } from 'node:http';

/** Finestra mobile di 60 s, globale (non per IP: dietro a un tunnel l'IP è sempre quello del tunnel). */
export class RateLimiter {
  private hits: number[] = [];

  constructor(private readonly perMinute: number, private readonly now: () => number = Date.now) {}

  allow(): boolean {
    const t = this.now();
    this.hits = this.hits.filter((h) => t - h < 60_000);
    if (this.hits.length >= this.perMinute) return false;
    this.hits.push(t);
    return true;
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Legge il corpo fino a `max` byte; oltre, 413 senza leggere il resto. */
export async function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, 'Corpo troppo grande');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new HttpError(413, 'Corpo troppo grande');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
