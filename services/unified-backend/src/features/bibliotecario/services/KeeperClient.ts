/**
 * KeeperClient — proxy verso embeddings-worker per le chiamate RAG
 * ("Bibliotecario") only. Le operazioni di ricerca pura (embedding,
 * semantic search) restano in features/documenti/services/EmbeddingService.ts:
 * quelle servono alla ricerca anche a bibliotecario spento, queste no.
 *
 * Portato da EmbeddingService.ts (Fase 2 del refactor, vedi
 * docs/refactor/FEATURE-MODULES-PLAN.md): isAiAvailable() e askQuestion()
 * avevano zero chiamanti fuori dal perimetro keeper, verificato con grep
 * sull'intero repo prima dello spostamento.
 */

import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';
import type { ContextChunk } from '@core/extensions/points';

const EMBEDDINGS_SERVICE_URL = appConfig.services.embeddingsUrl;

interface KeeperAnswer {
  success: boolean;
  answer?: string;
  sources?: Array<{ heading: string; slug?: string; fullPath?: string; title?: string; used: boolean }>;
  metadata?: { model: string; tokensUsed: number };
  error?: string;
}

interface KeeperEnrichment {
  success: boolean;
  enrichment?: string | null;
  metadata?: { model: string; tokensUsed: number };
  error?: string;
}

export class KeeperClient {
  // Ollama availability è cachata brevemente: più domande nella stessa
  // finestra non devono ripetere un ping live a embeddings-worker /health
  // (e quindi a Ollama) ad ogni singola richiesta.
  private static aiHealthy: boolean | null = null;
  private static aiHealthCheckedAt = 0;
  private static readonly AI_HEALTH_TTL_MS = 60_000;

  /**
   * Whether il path RAG (Bibliotecario) è disponibile, cioè embeddings-worker
   * è raggiungibile E Ollama è su. Cachato per AI_HEALTH_TTL_MS.
   */
  static async isAiAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.aiHealthy !== null && now - this.aiHealthCheckedAt < this.AI_HEALTH_TTL_MS) {
      return this.aiHealthy;
    }

    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      const data = await response.json() as { ollama?: boolean };
      this.aiHealthy = data.ollama === true;
    } catch {
      this.aiHealthy = false;
    }

    this.aiHealthCheckedAt = now;
    return this.aiHealthy;
  }

  /** Generazione risposta AI del Bibliotecario via embeddings-worker /ask. */
  static async ask(payload: {
    question: string;
    context: ContextChunk[];
    options?: { maxTokens?: number; locale?: string };
  }): Promise<KeeperAnswer | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        logger.error(`[KeeperClient] /ask error: ${response.status}`);
        return null;
      }

      return await response.json() as KeeperAnswer;
    } catch (error: unknown) {
      logger.error(`[KeeperClient] Error in ask: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Arricchimento progressivo via embeddings-worker /ask/enrich: una fonte
   * alla volta, non l'intero contesto insieme (quello è ask()). Usata dal
   * loop rank-per-rank in extensions/searchStream.ts.
   */
  static async enrich(payload: {
    question: string;
    previousAnswer: string;
    chunk: ContextChunk;
    options?: { maxTokens?: number; locale?: string };
  }): Promise<KeeperEnrichment | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/ask/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        logger.error(`[KeeperClient] /ask/enrich error: ${response.status}`);
        return null;
      }

      return await response.json() as KeeperEnrichment;
    } catch (error: unknown) {
      logger.error(`[KeeperClient] Error in enrich: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
