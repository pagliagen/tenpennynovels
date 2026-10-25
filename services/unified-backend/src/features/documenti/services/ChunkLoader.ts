import mongoose from 'mongoose';

type Database = NonNullable<typeof mongoose.connection.db>;

/** Un chunk di `documentchunks` come lo restituisce Mongo (campi usati qui e dai chiamanti). */
export interface StoredChunk {
  chunkId: string;
  documentId: string;
  slug: string;
  heading?: string;
  headingLevel?: number;
  content: string;
  splitIndex?: number;
  splitTotal?: number;
  [key: string]: unknown;
}

/**
 * Carica i chunk trovati dalla ricerca e ricompone il contenuto intero delle sezioni spezzate.
 *
 * Sezioni troppo lunghe per il subprocess di embedding vengono spezzate in più chunk in
 * scrittura (embeddings-worker/ChunkParser.splitOversizedChunk), che condividono
 * {documentId, slug} come chiave di riaggancio. La ricerca vettoriale può far match su UN
 * SOLO pezzo: qui si recuperano tutti i fratelli, così chi risponde (Bibliotecario, bot)
 * lavora sul testo completo della sezione e non solo sul frammento che ha fatto match.
 */
export async function loadReassembledChunks(db: Database, chunkIds: string[]): Promise<StoredChunk[]> {
  const chunks = (await db.collection('documentchunks').find({ chunkId: { $in: chunkIds } }).toArray()) as unknown as StoredChunk[];

  const splitGroups = [...new Set(
    chunks.filter(c => (c.splitTotal ?? 1) > 1).map(c => `${c.documentId}::${c.slug}`)
  )];
  if (splitGroups.length === 0) return chunks;

  const siblings = (await db.collection('documentchunks').find({
    $or: splitGroups.map(key => {
      const [documentId, slug] = key.split('::');
      return { documentId, slug };
    })
  }).toArray()) as unknown as StoredChunk[];

  const reassembledByGroup = new Map<string, string>();
  for (const key of splitGroups) {
    const [documentId, slug] = key.split('::');
    const piecesContent = siblings
      .filter(s => s.documentId === documentId && s.slug === slug)
      .sort((a, b) => (a.splitIndex ?? 0) - (b.splitIndex ?? 0))
      .map(s => s.content);
    reassembledByGroup.set(key, piecesContent.join('\n\n'));
  }

  for (const chunk of chunks) {
    if ((chunk.splitTotal ?? 1) > 1) {
      chunk.content = reassembledByGroup.get(`${chunk.documentId}::${chunk.slug}`) ?? chunk.content;
    }
  }
  return chunks;
}
