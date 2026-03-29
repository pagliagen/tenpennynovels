import { AttachmentStyle } from '../models/Relationship';

interface AttachmentRule {
  keywords: string[];
  style: AttachmentStyle;
  weight: number;
}

const ATTACHMENT_RULES: AttachmentRule[] = [
  // Secure indicators
  { keywords: ['leale', 'fedele', 'fiducioso', 'fiduciosa', 'empatico', 'empatica', 'equilibrato', 'equilibrata', 'stabile', 'sereno', 'serena'], style: 'secure', weight: 1 },
  // Anxious indicators
  { keywords: ['ansioso', 'ansiosa', 'insicuro', 'insicura', 'bisognoso', 'bisognosa', 'geloso', 'gelosa', 'possessivo', 'possessiva', 'sensibile', 'emotivo', 'emotiva', 'apprensivo', 'apprensiva'], style: 'anxious', weight: 1 },
  // Avoidant indicators
  { keywords: ['freddo', 'fredda', 'distaccato', 'distaccata', 'riservato', 'riservata', 'indipendente', 'solitario', 'solitaria', 'diffidente', 'cinico', 'cinica', 'stoico', 'stoica'], style: 'avoidant', weight: 1 },
  // Disorganized indicators (conflicting signals)
  { keywords: ['imprevedibile', 'instabile', 'contraddittorio', 'contraddittoria', 'traumatizzato', 'traumatizzata', 'erratico', 'erratica'], style: 'disorganized', weight: 1.5 },
];

const styleCache = new Map<string, AttachmentStyle>();

/**
 * Derives attachment style from bot personality traits.
 * Uses keyword matching, cached per trait-set.
 *
 * Attachment style effects:
 * - secure:       standard dampening, balanced phase transitions
 * - anxious:      faster trust growth AND loss (1.3x), faster phase changes
 * - avoidant:     slower trust growth (0.6x), higher thresholds for phase advancement
 * - disorganized: slightly amplified changes (1.1x), unpredictable phase patterns
 */
export function deriveAttachmentStyle(traits: string[]): AttachmentStyle {
  const cacheKey = traits.sort().join('|').toLowerCase();
  if (styleCache.has(cacheKey)) return styleCache.get(cacheKey)!;

  const lowerTraits = traits.map(t => t.toLowerCase());
  const scores: Record<AttachmentStyle, number> = { secure: 0, anxious: 0, avoidant: 0, disorganized: 0 };

  for (const rule of ATTACHMENT_RULES) {
    const matchCount = rule.keywords.filter(kw => lowerTraits.some(t => t.includes(kw))).length;
    scores[rule.style] += matchCount * rule.weight;
  }

  const best = (Object.entries(scores) as [AttachmentStyle, number][])
    .sort((a, b) => b[1] - a[1])[0];

  // Default to secure if no keywords matched
  const result = best[1] > 0 ? best[0] : 'secure';
  styleCache.set(cacheKey, result);
  return result;
}

/** Dampening multiplier based on attachment style */
export function getAttachmentDampeningMultiplier(style: AttachmentStyle): number {
  const multipliers: Record<AttachmentStyle, number> = {
    secure: 1.0,
    anxious: 1.3,      // Stronger emotional swings
    avoidant: 0.6,     // Muted emotional response
    disorganized: 1.1, // Slightly amplified
  };
  return multipliers[style];
}

/** Descriptive text for the bot's attachment tendencies (injected into prompt) */
export function describeAttachmentStyle(style: AttachmentStyle): string {
  const descriptions: Record<AttachmentStyle, string> = {
    secure: 'Ti senti a tuo agio sia nella vicinanza che nella distanza emotiva. Riesci ad aprirti senza perdere te stesso e accetti l\'indipendenza degli altri senza sentirti minacciato.',
    anxious: 'Tendi a cercare rassicurazione e vicinanza. L\'allontanamento degli altri ti provoca ansia. Puoi essere possessivo o bisognoso, ma è perché tieni profondamente alle persone.',
    avoidant: 'Tendi a mantenere le distanze emotive. Anche quando qualcuno ti piace, fai fatica ad aprirti. La vicinanza troppo intensa ti mette a disagio e potresti ritrarti.',
    disorganized: 'Il tuo rapporto con la vicinanza è contraddittorio. Desideri connessione ma la temi. Puoi essere imprevedibile — caldo e poi improvvisamente distante.',
  };
  return descriptions[style];
}
