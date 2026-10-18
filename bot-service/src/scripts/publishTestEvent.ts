/**
 * Simula un messaggio di giocatore sul canale Redis, senza passare dal game.
 * Uso: npm run simulate -- <locationId> "<testo>" [nomePersonaggio] [posizione]
 * La risposta viene comunque postata al backend vero: serve un bot configurato
 * e un unified-backend attivo (altrimenti si vede solo la generazione nei log).
 */
import 'dotenv/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { BOT_CHAT_CHANNEL } from '../events';

async function main(): Promise<void> {
  const [locationId, content, name = 'Tester', position] = process.argv.slice(2);
  if (!locationId || !content) {
    process.stderr.write('Uso: npm run simulate -- <locationId> "<testo>" [nomePersonaggio] [posizione]\n');
    process.exit(1);
  }

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redis.publish(BOT_CHAT_CHANNEL, JSON.stringify({
    eventId: randomUUID(),
    chatId: randomUUID().replace(/-/g, '').slice(0, 24),
    characterId: 'simulated-player',
    characterName: name,
    locationId,
    content,
    actionType: 'standard',
    visibility: 'public',
    isHidden: false,
    position,
    positionDescription: position === 'Ingresso' ? "Punto d'ingresso alla location: qui i personaggi arrivano provenendo dall'esterno." : undefined,
    timestamp: new Date().toISOString(),
  }));
  await redis.quit();
}

void main();
