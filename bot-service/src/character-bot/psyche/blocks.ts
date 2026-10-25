import type { Psyche } from '../config';
import { describeAppearance } from './appearance';
import { describeMood, describePsyche, describeRelation } from './describe';
import type { Appearance, Pad, Relation, Stance } from './types';

/** Come l'umore cambia il MODO di rispondere (mai il se: la giocata va sempre lanciata). */
export function describeDemeanor(pad: Pad): string[] {
  const lines: string[] = [];
  if (pad.p <= -0.25) lines.push('Sei di cattivo umore: risposte più secche, poca cortesia, qualche frecciata. Non per questo rifiuti di giocare: rispondi, ma fai sentire che non hai voglia di chiacchierare.');
  else if (pad.p >= 0.3) lines.push('Sei di buon umore: più caloroso del solito, qualche battuta in più.');
  if (pad.a >= 0.35) lines.push('Sei agitato: frasi più corte e nervose, gesti bruschi.');
  else if (pad.a <= -0.4) lines.push('Sei posato e lento: poche parole, gesti tranquilli.');
  if (pad.d <= -0.25) lines.push('Ti senti in soggezione o sotto pressione: sei più cauto e meno sicuro di te.');
  return lines;
}

export interface PsycheInput {
  psyche: Psyche;
  /** Umore effettivo con questa persona (di fondo + effetto di lei/lui). */
  mood: Pad;
  relation: Relation | null;
  stance?: Stance;
  appearance?: Appearance | null;
  /** Nome con cui il bot la conosce, se lo conosce. */
  name?: string;
  now: Date;
  /** Altri presenti con cui il bot ha un rapporto: «Mrs. X (tua sorella)». */
  others?: string[];
  /** Il meteo, già in frasi e già filtrato (environment.ts): vuoto se non serve dirlo. */
  environment?: string[];
  /** Luoghi e ambientazione che il bot può usare per rispondere (knowledge.ts): vuoto se non servono. */
  knowledge?: string[];
}

/** Le sezioni di prompt con carattere, umore e rapporto: per scaletta e bozza. */
export function buildPsycheLines(input: PsycheInput): string[] {
  const { psyche, mood, relation, stance, appearance, name, now, others, environment, knowledge } = input;
  const seen = describeAppearance(appearance ?? null);
  const demeanor = describeDemeanor(mood);
  return [
    '--- IL TUO CARATTERE ---',
    ...describePsyche(psyche),
    '',
    '--- IL TUO UMORE ORA ---',
    describeMood(mood),
    'Lascia che colori il tono e i gesti, senza dichiararlo mai apertamente.',
    ...demeanor,
    '',
    '--- CHI HAI DAVANTI ---',
    ...describeRelation(relation, now, stance, name, appearance?.gender),
    ...(seen.length > 0 ? ['Quello che vedi:', ...seen] : []),
    ...(!relation || relation.interactions === 0
      ? !stance?.authored ? ['Se non la conosci, presentati nel modo che il tuo carattere suggerisce (un taciturno o un diffidente può dire poco o niente di sé). Puoi commentare ciò che vedi di lei, ma sono solo impressioni: non inventare altro.'] : []
      : []),
    ...(others && others.length > 0 ? ['', '--- ALTRI PRESENTI ---', ...others] : []),
    ...(environment && environment.length > 0 ? ['', '--- FUORI DAL LOCALE ---', ...environment] : []),
    ...(knowledge && knowledge.length > 0 ? ['', '--- COSA SAI DEL MONDO ---', ...knowledge] : []),
  ];
}
