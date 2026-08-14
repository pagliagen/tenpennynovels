/**
 * Superficie pubblica della feature corporazioni per consumatori esterni
 * (features/forum/services/ForumAccessService.ts, features/oggetti/ — via
 * dependsOn dichiarato nei rispettivi manifest). Sostituisce l'import
 * diretto del model Corporation — vedi Fase 4 del refactor.
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

// Usata da modules/game/controllers/CharacterSocialController.ts (GET
// /characters/:characterId/corporations) — sostituisce l'import diretto del
// model, stessa query/projection di prima dello spostamento fuori dal barrel.
export async function getCorporationsForCharacter(characterId: string) {
  return Corporation.find({
    'members.characterId': characterId
  }).select('name description type membershipType isRecruiting members');
}

// --- Wrapper per la feature oggetti (Fase 6.4, dependsOn: ['corporazioni']) ---
// ShopController.restockShop legge/scrive il tesoro corporativo senza importare
// il model Corporation direttamente.

// Lettura non mutante, usata quando payFromTreasury è false: la risposta di
// restockShop include comunque i campi "treasury" ricostruiti dal valore
// corrente (bug preservato, vedi debitTreasuryUnsafe), anche senza addebito.
export async function getCorporationTreasuryRaw(corporationId: string | Types.ObjectId): Promise<
  { found: true; treasury: unknown } | { found: false }
> {
  const corporation = await Corporation.findById(corporationId).select('treasury').lean();
  if (!corporation) return { found: false };
  return { found: true, treasury: corporation.treasury };
}

// Bug preesistente preservato esattamente (vedi models/Corporation.ts: treasury è un
// oggetto {balance, monthlyIncome, monthlyExpenses, transactions[], lastUpdated}, non
// un numero — questa sottrazione produce NaN e sovrascrive l'intero campo alla
// successiva .save()). Comportamento invariato rispetto a prima dello spostamento
// in features/oggetti (Fase 6.4), non corretto qui. Nome deliberatamente esplicito
// perché non è un'operazione sicura.
export async function debitTreasuryUnsafe(corporationId: string | Types.ObjectId, amount: number): Promise<
  { ok: true; treasury: unknown } | { ok: false; reason: 'NOT_FOUND' }
> {
  const corporation = await Corporation.findById(corporationId);
  if (!corporation) return { ok: false, reason: 'NOT_FOUND' };

  (corporation as unknown as { treasury: unknown }).treasury =
    ((corporation.treasury as unknown as number) || 0) - amount;
  await corporation.save();

  return { ok: true, treasury: corporation.treasury as unknown };
}
