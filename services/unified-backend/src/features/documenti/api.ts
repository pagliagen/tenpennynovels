/**
 * Barrel pubblico della feature. Espone EmbeddingService (puro proxy HTTP
 * verso embeddings-worker, nessuna logica di dominio da isolare in wrapper
 * dedicati — a differenza dei wrapper di economia/corporazioni per oggetti,
 * Fase 6.4): tutti e 3 i metodi rimasti dopo lo scarto del codice morto
 * servono a consumer esterni reali (ChatController.ts, forum/ForumController.ts
 * — non feature, la regola "solo tramite api.ts" del boundary checker vale
 * per qualunque file esterno — e fineSessione/ChatSceneService.ts, che è una
 * feature e la referenzia via dependsOn: ['documenti']).
 */
export { EmbeddingService } from './services/EmbeddingService';
