import mongoose from 'mongoose';
import { aiGateway } from '@core/ai';
import { appConfig } from '@config/runtime';
import { invalidateBotDirectory } from '@features/botChat/api';
import { LOCATION_TAG_DEFS, type LocationTag } from '@core/location/constants/locationTags';
import { Location } from '@core/location/models/Location';
import { characterNameInUse, characterStatuses, createBotCharacter, deleteBotCharacter, systemBotUserExists } from './BotCharacterService';
import type { BotAdminDeps, LocationInfo } from './BotAdminService';

/** Il contesto di una location per la generazione: solo contenuti pubblici (nome, quartiere, tag, descrizione, nomi delle posizioni). */
async function loadLocationInfo(locationId: string): Promise<LocationInfo | null> {
  if (!mongoose.isValidObjectId(locationId)) return null;
  const location = await Location.findById(locationId).select('name description tags positions parentLocation locationLevel').lean();
  if (!location) return null;

  let quartiere: string | null = null;
  let district: string | null = null;
  let parentId = location.parentLocation?.toString();
  for (let depth = 0; parentId && depth < 6; depth++) {
    const parent = await Location.findById(parentId).select('name locationLevel parentLocation').lean();
    if (!parent) break;
    if (parent.locationLevel === 'quartiere' && !quartiere) quartiere = parent.name;
    if (parent.locationLevel === 'district' && !district) district = parent.name;
    parentId = parent.parentLocation?.toString();
  }

  return {
    _id: location._id.toString(),
    name: location.name,
    quartiere,
    district,
    description: location.description ?? '',
    tagLabels: ((location.tags ?? []) as string[]).map((t) => LOCATION_TAG_DEFS[t as LocationTag]?.label ?? t),
    positionNames: (location.positions ?? []).map((p: { name?: string }) => p.name ?? '').filter(Boolean),
    hasChat: location.locationLevel === 'location',
  };
}

async function locationNames(ids: string[]): Promise<Map<string, string>> {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return new Map();
  const rows = await Location.find({ _id: { $in: valid } }).select('name').lean();
  return new Map(rows.map((r) => [r._id.toString(), r.name]));
}

export const defaultDeps: BotAdminDeps = {
  environment: appConfig.botEnvironment,
  call: (action, body, timeoutMs) => aiGateway.call('character-bot', action, body, timeoutMs ? { timeoutMs } : {}),
  loadLocation: loadLocationInfo,
  locationNames,
  characterStatuses,
  systemUserExists: systemBotUserExists,
  nameInUse: characterNameInUse,
  createCharacter: createBotCharacter,
  deleteCharacter: deleteBotCharacter,
  afterCreate: invalidateBotDirectory,
};
