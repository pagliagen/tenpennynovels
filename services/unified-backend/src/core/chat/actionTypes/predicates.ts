/**
 * Predicato condiviso, spostato verbatim dal branch comune di
 * ChatController.validateActionPermission per standard/whisper/ooc/
 * dice_roll — e riusato identico dalle feature skillCheck/statCheck/
 * itemUse, che avevano lo stesso identico controllo duplicato lì.
 */
export function isApprovedPlayerOrAbove(gameplayRoles: string[]): boolean {
  return gameplayRoles.includes('player') ||
    gameplayRoles.includes('master') ||
    gameplayRoles.includes('moderatore');
}
