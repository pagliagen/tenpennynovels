// Barrel pubblico della feature. Vuoto: nessun consumatore cross-feature reale
// verso oggetti trovato in ricognizione (Fase 6.4) — i consumer esterni esistenti
// (ChatController, MessageContext, WeaponService, GameController,
// CharacterController, CharacterApprovalController) passano tutti dal barrel
// @database/models/Item (shim), non da qui, e sono documentati come debito
// dichiarato nei rispettivi file.
