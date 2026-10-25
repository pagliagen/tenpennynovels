/**
 * Simula un messaggio di giocatore chiamando il servizio come farebbe il gioco, senza passare dalla chat.
 * Uso: npm run simulate -- <locationId> "<testo>" [nomePersonaggio] [posizione] [characterId]
 *
 * Serve in `.env` di bot-service: BOT_SERVICE_SECRET (lo stesso del backend che risponde: firma il token di prova) e
 * ALLOWED_REPLY_ORIGINS che includa l'indirizzo di risposta. Opzionali: SIMULATE_ENVIRONMENT (default `local`),
 * SIMULATE_REPLY_URL (default http://localhost:3001), PORT (default 8788).
 * La risposta viene postata davvero al backend: serve un bot configurato per quella location e un backend attivo con
 * `ENABLE_BOT_CHAT=true` (altrimenti `/bot-api` risponde 404 e si vede solo la generazione nei log).
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { loadBotDefs, loadMapping } from '../config';
import { botPathsFromEnv } from '../registry';
import { signDevToken } from './devToken';

async function main(): Promise<void> {
  const [locationId, content, name = 'Tester', position, characterId = 'simulated-player'] = process.argv.slice(2);
  if (!locationId || !content) {
    process.stderr.write('Uso: npm run simulate -- <locationId> "<testo>" [nomePersonaggio] [posizione] [characterId]\n');
    process.exit(1);
  }
  const secret = process.env.BOT_SERVICE_SECRET;
  if (!secret || secret.length < 32) {
    process.stderr.write('Serve BOT_SERVICE_SECRET (almeno 32 caratteri) in bot-service/.env: è lo stesso del backend.\n');
    process.exit(1);
  }

  const environment = process.env.SIMULATE_ENVIRONMENT ?? 'local';
  const paths = botPathsFromEnv();
  const entry = loadMapping(paths.mappingFile).find((m) => m.locationId === locationId && m.environment === environment);
  const bot = entry && loadBotDefs(paths.botsDir).find((d) => d.characterId === entry.botId && d.environment === environment);
  if (!bot) {
    process.stderr.write(`Nessun bot per la location ${locationId} (ambiente ${environment}) in mapping.json.\n`);
    process.exit(1);
  }

  const now = new Date();
  const line = {
    characterId, characterName: name, content, position,
    positionDescription: position === 'Ingresso' ? "Punto d'ingresso alla location: qui i personaggi arrivano provenendo dall'esterno." : undefined,
  };
  const body = {
    environment,
    locationId,
    event: { eventId: randomUUID(), chatId: randomUUID().replace(/-/g, '').slice(0, 24), ...line, actionType: 'standard', visibility: 'public', isHidden: false, timestamp: now.toISOString() },
    history: [line],
    reply: {
      baseUrl: process.env.SIMULATE_REPLY_URL ?? 'http://localhost:3001',
      token: signDevToken({ env: environment, loc: locationId, bot: bot.characterId, exp: Math.floor(now.getTime() / 1000) + 15 * 60 }, secret),
    },
  };

  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? '8788'}/v1/character-bot/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  process.stdout.write(`${response.status} ${await response.text()}\n`);
}

void main();
