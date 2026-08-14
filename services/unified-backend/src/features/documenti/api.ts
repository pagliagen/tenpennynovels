/**
 * Barrel pubblico della feature. Espone EmbeddingService (puro proxy HTTP
 * verso embeddings-worker, nessuna logica di dominio da isolare in wrapper
 * dedicati — a differenza dei wrapper di economia/corporazioni per oggetti,
 * Fase 6.4): tutti e 3 i metodi rimasti dopo lo scarto del codice morto
 * servono a consumer esterni reali (ChatController.ts, ChatSceneService.ts,
 * ForumController.ts — nessuno dei tre è una feature, ma la regola "solo
 * tramite api.ts" del boundary checker vale per qualunque file esterno).
 */
export { EmbeddingService } from './services/EmbeddingService';
