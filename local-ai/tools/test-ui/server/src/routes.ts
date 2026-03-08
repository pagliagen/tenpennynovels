import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const router = Router();

function loadApiKeyFromClients(): string {
  const candidates = [
    path.resolve('/app/clients.json'),
    path.resolve(__dirname, '../../../../clients.json'),
    path.resolve(process.cwd(), 'clients.json'),
  ];

  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const clients = JSON.parse(raw) as Array<{ id: string; apiKey: string; hmacSecret?: string }>;
      const devClient = clients.find((c) => !c.hmacSecret);
      return devClient?.apiKey || clients[0]?.apiKey || '';
    } catch {
      continue;
    }
  }
  return '';
}

interface SSEClient {
  id: string;
  res: Response;
}

const sseClients: SSEClient[] = [];

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.res.write(payload);
  }
}

router.get('/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

router.get('/config', (_req: Request, res: Response) => {
  const callbackUrl = process.env.CALLBACK_URL || 'http://localhost:3100';
  const apiKey = process.env.API_KEY || loadApiKeyFromClients();

  res.json({
    gatewayUrl: '/gw',
    callbackUrl: `${callbackUrl}/api/callback`,
    apiKey,
  });
});

router.post('/callback', (req: Request, res: Response) => {
  const payload = req.body;
  const eventType = payload.type || 'callback';

  broadcast(eventType, payload);

  res.json({ success: true });
});
