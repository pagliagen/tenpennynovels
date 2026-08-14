/**
 * useCharacterReview
 *
 * Mutation per confermare (acknowledge) un esito di approvazione/rifiuto
 * personaggio mostrato tramite CharacterReviewOutcomeModal.
 *
 * @module hooks/useCharacterReview
 */

import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

interface AcknowledgeReviewParams {
  characterId: string;
  reviewId: string;
}

export function useAcknowledgeReview() {
  return useMutation({
    mutationFn: async ({ characterId, reviewId }: AcknowledgeReviewParams) => {
      return await api.put<{ reviewId: string; acknowledged: boolean }>(
        `/game/characters/${characterId}/review/${reviewId}/ack`
      );
    }
  });
}
