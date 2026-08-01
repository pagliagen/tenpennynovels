import { Response } from 'express';
import mongoose from 'mongoose';
import { EmbeddingService } from './EmbeddingService';
import { logger } from '@shared/utils/logger';

const MAX_KEYWORDS = 3;
const MAX_DOCS_PER_KEYWORD = 2;

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

interface DocumentInfo {
  documentId: string;
  title: string;
  fullPath: string;
  content: string;
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

/**
 * Fetches document info from search results, grouping chunks by document.
 * Returns unique documents with their aggregated content.
 */
async function getDocumentInfoFromResults(
  searchResults: Array<{ chunkId: string; documentId: string; slug: string; heading: string; score: number; type: string }>,
  seenDocIds: Set<string>,
): Promise<DocumentInfo[]> {
  const db = mongoose.connection.db;
  if (!db) return [];

  const chunkIds = searchResults.map(r => r.chunkId).filter(Boolean);
  if (chunkIds.length === 0) return [];

  const chunks = await db.collection('documentchunks').find({ chunkId: { $in: chunkIds } }).toArray();

  const uniqueDocIds = [...new Set(chunks.map(c => c.documentId).filter(Boolean))]
    .filter(id => !seenDocIds.has(id));

  if (uniqueDocIds.length === 0) return [];

  const docs = await db.collection('documents').find({
    _id: { $in: uniqueDocIds.map(id => new mongoose.Types.ObjectId(id)) },
    deletedAt: null,
    isDraft: { $ne: true },
    visible: { $ne: false },
  }).toArray();

  return docs.slice(0, MAX_DOCS_PER_KEYWORD).map(doc => {
    const docChunks = chunks
      .filter((c: any) => c.documentId === doc._id.toString())
      .map((c: any) => c.content || '')
      .join('\n\n');

    return {
      documentId: doc._id.toString(),
      title: doc.title,
      fullPath: `/${doc.type}/${doc.path}`,
      content: docChunks.substring(0, 1500),
    };
  });
}

export class DocumentSearchAgent {
  /**
   * Runs the agentic search loop:
   * 1. AI answer from initial context
   * 2. Extract keywords for enrichment
   * 3. For each keyword: search → read documents → extract insights
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

      // Step 1: Get initial AI answer
      const qaResponse = await EmbeddingService.askQuestion({
        question,
        context: initialContextChunks,
        options: { maxTokens: 400, locale: 'it' },
      });

      if (signal.aborted) return;

      if (!qaResponse?.success || !qaResponse.answer) {
        logger.warn('[SearchAgent] First AI answer failed or empty');
        sendSSE(res, 'complete', {});
        res.end();
        return;
      }

      sendSSE(res, 'ai_answer', {
        answer: qaResponse.answer,
        sources: qaResponse.sources || [],
        model: qaResponse.metadata?.model,
      });

      // Step 2: Extract keywords for further research
      const keywordsResponse = await EmbeddingService.extractKeywords({
        question,
        answer: qaResponse.answer,
      });

      if (signal.aborted) return;

      const keywords = keywordsResponse?.success ? keywordsResponse.keywords : [];

      if (keywords.length === 0) {
        logger.info('[SearchAgent] No enrichment keywords suggested, answer is complete');
        sendSSE(res, 'complete', {});
        res.end();
        return;
      }

      logger.info(`[SearchAgent] Keywords for enrichment: ${keywords.join(', ')}`);

      // Track already-seen document IDs (from initial search)
      const seenDocIds = new Set<string>();
      for (const chunk of initialContextChunks) {
        if (chunk.source.documentId) {
          seenDocIds.add(chunk.source.documentId);
        }
      }

      // Step 3: For each keyword, search and evaluate documents
      let enrichmentCount = 0;
      for (const keyword of keywords.slice(0, MAX_KEYWORDS)) {
        if (signal.aborted) return;

        logger.info(`[SearchAgent] Searching for keyword: "${keyword}"`);

        const searchResults = await EmbeddingService.semanticSearch(keyword, undefined, 5, 0.01);
        if (signal.aborted) return;

        if (searchResults.length === 0) {
          logger.info(`[SearchAgent] No results for keyword "${keyword}"`);
          continue;
        }

        const documents = await getDocumentInfoFromResults(searchResults, seenDocIds);
        if (signal.aborted) return;

        if (documents.length === 0) {
          logger.info(`[SearchAgent] No new documents for keyword "${keyword}"`);
          continue;
        }

        for (const doc of documents) {
          if (signal.aborted) return;

          seenDocIds.add(doc.documentId);

          sendSSE(res, 'ai_reading', {
            title: doc.title,
            fullPath: doc.fullPath,
          });

          const insightResponse = await EmbeddingService.extractInsight({
            question,
            existingAnswer: qaResponse.answer,
            documentContent: doc.content,
            documentTitle: doc.title,
          });

          if (signal.aborted) return;

          if (insightResponse?.success && insightResponse.hasNewInfo && insightResponse.insight) {
            enrichmentCount++;
            sendSSE(res, 'ai_enrichment', {
              enrichment: insightResponse.insight,
              source: {
                title: doc.title,
                fullPath: doc.fullPath,
              },
              step: enrichmentCount,
            });
            logger.info(`[SearchAgent] Enrichment #${enrichmentCount} from "${doc.title}"`);
          } else {
            logger.info(`[SearchAgent] No new info in "${doc.title}"`);
          }
        }
      }

      if (!signal.aborted) {
        logger.info(`[SearchAgent] Complete. ${enrichmentCount} enrichment(s) added.`);
        sendSSE(res, 'complete', {});
        res.end();
      }
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
