import mongoose from 'mongoose';
import { Character } from '@core/character/models/Character';
import { appConfig } from '@config/runtime';
import { User } from '@core/auth/models/User';
import type { CharacterFields } from '../utils/draft';

/**
 * Il personaggio di un bot nel game: appartiene all'utente di sistema (`SYSTEM_BOT_USER_ID`), è approvato e non è
 * mai selezionato da una sessione. Stessi campi e stessi valori di default di `scripts/seeders/seeders/BotCharacterSeeder.ts`
 * (il seeder è uno script a sé e non può importare dal backend: se cambia uno, va allineato l'altro).
 *
 * Scrive sulla collection e non con `save()`: così non scattano gli hook di approvazione (permessi, finanze).
 * `characterType` è 'pg_principale': un 'png' richiederebbe un referentCharacterId che l'utente di sistema non ha.
 */

const systemUserId = (): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(appConfig.services.botService.systemUserId);

export async function systemBotUserExists(): Promise<boolean> {
  return (await User.exists({ _id: systemUserId() })) !== null;
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Un personaggio (di chiunque) con questo nome completo, senza badare alle maiuscole. */
export async function characterNameInUse(name: string): Promise<boolean> {
  return (await Character.exists({ name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } })) !== null;
}

export async function createBotCharacter(fields: CharacterFields): Promise<string> {
  const now = new Date();
  const botUserId = systemUserId();
  const result = await Character.collection.insertOne({
    ...fields,
    characterType: 'pg_principale',
    userId: botUserId,
    playerStatus: 'approved',
    gameplayRoles: ['player'],
    canAccessAdminPanel: false,
    isGestore: false,
    characterPermissions: [],
    adminPermissions: [],
    skills: {},
    equipment: [],
    isActive: false,
    isBanned: false,
    stats: { strength: 55, constitution: 55, size: 60, dexterity: 45, appearance: 45, intelligence: 55, power: 50, education: 40 },
    derived: { ideaRoll: 55, luckRoll: 50, knowledge: 40, hitPoints: 11, sanity: 50, maxSanity: 99, magicPoints: 10, movementRate: 7, bonusDamage: '+1d4', build: 1 },
    forumStats: { followerCount: 0, followingCount: 0, postCount: 0 },
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    approvedAt: now,
    approvedBy: botUserId,
    approvedByName: 'System',
  });
  return result.insertedId.toString();
}

/** Compensazione: toglie un personaggio bot appena creato (solo se è dell'utente di sistema). */
export async function deleteBotCharacter(characterId: string): Promise<void> {
  await Character.collection.deleteOne({ _id: new mongoose.Types.ObjectId(characterId), userId: systemUserId() });
}

export async function characterStatuses(ids: string[]): Promise<Map<string, string>> {
  const rows = await Character.collection
    .find({ _id: { $in: ids.filter((i) => mongoose.isValidObjectId(i)).map((i) => new mongoose.Types.ObjectId(i)) } }, { projection: { playerStatus: 1 } })
    .toArray();
  return new Map(rows.map((r) => [r._id.toString(), String(r.playerStatus ?? '')]));
}
