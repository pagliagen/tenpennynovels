/**
 * Character Sheet Data Hook
 *
 * React Query hook for fetching character sheet data with permissions.
 * Provides loading/error states and automatic caching.
 *
 * @module hooks/useCharacterSheetData
 * @since 2.0.0
 */

'use client';

import { useQuery, UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Character sheet permissions
 * Calculated backend-side based on viewer role
 */
export interface CharacterSheetEditPermissions {
  informazioni: boolean;
  background: boolean;
  statistiche: boolean;
  abilita: boolean;
  diario: boolean;
  noteMaster: boolean;
  inventario: boolean;
}

export interface CharacterSheetPermissions {
  /** Is viewer the character owner */
  isOwner: boolean;

  /** Is viewer a master/gestore */
  isMaster: boolean;

  /** Can view private background fields */
  canViewPrivateBackground: boolean;

  /** Can view review history (Note Master tab) */
  canViewReviewHistory: boolean;

  /** Can view full inventory (not just visible items) */
  canViewFullInventory: boolean;

  /** Can view skill breakdown (base, manual, bonuses) */
  canViewSkillBreakdown: boolean;

  /** @deprecated usa editPermissions.informazioni — mantenuto per compatibilità */
  canEdit: boolean;

  /** Permessi di modifica granulari, uno per tab della scheda */
  editPermissions: CharacterSheetEditPermissions;

  /** Il viewer è master: ha sempre accesso in scrittura alle sezioni gestibili da master */
  masterOverride: boolean;
}

/**
 * Character sheet API response
 */
export interface CharacterSheetData {
  character: {
    _id: string;
    name: string;
    /** Nome di finzione (RP) — editabile solo nel wizard, visibile in scheda (Character.ts) */
    firstName?: string;
    /** Cognome — opzionale, visibile a tutti (Character.ts) */
    surname?: string;
    characterType: 'pg_principale' | 'pg_master' | 'png';
    avatar?: string;
    profileImage?: string;
    /** Link musica del personaggio: riprodotto quando la sua scheda è la finestra attiva */
    audioTheme?: string;
    /** Età apparente — pubblica. L'età reale (privata, master-only) è in privateInfo.age */
    apparentAge?: number;
    gender?: string;
    occupation?: {
      _id: string;
      name: string;
      description?: string;
    };
    /** Occupazione attuale, campo libero distinto dal riferimento a Occupation (Character.ts) */
    currentOccupation?: string;
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    playerStatus?: 'draft' | 'pending' | 'approved'; // Backend returns this field

    // Anagrafica pubblica (Character.ts: "visibile a tutti")
    publicBackground?: string;
    physicalDescription?: string;
    visibleMarks?: string;
    height?: string;
    weight?: string;
    eyeColor?: string;
    hairColor?: string;

    // Present only when the viewer is the owner or a master (stripped server-side otherwise)
    hiddenMarks?: string;
    currentHP?: number;
    maxHP?: number;
    /** Età reale — privata, master-only (Character.ts) */
    age?: number;
    birthDate?: string;
    birthPlace?: string;
    maritalStatus?: string;
    educationTitle?: string;
    criminalRecord?: string;
    pathologies?: string;
    privateDescription?: string;

    // Private fields (visible only to owner/game masters)
    privateBackground?: string;
    motivations?: string;
    fears?: string;
    traumas?: string;
    beliefSystem?: string;
    bonds?: string;
    secrets?: string;

    // Statistiche base CoC (Character.ts: stats)
    stats?: {
      appearance?: number;
      constitution?: number;
      dexterity?: number;
      education?: number;
      intelligence?: number;
      power?: number;
      size?: number;
      strength?: number;
    };

    // Statistiche derivate, calcolate automaticamente (Character.ts: derived — oggetto
    // separato da stats, non annidato dentro: leggere da qui, non da stats.hp/sanity/...)
    derived?: {
      ideaRoll?: number;
      luckRoll?: number;
      knowledge?: number;
      hitPoints?: number;
      sanity?: number;
      maxSanity?: number;
      magicPoints?: number;
      movementRate?: number;
      bonusDamage?: string;
      build?: number;
    };

    // Skills (Map serialized as object)
    skills?: Record<string, {
      name: string;
      base: number;
      total: number;
      manualPoints?: number;
      occupationBonus?: number;
      interestBonus?: number;
      lockedForPlayer?: boolean;
    }>;

    // Equipment
    equipment?: Array<{
      _id: string;
      name: string;
      description?: string;
      quantity: number;
      visible: boolean;
    }>;

    // Memberships
    memberships?: Array<{
      _id: string;
      corporationId: string;
      corporationName: string;
      role: string;
      permissions: string[];
    }>;

    // Housing
    housing?: {
      _id: string;
      locationId: string;
      locationName: string;
      roomType: string;
      rentPerMonth: number;
    };

    // Review history (audit trail del workflow di approvazione — campi reali del backend,
    // vedi Character.ts: NON author/authorRole/date/notes, che non esistono nello schema)
    reviewHistory?: Array<{
      reviewedAt: string;
      action: 'approve' | 'reject' | 'request_changes' | 'draft';
      note?: string;
    }>;

    // Bot
    isBot?: boolean;
    bot_id?: string;

    // Metadata
    createdAt: string;
    lastActive?: string;
    personalityTraits?: string[];
  };

  permissions: CharacterSheetPermissions;

  /** Skill IDs visible to this viewer */
  visibleSkills: string[];

  /** Equipment IDs visible to this viewer */
  visibleEquipment: string[];
}

/**
 * Fetch character sheet data from API
 */
async function fetchCharacterSheet(characterId: string): Promise<CharacterSheetData> {
  const response = await apiClient.get(`/game/characters/${characterId}?view=sheet`);
  return response.data.data;
}

/**
 * Character Sheet Data Hook
 *
 * @param characterId - Character ID to fetch
 * @returns Query result with character data, permissions, loading/error states
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, error } = useCharacterSheetData(characterId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <ErrorMessage error={error} />;
 *
 * const { character, permissions } = data;
 * // Render character data with permission checks
 * ```
 */
export function useCharacterSheetData(
  characterId: string
): UseQueryResult<CharacterSheetData, Error> {
  return useQuery({
    queryKey: ['character-sheet', characterId],
    queryFn: () => fetchCharacterSheet(characterId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    enabled: !!characterId, // Only fetch if characterId exists
  });
}
