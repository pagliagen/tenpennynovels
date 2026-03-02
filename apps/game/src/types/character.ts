/**
 * Character Domain Types
 *
 * Backend character status values (different from API status values).
 *
 * @module types/character
 * @since 2.0.0
 */

/**
 * Character Status (Backend Domain Model)
 *
 * Status workflow:
 * - DRAFT: Character being created
 * - PENDING_APPROVAL: Submitted for approval
 * - APPROVED: Approved and active
 * - DELETED: Soft-deleted
 */
export type CharacterStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
