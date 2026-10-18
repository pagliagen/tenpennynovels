import type { Psyche } from '../config';
import { describeMood, describePsyche, describeRelation } from './describe';
import type { Pad, Relation } from './types';

/** Le sezioni di prompt con carattere, umore e rapporto: per scaletta e bozza. */
export function buildPsycheLines(psyche: Psyche, mood: Pad, relation: Relation | null, now: Date): string[] {
  return [
    '--- IL TUO CARATTERE ---',
    ...describePsyche(psyche),
    '',
    '--- IL TUO UMORE ORA ---',
    describeMood(mood),
    'Lascia che colori il tono e i gesti, senza dichiararlo mai apertamente.',
    '',
    '--- CHI HAI DAVANTI ---',
    ...describeRelation(relation, now),
  ];
}
