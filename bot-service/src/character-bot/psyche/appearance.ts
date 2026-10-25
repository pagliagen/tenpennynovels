import type { AGE_BANDS } from '../config';
import type { Appearance } from './types';

export type AgeBand = (typeof AGE_BANDS)[number];

export function ageBandOf(apparentAge: number | undefined): AgeBand | undefined {
  if (apparentAge === undefined) return undefined;
  if (apparentAge < 16) return 'child';
  if (apparentAge < 30) return 'young';
  if (apparentAge < 50) return 'adult';
  if (apparentAge < 65) return 'mature';
  return 'old';
}

/** "Una ventina d'anni", non "22": il bot stima a occhio, come una persona. */
export function ageImpression(age: number, who: string): string {
  if (age < 13) return `A occhio è ${who === 'una donna' ? 'una bambina' : 'un bambino'}.`;
  if (age < 18) return `A occhio è ${who === 'una donna' ? 'una ragazzina' : 'un ragazzino'}.`;
  if (age >= 77) return `A occhio è ${who} molto anziano/a.`.replace('anziano/a', who === 'una donna' ? 'anziana' : 'anziano');
  const decades = [[27, 'una ventina'], [37, 'una trentina'], [47, 'una quarantina'], [57, 'una cinquantina'], [67, 'una sessantina']] as const;
  const found = decades.find(([limit]) => age < limit);
  return `A occhio è ${who} di ${found ? found[1] : 'una settantina'} d'anni.`;
}

/** Cosa il bot vede della persona che ha davanti: solo campi pubblici della scheda. */
export function describeAppearance(a: Appearance | null): string[] {
  if (!a) return [];
  const lines: string[] = [];
  const who = a.gender === 'male' ? 'un uomo' : a.gender === 'female' ? 'una donna' : 'una persona';
  if (a.apparentAge !== undefined) {
    lines.push(ageImpression(a.apparentAge, who));
  } else if (a.gender) {
    lines.push(`Hai davanti ${who}.`);
  }
  const looks = [a.height && `alt${a.gender === 'female' ? 'a' : 'o'} ${a.height}`, a.hairColor && `capelli ${a.hairColor}`, a.eyeColor && `occhi ${a.eyeColor}`].filter(Boolean);
  if (looks.length > 0) lines.push(`Noti: ${looks.join(', ')}.`);
  if (a.physicalDescription) lines.push(`Aspetto: ${a.physicalDescription}`);
  if (a.publicDescription) lines.push(`Si sa in giro: ${a.publicDescription}`);
  if (a.visibleMarks) lines.push(`Segni visibili: ${a.visibleMarks}`);
  return lines;
}
