/**
 * Superficie pubblica della feature corporazioni per consumatori esterni
 * (oggi: modules/forum/services/ForumAccessService.ts). Sostituisce
 * l'import diretto del model Corporation, che faceva 3 query di
 * membership senza passare da qui — vedi Fase 4 del refactor.
 */
import { Types } from 'mongoose';
import { Corporation } from './models/Corporation';

export async function isMember(characterId: string, corporationId: string | Types.ObjectId): Promise<boolean> {
  return (await Corporation.exists({
    _id: corporationId,
    'members.characterId': new Types.ObjectId(characterId),
  })) !== null;
}

export async function getMemberCorporationIds(characterId: string): Promise<Types.ObjectId[]> {
  return Corporation.find({ 'members.characterId': new Types.ObjectId(characterId) }).distinct('_id');
}
