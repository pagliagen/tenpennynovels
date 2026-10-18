/**
 * Controlli di qualità su una battuta generata, confrontata con le ultime
 * battute dello stesso bot. Un modello piccolo copia sé stesso dal contesto
 * (stesse immagini, stesse aperture) e a volte scrive le azioni in prima
 * persona: lo si rileva qui e il responder rigenera con un feedback preciso.
 */

export type Issue =
  | { type: 'repeat'; phrases: string[] }
  | { type: 'opener'; words: string }
  | { type: 'person'; word: string }
  | { type: 'invented'; names: string[] };

const SHINGLE = 3;
/** Una frase ripetuta di almeno questa lunghezza (in parole) è sempre un problema. */
const MIN_REPEATED_PHRASE_WORDS = 4;
/** Oppure bastano tre trigrammi condivisi sparsi. */
const MAX_SHARED_SHINGLES = 2;

/** Avverbi e preposizioni in -o che aprono un'azione senza essere un verbo in prima persona. */
const NOT_A_VERB = new Set(['adesso', 'dietro', 'intanto', 'subito', 'ancora', 'poco', 'dopo', 'come', 'sotto', 'sopra', 'molto', 'piano', 'solo', 'ormai', 'quando', 'sempre']);

function words(text: string): string[] {
  return text.toLowerCase().replace(/['’]/g, ' ').match(/[a-zàèéìòù]+/g) ?? [];
}

function shingles(ws: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + SHINGLE <= ws.length; i++) out.push(ws.slice(i, i + SHINGLE).join(' '));
  return out;
}

/** Tre parole brevi di fila ("che non si") sono grammatica, non ripetizione. */
function isTrivial(shingle: string): boolean {
  return shingle.split(' ').every((w) => w.length <= 3);
}

function repeatedPhrases(draft: string[], previous: Set<string>): { phrases: string[]; shared: number } {
  const sh = shingles(draft);
  const hit = sh.map((s) => previous.has(s) && !isTrivial(s));
  const phrases: string[] = [];
  let shared = 0;
  let i = 0;
  while (i < hit.length) {
    if (!hit[i]) { i++; continue; }
    let j = i;
    while (j + 1 < hit.length && hit[j + 1]) j++;
    shared += j - i + 1;
    phrases.push(draft.slice(i, j + SHINGLE).join(' '));
    i = j + 1;
  }
  return { phrases, shared };
}

/** Titoli che introducono un nome proprio: "Mrs. Halloway", "Ispettore Grey". */
const TITLED_NAME = /\b(?:Mrs?\.?|Miss|Lady|Lord|Sir|Madame|Signor[ae]?|Dottor[e]?|Ispettor[e]?|Inspector|Padre|Reverendo|Capitano|Sergente)\s+([A-ZÀ-Ý][a-zà-ÿ]+)/g;

function inventedNames(draft: string, knownText: string): string[] {
  const known = knownText.toLowerCase();
  const names = new Set<string>();
  for (const [, surname] of draft.matchAll(TITLED_NAME)) {
    if (surname && !known.includes(surname.toLowerCase())) names.add(surname);
  }
  return [...names];
}

/**
 * @param knownText tutto il testo da cui un nome può legittimamente venire
 *   (persona, nomi e battute della chat): un nome con titolo che non compare
 *   lì è stato inventato dal modello.
 */
export function findIssues(draft: string, previousOwn: string[], knownText = ''): Issue[] {
  const issues: Issue[] = [];
  const draftWords = words(draft);

  const previousShingles = new Set(previousOwn.flatMap((p) => shingles(words(p))));
  const { phrases, shared } = repeatedPhrases(draftWords, previousShingles);
  const long = phrases.filter((p) => p.split(' ').length >= MIN_REPEATED_PHRASE_WORDS);
  if (long.length > 0 || shared > MAX_SHARED_SHINGLES) {
    issues.push({ type: 'repeat', phrases: long.length > 0 ? long : phrases });
  }

  const opener = draftWords.slice(0, SHINGLE).join(' ');
  if (opener && previousOwn.some((p) => words(p).slice(0, SHINGLE).join(' ') === opener)) {
    issues.push({ type: 'opener', words: opener });
  }

  if (knownText) {
    const names = inventedNames(draft, knownText);
    if (names.length > 0) issues.push({ type: 'invented', names });
  }

  for (const [, action] of draft.matchAll(/\*([^*]+)\*/g)) {
    const first = words(action ?? '')[0];
    if (first && first.length >= 4 && first.endsWith('o') && !NOT_A_VERB.has(first)) {
      issues.push({ type: 'person', word: first });
      break;
    }
  }

  return issues;
}

/** Istruzione da aggiungere al prompt del tentativo successivo. */
export function issueFeedback(issues: Issue[]): string {
  return issues
    .map((issue) => {
      switch (issue.type) {
        case 'repeat':
          return `Hai già usato queste espressioni nei messaggi precedenti, NON riusarle né riformularle: ${issue.phrases.map((p) => `«${p}»`).join(', ')}. Cambia gesto, immagine e parole.`;
        case 'opener':
          return `Non aprire di nuovo con «${issue.words}»: inizia con un gesto o una frase diversa.`;
        case 'invented':
          return `Hai nominato ${issue.names.map((n) => `«${n}»`).join(', ')}, che nessuno ha menzionato: non esiste. Non introdurre persone o nomi nuovi.`;
        case 'person':
          return `Le azioni tra asterischi vanno in TERZA persona (es. «alza», «prende», «porge»), non «${issue.word}».`;
      }
    })
    .join(' ');
}
