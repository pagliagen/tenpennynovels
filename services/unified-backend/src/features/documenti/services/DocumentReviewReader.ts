import mongoose from 'mongoose';
import { PUBLIC_DOCUMENT_TYPE_LIST } from '../constants/documentTypes';

export interface ReviewDocumentRow {
  _id: string;
  title: string;
  slug: string;
  type: string;
  isDraft: boolean;
  /** Contenuto senza HTML. */
  text: string;
}

export interface ReviewSubtypeRow {
  _id: string;
  slug: string;
  title: string;
  type: string;
}

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&egrave;': 'è', '&agrave;': 'à' };

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Documenti pubblici (ambientazione, regolamento; mai manuale-master) e sottotipi, in sola
 * lettura, per chi deve rivedere il canone. Include le bozze (marcate) perché un refuso in una
 * bozza va corretto prima della pubblicazione; esclude gli eliminati.
 */
export async function readDocumentsForReview(): Promise<{ documents: ReviewDocumentRow[]; subtypes: ReviewSubtypeRow[] }> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');

  const [docs, subtypes] = await Promise.all([
    db.collection('documents')
      .find({ type: { $in: PUBLIC_DOCUMENT_TYPE_LIST }, deletedAt: null }, { projection: { title: 1, slug: 1, type: 1, isDraft: 1, content: 1 } })
      .toArray(),
    db.collection('documentsubtypes')
      .find({ type: { $in: PUBLIC_DOCUMENT_TYPE_LIST } }, { projection: { slug: 1, title: 1, type: 1 } })
      .toArray(),
  ]);

  return {
    documents: docs.map((d) => ({
      _id: String(d._id), title: String(d.title ?? ''), slug: String(d.slug ?? ''), type: String(d.type),
      isDraft: d.isDraft === true, text: htmlToPlainText(String(d.content ?? '')),
    })),
    subtypes: subtypes.map((s) => ({ _id: String(s._id), slug: String(s.slug ?? ''), title: String(s.title ?? ''), type: String(s.type) })),
  };
}
