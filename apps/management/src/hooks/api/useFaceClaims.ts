/**
 * Face Claims Hooks
 *
 * TanStack Query hooks for face claims management.
 *
 * @module hooks/api/useFaceClaims
 * @since 2.0.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDuplicateFaceClaims,
  approveFaceClaim,
  rejectFaceClaim,
  type DuplicateFaceClaimsResponse,
  type ApproveFaceClaimRequest,
  type RejectFaceClaimRequest
} from '@/lib/api/faceClaims';
import { toast } from 'react-toastify';

/**
 * Query Keys
 */
export const faceClaimsQueryKeys = {
  all: ['face-claims'] as const,
  duplicates: ['face-claims', 'duplicates'] as const,
};

/**
 * useDuplicateFaceClaims Hook
 *
 * Fetches all face claims with duplicates (2+ characters).
 *
 * @returns {UseQueryResult<DuplicateFaceClaimsResponse>} Query result
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDuplicateFaceClaims();
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage />;
 *
 * return (
 *   <div>
 *     {data.faceClaimGroups.map(group => (
 *       <div key={group.prestavolto}>
 *         {group.prestavolto}: {group.duplicateCount} characters
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useDuplicateFaceClaims() {
  return useQuery<DuplicateFaceClaimsResponse>({
    queryKey: faceClaimsQueryKeys.duplicates,
    queryFn: getDuplicateFaceClaims,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useApproveFaceClaim Hook
 *
 * Mutation for approving a face claim (allows duplicate).
 *
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const { mutate: approve, isPending } = useApproveFaceClaim();
 *
 * const handleApprove = (characterId: string) => {
 *   approve(
 *     { characterId, notes: 'Twin characters approved' },
 *     {
 *       onSuccess: () => {
 *         console.log('Face claim approved!');
 *       }
 *     }
 *   );
 * };
 * ```
 */
export function useApproveFaceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ApproveFaceClaimRequest) => approveFaceClaim(request),
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: faceClaimsQueryKeys.duplicates });
      queryClient.invalidateQueries({ queryKey: ['characters'] }); // Refresh character lists

      toast.success('Prestavolto approvato con successo');
    },
    onError: (error: Error) => {
      console.error('Error approving face claim:', error);
      toast.error(`Errore nell'approvazione: ${error.message}`);
    },
  });
}

/**
 * useRejectFaceClaim Hook
 *
 * Mutation for rejecting a face claim (clears prestavolto field).
 *
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const { mutate: reject, isPending } = useRejectFaceClaim();
 *
 * const handleReject = (characterId: string) => {
 *   reject(
 *     { characterId, reason: 'Face claim already in use' },
 *     {
 *       onSuccess: () => {
 *         console.log('Face claim rejected!');
 *       }
 *     }
 *   );
 * };
 * ```
 */
export function useRejectFaceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: RejectFaceClaimRequest) => rejectFaceClaim(request),
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: faceClaimsQueryKeys.duplicates });
      queryClient.invalidateQueries({ queryKey: ['characters'] }); // Refresh character lists

      toast.success('Prestavolto rifiutato. Il personaggio dovrà scegliere un altro prestavolto.');
    },
    onError: (error: Error) => {
      console.error('Error rejecting face claim:', error);
      toast.error(`Errore nel rifiuto: ${error.message}`);
    },
  });
}

/**
 * useBulkApproveFaceClaims Hook
 *
 * Mutation for approving multiple face claims at once.
 * Uses Promise.allSettled to handle partial failures.
 *
 * @returns {UseMutationResult} Mutation result
 *
 * @example
 * ```tsx
 * const { mutate: bulkApprove, isPending } = useBulkApproveFaceClaims();
 *
 * const handleApproveAll = (characterIds: string[]) => {
 *   bulkApprove(characterIds);
 * };
 * ```
 */
export function useBulkApproveFaceClaims() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterIds: string[]) => {
      const results = await Promise.allSettled(
        characterIds.map((id) => approveFaceClaim({ characterId: id }))
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`${failures.length} approvazioni fallite`);
      }

      return results;
    },
    onSuccess: (_, characterIds) => {
      queryClient.invalidateQueries({ queryKey: faceClaimsQueryKeys.duplicates });
      queryClient.invalidateQueries({ queryKey: ['characters'] });

      toast.success(`${characterIds.length} prestavolti approvati con successo`);
    },
    onError: (error: Error) => {
      console.error('Error bulk approving face claims:', error);
      toast.error(`Errore nell'approvazione multipla: ${error.message}`);
    },
  });
}
