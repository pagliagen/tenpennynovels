/**
 * Ciò che un bot può "vedere" di un personaggio: solo i campi che la scheda
 * dichiara visibili a tutti. Whitelist esplicita (default-deny): `age`,
 * `birthDate`, `privateDescription`, `hiddenMarks` & co. non entrano mai,
 * anche se in futuro vengono aggiunti campi alla scheda.
 */
export interface PublicAppearance {
  _id: string;
  gender?: 'male' | 'female';
  /** Età apparente (non quella reale). */
  apparentAge?: number;
  physicalDescription?: string;
  publicDescription?: string;
  height?: string;
  hairColor?: string;
  eyeColor?: string;
  visibleMarks?: string;
}

/** Campi della scheda che questo modulo legge: tutto il resto viene ignorato. */
export interface AppearanceSource {
  _id: { toString(): string };
  gender?: 'male' | 'female' | null;
  apparentAge?: number | null;
  physicalDescription?: string | null;
  publicDescription?: string | null;
  height?: string | null;
  hairColor?: string | null;
  eyeColor?: string | null;
  visibleMarks?: string | null;
}

export const APPEARANCE_FIELDS = [
  'gender', 'apparentAge', 'physicalDescription', 'publicDescription', 'height', 'hairColor', 'eyeColor', 'visibleMarks',
] as const;

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function toPublicAppearance(character: AppearanceSource): PublicAppearance {
  const out: PublicAppearance = { _id: character._id.toString() };
  if (character.gender === 'male' || character.gender === 'female') out.gender = character.gender;
  if (typeof character.apparentAge === 'number' && Number.isFinite(character.apparentAge)) out.apparentAge = character.apparentAge;
  for (const key of ['physicalDescription', 'publicDescription', 'height', 'hairColor', 'eyeColor', 'visibleMarks'] as const) {
    const value = text(character[key]);
    if (value) out[key] = value;
  }
  return out;
}
