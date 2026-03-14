/**
 * Character API Types
 *
 * Definisce interfacce per Character entity e relative API responses.
 */

import type { ApiResponse } from './common';

export interface Character {
  _id: string;
  userId: string;
  user?: {
    _id: string;
    username: string;
    email: string;
  };
  name: string;
  surname: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  approvalStatus: {
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  };
  biography: {
    appearance: string;
    personality: string;
    background: string;
    goals: string;
  };
  prestavolto?: string;
  prestavoltoStatus?: 'approved' | 'pending_duplicate' | null;
  prestavoltoApprovedBy?: string;
  prestavoltoApprovedAt?: string;
  occupation?: {
    _id: string;
    name: string;
    category: string;
  };
  location?: {
    _id: string;
    name: string;
    slug: string;
  };
  socialClass: {
    level: number;
    name: string;
    wealth: number;
  };
  skills: CharacterSkill[];
  relationships: CharacterRelation[];
  inventory: {
    items: InventoryItem[];
    money: number;
    currency: string;
  };
  stats: {
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    reputation: number;
  };
  activity: {
    lastActiveAt: string | null;
    messagesSent: number;
    actionsPerformed: number;
    eventsParticipated: number;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    isNPC: boolean;
    isPublic: boolean;
  };

  // Granular permission system
  isGestore: boolean;
  characterRoles: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions: string[];
}

export interface CharacterSkill {
  _id: string;
  skillId: string;
  skillName: string;
  level: number;
  experience: number;
  category: string;
}

export interface CharacterRelation {
  _id: string;
  targetCharacterId: string;
  targetCharacterName: string;
  type: 'friend' | 'enemy' | 'family' | 'romantic' | 'business' | 'acquaintance';
  strength: number;
  notes?: string;
}

export interface InventoryItem {
  _id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  equipped: boolean;
}

export interface CharacterListParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  userId?: string;
  socialClass?: number;
}

export interface CharacterListResponse {
  items: Character[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UpdateCharacterData {
  name?: string;
  surname?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  status?: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  biography?: {
    appearance?: string;
    personality?: string;
    background?: string;
    goals?: string;
  };
  occupation?: string;
  location?: string;
  socialClass?: {
    level?: number;
    wealth?: number;
  };
  // Permission fields (used by /characters/permissions page)
  isGestore?: boolean;
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];
}

export interface ApproveCharacterData {
  notes?: string;
}

export interface RejectCharacterData {
  note: string;
}
