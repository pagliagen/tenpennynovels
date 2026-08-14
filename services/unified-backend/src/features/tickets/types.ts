// Ticketing System — enum/mapping runtime, da modules/game/types/game.ts (righe 512-586)

export enum TicketStatus {
  OPEN = 'open',           // Nuovo ticket
  ASSIGNED = 'assigned',   // Staff assegnato
  IN_PROGRESS = 'in_progress', // Lavorazione attiva
  WAITING_USER = 'waiting_user', // Attesa risposta utente
  CLOSED = 'closed',       // Risolto
  REOPENED = 'reopened'    // Riaperto dal personaggio
}

export enum TicketDepartment {
  // Reparti Specializzati
  MASTER = 'master',           // Gestione gameplay, narrazione, eventi
  TECHNICAL = 'technical',     // Bug, performance, problemi tecnici
  MODERATION = 'moderation',   // Segnalazioni utenti, comportamenti
  ADMINISTRATION = 'administration', // Gestione personaggi, policy
  GENERAL = 'general'          // Supporto generale, prima categorizzazione
}

export enum TicketCategory {
  // v1 - 5 categorie iniziali
  CHARACTER_APPROVAL = 'character_approval',
  CHARACTER_EDIT = 'character_edit',
  QUEST_PROPOSAL = 'quest_proposal',
  GAME_BUG_REPORT = 'game_bug_report',
  IMPROVEMENT_SUGGESTION = 'improvement_suggestion',
  /** Contestazione / chiarimenti su sanzioni (ban parziale o comunicazione con staff) */
  SANCTION_APPEAL = 'sanction_appeal',
}

export enum TicketPriority {
  LOW = 'low',           // 5-7 giorni escalation
  MEDIUM = 'medium',     // 48h escalation
  HIGH = 'high',         // 24h escalation
  CRITICAL = 'critical'  // 6h escalation (solo admin)
}

// Mapping Categoria → Label Italiana (v1 - 5 categorie iniziali)
//
// ATTENZIONE — divergenza nota, bug preesistente NON corretto in questa migrazione:
// questo è il set "v1" a 6 voci usato da TicketController.ts per validare la categoria
// in creazione ticket lato game. TicketManagementController.ts (admin) ha una COPIA
// LOCALE indipendente di TICKET_CATEGORIES con 23 voci (il set realmente in uso lato
// admin), non derivata da questa. Risultato: un giocatore non può creare un ticket
// in 17 delle 23 categorie che l'admin supporta. Comportamento spostato esattamente
// com'era, deduplicazione fuori scope.
export const TICKET_CATEGORIES = {
  [TicketCategory.CHARACTER_APPROVAL]: 'Approvazione Personaggio',
  [TicketCategory.CHARACTER_EDIT]: 'Modifica Personaggio',
  [TicketCategory.QUEST_PROPOSAL]: 'Proposta Trama/Quest',
  [TicketCategory.GAME_BUG_REPORT]: 'Segnalazione Bug',
  [TicketCategory.IMPROVEMENT_SUGGESTION]: 'Suggerimento Miglioramento',
  [TicketCategory.SANCTION_APPEAL]: 'Sanzione / contestazione',
} as const;

// Mapping Categoria → Reparto (routing automatico iniziale) - v1
export const CATEGORY_DEPARTMENT_MAPPING = {
  [TicketCategory.CHARACTER_APPROVAL]: TicketDepartment.ADMINISTRATION,
  [TicketCategory.CHARACTER_EDIT]: TicketDepartment.ADMINISTRATION,
  [TicketCategory.QUEST_PROPOSAL]: TicketDepartment.MASTER,
  [TicketCategory.GAME_BUG_REPORT]: TicketDepartment.TECHNICAL,
  [TicketCategory.IMPROVEMENT_SUGGESTION]: TicketDepartment.GENERAL,
  [TicketCategory.SANCTION_APPEAL]: TicketDepartment.MODERATION,
} as const;

