import type { Character } from '@/types/api/schemas';

/** Allineato a `CharacterBanPublicPayload` backend (scope legacy può includere game_only). */
export interface CharacterBanSessionPayload {
  active: boolean;
  scope: 'full' | 'chat_only' | 'forum_only' | 'game_only' | null;
  reason: string | null;
  bannedUntil: string | null;
  bannedAt: string | null;
  blocksLandAccess: boolean;
  blocksChatWrite: boolean;
  blocksForumWrite: boolean;
}

/**
 * Corpo risposta GET /auth/session (sottoinsieme usato per refresh client-side).
 */
export interface AuthSessionApiResponse {
  success: boolean;
  data?: {
    valid: boolean;
    user?: {
      id: string;
      username: string;
      canAccessAdminPanel: boolean;
    };
    character?: Character | null;
    gamePermissions?: string[];
    ban?: CharacterBanSessionPayload | null;
  };
}
