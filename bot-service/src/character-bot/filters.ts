import type { BotConfig } from './config';
import type { ChatEvent } from './events';

/**
 * Un messaggio entra nella storia solo se tutti i presenti lo vedono:
 * standard, pubblico, non nascosto. Sussurri e azioni master non devono mai
 * arrivare al modello (e quindi nemmeno finire in una risposta pubblica).
 */
export function isPublicStandard(event: ChatEvent): boolean {
  return event.actionType === 'standard' && event.visibility === 'public' && !event.isHidden;
}

export function mentionsBot(content: string, botName: string): boolean {
  const text = content.toLowerCase();
  const full = botName.toLowerCase();
  if (text.includes(full)) return true;
  // "Mrs. Hargreave" → anche "Hargreave": ultimo token, se abbastanza distintivo.
  const last = full.split(/\s+/).at(-1) ?? '';
  return last.length >= 4 && new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

/** Il bot deve considerare di rispondere a questo evento? */
export function shouldTrigger(event: ChatEvent, bot: BotConfig, botCharacterIds: ReadonlySet<string>): boolean {
  if (!isPublicStandard(event)) return false;
  if (event.locationId !== bot.locationId) return false;
  // Nessun bot risponde a un bot: evita loop e catene bot→bot.
  if (botCharacterIds.has(event.characterId)) return false;
  if (bot.respondTo === 'mention') return mentionsBot(event.content, bot.name);
  return true;
}
