import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'crypto';

export interface ClientConfig {
  id: string;
  name: string;
  apiKey: string;
  hmacSecret?: string;
  permissions: string[];
  rateLimit: {
    maxPerMinute: number;
  };
}

let clients: ClientConfig[] = [];

export function loadClients(): void {
  const filePath = resolveClientsFile();

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('clients.json must be a non-empty JSON array');
    }

    for (const c of parsed) {
      if (!c.id || !c.apiKey) {
        throw new Error(`Client missing id or apiKey: ${JSON.stringify(c)}`);
      }
    }

    clients = parsed;
    console.log(`[Gateway] Loaded ${clients.length} client(s) from ${filePath}: ${clients.map(c => c.id).join(', ')}`);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error(`[Gateway] Client file not found: ${filePath}`);
      console.error('[Gateway] Copy clients.json.example to clients.json and configure your API keys.');
    } else {
      console.error(`[Gateway] Failed to load clients from ${filePath}: ${err.message}`);
    }
    process.exit(1);
  }
}

function resolveClientsFile(): string {
  if (process.env.CLIENTS_FILE) {
    return process.env.CLIENTS_FILE;
  }

  const candidates = [
    path.resolve('/app/clients.json'),
    path.resolve(__dirname, '../../clients.json'),
    path.resolve(process.cwd(), 'clients.json'),
    path.resolve(process.cwd(), '../clients.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function resolveClient(apiKey: string, clientId?: string): ClientConfig | null {
  const match = clients.find(c => safeEqual(c.apiKey, apiKey));
  if (!match) return null;

  if (clientId && match.id !== clientId) return null;

  return match;
}

export function getClients(): ClientConfig[] {
  return clients;
}
