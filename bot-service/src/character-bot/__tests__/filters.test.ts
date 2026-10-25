import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testBot } from './fixtures';
import { shouldTrigger, mentionsBot, isPublicStandard } from '../filters';
import type { ChatEvent } from '../events';

const bot = testBot();
const bots = new Set(['bot1', 'bot2']);

const ev = (over: Partial<ChatEvent> = {}): ChatEvent => ({
  eventId: 'e', chatId: 'c', characterId: 'p1', characterName: 'John', locationId: 'loc1',
  content: 'Buonasera', actionType: 'standard', visibility: 'public', isHidden: false,
  timestamp: new Date().toISOString(), ...over,
});

test('risponde a un messaggio pubblico nella sua location', () => {
  assert.equal(shouldTrigger(ev(), bot, bots), true);
});

test('ignora altre location', () => {
  assert.equal(shouldTrigger(ev({ locationId: 'loc2' }), bot, bots), false);
});

test('non vede sussurri, master, azioni nascoste', () => {
  assert.equal(isPublicStandard(ev({ visibility: 'whisper' })), false);
  assert.equal(isPublicStandard(ev({ visibility: 'master_only' })), false);
  assert.equal(isPublicStandard(ev({ actionType: 'master' })), false);
  assert.equal(isPublicStandard(ev({ isHidden: true })), false);
});

test('non risponde a nessun bot (anti-loop, anche altri bot)', () => {
  assert.equal(shouldTrigger(ev({ characterId: 'bot1' }), bot, bots), false);
  assert.equal(shouldTrigger(ev({ characterId: 'bot2' }), bot, bots), false);
});

test('modalità mention: solo se citato, anche per cognome', () => {
  const m = { ...bot, respondTo: 'mention' as const };
  assert.equal(shouldTrigger(ev(), m, bots), false);
  assert.equal(shouldTrigger(ev({ content: 'Mrs. Hargreave, una birra' }), m, bots), true);
  assert.equal(shouldTrigger(ev({ content: 'Ehi Hargreave!' }), m, bots), true);
});

test('mentionsBot non scatta su token troppo corti', () => {
  assert.equal(mentionsBot('Mr Li passa di qui', 'Mr Li'), true);
  assert.equal(mentionsBot('il lido è chiuso', 'Mr Li'), false);
});
