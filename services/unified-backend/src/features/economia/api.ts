// Barrel pubblico della feature. Non vuoto: oltre al re-export sotto per il
// cron, espone funzioni wrapper mirate per la feature oggetti (Fase 6.4,
// dependsOn: ['economia']) — mai il model CharacterFinances nudo.
//
// server.ts importa questo modulo dinamicamente solo per innescare il
// side-effect del cron in services/serviceCancellationCleanup.ts
// (cron.schedule() a livello di modulo, nessuna funzione da chiamare
// esplicitamente). Se questo export venisse rimosso, il cron smetterebbe di
// registrarsi senza alcun errore visibile.
export * from './services/serviceCancellationCleanup';

import { CharacterFinances } from './models/CharacterFinances';
import type { SocialClass } from '@shared/types/socialClass';

export interface CharacterFinancesSnapshot {
  cash: number;
  bankDeposit: number;
  socialClass: SocialClass;
  creditLine: { maxWeekly: number; currentAvailable: number; nextResetDate: Date };
}

export async function getCharacterFinancesSnapshot(characterId: string): Promise<CharacterFinancesSnapshot | null> {
  const finances = await CharacterFinances.findOne({ characterId }).lean();
  if (!finances) return null;

  return {
    cash: finances.cash,
    bankDeposit: finances.bankDeposit,
    socialClass: finances.socialClass,
    creditLine: {
      maxWeekly: finances.creditLine.maxWeekly,
      currentAvailable: finances.creditLine.currentAvailable,
      nextResetDate: finances.creditLine.nextResetDate
    }
  };
}

// Sottrae da cash, poi da bankDeposit se cash non basta. Stessa logica esatta
// oggi inline in EconomyController.purchaseItem. 'NOT_FOUND'/'INSUFFICIENT_FUNDS'
// mappano 1:1 sui codici errore già restituiti da purchaseItem.
export async function deductCash(characterId: string, amount: number): Promise<
  { ok: true } | { ok: false; reason: 'NOT_FOUND' } | { ok: false; reason: 'INSUFFICIENT_FUNDS'; available: number }
> {
  const finances = await CharacterFinances.findOne({ characterId });
  if (!finances) return { ok: false, reason: 'NOT_FOUND' };

  const totalCash = finances.cash + finances.bankDeposit;
  if (totalCash < amount) {
    return { ok: false, reason: 'INSUFFICIENT_FUNDS', available: totalCash };
  }

  if (finances.cash >= amount) {
    finances.cash -= amount;
  } else {
    const remainder = amount - finances.cash;
    finances.cash = 0;
    finances.bankDeposit -= remainder;
  }
  finances.lastCalculated = new Date();
  await finances.save();

  return { ok: true };
}

// Sottrae da creditLine.currentAvailable. Stessa logica oggi inline in
// EconomyController.purchaseItem.
export async function deductCredit(characterId: string, amount: number): Promise<
  { ok: true } | { ok: false; reason: 'NOT_FOUND' } | { ok: false; reason: 'INSUFFICIENT_CREDIT'; available: number }
> {
  const finances = await CharacterFinances.findOne({ characterId });
  if (!finances) return { ok: false, reason: 'NOT_FOUND' };

  if (finances.creditLine.currentAvailable < amount) {
    return { ok: false, reason: 'INSUFFICIENT_CREDIT', available: finances.creditLine.currentAvailable };
  }

  finances.creditLine.currentAvailable -= amount;
  finances.lastCalculated = new Date();
  await finances.save();

  return { ok: true };
}
