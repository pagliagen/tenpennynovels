/**
 * Trimmed da shared/types/corporation.ts (Fase 4 del refactor, vedi
 * docs/refactor/FEATURE-MODULES-PLAN.md). Il file originale esportava 13
 * interfacce; verificato con grep sull'intero repo che solo CorporationRole
 * era davvero importato altrove (da CorporationController.ts, che si sposta
 * qui insieme). CorporationPermission resta perché CorporationRole ne
 * dipende internamente — non è morto, il grep sui soli import esterni non
 * lo catturava. Le altre 11 interfacce (Corporation, CorporationMember,
 * CorporationInvitation, CorporationMembershipRequest,
 * CorporationMembershipApplication, CorporationTreasury,
 * CorporationFinancialTransaction, CorporationRevenueSource,
 * CorporationBudget, CorporationActivity, CorporationAutomaticRule) erano
 * un modello di dominio "a stringhe" mai collegato all'implementazione
 * reale (che usa i model Mongoose in models/Corporation.ts) — eliminate.
 */
import { VictorianCurrency } from '@shared/types/economy';

export interface CorporationPermission {
  action: 'invite_members' | 'remove_members' | 'manage_roles' | 'access_locations' |
          'manage_locations' | 'view_finances' | 'manage_finances' | 'create_missions' |
          'approve_missions' | 'access_private_chat' | 'manage_corporation';
  granted: boolean;
  restrictions?: {
    maxLevel?: number; // Can only affect members of lower level
    locationIds?: string[]; // Specific locations only
  };
}

export interface CorporationRole {
  id: string;
  corporationId: string;
  name: string;
  description: string;

  // Hierarchy
  level: number; // Higher number = higher rank
  parentRoleId?: string; // Role hierarchy

  // Economic benefits
  dailySalary?: VictorianCurrency; // Daily salary paid from corporation treasury

  // Permissions
  permissions: CorporationPermission[];

  // Limits
  maxMembers?: number; // null = unlimited

  // Requirements
  requirements?: {
    minimumStats?: { [key: string]: number };
    requiredSkills?: { [key: string]: number };
  };
}
