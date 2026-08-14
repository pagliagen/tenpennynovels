/**
 * EmbeddingService
 *
 * Proxy verso embeddings-worker per generazione embedding e ricerca semantica.
 * Tutte le operazioni vettoriali (Qdrant, Elasticsearch) sono gestite da embeddings-worker.
 *
 * classifySceneContinuation/summarizeScene sono debito dichiarato: 100% chat-only
 * (unico chiamante: features/fineSessione/services/ChatSceneService.ts), parcheggiati qui
 * perché la destinazione originale del piano generale (core/ai/AiGatewayClient.ts)
 * non esiste ancora — deciso con l'utente in Fase 6.5, non creato in questa fase.
 */

import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

const EMBEDDINGS_SERVICE_URL = appConfig.services.embeddingsUrl;

interface SceneClassificationMessage {
  characterName: string;
  content: string;
}

interface SceneClassificationCandidate {
  sceneId: string;
  recentMessages: SceneClassificationMessage[];
}

interface SceneClassificationResponse {
  success: boolean;
  result: { matchedSceneId: string | null; confidence: number };
}

interface SceneSummarizationResponse {
  success: boolean;
  title: string;
  summary: string;
}

export class EmbeddingService {
  /**
   * Hybrid search (keyword + semantic) via embeddings-worker
   *
   * Delegates search to embeddings-worker /search endpoint which combines
   * ElasticSearch keyword search with Qdrant semantic search using RRF.
   *
   * @param query - Search query text
   * @param type - Document type filter (optional)
   * @param limit - Max results to return (default 10)
   * @param minScore - Minimum similarity score threshold (default 0.4)
   * @param source - Source type: 'documents', 'forum', 'chat' (optional)
   * @param filters - Additional filters (e.g., topicSlug, locationId, characterId, dateStart, dateEnd)
   * @returns Array of matching results with hybrid scores
   */
  static async semanticSearch(
    query: string,
    type?: 'ambientazione' | 'regolamento',
    limit: number = 10,
    minScore: number = 0.4,
    source?: 'documents' | 'forum' | 'chat',
    filters?: Record<string, any>
  ): Promise<any[]> {
    try {
      const requestBody: any = { query, type, limit, minScore };
      if (source) requestBody.source = source;
      if (filters) requestBody.filters = filters;

      logger.info(`[EmbeddingService] Calling embeddings-worker: ${EMBEDDINGS_SERVICE_URL}/search`);
      logger.info(`[EmbeddingService] Request payload: ${JSON.stringify(requestBody)}`);

      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000)
      });

      logger.info(`[EmbeddingService] Response status: ${response.status}`);

      if (!response.ok) {
        logger.error(`Search service error: ${response.status}`);
        return [];
      }

      const data = await response.json() as { success: boolean; results?: any[] };
      logger.info(`[EmbeddingService] Response data: ${JSON.stringify({ success: data.success, resultsCount: data.results?.length || 0 })}`);

      if (!data.success || !data.results) {
        logger.warn(`[EmbeddingService] Invalid response: success=${data.success}, results=${!!data.results}`);
        return [];
      }

      return data.results;

    } catch (error: any) {
      logger.error(`Error in semanticSearch: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      return [];
    }
  }

  /**
   * Segmentazione chat in "scene" (ChatSceneService): usa lo stesso Ollama/
   * modello del Bibliotecario via embeddings-worker /classify/scene-continuation.
   * Timeout basso: numPredict piccolo lato embeddings-worker, risposta rapida.
   */
  static async classifySceneContinuation(
    newMessage: SceneClassificationMessage,
    candidateScenes: SceneClassificationCandidate[]
  ): Promise<SceneClassificationResponse | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/classify/scene-continuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMessage, candidateScenes }),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        logger.error(`[EmbeddingService] /classify/scene-continuation error: ${response.status}`);
        return null;
      }

      return await response.json() as SceneClassificationResponse;
    } catch (error: any) {
      logger.error(`Error in classifySceneContinuation: ${error.message}`);
      return null;
    }
  }

  /**
   * Genera titolo + riassunto oggettivo di una scena chiusa (ChatSceneService),
   * seme per le copie personali per personaggio. Stesso Ollama/modello del
   * Bibliotecario e della classificazione scene, via embeddings-worker.
   * Timeout più largo di /classify (500 token vs 100): la generazione del
   * riassunto è più lenta della sola classificazione.
   */
  static async summarizeScene(payload: { transcript: string; locationName?: string }): Promise<SceneSummarizationResponse | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/summarize/scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000)
      });

      if (!response.ok) {
        logger.error(`[EmbeddingService] /summarize/scene error: ${response.status}`);
        return null;
      }

      return await response.json() as SceneSummarizationResponse;
    } catch (error: any) {
      logger.error(`Error in summarizeScene: ${error.message}`);
      return null;
    }
  }
}
