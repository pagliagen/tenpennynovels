/**
 * SecondaryEmotions — Derives complex emotions from Plutchik primary axes.
 *
 * Plutchik's dyad theory: secondary emotions are combinations of adjacent primary axes.
 * Examples: shame = fear + disgust, love = joy + trust, contempt = disgust + anger.
 *
 * Secondary emotions are computed on the fly (never persisted).
 * They enhance prompt descriptions and mood derivation.
 */

import { IPlutchikEmotions, PLUTCHIK_AXES } from '../models/Bot';

export interface SecondaryEmotion {
  name: string;
  nameIT: string;        // Italian name for prompt
  intensity: number;     // 0-1
  components: string[];  // which primary axes compose it
}

interface DyadRule {
  name: string;
  nameIT: string;
  components: [keyof IPlutchikEmotions, keyof IPlutchikEmotions];
  threshold: number;
  /** Optional: require a third axis to be LOW for this emotion to trigger */
  requiresLow?: { axis: keyof IPlutchikEmotions; below: number };
}

/**
 * Plutchik dyad table — secondary emotions as combinations of primary axes.
 * Ordered by psychological relevance in a Victorian RP setting.
 */
const DYAD_TABLE: DyadRule[] = [
  // Primary dyads (adjacent axes)
  { name: 'love', nameIT: 'amore', components: ['gioia', 'fiducia'], threshold: 0.3 },
  { name: 'submission', nameIT: 'sottomissione', components: ['fiducia', 'paura'], threshold: 0.3 },
  { name: 'awe', nameIT: 'soggezione', components: ['paura', 'sorpresa'], threshold: 0.3 },
  { name: 'disapproval', nameIT: 'disapprovazione', components: ['sorpresa', 'tristezza'], threshold: 0.3 },
  { name: 'remorse', nameIT: 'rimorso', components: ['tristezza', 'disgusto'], threshold: 0.3 },
  { name: 'contempt', nameIT: 'disprezzo', components: ['disgusto', 'rabbia'], threshold: 0.3 },
  { name: 'aggression', nameIT: 'aggressività', components: ['rabbia', 'anticipazione'], threshold: 0.3 },
  { name: 'optimism', nameIT: 'ottimismo', components: ['anticipazione', 'gioia'], threshold: 0.3 },

  // Secondary dyads (one-apart axes) — especially relevant for Victorian setting
  { name: 'shame', nameIT: 'vergogna', components: ['paura', 'disgusto'], threshold: 0.25 },
  { name: 'guilt', nameIT: 'colpa', components: ['paura', 'tristezza'], threshold: 0.25 },
  { name: 'envy', nameIT: 'invidia', components: ['rabbia', 'tristezza'], threshold: 0.3 },
  { name: 'pride', nameIT: 'orgoglio', components: ['gioia', 'rabbia'], threshold: 0.3 },
  { name: 'curiosity', nameIT: 'curiosità', components: ['sorpresa', 'anticipazione'], threshold: 0.25 },
  { name: 'despair', nameIT: 'disperazione', components: ['tristezza', 'paura'], threshold: 0.35 },
  { name: 'morbid_fascination', nameIT: 'fascino morboso', components: ['disgusto', 'anticipazione'], threshold: 0.3 },
  { name: 'bittersweet', nameIT: 'agrodolce', components: ['gioia', 'tristezza'], threshold: 0.25 },
];

/**
 * Derive secondary emotions from primary Plutchik axes.
 * Returns sorted by intensity (highest first), max 3.
 */
export function deriveSecondaryEmotions(axes: IPlutchikEmotions): SecondaryEmotion[] {
  const results: SecondaryEmotion[] = [];

  for (const dyad of DYAD_TABLE) {
    const [comp1, comp2] = dyad.components;
    const val1 = axes[comp1] || 0;
    const val2 = axes[comp2] || 0;

    if (val1 >= dyad.threshold && val2 >= dyad.threshold) {
      // Check optional low-axis requirement
      if (dyad.requiresLow) {
        const lowVal = axes[dyad.requiresLow.axis] || 0;
        if (lowVal >= dyad.requiresLow.below) continue;
      }

      // Intensity = geometric mean of components (rewards balanced contributions)
      const intensity = Math.sqrt(val1 * val2);

      results.push({
        name: dyad.name,
        nameIT: dyad.nameIT,
        intensity,
        components: [comp1, comp2],
      });
    }
  }

  // Sort by intensity, return top 3
  return results.sort((a, b) => b.intensity - a.intensity).slice(0, 3);
}

