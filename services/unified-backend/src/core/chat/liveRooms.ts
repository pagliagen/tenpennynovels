import { hasGamePermission, GamePermissions } from '@config/permissions';

/**
 * Room Socket.IO che ricevono contenuti riservati o notifiche di servizio.
 *
 * Due room distinte, perché rispondono a due domande diverse:
 * - CHAT_MASTERS_ROOM: chi può leggere dal vivo sussurri, messaggi `master_only` e confronti non mascherati.
 *   L'autorità è la stessa di `ChatMessageService.canSeeAction` (permesso CHAT_MASTER_ACTION), che vale solo su un
 *   personaggio approvato: la consegna dal vivo non deve mai concedere più della lettura via REST.
 * - STAFF_ROOM: notifiche di ticket e approvazioni. Non porta contenuti di chat.
 *
 * Fino al 2026-11-15 esisteva solo `staff`, assegnata guardando `gameplayRoles` senza lo stato: un personaggio in
 * bozza con ruolo master riceveva i sussurri dal vivo (quarto percorso dei poteri di ruolo, vedi 20-backend.md).
 */
export const CHAT_MASTERS_ROOM = 'chat_masters';
export const STAFF_ROOM = 'staff';

export interface LiveRoomCharacter {
  playerStatus?: string;
  isGestore?: boolean;
  gameplayRoles?: string[];
  characterPermissions?: string[];
}

export interface LiveRoomMembership {
  /** Riceve sussurri e messaggi riservati al master. */
  chatMasters: boolean;
  /** Riceve le notifiche di servizio (ticket, approvazioni). */
  staff: boolean;
  /** Riceve le notifiche riservate ai gestori. */
  leadership: boolean;
}

export function resolveLiveRooms(character: LiveRoomCharacter | null | undefined): LiveRoomMembership {
  if (!character) return { chatMasters: false, staff: false, leadership: false };

  // Stato assente = bozza: mai dare per approvato un personaggio di cui non si conosce lo stato.
  const playerStatus = character.playerStatus || 'draft';
  const isGestore = character.isGestore === true;
  const roles = character.gameplayRoles || [];
  const approved = playerStatus === 'approved';

  const chatMasters = hasGamePermission(
    GamePermissions.CHAT_MASTER_ACTION,
    playerStatus,
    isGestore,
    roles,
    character.characterPermissions || []
  );

  // Notifiche di servizio: i ruoli valgono solo da approvati; il gestore le riceve in ogni stato, come nel pannello
  // admin (eccezione del 2026-11-10: l'account amministrativo di produzione è in bozza).
  const staff = isGestore || (approved && (roles.includes('master') || roles.includes('moderatore')));

  return { chatMasters, staff, leadership: isGestore };
}
