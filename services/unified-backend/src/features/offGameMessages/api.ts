/**
 * Barrel pubblico della feature. Consumer esterni reali:
 * - modules/game/events/handlers/CharacterReviewEventHandler.ts chiama
 *   OffGameChatService.createOrGetDirectChat()/.sendMessage() per notificare
 *   l'esito di una review personaggio (sistema legacy).
 * - modules/game/controllers/GameController.ts interroga direttamente
 *   OffGameChatParticipant/OffGameChatMessage per calcolare il badge
 *   "messaggi non letti" in /game/init (query ad-hoc, non passa dal service).
 * - modules/game/websocket/chatHandlers.ts interroga OffGameChat.find() per
 *   contare le chat attive in handshake ('join_offgame_chats'), nessun join
 *   di room.
 * - modules/game/controllers/ChatModerationController.ts (game e admin,
 *   entrambe le varianti) interroga OffGameChatMessage per la sezione
 *   offGame della moderazione condivisa location/onGame/offGame — questo
 *   controller resta fuori dal perimetro (debito dichiarato, vedi
 *   manifest.ts) ma è un consumer reale con import profondo pre-esistente.
 * - modules/game/services/MessageService.ts (core-adiacente, condiviso col
 *   sistema postale onGame, resta fuori dal perimetro) usa OffGameMessage
 *   e OffGameThreadService per il ramo "offgame" del suo branch interno.
 */
export { OffGameChatService } from './services/OffGameChatService';
export { OffGameThreadService } from './services/OffGameThreadService';
export { OffGameChat } from './models/OffGameChat';
export { OffGameChatMessage } from './models/OffGameChatMessage';
export { OffGameChatParticipant } from './models/OffGameChatParticipant';
export { OffGameMessage } from './models/OffGameMessage';
