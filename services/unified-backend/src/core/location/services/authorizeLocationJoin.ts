import { Character } from '@core/character/models/Character';
import { Location } from '@core/location/models/Location';
import { hasGamePermission, GamePermissions } from '@config/permissions';
import { isCharacterBlockedForScope } from '@shared/middleware/banCheck';
import { checkLocationAccess } from './checkLocationAccess';

export type LocationJoinResult =
  | { ok: true; locationName: string }
  | { ok: false; reason: 'CHARACTER_NOT_FOUND' | 'LOCATION_NOT_FOUND' | 'BANNED' | 'NOT_ALLOWED' | 'ACCESS_DENIED' };

/**
 * Può questo personaggio entrare nella room dal vivo di questa location?
 *
 * Stesse regole di `POST /game/locations/:id/enter` (ban, permesso `game:locations:enter`, `checkLocationAccess`),
 * lette dal DB al momento della richiesta: i dati sul socket sono una fotografia dell'handshake e possono essere
 * vecchi di ore. Chi è nella room riceve i messaggi senza altri filtri, quindi l'ingresso è l'unico controllo.
 */
export async function authorizeLocationJoin(characterId: string, locationId: string): Promise<LocationJoinResult> {
  const [character, location] = await Promise.all([
    Character.findById(characterId),
    Location.findById(locationId),
  ]);

  if (!character) return { ok: false, reason: 'CHARACTER_NOT_FOUND' };
  if (!location) return { ok: false, reason: 'LOCATION_NOT_FOUND' };

  if (await isCharacterBlockedForScope(characterId, 'game_banned')) {
    return { ok: false, reason: 'BANNED' };
  }

  const canEnter = hasGamePermission(
    GamePermissions.LOCATIONS_ENTER,
    character.playerStatus || 'draft',
    character.isGestore || false,
    character.gameplayRoles || [],
    character.characterPermissions || []
  );
  if (!canEnter) return { ok: false, reason: 'NOT_ALLOWED' };

  if (!(await checkLocationAccess(location, character))) {
    return { ok: false, reason: 'ACCESS_DENIED' };
  }

  return { ok: true, locationName: location.name };
}
