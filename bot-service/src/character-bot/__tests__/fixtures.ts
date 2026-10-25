import { botSchema, type BotConfig } from '../config';

export const PSYCHE = {
  ocean: { O: 35, C: 70, E: 30, A: 45, N: 25 },
  enneagram: { type: 6, fear: 'essere tradito o truffato', desire: 'sentirsi al sicuro tra gente fidata' },
  pad: { p: 0.1, a: -0.2, d: 0.4 },
};

export function testBot(over: Record<string, unknown> = {}): BotConfig {
  return botSchema.parse({
    name: 'Mrs. Hargreave',
    characterId: 'bot1',
    locationId: 'loc1',
    persona: 'Sei Mrs. Hargreave, la locandiera del Rusty Anchor.',
    psyche: PSYCHE,
    ...over,
  });
}
