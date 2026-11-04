/**
 * Scala della dimensione del carattere dell'editor documenti.
 *
 * Cinque gradini, non px liberi: restano coerenti con la tipografia del sito e
 * leggibili da mobile. "Normale" è l'assenza di valore (nessun mark).
 *
 * ⚠️ I valori sono scritti nel JSON del documento e devono coincidere con
 * `FONT_SIZE_CLASSES` in `services/unified-backend/.../HtmlGenerator.ts` (che li
 * trasforma in classi `fs-*`) e con le classi in `apps/documents/.../
 * DocumentDetail.module.scss`. Niente npm workspace: tre posti da tenere allineati.
 */
export interface FontSizeOption {
  label: string;
  /** Valore CSS scritto da TipTap; `null` = dimensione normale. */
  value: string | null;
}

export const FONT_SIZES: readonly FontSizeOption[] = [
  { label: 'Piccolo', value: '0.85em' },
  { label: 'Normale', value: null },
  { label: 'Grande', value: '1.2em' },
  { label: 'Più grande', value: '1.5em' },
  { label: 'Enorme', value: '2em' }
];

/** Valore dell'<option> per "nessuna dimensione" (un <select> non accetta null). */
export const NORMAL_SIZE_VALUE = '';

/** Valore dell'<option> mostrata quando il testo ha una misura fuori scala (documenti vecchi). */
export const CUSTOM_SIZE_VALUE = '__custom';

export function isKnownFontSize(value: string | null | undefined): boolean {
  return !value || FONT_SIZES.some((size) => size.value === value);
}
