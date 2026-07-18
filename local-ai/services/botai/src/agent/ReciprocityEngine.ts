import { IRelationship, ISupportEvent, ReciprocityMode, RelationshipPhase } from '../models/Relationship';

const SUPPORT_DECAY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_SUPPORT_EVENTS = 20;

export interface ReciprocityResult {
  givenWeight: number;
  receivedWeight: number;
  ratio: number;
  equity: 'balanced' | 'over_benefited' | 'under_benefited' | 'severely_imbalanced';
  mode: ReciprocityMode;
  description: string;
}

/**
 * Computes temporally-decayed weight for a support event.
 * Recent favors matter more than old ones.
 *
 * Example:
 * - Saving life (weight 10) 3 months ago → decayed ~1.25
 * - Lending money (weight 4) yesterday → decayed ~3.9
 */
function computeDecayedWeight(event: ISupportEvent): number {
  const ageMs = Date.now() - new Date(event.timestamp).getTime();
  const decayFactor = Math.pow(0.5, ageMs / SUPPORT_DECAY_HALF_LIFE_MS);
  return event.weight * decayFactor;
}

/**
 * Derives reciprocity mode from relationship phase and type.
 *
 * exchange:      tit-for-tat, imbalance causes resentment (strangers, acquaintances, professional)
 * transitional:  some tracking but softened (early friends, mentor/protege)
 * communal:      no active tracking, giving freely (deep friends, romantic, bonded)
 */
export function deriveReciprocityMode(
  phase: RelationshipPhase,
  relationshipType: string,
): ReciprocityMode {
  const isCloseType = ['friend', 'romantic', 'mentor', 'protege'].includes(relationshipType);
  const isDeepPhase = ['integrating', 'bonding'].includes(phase);
  const isMidPhase = phase === 'intensifying';

  if (isDeepPhase && isCloseType) return 'communal';
  if (isMidPhase && isCloseType) return 'transitional';
  if (isDeepPhase) return 'transitional';
  return 'exchange';
}

/**
 * Computes the reciprocity balance with temporal decay and mode awareness.
 */
export function computeReciprocityBalance(relationship: IRelationship): ReciprocityResult {
  const events = relationship.supportEvents || [];
  const mode = relationship.reciprocityMode || 'exchange';

  if (events.length === 0) {
    return { givenWeight: 0, receivedWeight: 0, ratio: 1, equity: 'balanced', mode, description: '' };
  }

  let givenWeight = 0;
  let receivedWeight = 0;

  for (const event of events) {
    const decayed = computeDecayedWeight(event);
    if (event.direction === 'given') givenWeight += decayed;
    else receivedWeight += decayed;
  }

  const ratio = givenWeight / Math.max(receivedWeight, 0.01);

  // Equity classification
  let equity: ReciprocityResult['equity'] = 'balanced';
  if (ratio > 3.0 || ratio < 0.33) equity = 'severely_imbalanced';
  else if (ratio > 1.5) equity = 'under_benefited'; // gave more than received
  else if (ratio < 0.67) equity = 'over_benefited'; // received more than gave

  // Mode-aware description
  const description = buildDescription(ratio, equity, mode, givenWeight, receivedWeight);

  return { givenWeight, receivedWeight, ratio, equity, mode, description };
}

function buildDescription(
  ratio: number,
  equity: ReciprocityResult['equity'],
  mode: ReciprocityMode,
  givenWeight: number,
  receivedWeight: number,
): string {
  // In communal mode, tracking feels offensive — only flag severe imbalance
  if (mode === 'communal') {
    if (equity === 'severely_imbalanced' && ratio > 3.0) {
      return 'Nonostante il legame profondo, hai dato enormemente di più. Potresti iniziare a sentirti sfruttato.';
    }
    if (equity === 'severely_imbalanced' && ratio < 0.33) {
      return 'Hai ricevuto molto senza ricambiare. In un rapporto così intimo, potresti sentire un peso di gratitudine.';
    }
    return ''; // Communal relationships don't track reciprocity
  }

  // In transitional mode, softer language
  if (mode === 'transitional') {
    if (ratio > 2.0) return 'Hai dato più di quanto ricevuto. Non ti pesa ancora, ma lo noti.';
    if (ratio < 0.5) return 'Hai ricevuto più di quanto dato. Potresti voler ricambiare.';
    return '';
  }

  // Exchange mode: explicit tracking
  if (ratio > 3.0) {
    return 'Hai dato enormemente più supporto di quanto ne hai ricevuto — potresti provare risentimento o sentirti sfruttato.';
  }
  if (ratio > 1.5) {
    return 'Hai dato leggermente più di quanto hai ricevuto. Potrebbe essere il momento di aspettarsi una contropartita.';
  }
  if (ratio < 0.33) {
    return 'Hai ricevuto molto supporto senza ricambiare — potresti sentire un debito di gratitudine o una pressione a contraccambiare.';
  }
  if (ratio < 0.67) {
    return 'Hai ricevuto leggermente più di quanto hai dato. Un piccolo debito di gratitudine.';
  }
  return '';
}

/**
 * Adds a support event to the relationship's supportEvents array.
 * Maintains max size by removing oldest events beyond MAX_SUPPORT_EVENTS.
 */
export function addSupportEvent(
  existingEvents: ISupportEvent[],
  newEvent: ISupportEvent,
): ISupportEvent[] {
  const events = [...existingEvents, newEvent];
  // Keep only the most recent MAX_SUPPORT_EVENTS
  if (events.length > MAX_SUPPORT_EVENTS) {
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, MAX_SUPPORT_EVENTS);
  }
  return events;
}
