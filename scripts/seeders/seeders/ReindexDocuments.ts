/**
 * Reindex Documents - Standalone Script
 *
 * Riallinea l'indice di ricerca (Qdrant/Elasticsearch, popolati dall'embeddings-worker) ai
 * documenti che ci sono DAVVERO in MongoDB, senza toccare i documenti:
 *
 *   1. orfani: documentId presenti in Qdrant che in Mongo non esistono (o non sono di un tipo
 *      pubblico, o sono eliminati) → evento `embedding:document:deleted`, il worker li toglie da
 *      Qdrant, Elasticsearch e Mongo;
 *   2. tutti i documenti pubblici esistenti → evento `embedding:document:updated`, il worker
 *      rigenera i chunk e toglie quelli non più presenti (pruneStaleChunks).
 *
 * Perché non un seed: i seeder cancellano e ricreano i documenti (con id nuovi, perdendo quelli
 * scritti dal gestionale) e non pubblicano mai eventi di cancellazione.
 *
 *   npm run seed:dev:reindex-documents -- --dry-run      # mostra cosa farebbe, non pubblica nulla
 *   npm run seed:dev:reindex-documents                   # pubblica gli eventi
 *   npm run seed:dev:reindex-documents -- --only-orphans # solo la pulizia degli orfani
 *   npm run seed:dev:reindex-documents -- --wait         # dopo, attende che l'indice sia allineato
 */

import crypto from 'crypto';
import Redis from 'ioredis';
import { getConnection } from '../utils/connection.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
/** Tipi che il backend indicizza (Document.post('save'): solo i pubblici). */
const INDEXED_TYPES = ['ambientazione', 'regolamento'];
/** Collection di Qdrant il cui payload ha `documentId`. */
const COLLECTIONS = ['documents', 'document_chunks'];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const onlyOrphans = args.has('--only-orphans');
const wait = args.has('--wait');

/** Tutti i documentId distinti presenti in una collection di Qdrant. */
async function indexedDocumentIds(collection: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset: unknown = null;
  do {
    const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 256, with_payload: ['documentId'], with_vector: false, ...(offset ? { offset } : {}) }),
    });
    if (!response.ok) throw new Error(`Qdrant ${collection}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    const body = (await response.json()) as { result: { points: { payload?: { documentId?: string } }[]; next_page_offset?: unknown } };
    for (const point of body.result.points) {
      if (typeof point.payload?.documentId === 'string') ids.add(point.payload.documentId);
    }
    offset = body.result.next_page_offset ?? null;
  } while (offset);
  return ids;
}

async function indexedIds(): Promise<Set<string>> {
  const all = new Set<string>();
  for (const collection of COLLECTIONS) for (const id of await indexedDocumentIds(collection)) all.add(id);
  return all;
}

async function main() {
  console.log('🔎 Reindex Documents\n');
  const { client, db } = await getConnection();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

  try {
    const docs = await db
      .collection('documents')
      .find({ type: { $in: INDEXED_TYPES }, deletedAt: null })
      .toArray();
    const expected = new Set(docs.map((d) => d._id.toString()));

    const indexed = await indexedIds();
    const orphans = [...indexed].filter((id) => !expected.has(id));
    const missing = [...expected].filter((id) => !indexed.has(id));

    console.log(`   Documenti pubblici in Mongo: ${expected.size}`);
    console.log(`   documentId distinti in Qdrant: ${indexed.size}`);
    console.log(`   Orfani (in Qdrant, non in Mongo / non pubblici): ${orphans.length}${orphans.length ? ` → ${orphans.join(', ')}` : ''}`);
    console.log(`   Non ancora indicizzati: ${missing.length}${missing.length ? ` → ${docs.filter((d) => missing.includes(d._id.toString())).map((d) => d.slug).join(', ')}` : ''}\n`);

    if (dryRun) {
      console.log(`(dry-run) pubblicherei ${orphans.length} cancellazioni${onlyOrphans ? '' : ` e ${docs.length} aggiornamenti`}. Nessun evento inviato.`);
      return;
    }

    for (const id of orphans) {
      await redis.publish('embedding:document:deleted', JSON.stringify({
        eventId: crypto.randomUUID(), timestamp: new Date(), entityType: 'document', entityId: id,
      }));
    }
    console.log(`   ✓ ${orphans.length} eventi di cancellazione`);

    if (!onlyOrphans) {
      for (const doc of docs) {
        await redis.publish('embedding:document:updated', JSON.stringify({
          eventId: crypto.randomUUID(),
          timestamp: new Date(),
          documentId: doc._id.toString(),
          title: doc.title,
          content: doc.content || '',
          // Senza contentDelta il worker non fa il chunking (vedi incidente 2026-08-15).
          contentDelta: doc.contentDelta,
          type: doc.type,
        }));
      }
      console.log(`   ✓ ${docs.length} eventi di aggiornamento`);
    }

    if (wait) {
      console.log('\n⏳ Attendo che il worker allinei l\'indice (max 5 minuti)...');
      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const now = await indexedIds();
        const stillOrphans = [...now].filter((id) => !expected.has(id));
        const stillMissing = onlyOrphans ? [] : [...expected].filter((id) => !now.has(id));
        console.log(`   orfani ${stillOrphans.length}, mancanti ${stillMissing.length}`);
        if (stillOrphans.length === 0 && stillMissing.length === 0) {
          console.log('   ✅ Indice allineato');
          return;
        }
      }
      console.log('   ⚠️  Tempo scaduto: controlla i log di embeddings-worker (il modello può impiegare ~60s a caricarsi).');
    } else {
      console.log('\n💡 Il worker elabora in background: rilancia con --dry-run per vedere se l\'indice è allineato.');
    }
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exitCode = 1;
  } finally {
    await redis.quit();
    await client.close();
    console.log('👋 Done');
  }
}

main();
