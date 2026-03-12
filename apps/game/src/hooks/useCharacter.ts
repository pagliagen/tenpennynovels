/**
 * useCharacter Hooks
 *
 * TanStack Query hooks for character operations.
 * Handles server state with automatic caching, loading states, and error handling.
 *
 * **Hooks**:
 * - useCharacter(id) - Get character by ID
 * - useCreateCharacter() - Create new character
 * - useUpdateCharacter(id) - Update existing character
 * - useSubmitForApproval(id) - Submit character for approval
 * - useDeleteCharacter() - Delete character
 * - useCharactersList() - List user's characters
 * - useCreationConfig() - Get character creation config
 * - useOccupations() - Get occupations list
 * - useSkills() - Get skills list
 *
 * @module hooks/useCharacter
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { characterApi } from '@/lib/api/character';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/router';
import type { Character } from '@/types/api/schemas';
import type { CharacterCreatePayload } from '@/types/wizard';

/**
 * Query Keys
 *
 * Centralized query keys for cache invalidation.
 */
export const characterQueryKeys = {
  all: ['characters'] as const,
  lists: () => [...characterQueryKeys.all, 'list'] as const,
  list: (filters?: { status?: string }) => [...characterQueryKeys.lists(), filters] as const,
  details: () => [...characterQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...characterQueryKeys.details(), id] as const,
  wizard: (id: string) => [...characterQueryKeys.all, 'wizard', id] as const,
  config: () => [...characterQueryKeys.all, 'config'] as const,
  occupations: () => [...characterQueryKeys.all, 'occupations'] as const,
  skills: () => [...characterQueryKeys.all, 'skills'] as const,
};

/**
 * useCharacter Hook
 *
 * Fetches a single character by ID.
 * Automatically caches and refetches on stale data.
 *
 * @param {string} characterId - Character ID
 * @param {Object} [options] - Query options
 * @param {boolean} [options.enabled=true] - Enable/disable query
 * @returns {UseQueryResult<Character>} Query result
 *
 * @example
 * ```tsx
 * const { data: character, isLoading, error } = useCharacter('abc123');
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * return <div>{character.name}</div>;
 * ```
 */
export function useCharacter(
  characterId: string,
  options?: { enabled?: boolean }
): UseQueryResult<Character, Error> {
  return useQuery({
    queryKey: characterQueryKeys.detail(characterId),
    queryFn: () => characterApi.getById(characterId),
    enabled: options?.enabled !== false && !!characterId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
  });
}

/**
 * useCharacterForWizard Hook
 *
 * Fetches character data for the wizard (draft editing). Uses GET /characters/:id/wizard
 * which requires game:character:wizard. Use this instead of useCharacter when loading
 * an existing draft into the wizard.
 *
 * Always fetches fresh data on mount to handle rejected→draft scenarios
 * where the DB data may have changed since the last wizard session.
 */
export function useCharacterForWizard(
  characterId: string,
  options?: { enabled?: boolean }
): UseQueryResult<Character, Error> {
  return useQuery({
    queryKey: characterQueryKeys.wizard(characterId),
    queryFn: () => characterApi.getForWizard(characterId),
    enabled: options?.enabled !== false && !!characterId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
}

/**
 * useCreateCharacter Hook
 *
 * Creates a new character with status DRAFT.
 *
 * **Side Effects**:
 * - Updates authStore with new character
 * - Redirects to wizard if DRAFT
 * - Invalidates characters list cache
 *
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const createCharacter = useCreateCharacter();
 *
 * const handleSubmit = async (data: CharacterCreatePayload) => {
 *   try {
 *     const character = await createCharacter.mutateAsync(data);
 *     console.log(`Created: ${character.name}`);
 *   } catch (error) {
 *     console.error('Creation failed:', error);
 *   }
 * };
 * ```
 */
export function useCreateCharacter(): UseMutationResult<
  Character,
  Error,
  CharacterCreatePayload
> {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setSelectedCharacter } = useAuthStore();

  return useMutation({
    mutationFn: (data: CharacterCreatePayload) => characterApi.create(data),
    onSuccess: (character) => {
      // Invalidate characters list
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.lists() });

      // Update auth store with new character
      setSelectedCharacter(character);

      // If DRAFT (not completed), redirect to wizard
      if (character.status === 'DRAFT') {
        router.push('/character/wizard');
      }

      console.log(`✅ [useCreateCharacter] Created character: ${character.name} (${character._id})`);
    },
    onError: (error) => {
      console.error('❌ [useCreateCharacter] Failed to create character:', error);
    },
  });
}

/**
 * useUpdateCharacter Hook
 *
 * Updates an existing character.
 * Only DRAFT or APPROVED characters can be edited.
 *
 * **Side Effects**:
 * - Invalidates character detail cache
 * - Invalidates characters list cache
 * - Updates authStore if selectedCharacter
 *
 * @param {string} characterId - Character ID to update
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const updateCharacter = useUpdateCharacter('abc123');
 *
 * const handleSave = async () => {
 *   await updateCharacter.mutateAsync({
 *     age: 36,
 *     height: "5'11\""
 *   });
 * };
 * ```
 */
export function useUpdateCharacter(characterId: string): UseMutationResult<
  Character,
  Error,
  Partial<CharacterCreatePayload>
> {
  const queryClient = useQueryClient();
  const { selectedCharacter, setSelectedCharacter } = useAuthStore();

  return useMutation({
    mutationFn: (data: Partial<CharacterCreatePayload>) =>
      characterApi.update(characterId, data),
    onSuccess: (character) => {
      // Invalidate character detail cache
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.detail(characterId) });

      // Invalidate characters list cache
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.lists() });

      // Merge (not replace!) updated fields into selectedCharacter to preserve
      // critical fields like playerStatus, gamePermissions, gameplayRoles that
      // the update API response does not return.
      if (selectedCharacter?._id === characterId) {
        setSelectedCharacter({ ...selectedCharacter, ...character });
      }

      console.log(`✅ [useUpdateCharacter] Updated character: ${character.name} (${character._id})`);
    },
    onError: (error) => {
      console.error('❌ [useUpdateCharacter] Failed to update character:', error);
    },
  });
}

