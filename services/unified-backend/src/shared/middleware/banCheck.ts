import { Request, Response, NextFunction } from 'express';
import { Character } from '@database/models/Character';
import { User } from '@database/models/User';
import { logger } from '@shared/utils/logger';
import {
  blocksChatWrite as charBlocksChat,
  blocksForumWrite as charBlocksForum,
  blocksLandAccess as charBlocksLand,
  isCharacterBanActive,
  legacyUserBlocksChat,
  legacyUserBlocksForum,
  legacyUserBlocksGame,
  type CharacterBanFields,
  type LegacyUserBanFields,
} from '@shared/utils/characterBan';

export interface BanCheckOptions {
  requiredScope: 'chat_banned' | 'game_banned' | 'forum_banned' | 'documents_banned' | 'full_site_banned';
  message?: string;
}

type LeanChar = CharacterBanFields & { userId: { toString(): string } };
type LeanUser = LegacyUserBanFields;

async function loadBanContext(characterId: string): Promise<{
  character: LeanChar | null;
  user: LeanUser | null;
}> {
  const character = await Character.findById(characterId)
    .select('userId isBanned banScope banReason bannedAt bannedUntil')
    .lean();
  if (!character) {
    return { character: null, user: null };
  }
  const user = await User.findById(character.userId)
    .select('isBanned banScope banReason bannedAt bannedUntil')
    .lean();
  return {
    character: character as unknown as LeanChar,
    user: user as unknown as LeanUser,
  };
}

function isBlockedForScope(
  scope: BanCheckOptions['requiredScope'],
  character: LeanChar | null,
  user: LeanUser | null
): boolean {
  if (scope === 'documents_banned' || scope === 'full_site_banned') {
    if (isCharacterBanActive(character)) {
      return character!.banScope === 'full';
    }
    return legacyUserBlocksGame(user) && legacyUserBlocksChat(user) && legacyUserBlocksForum(user);
  }
  if (scope === 'game_banned') {
    if (isCharacterBanActive(character) && charBlocksLand(character)) return true;
    return legacyUserBlocksGame(user);
  }
  if (scope === 'chat_banned') {
    if (isCharacterBanActive(character) && charBlocksChat(character)) return true;
    return legacyUserBlocksChat(user);
  }
  if (scope === 'forum_banned') {
    if (isCharacterBanActive(character) && charBlocksForum(character)) return true;
    return legacyUserBlocksForum(user);
  }
  return false;
}

function buildBanInfo(character: LeanChar | null, user: LeanUser | null) {
  const charActive = isCharacterBanActive(character);
  if (charActive) {
    return {
      reason: character!.banReason,
      bannedUntil: character!.bannedUntil,
      bannedAt: character!.bannedAt,
      scopes: [character!.banScope],
      source: 'character' as const,
    };
  }
  if (user?.isBanned) {
    return {
      reason: user.banReason,
      bannedUntil: user.bannedUntil,
      bannedAt: user.bannedAt,
      scopes: user.banScope ? [user.banScope] : ['full'],
      source: 'user' as const,
    };
  }
  return null;
}

/**
 * Middleware: verifica ban sul **personaggio** corrente (e fallback ban legacy sullo User).
 */
export function banCheck(options: BanCheckOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const characterId = req.character?.characterId;

      if (!characterId) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione personaggio richiesta',
          code: 'CHARACTER_AUTH_REQUIRED',
        });
      }

      const { character, user } = await loadBanContext(characterId);

      if (!character) {
        return res.status(404).json({
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
        });
      }

      if (!isBlockedForScope(options.requiredScope, character, user)) {
        return next();
      }

      if (options.requiredScope === 'full_site_banned' || options.requiredScope === 'documents_banned') {
        return res.status(403).json({
          success: false,
          error:
            options.requiredScope === 'documents_banned'
              ? 'Non puoi accedere ai documenti. Restrizione attiva sul personaggio.'
              : 'Accesso negato: restrizione attiva sul personaggio.',
          code:
            options.requiredScope === 'documents_banned'
              ? 'DOCUMENTS_BAN_ACTIVE'
              : 'FULL_RESTRICTION_ACTIVE',
          banInfo: buildBanInfo(character, user),
        });
      }

      const scopeMessages: Record<string, string> = {
        chat_banned: 'Non puoi inviare messaggi in chat. Restrizione attiva sul personaggio.',
        game_banned: 'Non puoi accedere al gameplay con questo personaggio.',
        forum_banned: 'Non puoi scrivere nel forum con questo personaggio.',
        documents_banned: 'Non puoi accedere ai documenti. Sei stato bannato dai documenti.',
        full_site_banned: 'Accesso negato.',
      };

      return res.status(403).json({
        success: false,
        error: options.message || scopeMessages[options.requiredScope],
        code: `${options.requiredScope.toUpperCase()}_ACTIVE`,
        banInfo: {
          ...buildBanInfo(character, user),
          specificScope: options.requiredScope,
        },
      });
    } catch (error) {
      logger.error('Ban check middleware error:', error);

      return res.status(500).json({
        success: false,
        error: 'Errore interno del server durante il controllo ban',
        code: 'BAN_CHECK_ERROR',
      });
    }
  };
}

export const banChecks = {
  chat: () => banCheck({ requiredScope: 'chat_banned' }),
  game: () => banCheck({ requiredScope: 'game_banned' }),
  forum: () => banCheck({ requiredScope: 'forum_banned' }),
  documents: () => banCheck({ requiredScope: 'documents_banned' }),
  fullSite: () => banCheck({ requiredScope: 'full_site_banned' }),
};

export function banCheckMultiple(scopes: BanCheckOptions['requiredScope'][]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const characterId = req.character?.characterId;

      if (!characterId) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione personaggio richiesta',
          code: 'CHARACTER_AUTH_REQUIRED',
        });
      }

      const { character, user } = await loadBanContext(characterId);

      if (!character) {
        return res.status(404).json({
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
        });
      }

      const conflicting = scopes.filter((s) => isBlockedForScope(s, character, user));

      if (conflicting.length === 0) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Non hai i permessi per eseguire questa azione a causa di restrizioni attive.',
        code: 'MULTIPLE_BANS_ACTIVE',
        banInfo: {
          ...buildBanInfo(character, user),
          conflictingScopes: conflicting,
        },
      });
    } catch (error) {
      logger.error('Multiple ban check middleware error:', error);

      return res.status(500).json({
        success: false,
        error: 'Errore interno del server durante il controllo ban',
        code: 'BAN_CHECK_ERROR',
      });
    }
  };
}