/**
 * Describe secondary emotions in Italian for prompt injection.
 * Returns empty string if no secondary emotions are active.
 */
export function describeSecondaryEmotions(secondaries: SecondaryEmotion[]): string {
  if (secondaries.length === 0) return '';

  const DESCRIPTIONS: Record<string, string> = {
    love: 'Provi amore — un misto di gioia e fiducia profonda.',
    submission: 'Ti senti sottomesso — fiducia mista a paura, accetti l\'autorità dell\'altro.',
    awe: 'Provi soggezione — paura e sorpresa si mescolano in riverenza.',
    disapproval: 'Senti disapprovazione — sorpresa e tristezza per ciò che vedi.',
    remorse: 'Provi rimorso — tristezza e disgusto per qualcosa che hai fatto o permesso.',
    contempt: 'Provi disprezzo — disgusto e rabbia verso chi consideri indegno.',
    aggression: 'Senti aggressività — rabbia e determinazione a prendere l\'iniziativa.',
    optimism: 'Ti senti ottimista — anticipazione gioiosa per ciò che verrà.',
    shame: 'Provi vergogna — paura del giudizio altrui mista a disgusto per te stesso.',
    guilt: 'Provi colpa — paura delle conseguenze e tristezza per ciò che hai fatto.',
    envy: 'Provi invidia — rabbia e tristezza per ciò che l\'altro ha e tu no.',
    pride: 'Provi orgoglio — gioia e una punta di sfida per ciò che hai raggiunto.',
    curiosity: 'Senti curiosità — sorpresa e anticipazione spingono a indagare.',
    despair: 'Senti disperazione — tristezza e paura si alimentano a vicenda.',
    morbid_fascination: 'Provi un fascino morboso — disgusto e attrazione si mescolano.',
    bittersweet: 'Senti un\'emozione agrodolce — gioia e tristezza coesistono, come un ricordo felice che fa male.',
  };

  const parts = secondaries.map(s => DESCRIPTIONS[s.name] || `Provi ${s.nameIT}.`);
  return parts.join(' ');
}

/**
 * Detect ambivalence — when two opposing axes are both strong.
 * Returns a description if ambivalence is detected, empty string otherwise.
 */
export function detectAmbivalence(axes: IPlutchikEmotions): string {
  const OPPOSING_PAIRS: Array<[keyof IPlutchikEmotions, keyof IPlutchikEmotions, string]> = [
    ['gioia', 'tristezza', 'Dentro di te gioia e tristezza coesistono — un sentimento agrodolce che non riesci a risolvere.'],
    ['fiducia', 'disgusto', 'Provi fiducia e disgusto allo stesso tempo — vuoi credere ma qualcosa ti repelle.'],
    ['rabbia', 'paura', 'Rabbia e paura lottano dentro di te — vuoi reagire ma qualcosa ti trattiene.'],
    ['anticipazione', 'sorpresa', 'Oscilli tra aspettativa e sorpresa — nulla va come previsto.'],
    ['gioia', 'rabbia', 'Gioia e rabbia si mescolano — un trionfo vendicativo, o la frustrazione di un piacere proibito.'],
    ['fiducia', 'paura', 'Fiducia e paura si alternano — vuoi affidarti ma il rischio ti paralizza.'],
  ];

  const MIN_FOR_AMBIVALENCE = 0.3;
  const MAX_DISTANCE = 0.15;

  for (const [axis1, axis2, description] of OPPOSING_PAIRS) {
    const val1 = axes[axis1] || 0;
    const val2 = axes[axis2] || 0;
    if (val1 >= MIN_FOR_AMBIVALENCE && val2 >= MIN_FOR_AMBIVALENCE && Math.abs(val1 - val2) <= MAX_DISTANCE) {
      return description;
    }
  }

  return '';
}
