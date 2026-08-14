import type { FeatureManifest } from '@core/features/types';
import offGameChatsRoutes from './routes/offGameChats';
import offGameMessagesRoutes from './routes/offGameMessages';
import messagingSystemRoutes from './routes/messagingSystem';
import mailRoutes from './routes/mail';

/**
 * Messaggistica fuori-fiction (OOC) tra giocatori. Contiene DUE sistemi
 * paralleli, non uno — nessuna migrazione dell'uno verso l'altro è mai
 * stata completata:
 *
 * 1. Sistema legacy — OffGameChat/OffGameChatMessage/OffGameChatParticipant.
 *    Gruppi + dirette, pienamente funzionante (route, WebSocket inline nel
 *    controller, pannello admin MessagingSystemController). Usato ancora
 *    oggi da CharacterReviewEventHandler per le notifiche di review.
 * 2. Sistema nuovo — OffGameThread/OffGameMessage. Solo 1-a-1, con scoring
 *    di moderazione AI. Modello/servizio completi ma SENZA consegna
 *    realtime funzionante: ogni punto di emissione WebSocket nel
 *    controller è un TODO "Passo 5" mai implementato — preservato tale
 *    quale, non è stato completato durante questo spostamento.
 *
 * dependsOn: [] — nessun import da altre feature.
 *
 * Debito parzialmente risolto in Fase 7.4: il ramo offGame di
 * modules/game/services/MessageService.ts (branch interno su
 * messageContext, condiviso con onGame) è stato estratto in
 * features/offGameMessages/services/OffGameMessageService.ts — non più
 * un import esterno con boundary-allow, ora interno alla feature.
 * MessageBackupService.ts resta condiviso in modules/game/services/
 * (usato da entrambi i rami onGame/offGame): una feature può importare
 * da modules/ liberamente, nessun vincolo di boundary in quella
 * direzione, non serve alcuna annotazione.
 *
 * Debito accettato — infrastruttura di moderazione condivisa fra
 * location/onGame/offGame (fuori perimetro, non toccata):
 * ChatModerationController.ts (game+admin — anche questi due trovati solo
 * dal type-check, importavano OffGameChatMessage con un path profondo verso
 * @database/models/OffGameChatMessage), ChatMonitoringController.ts
 * (admin), ModerationAlertController.ts (admin) e i model
 * ChatModerationAction/MessageReport/UserReport/ModerationAlert operano su
 * tutti e tre i tipi di messaggio con un discriminatore, non solo offGame.
 *
 * shared/types/messaging.ts NON è stato toccato: la ricognizione iniziale
 * lo aveva segnalato come file morto (zero import con path tipo
 * '@shared/types/messaging' o relativi profondi), ma shared/types/index.ts
 * e shared/types/websocket.ts lo importano con un path relativo nella
 * stessa directory ('./messaging'), invisibile a quel grep — scoperto e
 * corretto dal type-check post-switch, non dalla ricognizione.
 *
 * Bug preesistenti confermati e preservati (decisi con l'utente,
 * ognuno singolarmente):
 * - ChatMonitoringController.ts (fuori perimetro) interroga la collection
 *   raw 'offgame_chat_messages' (con underscore) via driver nativo, ma la
 *   collection Mongoose reale è 'offgamechatmessages' (pluralizzazione di
 *   default, confermato via query diretta) — la sezione offGame della
 *   dashboard di monitoraggio admin restituisce sempre risultati vuoti.
 * - MessagingSystemController.moderateParticipant legge
 *   req.params.characterId, ma la route (routes/messagingSystem.ts) dichiara
 *   il segmento come :participantId — mute/rimuovi partecipante dal
 *   pannello admin fallisce sempre silenziosamente (characterId è sempre
 *   undefined, la query non trova mai il participant, 404).
 * - OffGameThreadService.findOrCreateThread crea un nuovo thread con
 *   lastMessagePreview: '' (stringa vuota), ma lo schema ha
 *   lastMessagePreview required: true — Mongoose rifiuta le stringhe vuote
 *   sui path String required. Confermato con test live (500
 *   ValidationError): il sistema nuovo (thread 1-a-1) non ha mai creato un
 *   thread con successo, coerente con le collection offgame_threads/
 *   offgame_messages già vuote nel DB prima di questa migrazione.
 * - OffGameChatService.createOrGetDirectChat filtra Character.find({status:
 *   {$in:['DRAFT','PENDING_APPROVAL','APPROVED']}}), ma lo schema Character
 *   reale ha playerStatus (minuscolo: 'draft'/'pending'/'approved'), non
 *   status — il filtro non trova mai i partecipanti, la funzione fallisce
 *   sempre con "One or both participants are invalid or not found".
 *   Confermato chiamando il servizio direttamente: CharacterReviewEventHandler
 *   (notifica OOC di approvazione/rifiuto personaggio, sistema legacy) non
 *   ha mai funzionato. Nota: OffGameChatController.ts (le route dirette
 *   /offgame-chats) non ha questo bug — implementa la stessa logica inline
 *   usando playerStatus correttamente, non passa da questo service.
 *
 * ⚠️ SICUREZZA — NON un bug di refactor, preesistente e indipendente da
 * questa migrazione: routes/mail.ts (metà offGame, spostata verbatim) e la
 * metà onGame gemella rimasta in modules/admin/routes/mailModerationRoutes.ts
 * non hanno NESSUN middleware di autenticazione in tutta la catena — non
 * nel file, non nel router padre, non in app.ts, e api-gateway fa solo da
 * reverse proxy senza layer di auth proprio per /admin. Chiunque raggiunga
 * il backend può leggere/eliminare (anche bulk, anche hard-delete) messaggi
 * privati on-game e off-game di qualsiasi giocatore. Deciso con l'utente:
 * preservato nello spostamento, ma segnalato come azione urgente da
 * affrontare in un task dedicato SUBITO DOPO la chiusura della Fase 6 — non
 * è sicuro lasciarlo così a lungo termine.
 */
export const offGameMessages: FeatureManifest = {
  key: 'offGameMessages',
  title: 'Messaggi fuori gioco',
  description: 'Messaggistica OOC tra giocatori: sistema legacy a chat/gruppi e sistema nuovo a thread 1-a-1',
  routes: [
    { scope: 'game', path: '/', router: offGameChatsRoutes },
    { scope: 'game', path: '/', router: offGameMessagesRoutes },
    { scope: 'admin', path: '/messaging', router: messagingSystemRoutes },
    { scope: 'admin', path: '/mail', router: mailRoutes },
  ],
};
