import type { Psyche } from '../config';
import type { PadDelta, Relation, RelationDelta } from './types';

/** Gli eventi che l'AI può riconoscere in un messaggio: elenco chiuso, i numeri sono qui. */
export const APPRAISAL_EVENTS = [
  'ordinario', 'gentilezza', 'complimento', 'mancia', 'aiuto', 'scuse', 'confidenza', 'flirt',
  'richiesta_aiuto', 'scherno', 'accusa', 'insulto', 'minaccia',
] as const;

export interface AppraisalEvent {
  type: (typeof APPRAISAL_EVENTS)[number];
  /** 1 lieve, 2 netta, 3 forte. */
  intensity: 1 | 2 | 3;
}

interface Effect {
  pad: PadDelta;
  rel: RelationDelta;
  /** Frase per `Relation.lastEvent` (solo per gli eventi che si ricordano). */
  memory?: string;
}

/** Effetto di un evento di intensità 2, a un bot e a un rapporto "medi". */
const EFFECTS: Record<AppraisalEvent['type'], Effect> = {
  ordinario: { pad: { p: 0, a: 0, d: 0 }, rel: { trust: 1, respect: 0, suspicion: 0 } },
  gentilezza: { pad: { p: 0.2, a: 0.05, d: 0 }, rel: { trust: 3, respect: 2, suspicion: -2 }, memory: 'è stato gentile' },
  complimento: { pad: { p: 0.2, a: 0.1, d: 0.1 }, rel: { trust: 2, respect: 2, suspicion: 0 } },
  mancia: { pad: { p: 0.25, a: 0.1, d: 0 }, rel: { trust: 4, respect: 3, suspicion: -2 }, memory: 'ha pagato bene' },
  aiuto: { pad: { p: 0.2, a: 0.05, d: -0.05 }, rel: { trust: 5, respect: 3, suspicion: -3 }, memory: 'lo ha aiutato' },
  scuse: { pad: { p: 0.15, a: -0.1, d: 0.1 }, rel: { trust: 3, respect: 1, suspicion: -2 } },
  confidenza: { pad: { p: 0.05, a: 0, d: 0 }, rel: { trust: 3, respect: 1, suspicion: -1 } },
  flirt: { pad: { p: 0.1, a: 0.25, d: -0.1 }, rel: { trust: 0, respect: 0, suspicion: 1 } },
  richiesta_aiuto: { pad: { p: -0.05, a: 0.15, d: 0.05 }, rel: { trust: 0, respect: 0, suspicion: 0 } },
  scherno: { pad: { p: -0.25, a: 0.15, d: -0.1 }, rel: { trust: -3, respect: -5, suspicion: 2 }, memory: 'lo ha preso in giro' },
  accusa: { pad: { p: -0.3, a: 0.3, d: 0 }, rel: { trust: -5, respect: -2, suspicion: 5 }, memory: 'lo ha accusato' },
  insulto: { pad: { p: -0.35, a: 0.3, d: 0.05 }, rel: { trust: -5, respect: -5, suspicion: 4 }, memory: 'lo ha offeso' },
  minaccia: { pad: { p: -0.5, a: 0.5, d: -0.3 }, rel: { trust: -8, respect: -3, suspicion: 8 }, memory: 'lo ha minacciato' },
};

const INTENSITY = { 1: 0.5, 2: 1, 3: 1.5 } as const;

export interface EventOutcome {
  pad: PadDelta;
  relation: RelationDelta;
  memory?: string;
}

/**
 * Da eventi a variazioni. La fiducia tradita pesa di più (chi si fida soffre di
 * più per un'offesa); la gentilezza di chi è sospettato conta meno; la
 * Gradevolezza bassa fa pesare meno i toni affettuosi.
 */
export function outcomeOf(events: AppraisalEvent[], rel: Pick<Relation, 'trust' | 'suspicion'> | null, psyche: Psyche): EventOutcome {
  const pad = { p: 0, a: 0, d: 0 };
  const relation = { trust: 0, respect: 0, suspicion: 0 };
  let memory: string | undefined;
  let strongest = 0;

  for (const { type, intensity } of events) {
    const effect = EFFECTS[type];
    const k = INTENSITY[intensity];
    const warm = effect.rel.trust > 0 || effect.rel.suspicion < 0;
    const trusting = (rel?.trust ?? 40) >= 65;
    const suspicious = (rel?.suspicion ?? 50) >= 65;
    const relScale = warm ? (suspicious ? 0.6 : 1) * (psyche.ocean.A < 35 ? 0.8 : 1) : trusting ? 1.3 : 1;

    pad.p += effect.pad.p * k;
    pad.a += effect.pad.a * k;
    pad.d += effect.pad.d * k;
    relation.trust += effect.rel.trust * k * relScale;
    relation.respect += effect.rel.respect * k * relScale;
    relation.suspicion += effect.rel.suspicion * k * relScale;

    if (effect.memory && k > strongest) {
      strongest = k;
      memory = effect.memory;
    }
  }
  return { pad, relation, ...(memory ? { memory } : {}) };
}
