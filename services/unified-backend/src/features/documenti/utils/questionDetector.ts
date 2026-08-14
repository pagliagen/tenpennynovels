const QUESTION_PREFIXES = [
  'chi', 'cosa', 'come', 'dove', 'quando', 'perché', 'perche',
  'qual è', 'qual\'è', 'quale', 'quali', 'quanti', 'quante', 'quanto', 'quanta',
  'che cosa', 'che cos\'è',
];

const REQUEST_PREFIXES = [
  'mi trovi', 'mi dici', 'mi spieghi', 'mi puoi', 'mi potresti',
  'mi dai', 'mi daresti', 'mi fai', 'mi faresti',
  'dimmi', 'spiegami', 'elencami', 'parlami', 'descrivi', 'raccontami',
  'trovami', 'dammi', 'fammi',
  'puoi dirmi', 'puoi spiegarmi', 'puoi trovarmi', 'puoi darmi',
  'vorrei sapere', 'voglio sapere',
  'mi aiuti', 'mi puoi aiutare', 'mi potresti aiutare', 'puoi aiutarmi',
  'puoi darmi una mano', 'mi daresti una mano', 'puoi aiutare', 'aiutami'
];

const ALL_PREFIXES = [...QUESTION_PREFIXES, ...REQUEST_PREFIXES];

/**
 * Detects whether a search query is a natural-language question
 * (requiring an AI-generated answer) vs a simple keyword search.
 *
 * Examples:
 *  - "Vampiri" → false (keyword)
 *  - "Come funzionano i fucili a pompa?" → true
 *  - "Mi trovi i documenti su Londra?" → true
 */
export function isQuestion(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 5) return false;

  if (trimmed.endsWith('?')) return true;

  const lower = trimmed.toLowerCase();
  return ALL_PREFIXES.some(prefix => lower.startsWith(prefix + ' '));
}
