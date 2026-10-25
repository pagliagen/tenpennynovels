import { Location } from '@core/location/models/Location';
import { type LocationTag } from '@core/location/constants/locationTags';
import { escapeRegex } from '@shared/utils/validation';
import { buildChain, byProximity, proximity, type HierarchyNode, type Proximity } from '../utils/proximity';

const MAX_PLACES = 5;
const MAX_DESCRIPTION_CHARS = 220;

export interface KnownPlace {
  name: string;
  district: string | null;
  quartiere: string | null;
  description: string;
  tags: string[];
  proximity: Proximity;
  /** È il luogo in cui si trova il bot. */
  isCurrent: boolean;
}

export interface PlaceQuery {
  tags: LocationTag[];
  /** Nome (o parte del nome) di un luogo di cui il giocatore chiede. */
  name?: string | undefined;
  fromLocationId: string;
  /** Distretti che il bot conosce bene oltre al proprio. */
  knownDistricts: string[];
}

/**
 * I luoghi che il bot può nominare: solo foglie visibili e NON private. Un luogo privato
 * o nascosto non esiste per il bot (è il confine di riservatezza di questo endpoint).
 * Ordinati per vicinanza a dove si trova il bot; gli eliminati (soft delete) sono esclusi dal plugin.
 */
export async function findPlaces(query: PlaceQuery): Promise<KnownPlace[]> {
  const matchers: Record<string, unknown>[] = [];
  if (query.tags.length > 0) matchers.push({ tags: { $in: query.tags } });
  const name = query.name?.trim();
  if (name && name.length >= 3) matchers.push({ name: { $regex: escapeRegex(name), $options: 'i' } });
  if (matchers.length === 0) return [];

  const [candidates, hierarchy, origin] = await Promise.all([
    Location.find({
      locationLevel: 'location',
      'settings.visible': true,
      'settings.private': { $ne: true },
      $or: matchers,
    }).select('name description tags parentLocation').lean(),
    Location.find({ locationLevel: { $in: ['district', 'quartiere'] } }).select('name locationLevel parentLocation').lean(),
    Location.findById(query.fromLocationId).select('parentLocation').lean(),
  ]);

  const nodes = new Map<string, HierarchyNode>(hierarchy.map((h) => [
    h._id.toString(),
    { name: h.name, level: h.locationLevel, parent: h.parentLocation?.toString() },
  ]));
  const fromChain = buildChain(origin?.parentLocation?.toString(), nodes);

  return candidates
    .map((c): KnownPlace => {
      const chain = buildChain(c.parentLocation?.toString(), nodes);
      return {
        name: c.name,
        district: chain.district?.name ?? null,
        quartiere: chain.quartiere?.name ?? null,
        description: c.description.length > MAX_DESCRIPTION_CHARS ? `${c.description.slice(0, MAX_DESCRIPTION_CHARS).trim()}…` : c.description,
        tags: c.tags ?? [],
        proximity: proximity(fromChain, chain, query.knownDistricts),
        isCurrent: c._id.toString() === query.fromLocationId,
      };
    })
    .sort(byProximity)
    .slice(0, MAX_PLACES);
}
