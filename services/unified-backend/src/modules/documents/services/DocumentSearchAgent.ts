import { Response } from 'express';
import mongoose from 'mongoose';
import { EmbeddingService } from './EmbeddingService';
import { logger } from '@shared/utils/logger';

interface ContextChunk {
  heading: string;
  content: string;
  source: {
    documentId?: string;
    slug?: string;
    fullPath?: string;
    title?: string;
    subtypeTitle?: string;
  };
}

function sendSSE(res: Response, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Builds context chunks from search results by fetching full content from MongoDB.
 */
async function buildContextChunks(
  searchResults: Array<{ chunkId: string; documentId: string; slug: string; heading: string; score: number; type: string }>,
): Promise<ContextChunk[]> {
  const db = mongoose.connection.db;
  if (!db) return [];

  const chunkIds = searchResults.map(r => r.chunkId).filter(Boolean);
  if (chunkIds.length === 0) return [];

  const chunks = await db.collection('documentchunks').find({ chunkId: { $in: chunkIds } }).toArray();

  const documentIds = chunks.map(c => c.documentId).filter(Boolean);
  const docs = await db.collection('documents').find({
    _id: { $in: documentIds.map(id => new mongoose.Types.ObjectId(id)) },
    deletedAt: null,
    isDraft: { $ne: true },
    visible: { $ne: false },
  }).toArray();
  const docMap = new Map(docs.map(d => [d._id.toString(), d]));

  const subtypeIds = [...new Set(docs.map(d => d.subtypeId?.toString()).filter(Boolean))];
  const subtypes = subtypeIds.length > 0
    ? await db.collection('documentsubtypes').find({
        _id: { $in: subtypeIds.map(id => new mongoose.Types.ObjectId(id)) },
      }).toArray()
    : [];
  const subtypeMap = new Map(subtypes.map(s => [s._id.toString(), s]));

  return searchResults
    .map(result => {
      const chunk: any = chunks.find((c: any) => c.chunkId === result.chunkId);
      if (!chunk) return null;
      const doc = docMap.get(chunk.documentId?.toString());
      if (!doc) return null;
      const subtype: any = subtypeMap.get(doc.subtypeId?.toString());

      return {
        heading: result.heading,
        content: (chunk.content || '').substring(0, 1500),
        source: {
          documentId: doc._id.toString(),
          slug: doc.slug,
          fullPath: `/${doc.type}/${doc.path}#${result.slug}`,
          title: doc.title,
          subtypeTitle: subtype?.title || '',
        },
      };
    })
    .filter(Boolean) as ContextChunk[];
}

export class DocumentSearchAgent {
  /**
   * Genera la risposta del Bibliotecario dal contesto già recuperato.
   * Niente step successivi di ricerca/enrichment: il giocatore ha comunque
   * accesso a tutti i documenti, la risposta principale punta a essere
   * già sufficientemente ricca da sola (vedi maxTokens e prompt in RAGPipeline).
   */
  static async run(
    question: string,
    initialContextChunks: ContextChunk[],
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      if (signal.aborted) return;

      const keeperEnabled = await EmbeddingService.isKeeperQaEnabled();
      if (!keeperEnabled) {
        sendSSE(res, 'complete', {});
        res.end();
        return;
      }

      const healthy = await EmbeddingService.isAiAvailable();
      if (!healthy) {
        logger.warn('[SearchAgent] AI gateway not healthy, skipping');
        sendSSE(res, 'complete', {});
        res.end();
        return;
      }

      const qaResponse = await EmbeddingService.askQuestion({
        question,
        context: initialContextChunks,
        options: { maxTokens: 800, locale: 'it' },
      });

      if (signal.aborted) return;

      if (!qaResponse?.success || !qaResponse.answer) {
        logger.warn('[SearchAgent] AI answer failed or empty');
        sendSSE(res, 'complete', {});
        res.end();
        return;
      }

      sendSSE(res, 'ai_answer', {
        answer: qaResponse.answer,
        sources: qaResponse.sources || [],
        model: qaResponse.metadata?.model,
      });

      sendSSE(res, 'complete', {});
      res.end();
    } catch (error: any) {
      logger.error(`[SearchAgent] Error: ${error.message}`);
      if (!signal.aborted) {
        try {
          sendSSE(res, 'complete', {});
          res.end();
        } catch {
          // connection already closed
        }
      }
    }
  }
}
