import { z } from 'zod';

/**
 * La bozza di un bot come la produce `bot-service` (`character-bot/designer.ts`) e come torna dal gestionale dopo
 * la correzione a mano. I limiti sono quelli del modello `Character` e di `botDefSchema`: stessa forma, scritta due
 * volte perché i due pacchetti non condividono codice (se cambia uno, va allineato l'altro).
 */
export const characterFieldsSchema = z.object({
  name: z.string().trim().min(3).max(50),
  firstName: z.string().trim().min(1).max(50),
  surname: z.string().trim().min(1).max(50),
  gender: z.enum(['male', 'female']),
  age: z.number().int().min(18).max(80),
  apparentAge: z.number().int().min(14).max(90),
  height: z.string().trim().min(3).max(20),
  eyeColor: z.string().trim().min(2).max(50),
  hairColor: z.string().trim().min(2).max(50),
  visibleMarks: z.string().trim().max(500),
  physicalDescription: z.string().trim().min(20).max(5000),
  publicDescription: z.string().trim().min(10).max(5000),
});

export const draftSchema = z.object({
  character: characterFieldsSchema,
  persona: z.string().trim().min(20).max(5000),
  psyche: z.object({
    ocean: z.object({ O: z.number().min(1).max(100), C: z.number().min(1).max(100), E: z.number().min(1).max(100), A: z.number().min(1).max(100), N: z.number().min(1).max(100) }),
    enneagram: z.object({ type: z.number().int().min(1).max(9), fear: z.string().min(3), desire: z.string().min(3) }),
    pad: z.object({ p: z.number().min(-1).max(1), a: z.number().min(-1).max(1), d: z.number().min(-1).max(1) }),
  }),
});

export type BotDraft = z.infer<typeof draftSchema>;
export type CharacterFields = z.infer<typeof characterFieldsSchema>;

/** Il testo che il modello ha scritto per il personaggio: serve ai controlli (anacronismi). */
export function draftText(draft: BotDraft): string {
  const c = draft.character;
  return [draft.persona, c.physicalDescription, c.publicDescription, c.visibleMarks].filter(Boolean).join('\n');
}

/** La scheda che `bot-service` salva in `bots/<nome>.json` (il resto dei campi ha i suoi default). */
export function botSheet(draft: BotDraft, characterId: string): { name: string; characterId: string; persona: string; psyche: BotDraft['psyche'] } {
  return { name: draft.character.name, characterId, persona: draft.persona, psyche: draft.psyche };
}
