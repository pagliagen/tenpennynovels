import mongoose from 'mongoose';
import Document from '../models/Document';
import { EmbeddingService } from './EmbeddingService';
import { loadReassembledChunks } from './ChunkLoader';

/** Quanti match vettoriali recuperare prima di filtrare per documento pubblicato. */
const FETCH_LIMIT = 10;
/** Il coseno minimo lo decide chi chiama: qui si recupera anche la fascia debole (0.1) per poterla valutare. */
const FETCH_MIN_SIMILARITY = 0.1;

export interface LorePassage {
  documentId: string;
  title: string;
  heading: string;
  text: string;
  /** Coseno grezzo della ricerca vettoriale (non l'RRF). */
  vectorScore: number;
  fullPath: string;
}

/**
 * Passaggi dell'ambientazione pubblica che rispondono a `query`, per chi NON è un
 * giocatore con permessi (il bot dei PNG). Default-deny: solo il tipo `ambientazione`,
 * mai regolamento né manuale-master; solo documenti pubblicati, visibili e pubblici.
 * Se il worker non risponde ritorna [] (chi chiama dice «non so»).
 */
export async function searchPublicLore(query: string, limit = 4): Promise<LorePassage[]> {
  const results = await EmbeddingService.semanticSearch(query, 'ambientazione', FETCH_LIMIT, FETCH_MIN_SIMILARITY);
  if (results.length === 0) return [];

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');

  const chunks = await loadReassembledChunks(db, results.map((r) => r.chunkId).filter(Boolean));
  const documentIds = [...new Set(chunks.map((c) => c.documentId).filter(Boolean))];
  const docs = await Document.find({
    _id: { $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)) },
    deletedAt: null,
    isDraft: { $ne: true },
    visible: { $ne: false },
    isPublic: true,
    type: 'ambientazione',
  }).lean();
  const docById = new Map(docs.map((d) => [d._id.toString(), d]));

  const passages: LorePassage[] = [];
  for (const result of results) {
    const chunk = chunks.find((c) => c.chunkId === result.chunkId);
    const doc = chunk ? docById.get(String(chunk.documentId)) : undefined;
    if (!chunk || !doc) continue;
    passages.push({
      documentId: String(chunk.documentId),
      title: doc.title,
      heading: String(result.heading ?? chunk.heading ?? ''),
      text: chunk.content,
      vectorScore: typeof result.vectorScore === 'number' ? result.vectorScore : 0,
      fullPath: `/${doc.type}/${doc.path}#${result.slug ?? chunk.slug}`,
    });
  }
  return passages.sort((a, b) => b.vectorScore - a.vectorScore).slice(0, limit);
}
