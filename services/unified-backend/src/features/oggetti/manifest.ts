import type { FeatureManifest } from '@core/features/types';
import gameItemsRoutes from './routes/game-items';
import gameInventoryRoutes from './routes/game-inventory';
import gameShopRoutes from './routes/game-shop';
import adminRoutes from './routes/admin';

/**
 * Seconda metà dello split di EconomyController.ts/economy.ts (Fase 6.3 ha
 * preso Financial/Services in features/economia/): oggetti prende Item,
 * CharacterInventory, Shop, ShopItem e le 4 route shop rimaste.
 *
 * Nessun flag, stesso motivo di occupazioni/economia: il catalogo oggetti e
 * l'inventario sono agganciati al game loop (equip/uso oggetti in chat,
 * scheda personaggio), non spegnibili senza rompere flussi core.
 *
 * Prima feature del registro a usare `dependsOn` per davvero: legge le
 * finanze del personaggio (economia/api.ts: getCharacterFinancesSnapshot,
 * deductCash, deductCredit) e il tesoro corporativo (corporazioni/api.ts:
 * getCorporationTreasuryRaw, debitTreasuryUnsafe) senza importare i model
 * nudi. `dependsOn:['occupazioni']` NON serve: item.prerequisites.
 * requiredOccupations è confrontato come stringa pura contro
 * character.occupation, nessun import del model Occupation.
 *
 * Tre router interni distinti lato game (mai stati nello stesso file negli
 * originali, a differenza di economia dove Financial+Services erano già
 * uniti in economy.ts):
 * - game-items.ts: da items.ts, path relativi → mount '/items'
 * - game-inventory.ts: da characterInventoryActions.ts, path assoluti → mount '/'
 * - game-shop.ts: da economy.ts (ridotto alle sole route shop in Fase 6.3), path assoluti → mount '/'
 *
 * ShopController.ts è il rinominato di EconomyController.ts: dopo lo split
 * di Fase 6.3 "Economy" non descriveva più cosa contiene (solo shop-purchase).
 *
 * Bug preesistenti preservati esattamente (documentati nei file, TUTTI
 * confermati con test E2E reali su Docker in Fase 6.4, non solo ipotizzati
 * dalla lettura del codice), non corretti in questa fase:
 * - ShopController.checkLocationAccess legge location.private/.visible al
 *   livello sbagliato (schema reale: location.settings.private/.visible) →
 *   sempre false → getShopItems risponde sempre 404 per qualunque location
 *   diversa da "london". Il negozio generale (getGeneralStore/purchaseItem,
 *   TESTATO funzionante: acquisto cash e credito, deduzione fondi corretta)
 *   è l'unico percorso shop di fatto funzionante oggi.
 * - Character non ha un campo/virtual "corporations" nello schema →
 *   ShopController.restockShop lancia sempre StrictPopulateError su
 *   .populate('corporations') → sempre 500, endpoint completamente non
 *   funzionante per chiunque.
 * - corporation.treasury trattato come numero (corporazioni/api.ts,
 *   debitTreasuryUnsafe/getCorporationTreasuryRaw) — irraggiungibile a causa
 *   del bug precedente, preservato comunque per fedeltà al codice originale.
 * - Il prerequisito requiredCorporations è sempre falso in ShopController.
 *   meetsRequirements (reqCorp.toString() invece di reqCorp.corporationId.
 *   toString()).
 * - isStackable/maxStack letti al livello sbagliato in ItemController
 *   (properties.isStackable/properties.maxQuantity nello schema reale, non
 *   campi di primo livello).
 *
 * `api.ts` è vuoto: nessun consumatore cross-feature reale trovato verso
 * oggetti. Il model Shop non ha alcun controller CRUD in tutto il repo
 * ("feature not yet implemented" in un commento su LocationController.ts) —
 * si è spostato comunque verbatim insieme a Item/CharacterInventory/ShopItem,
 * nessun costo aggiuntivo.
 */
export const oggetti: FeatureManifest = {
  key: 'oggetti',
  title: 'Oggetti',
  description: 'Catalogo oggetti, inventario personaggio, negozi (shop generale e di location)',
  dependsOn: ['economia', 'corporazioni'],
  routes: [
    { scope: 'game', path: '/items', router: gameItemsRoutes },
    { scope: 'game', path: '/', router: gameInventoryRoutes },
    { scope: 'game', path: '/', router: gameShopRoutes },
    { scope: 'admin', path: '/items', router: adminRoutes },
  ],
};
