import type { Attitude, BotConfig } from '../config';
import { ageBandOf } from './appearance';
import type { Appearance, Pad, Stance } from './types';

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const MAX_OFFSET = 0.6;

function matches(attitude: Attitude, appearance: Appearance | null): boolean {
  if (!appearance) return false;
  const { gender, ageBand, appearsLike } = attitude.match;
  if (gender && appearance.gender !== gender) return false;
  if (ageBand && ageBandOf(appearance.apparentAge) !== ageBand) return false;
  if (appearsLike) {
    const seen = [appearance.physicalDescription, appearance.publicDescription, appearance.visibleMarks].join(' ').toLowerCase();
    if (!appearsLike.some((k) => seen.includes(k.toLowerCase()))) return false;
  }
  return true;
}

/**
 * Cosa la scheda del bot dice di questa persona: il rapporto autorato (per
 * characterId) e gli atteggiamenti verso le categorie che le corrispondono.
 * Non si salva su DB: modificare la scheda cambia subito il comportamento.
 */
export function resolveStance(bot: Pick<BotConfig, 'relationships' | 'attitudes'>, characterId: string, appearance: Appearance | null): Stance {
  const rel = bot.relationships.find((r) => r.characterId === characterId);
  const attitudes = bot.attitudes.filter((a) => matches(a, appearance));

  const offset: Pad = { p: rel?.moodOffset.p ?? 0, a: rel?.moodOffset.a ?? 0, d: rel?.moodOffset.d ?? 0 };
  const shift = { trust: 0, respect: 0, suspicion: 0 };
  for (const a of attitudes) {
    offset.p += a.moodOffset.p;
    offset.a += a.moodOffset.a;
    offset.d += a.moodOffset.d;
    shift.trust += a.trustShift;
    shift.respect += a.respectShift;
    shift.suspicion += a.suspicionShift;
  }

  const initial = rel
    ? {
        ...(rel.trust !== undefined ? { trust: rel.trust } : {}),
        ...(rel.respect !== undefined ? { respect: rel.respect } : {}),
        ...(rel.suspicion !== undefined ? { suspicion: rel.suspicion } : {}),
      }
    : undefined;

  return {
    authored: !!rel,
    ...(rel ? { label: rel.label } : {}),
    ...(rel?.backstory ? { backstory: rel.backstory } : {}),
    hints: [rel?.hint, ...attitudes.map((a) => a.hint)].filter((h): h is string => !!h),
    knowsName: rel?.knowsName ?? false,
    moodOffset: { p: clamp(offset.p, -MAX_OFFSET, MAX_OFFSET), a: clamp(offset.a, -MAX_OFFSET, MAX_OFFSET), d: clamp(offset.d, -MAX_OFFSET, MAX_OFFSET) },
    ...(initial ? { initial } : {}),
    shift,
  };
}

/** L'umore con cui il bot parla a questa persona: quello di fondo più l'effetto che lei ha su di lui. */
export function effectivePad(mood: Pad, stance: Stance): Pad {
  return {
    p: clamp(mood.p + stance.moodOffset.p, -1, 1),
    a: clamp(mood.a + stance.moodOffset.a, -1, 1),
    d: clamp(mood.d + stance.moodOffset.d, -1, 1),
  };
}
