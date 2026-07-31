/**
 * Character Finances API types
 *
 * Liquidità (cash/bankDeposit, in penny), Valore di Credito (financeSkillValue)
 * e rendita settimanale (creditLine, in penny) di un personaggio — gestiti dal
 * pannello per correzioni narrative/premi/penalità, non toccati dal normale
 * flusso di gioco.
 */

export type SocialClass =
  | 'destitute'
  | 'poor'
  | 'modest'
  | 'lower_middle'
  | 'middle_class'
  | 'wealthy'
  | 'affluent'
  | 'elite';

export interface CharacterFinances {
  _id: string;
  characterId: string;
  socialClass: SocialClass;
  financeSkillValue: number;
  cash: number;
  bankDeposit: number;
  creditLine: {
    maxWeekly: number;
    currentAvailable: number;
    lastResetDate: string;
    nextResetDate: string;
  };
  lastCalculated: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCharacterFinancesData {
  cash?: number;
  bankDeposit?: number;
  financeSkillValue?: number;
  creditLine?: {
    maxWeekly?: number;
    currentAvailable?: number;
  };
}
