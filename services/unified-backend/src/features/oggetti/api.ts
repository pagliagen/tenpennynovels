// Barrel pubblico della feature. I consumer esterni reali (ChatController,
// MessageContext, WeaponService, GameController, CharacterController,
// CharacterApprovalController) leggono/scrivono Item/CharacterInventory con
// query dirette non coperte da nessuna logica di dominio da isolare in
// wrapper — a differenza di economia/corporazioni, qui non c'è comportamento
// da nascondere dietro una funzione, solo accesso al model. Popolato in
// occasione della rimozione dello shim di compatibilità in
// database/models/index.ts (fine Fase 6, pulizia pre-Fase 7).
export { Item, CharacterInventory } from './models/Item';
