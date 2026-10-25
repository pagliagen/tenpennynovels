import { logger } from '@shared/utils/logger';
import Document from '../models/Document';
import { PUBLIC_DOCUMENT_TYPE_LIST } from '../constants/documentTypes';
import { htmlToPlainText } from './DocumentReviewReader';

/**
 * Descrizione SEO (`description`, la meta description della pagina pubblica).
 * Solo documenti pubblici e non eliminati: il manuale master è a lettura riservata e non ha una pagina indicizzabile.
 */

export interface SeoSource {
  _id: string;
  title: string;
  type: string;
  path: string;
  /** Descrizione SEO attuale (può essere vuota). */
  description: string;
  /** Testo del documento senza HTML. */
  text: string;
}

const PUBLIC_FILTER = { type: { $in: PUBLIC_DOCUMENT_TYPE_LIST }, deletedAt: null } as const;

export async function readDocumentForSeo(documentId: string): Promise<SeoSource | null> {
  const doc = await Document.findOne({ _id: documentId, ...PUBLIC_FILTER }).select('title type path description content').lean();
  if (!doc) return null;
  return {
    _id: doc._id.toString(), title: doc.title, type: doc.type, path: doc.path ?? '',
    description: doc.description ?? '', text: htmlToPlainText(doc.content ?? ''),
  };
}

/**
 * Salva la descrizione SEO. Scrive con `findOneAndUpdate` e non con `save()`: `description` non cambia il contenuto,
 * quindi niente re-embed. La pagina pubblica è ISR (revalidate 1h): si rigenera subito, come per le altre modifiche.
 * Restituisce la descrizione precedente, o null se il documento non esiste o non è pubblico.
 */
export async function saveSeoDescription(documentId: string, description: string): Promise<{ previous: string } | null> {
  const before = await Document.findOneAndUpdate({ _id: documentId, ...PUBLIC_FILTER }, { $set: { description } }, { new: false })
    .select('type path description')
    .lean();
  if (!before) return null;

  import('@shared/services/DocumentsRevalidator')
    .then(({ revalidateDocumentPaths }) => revalidateDocumentPaths(before.type, [before.path]))
    .catch((error) => logger.error('[DocumentSeo] Revalidation fallita', { error, documentId }));
  return { previous: before.description ?? '' };
}
