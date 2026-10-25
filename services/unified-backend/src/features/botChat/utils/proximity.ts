/**
 * Quanto è vicino un luogo a dove si trova il bot, dalla gerarchia delle location
 * (root → distretto → quartiere → luogo). Un barista di Whitechapel conosce a memoria il
 * proprio quartiere, un po' il distretto, per il resto ha solo sentito parlare.
 */
export type Proximity = 'here' | 'near' | 'far';

export interface AncestorChain {
  /** Antenato di livello `quartiere`, se c'è (non tutti i distretti ne hanno). */
  quartiere?: { id: string; name: string } | undefined;
  /** Antenato di livello `district`. */
  district?: { id: string; name: string } | undefined;
}

export function proximity(from: AncestorChain, to: AncestorChain, knownDistricts: readonly string[] = []): Proximity {
  const sameQuartiere = !!from.quartiere && !!to.quartiere && from.quartiere.id === to.quartiere.id;
  // Distretto senza livello quartiere: i luoghi sono figli diretti del distretto, "qui" = stesso distretto.
  const sameFlatDistrict = !from.quartiere && !to.quartiere && !!from.district && from.district.id === to.district?.id;
  if (sameQuartiere || sameFlatDistrict) return 'here';

  if (from.district && to.district && from.district.id === to.district.id) return 'near';

  // Il bot può conoscere altri distretti perché ci lavora o ci è cresciuto (`knows` nella sua scheda).
  if (to.district && knownDistricts.some((d) => d.trim().toLowerCase() === to.district!.name.toLowerCase())) return 'near';
  return 'far';
}

const ORDER: Record<Proximity, number> = { here: 0, near: 1, far: 2 };

export function byProximity<T extends { proximity: Proximity; isCurrent?: boolean }>(a: T, b: T): number {
  if (!!a.isCurrent !== !!b.isCurrent) return a.isCurrent ? -1 : 1;
  return ORDER[a.proximity] - ORDER[b.proximity];
}

export interface HierarchyNode {
  name: string;
  level: string;
  parent?: string | undefined;
}

/**
 * Quartiere e distretto di un luogo, risalendo i genitori da `startParentId`
 * (il `parentLocation` del luogo). `nodes` contiene solo distretti e quartieri.
 */
export function buildChain(startParentId: string | undefined, nodes: ReadonlyMap<string, HierarchyNode>): AncestorChain {
  const chain: AncestorChain = {};
  let current = startParentId;
  for (let depth = 0; current && depth < 8; depth++) {
    const node = nodes.get(current);
    if (!node) break;
    if (node.level === 'quartiere' && !chain.quartiere) chain.quartiere = { id: current, name: node.name };
    if (node.level === 'district' && !chain.district) chain.district = { id: current, name: node.name };
    current = node.parent;
  }
  return chain;
}
