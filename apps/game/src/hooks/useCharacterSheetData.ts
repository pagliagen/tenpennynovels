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
export interface CharacterSheetPermissions {
  /** Is viewer the character owner */
  isOwner: boolean;

  /** Can view private background fields */
  canViewPrivateBackground: boolean;

  /** Can view review history (Note Master tab) */
  canViewReviewHistory: boolean;

  /** Can view full inventory (not just visible items) */
  canViewFullInventory: boolean;

  /** Can view skill breakdown (base, manual, bonuses) */
  canViewSkillBreakdown: boolean;

  /** Can edit character (owner + DRAFT status) */
  canEdit: boolean;
}

/**
 * Character sheet API response
 */
export interface CharacterSheetData {
  character: {
    _id: string;
    name: string;
    characterType: 'pg_principale' | 'pg_master' | 'png';
    avatar?: string;
    profileImage?: string;
    age?: number;
    gender?: string;
    occupation?: {
      _id: string;
      name: string;
      description?: string;
    };
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    playerStatus?: 'draft' | 'pending' | 'approved'; // Backend returns this field

    // Public fields
    publicBackground?: string;
    physicalDescription?: string;

    // Private fields (visible only to owner/game masters)
    privateBackground?: string;
    motivations?: string;
    fears?: string;
    traumas?: string;
    beliefSystem?: string;
    bonds?: string;
    secrets?: string;

    // Stats
    stats?: {
      charm?: number;
      constitution?: number;
      dexterity?: number;
      education?: number;
      intelligence?: number;
      power?: number;
      size?: number;
      strength?: number;
      // Derived stats
      damageBonus?: string;
      build?: number;
      luck?: number;
      idea?: number;
      knowledge?: number;
      mp?: number;
      sanity?: number;
      hp?: number;
    };

    // Skills (Map serialized as object)
    skills?: Record<string, {
      name: string;
      base: number;
      total: number;
      manualPoints?: number;
      occupationBonus?: number;
      interestBonus?: number;
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

    // Review history
    reviewHistory?: Array<{
      date: string;
      author: string;
      authorRole: string;
      notes: string;
    }>;

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
