import { Location } from '@core/location/models/Location';
import { readDocumentsForReview } from '@features/documenti/api';
import { buildCanonReport, type CanonReport } from '../utils/canonRules';

/** Legge documenti, sottotipi e location e applica le regole di canone. Nessuna scrittura, nessun modello. */
export async function runCanonCheck(): Promise<CanonReport> {
  const [{ documents, subtypes }, locations] = await Promise.all([
    readDocumentsForReview(),
    Location.find({ locationLevel: { $in: ['location', 'quartiere', 'district', 'root'] } })
      .select('name description locationLevel')
      .lean(),
  ]);

  return buildCanonReport({
    documents,
    subtypes,
    locations: locations.map((l) => ({ _id: l._id.toString(), name: l.name, description: l.description ?? '', locationLevel: l.locationLevel })),
  });
}