// Mapping Reparto → Ruoli Staff Autorizzati
//
// Duplicata identicamente (nessuna divergenza di valori) in TicketManagementController.ts.
// Deduplicazione fuori scope per questa fase.
export const DEPARTMENT_ROLES_MAPPING = {
  [TicketDepartment.MASTER]: ['master', 'amministratore'],
  [TicketDepartment.TECHNICAL]: ['amministratore'], // Solo admin per problemi tecnici
  [TicketDepartment.MODERATION]: ['moderatore', 'amministratore'],
  [TicketDepartment.ADMINISTRATION]: ['master', 'moderatore', 'amministratore'],
  [TicketDepartment.GENERAL]: ['master', 'moderatore', 'amministratore'] // Tutti possono gestire
} as const;

// Mapping Categoria → Priorità Automatica (per sistema escalation) - v1
export const CATEGORY_PRIORITY_MAPPING = {
  [TicketCategory.CHARACTER_APPROVAL]: TicketPriority.MEDIUM,
  [TicketCategory.CHARACTER_EDIT]: TicketPriority.MEDIUM,
  [TicketCategory.QUEST_PROPOSAL]: TicketPriority.LOW,
  [TicketCategory.GAME_BUG_REPORT]: TicketPriority.HIGH,
  [TicketCategory.IMPROVEMENT_SUGGESTION]: TicketPriority.LOW,
  [TicketCategory.SANCTION_APPEAL]: TicketPriority.HIGH,
} as const;

// DTO Admin — da modules/admin/types/management.ts (righe 317-452)
// Unico consumatore confermato: TicketManagementController.ts

export interface TicketManagement {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  department: 'master' | 'technical' | 'moderation' | 'administration' | 'general';

  // Creator information
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;

  // Assignment information
  assignedTo?: {
    id: string;
    name: string;
  };
  assignedAt?: string;

  // Status tracking
  closedAt?: string;
  closedBy?: {
    id: string;
    name: string;
  };

  // Escalation
  escalatedAt?: string;
  escalationLevel?: number;

  // Read tracking
  lastReadBy: {
    character?: string;
    staff?: string;
  };

  // Metadata
  tags?: string[];
  internalNotes?: string;
  messageCount?: number;
}

export interface TicketAssignment {
  ticketId: string;
  assignedTo: string;
  assignedToName: string;
  reason?: string;
}

export interface TicketReassignment {
  ticketId: string;
  fromStaff: string;
  fromStaffName: string;
  toStaff: string;
  toStaffName: string;
  reason?: string;
}

export interface TicketTransfer {
  ticketId: string;
  fromDepartment: string;
  toDepartment: string;
  reason: string;
}

export interface TicketClosure {
  ticketId: string;
  resolution?: string;
  notifyUser?: boolean;
}

// ATTENZIONE: nome collide col model Mongoose TicketMessage e con l'interfaccia
// (morta, non migrata) di modules/game/types/game.ts. Il consumatore originale
// importa questo tipo con alias `TicketMessage as TicketMessageResponse` — alias
// da preservare in TicketManagementController.ts dopo la migrazione.
export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: string;
  isInternal: boolean;
}

export interface TicketPriorityUpdate {
  ticketId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
}

export interface TicketInternalNote {
  ticketId: string;
  note: string;
}

export interface TicketStats {
  overview: {
    totalTickets: number;
    openTickets: number;
    assignedTickets: number;
    closedTickets: number;
    avgResolutionTime: string;
  };
  byDepartment: Record<string, {
    total: number;
    open: number;
    assigned: number;
    closed: number;
  }>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  staffPerformance: Array<{
    staffId: string;
    staffName: string;
    totalHandled: number;
    avgResolutionTime: string;
    currentAssigned: number;
  }>;
  escalationStats: {
    totalEscalated: number;
    byLevel: Record<number, number>;
  };
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  department?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  escalated?: boolean;
}