/**
 * useSubmitForApproval Hook
 *
 * Submits character for staff approval.
 * Transitions status: DRAFT → PENDING_APPROVAL.
 *
 * **Post-Submission**: Character becomes read-only until staff approves/rejects.
 *
 * **Side Effects**:
 * - Invalidates character detail cache
 * - Shows success modal (handled in component)
 * - Updates authStore
 *
 * @param {string} characterId - Character ID to submit
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const submitForApproval = useSubmitForApproval('abc123');
 *
 * const handleSubmit = async () => {
 *   try {
 *     await submitForApproval.mutateAsync();
 *     // Show success modal: "Richiesta inviata allo staff"
 *   } catch (error) {
 *     // Show error: validation failed
 *   }
 * };
 * ```
 */
export function useSubmitForApproval(characterId: string): UseMutationResult<
  Character,
  Error,
  void
> {
  const queryClient = useQueryClient();
  const { selectedCharacter, setSelectedCharacter } = useAuthStore();

  return useMutation({
    mutationFn: () => characterApi.submitForApproval(characterId),
    onSuccess: (character) => {
      // Invalidate character detail cache
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.detail(characterId) });

      // Invalidate characters list cache
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.lists() });

      // Update auth store if this is the selected character
      if (selectedCharacter?._id === characterId) {
        setSelectedCharacter(character);
      }

      console.log(`✅ [useSubmitForApproval] Character submitted: ${character.name} → PENDING_APPROVAL`);
    },
    onError: (error) => {
      console.error('❌ [useSubmitForApproval] Submission failed:', error);
    },
  });
}

/**
 * useDeleteCharacter Hook
 *
 * Soft-deletes a character (sets status to DELETED).
 *
 * **Side Effects**:
 * - Invalidates characters list cache
 * - Redirects to character list
 * - Shows success message
 *
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const deleteCharacter = useDeleteCharacter();
 *
 * const handleDelete = async (characterId: string) => {
 *   if (confirm('Are you sure?')) {
 *     await deleteCharacter.mutateAsync(characterId);
 *   }
 * };
 * ```
 */
export function useDeleteCharacter(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (characterId: string) => characterApi.delete(characterId),
    onSuccess: (_, characterId) => {
      // Invalidate characters list cache
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.lists() });

      // Remove character detail from cache
      queryClient.removeQueries({ queryKey: characterQueryKeys.detail(characterId) });

      // Redirect to character list
      router.push('/characters');

      console.log(`✅ [useDeleteCharacter] Character deleted: ${characterId}`);
    },
    onError: (error) => {
      console.error('❌ [useDeleteCharacter] Failed to delete character:', error);
    },
  });
}

/**
 * useCharactersList Hook
 *
 * Fetches list of user's characters.
 * Includes all statuses (DRAFT, PENDING_APPROVAL, APPROVED, DELETED).
 *
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @returns {UseQueryResult} Query result with characters array
 *
 * @example
 * ```tsx
 * // Get all characters
 * const { data, isLoading } = useCharactersList();
 *
 * // Get only APPROVED characters
 * const { data: approved } = useCharactersList({ status: 'APPROVED' });
 * ```
 */
export function useCharactersList(options?: { status?: string }): UseQueryResult<
  { characters: Character[]; total: number },
  Error
> {
  return useQuery({
    queryKey: characterQueryKeys.list(options),
    queryFn: () => characterApi.list(options),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useCreationConfig Hook
 *
 * Fetches character creation rules from backend.
 * Includes: stats budget (400), skills formula (200+INT/2), occupation config, formulas.
 *
 * **Cached**: Config is static, cached for 1 hour.
 *
 * @returns {UseQueryResult} Query result with config
 *
 * @example
 * ```tsx
 * const { data: config, isLoading } = useCreationConfig();
 *
 * if (!isLoading) {
 *   console.log(`Stats budget: ${config.stats.totalPoints}`); // 400
 * }
 * ```
 */
export function useCreationConfig(): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: characterQueryKeys.config(),
    queryFn: () => characterApi.getCreationConfig(),
    staleTime: 60 * 60 * 1000, // 1 hour (config is static)
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}

/**
 * useOccupations Hook
 *
 * Fetches available occupations for character creation.
 * Each occupation has required skills (6) and bonus skills (1).
 *
 * **Cached**: Occupations are static, cached for 1 hour.
 *
 * @returns {UseQueryResult} Query result with occupations array
 *
 * @example
 * ```tsx
 * const { data: occupations, isLoading } = useOccupations();
 *
 * const detective = occupations?.find(o => o.name === 'Detective');
 * ```
 */
export function useOccupations(): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: characterQueryKeys.occupations(),
    queryFn: () => characterApi.getOccupations(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}

/**
 * useSkills Hook
 *
 * Fetches all available skills with base values and categories.
 * Used for wizard Step 4 skill allocation.
 *
 * **Cached**: Skills are static, cached for 1 hour.
 *
 * @returns {UseQueryResult} Query result with skills array
 *
 * @example
 * ```tsx
 * const { data: skills, isLoading } = useSkills();
 *
 * const accounting = skills?.find(s => s.name === 'Accounting');
 * console.log(`${accounting.name}: ${accounting.base}%`); // Accounting: 15%
 * ```
 */
export function useSkills(): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: characterQueryKeys.skills(),
    queryFn: () => characterApi.getSkills(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}
