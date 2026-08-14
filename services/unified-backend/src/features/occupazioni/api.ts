// Barrel pubblico della feature. Popolato in occasione della rimozione dello
// shim di compatibilità in database/models/index.ts (fine Fase 6, pulizia
// pre-Fase 7): 5 consumer esterni reali (CharacterApprovalController,
// characterCreationUtils, GameController, CharacterGameplayController,
// CharacterController) leggono Occupation con query dirette, nessuna logica
// di dominio da isolare in wrapper.
export { Occupation } from './models/Occupation';
