/**
 * Face Claims API Client
 *
 * API client for face claims management (prestavolti).
 * Handles duplicate detection, approval, and rejection.
 *
 * @module lib/api/faceClaims
 * @since 2.0.0
 */

import { apiClient, withRetry } from './client';
import type { ApiResponse } from '@/types/api/common';

/**
 * Face Claim Character Entry
 */
export interface FaceClaimCharacter {
  _id: string;
  name: string;
  surname: string;
  avatar?: string;
  playerStatus: string;
  prestavoltoStatus?: 'approved' | 'pending_duplicate' | null;
  userId: string;
  createdAt: string;
}

/**
 * Face Claim Group (characters sharing same face claim)
 */
export interface FaceClaimGroup {
  prestavolto: string;
  characters: FaceClaimCharacter[];
  duplicateCount: number;
  hasApproved: boolean;
  hasPending: boolean;
}

/**
 * Get Duplicate Face Claims Response
 */
export interface DuplicateFaceClaimsResponse {
  faceClaimGroups: FaceClaimGroup[];
  totalGroups: number;
}

/**
 * Approve Face Claim Request
 */
export interface ApproveFaceClaimRequest {
  characterId: string;
  notes?: string;
}

/**
 * Reject Face Claim Request
 */
export interface RejectFaceClaimRequest {
  characterId: string;
  reason?: string;
}

/**
 * Get Duplicate Face Claims
 *
 * Fetches all face claims with duplicates (2+ characters using same face claim).
 * Groups characters by face claim name.
 *
 * @returns {Promise<DuplicateFaceClaimsResponse>} Face claim groups
 *
 * @example
 * ```typescript
 * const response = await getDuplicateFaceClaims();
 * console.log(`${response.totalGroups} face claims have duplicates`);
 * ```
 */
export async function getDuplicateFaceClaims(): Promise<DuplicateFaceClaimsResponse> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<DuplicateFaceClaimsResponse>>(
      '/admin/characters/face-claims/duplicates'
    )
  );
  if (!response.data.success || !response.data.data) {
    throw new Error('Errore nel recupero duplicati face claims');
  }
  return response.data.data;
}

/**
 * Approve Face Claim
 *
 * Approves a character's face claim (allows duplicate).
 * Sets `prestavoltoStatus = 'approved'`.
 *
 * **Use Case**: Twin characters, intentional duplicate VIPs.
 *
 * @param {ApproveFaceClaimRequest} request - Approval request
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await approveFaceClaim({
 *   characterId: 'abc123',
 *   notes: 'Approved: twin characters'
 * });
 * ```
 */
export async function approveFaceClaim(request: ApproveFaceClaimRequest): Promise<void> {
  await apiClient.post(`/admin/characters/${request.characterId}/approve-faceclaim`, {
    notes: request.notes
  });
}

/**
 * Reject Face Claim
 *
 * Rejects a character's face claim (clears prestavolto field).
 * Sets `prestavolto = null`, `prestavoltoStatus = null`.
 *
 * **Use Case**: User must choose different face claim.
 *
 * @param {RejectFaceClaimRequest} request - Rejection request
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await rejectFaceClaim({
 *   characterId: 'abc123',
 *   reason: 'Face claim already in use, not twins'
 * });
 * ```
 */
export async function rejectFaceClaim(request: RejectFaceClaimRequest): Promise<void> {
  await apiClient.post(`/admin/characters/${request.characterId}/reject-faceclaim`, {
    reason: request.reason
  });
}
