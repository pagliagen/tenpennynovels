/**
 * Parole che nel 1895 non esistono (o non nel senso comune): se compaiono in un testo del mondo
 * vanno guardate da una persona. Lista conservativa, precisione prima della completezza: NON ci
 * sono cose che invece c'erano (telefono dal 1876, telegrafo, bicicletta, automobile rarissima ma
 * esistente, cinematografo dal dicembre 1895, Coca-Cola dal 1886…).
 */
export const ANACHRONISMS: readonly string[] = [
  'computer', 'cellulare', 'smartphone', 'internet', 'e-mail', 'email', 'televisione', 'televisore',
  'aeroplano', 'aereo', 'elicottero', 'radar', 'nylon', 'penicillina', 'antibiotico', 'antibiotici',
  'plastica', 'supermercato', 'lavatrice', 'aspirapolvere', 'videogioco', 'videogiochi', 'hamburger',
  'autostrada', 'astronauta', 'atomica', 'fotocopia', 'microonde',
];

const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const PATTERN = new RegExp(`(?<![\\p{L}\\d])(${ANACHRONISMS.map((w) => w.replace(ESCAPE, '\\$&')).join('|')})(?![\\p{L}\\d])`, 'giu');

export interface AnachronismHit {
  word: string;
  excerpt: string;
}

/** Le parole anacronistiche in un testo, con la frase intorno. */
export function findAnachronisms(text: string): AnachronismHit[] {
  const hits: AnachronismHit[] = [];
  for (const match of text.matchAll(PATTERN)) {
    const at = match.index ?? 0;
    hits.push({
      word: match[1]!.toLowerCase(),
      excerpt: text.slice(Math.max(0, at - 40), at + match[1]!.length + 40).replace(/\s+/g, ' ').trim(),
    });
  }
  return hits;
}
