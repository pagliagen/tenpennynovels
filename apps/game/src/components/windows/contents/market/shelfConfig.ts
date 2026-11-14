/**
 * Configurazione dello scaffale del Mercato.
 *
 * Unica sorgente per posizioni e testi delle etichette cliccabili. Le coordinate sono
 * percentuali dell'immagine di sfondo (`/images/market/sfondo-mercato.jpg`, 422×263), cioè
 * il riquadro del TESTO misurato sul mockup: l'area cliccabile è più ampia (vedi Market.module.scss).
 * Se si sostituisce lo sfondo con una versione a risoluzione maggiore ma stesse proporzioni,
 * non cambia nulla. Per ritoccare a occhio: `?marketDebug=1` in sviluppo.
 */

export type MarketSectionId = 'servizi' | 'farmacia' | 'camuffamento' | 'armi' | 'trasporti' | 'mestiere';

export const SHELF_IMAGE = '/images/market/sfondo-mercato.jpg';
export const SHELF_IMAGE_WIDTH = 422;
export const SHELF_IMAGE_HEIGHT = 263;

export interface ShelfSection {
  id: MarketSectionId;
  /** Titolo completo (aria-label, intestazione del reparto). */
  title: string;
  /** Righe in cui l'etichetta va a capo sullo scaffale. */
  lines: string[];
  /** Riquadro del testo, in % dell'immagine. */
  text: { x: number; y: number; w: number; h: number };
  /** Dimensione del carattere in % della larghezza dello scaffale (unità cqw). */
  fontCqw: number;
  /** Inclinazione, per le scritte appese in obliquo (es. il cartellino). */
  rotateDeg?: number;
  /** `dark` per le scritte su fondo chiaro (il cartellino «Armi»), `light` sullo scaffale scuro. */
  tone?: 'light' | 'dark';
}

export const SHELF_SECTIONS: readonly ShelfSection[] = [
  { id: 'servizi', title: 'Servizi', lines: ['Servizi'], text: { x: 24.64, y: 20.53, w: 8.53, h: 4.94 }, fontCqw: 3.4 },
  {
    id: 'farmacia',
    title: 'Farmacia e medicina',
    lines: ['Farmacia', 'e medicina'],
    text: { x: 67.54, y: 19.77, w: 10.66, h: 8.37 },
    fontCqw: 2.9,
  },
  { id: 'camuffamento', title: 'Camuffamento', lines: ['Camuffamento'], text: { x: 10.66, y: 52.47, w: 18.48, h: 4.56 }, fontCqw: 3.5 },
  { id: 'armi', title: 'Armi', lines: ['Armi'], text: { x: 37.2, y: 60.08, w: 6.16, h: 4.56 }, fontCqw: 3.4, tone: 'dark' },
  { id: 'trasporti', title: 'Trasporti', lines: ['Trasporti'], text: { x: 69.91, y: 49.05, w: 11.85, h: 6.08 }, fontCqw: 3.4 },
  {
    id: 'mestiere',
    title: 'Attrezzi del mestiere',
    lines: ['Attrezzi del mestiere'],
    text: { x: 35.78, y: 81.75, w: 26.54, h: 5.7 },
    fontCqw: 3.6,
  },
];

export const SECTION_TITLES: Record<MarketSectionId, string> = Object.fromEntries(
  SHELF_SECTIONS.map((s) => [s.id, s.title])
) as Record<MarketSectionId, string>;

/** Etichette italiane delle sottocategorie usate come filtro nei reparti. */
export const SUBCATEGORY_LABELS: Record<string, string> = {
  ammunition: 'Munizioni',
  firearms: 'Armi da fuoco',
  melee: 'Corpo a corpo',
  ranged: 'Archi e balestre',
  explosives: 'Esplosivi',
  pharmacy: 'Farmaci e sostanze',
  'first-aid': 'Primo soccorso',
  disguise: 'Travestimenti',
  forgery: 'Falsificazione',
  personal: 'Mezzi personali',
  travel: 'Viaggi e biglietti',
  luggage: 'Bagagli',
  riding: 'Equitazione',
  water: 'Per acqua',
};
