/**
 * Fase 7.3 (consolidamento core): unifica due implementazioni quasi
 * identiche di "può questo personaggio accedere a questa location"
 * trovate una in LocationService.ts, una in LocationController.ts —
 * duplicate su decisione esplicita dell'utente in fase di ricognizione
 * ("dagli un senso, e rimuoviamo i duplicati").
 *
 * Le due versioni non erano equivalenti, non un copia-incolla puro:
 * - LocationController gestiva il gate su `settings.visible` COME PRIMO
 *   controllo, sempre applicato — coerente col fatto che i suoi 3 call
 *   site (checkLocationAccess su un GET diretto per ID, tag PNG, access
 *   info) fanno `Location.findById(locationId)` senza alcun pre-filtro:
 *   il gate qui è l'UNICO punto che nega l'accesso a una location non
 *   visibile, anche al proprietario. Comportamento reale, non un bug.
 * - LocationService NON aveva questo gate esplicito, ma il suo UNICO
 *   call site (getAccessibleLocations) filtra già a monte con una query
 *   Mongo su `settings.visible: true` prima di richiamare la funzione:
 *   il controllo su `visible` lì dentro sarebbe stato comunque
 *   ridondante, mai la fonte di verità.
 * - LocationController non guardava `location.settings` mancante prima
 *   di leggere `.visible` — un documento legacy senza `settings` avrebbe
 *   fatto crashare la chiamata (TypeError). LocationService gestiva
 *   questo caso esplicitamente (locations legacy = pubbliche). Bug reale
 *   in LocationController, corretto qui.
 * - LocationController non verificava `access.ownerType === 'character'`
 *   prima di confrontare `ownerId` — un owner di tipo diverso da
 *   'character' con lo stesso ObjectId (improbabile ma non impossibile,
 *   e comunque un controllo esplicito costa nulla) avrebbe passato
 *   l'accesso. LocationService lo controllava. Corretto qui.
 *
 * Sintesi: gate su `visible` sempre applicato (comportamento reale di
 * LocationController, l'unico dei due path realmente esposto a
 * location non pre-filtrate), più le due correzioni di robustezza da
 * LocationService (settings mancante, ownerType). Nessuno dei due call
 * site perde comportamento: per LocationService il gate su `visible` è
 * un no-op (la query a monte garantisce già `visible: true` o
 * `settings` assente, gestito dal primo return).
 */
export async function checkLocationAccess(location: any, character: any): Promise<boolean> {
  // Legacy locations senza settings: considerate pubbliche e visibili.
  if (!location.settings) {
    return true;
  }

  // Location non visibile: nessuno vi accede, proprietario incluso.
  if (!location.settings.visible) {
    return false;
  }

  // Location pubblica (non privata, visibile — già garantito sopra).
  if (!location.settings.private) {
    return true;
  }

  // Location privata: proprietario, accesso per-personaggio, corporazione (non implementato).
  if (location.settings.private) {
    if (location.access?.ownerType === 'character' && location.access?.ownerId?.toString() === character.id) {
      return true;
    }

    const access = location.access?.characterAccess?.find((a: any) => a.characterId.toString() === character.id);
    if (access) {
      if (access.duration === 'temporary' && access.expiresAt && new Date() > access.expiresAt) {
        return false;
      }
      return access.permissions.includes('view');
    }

    // Corporation membership - feature not yet implemented
  }

  return false;
}
