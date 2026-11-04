/**
 * Palette dei colori dell'editor documenti: stessa impostazione del selettore
 * di Google Docs (una riga di grigi, una di tinte piene, cinque di varianti
 * chiare e scure), più una riga di colori "del tema" vittoriano.
 */

const HUES = [350, 0, 30, 55, 120, 175, 215, 225, 275, 320] as const;

/** Riga dei grigi, dal nero al bianco. */
const GRAYS = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'];

/** [saturazione, luminosità] di ciascuna delle 6 righe a colori. */
const COLOR_ROWS: ReadonlyArray<readonly [number, number]> = [
  [100, 50], // tinta piena
  [95, 88], // chiaro 3
  [90, 76], // chiaro 2
  [85, 64], // chiaro 1
  [90, 36], // scuro 1
  [90, 26] // scuro 2
];

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const value = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** 7 righe × 10 colonne: grigi + 6 righe di tinte. */
export function buildColorGrid(): string[][] {
  return [GRAYS, ...COLOR_ROWS.map(([s, l]) => HUES.map((h) => hslToHex(h, s, l)))];
}

/** Colori del tema vittoriano del progetto (stessi toni del gestionale e del gioco). */
export const THEME_COLORS = ['#0d0d0d', '#5c4b37', '#8b4513', '#b8860b', '#8b1a1a', '#2d5016', '#1a5f8b', '#4a2c5a'];

const RECENT_KEY = 'documentEditor.recentColors';
const RECENT_MAX = 10;

/** Colori usati di recente. localStorage può mancare o lanciare (finestra privata, anteprime): mai bloccante. */
export function loadRecentColors(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberColor(color: string): string[] {
  const next = [color, ...loadRecentColors().filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* non persistito: resta nello stato del componente */
  }
  return next;
}
