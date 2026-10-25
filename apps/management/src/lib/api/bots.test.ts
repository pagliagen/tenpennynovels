/** @jest-environment node */
import { designBot, takeSseEvents } from './bots';

const enc = new TextEncoder();
const sse = (...chunks: string[]): Response =>
  new Response(new ReadableStream({ start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

const request = { locationId: 'a'.repeat(24), description: 'una cameriera sbrigativa, vedova' };
const RESULT = { draft: null, checks: [{ code: 'schema', ok: false }], attempts: 2, ms: 31000 };

describe('takeSseEvents', () => {
  it('spacchetta gli eventi completi, ignora i battiti e tiene la coda incompleta', () => {
    const { events, rest } = takeSseEvents(': battito\n\nevent: progress\ndata: {"elapsedMs":5000}\n\nevent: result\ndata: {"a"');
    expect(events).toEqual([{ event: 'progress', data: '{"elapsedMs":5000}' }]);
    expect(rest).toBe('event: result\ndata: {"a"');
  });

  it('accetta fine riga CRLF e più righe data', () => {
    const { events } = takeSseEvents('event: x\r\ndata: uno\r\ndata: due\r\n\r\n');
    expect(events).toEqual([{ event: 'x', data: 'uno\ndue' }]);
  });
});

describe('designBot', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('legge i battiti e restituisce il risultato, anche con gli eventi spezzati tra un pezzo e l\'altro', async () => {
    global.fetch = jest.fn().mockResolvedValue(sse('event: progress\ndata: {"elapsedMs":0}\n\nevent: prog', 'ress\ndata: {"elapsedMs":5000}\n\nevent: result\n', `data: ${JSON.stringify(RESULT)}\n\n`));
    const progress: number[] = [];
    const out = await designBot(request, { onProgress: (ms) => progress.push(ms) });
    expect(out).toEqual(RESULT);
    expect(progress).toEqual([0, 5000]);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/admin\/bots\/design$/);
    expect(init.credentials).toBe('include');
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it('un evento error diventa un errore con il messaggio del server', async () => {
    global.fetch = jest.fn().mockResolvedValue(sse('event: error\ndata: {"message":"Il servizio AI è occupato","code":"AI_UNAVAILABLE"}\n\n'));
    await expect(designBot(request)).rejects.toThrow('Il servizio AI è occupato');
  });

  it('errori di validazione (JSON normale): il messaggio del server; 401: sessione scaduta', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Questa location ha già un bot.' }), { status: 409 }));
    await expect(designBot(request)).rejects.toThrow('Questa location ha già un bot.');
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 401 }));
    await expect(designBot(request)).rejects.toThrow(/Sessione scaduta/);
  });

  it('il flusso che si chiude senza risultato è un errore, non un successo vuoto', async () => {
    global.fetch = jest.fn().mockResolvedValue(sse('event: progress\ndata: {"elapsedMs":0}\n\n'));
    await expect(designBot(request)).rejects.toThrow(/interrotta/);
  });
});
