import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Character } from '@database/models';
import { User } from '@core/auth/models/User';
import { redis } from '@config/runtime/redis';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { errorResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';
import { EmailService } from '@core/auth/services/EmailService';
import type { CharacterBanScope } from '@shared/utils/characterBan';

export class CharacterBanController {
  /**
   * POST /admin/characters/:characterId/ban
   */
  static async banCharacter(
    req: Request<{ characterId: string }, unknown, {
      reason: string;
      duration: 'temporary' | 'permanent';
      bannedUntil?: string;
      banScope: CharacterBanScope;
    }>,
    res: Response
  ): Promise<void> {
    try {
      const { characterId } = req.params;
      const banData = req.body;

      if (!Types.ObjectId.isValid(characterId)) {
        res.status(400).json(
          errorResponse('ID personaggio non valido', 'INVALID_CHARACTER_ID', undefined, 400, getRequestId(req))
        );
        return;
      }

      if (!banData.reason?.trim()) {
        res.status(400).json(
          errorResponse('Il motivo del ban è obbligatorio', 'BAN_REASON_REQUIRED', undefined, 400, getRequestId(req))
        );
        return;
      }

      if (!banData.duration || !['temporary', 'permanent'].includes(banData.duration)) {
        res.status(400).json(
          errorResponse('Durata non valida', 'INVALID_BAN_DURATION', undefined, 400, getRequestId(req))
        );
        return;
      }

      if (banData.duration === 'temporary' && !banData.bannedUntil) {
        res.status(400).json(
          errorResponse('Data fine richiesta per ban temporaneo', 'BAN_END_DATE_REQUIRED', undefined, 400, getRequestId(req))
        );
        return;
      }

      const scopes: CharacterBanScope[] = ['full', 'chat_only', 'forum_only'];
      if (!banData.banScope || !scopes.includes(banData.banScope)) {
        res.status(400).json(
          errorResponse('banScope non valido', 'INVALID_BAN_SCOPE', { allowed: scopes }, 400, getRequestId(req))
        );
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(
          errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req))
        );
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(
          errorResponse('Sessione admin non valida per audit', 'ADMIN_AUDIT_REQUIRED', undefined, 401, getRequestId(req))
        );
        return;
      }

      character.isBanned = true;
      character.banScope = banData.banScope;
      character.banReason = banData.reason.trim();
      character.bannedAt = new Date();
      character.bannedBy = new Types.ObjectId(auditInfo.adminId);
      character.bannedByName = auditInfo.adminUsername;
      character.bannedUntil =
        banData.duration === 'temporary' && banData.bannedUntil
          ? new Date(banData.bannedUntil)
          : null;

      await character.save();

      const owner = await User.findById(character.userId).select('email username displayName').lean();
      const displayName = owner?.displayName || owner?.username || 'giocatore';
      const characterLabel = character.surname
        ? `${character.name} ${character.surname}`
        : character.name;

      if (banData.banScope === 'full' && owner?.email) {
        try {
          await EmailService.sendCharacterFullBanNotice({
            email: owner.email,
            displayName,
            characterName: characterLabel,
            reason: character.banReason || '',
            bannedUntilIso: character.bannedUntil ? character.bannedUntil.toISOString() : null,
          });
        } catch (emailErr) {
          logger.error('Character ban: email non inviata', {
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
            characterId,
          });
        }
      }

      await redis.publish(
        'user:events',
        JSON.stringify({
          type: 'character_ban_updated',
          userId: character.userId.toString(),
          characterId: character._id.toString(),
          banScope: banData.banScope,
          active: true,
          timestamp: new Date().toISOString(),
        })
      );

      logger.warn('Character banned by admin', {
        ...auditInfo,
        targetCharacterId: characterId,
        banScope: banData.banScope,
      });

      res.json(
        updateResponse(
          {
            characterId: character._id.toString(),
            isBanned: true,
            banScope: character.banScope,
            bannedUntil: character.bannedUntil,
          },
          'Ban personaggio applicato',
          getRequestId(req)
        )
      );
    } catch (error: unknown) {
      logger.error('CharacterBanController.banCharacter', {
        error: error instanceof Error ? error.message : String(error),
        characterId: req.params.characterId,
      });
      res.status(500).json(
        errorResponse('Errore durante il ban del personaggio', 'CHARACTER_BAN_ERROR', undefined, 500, getRequestId(req))
      );
    }
  }

  /**
   * DELETE /admin/characters/:characterId/ban
   */
  static async unbanCharacter(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;

      if (!Types.ObjectId.isValid(characterId)) {
        res.status(400).json(
          errorResponse('ID personaggio non valido', 'INVALID_CHARACTER_ID', undefined, 400, getRequestId(req))
        );
        return;
      }

      const character = await Character.findByIdAndUpdate(
        characterId,
        {
          $set: { isBanned: false },
          $unset: {
            banScope: '',
            banReason: '',
            bannedAt: '',
            bannedUntil: '',
            bannedBy: '',
            bannedByName: '',
          },
        },
        { new: true }
      );

      if (!character) {
        res.status(404).json(
          errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req))
        );
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Character unbanned', {
        ...auditInfo,
        targetCharacterId: characterId,
      });

      await redis.publish(
        'user:events',
        JSON.stringify({
          type: 'character_ban_updated',
          userId: character.userId.toString(),
          characterId: character._id.toString(),
          banScope: null,
          active: false,
          timestamp: new Date().toISOString(),
        })
      );

      res.json(updateResponse({ characterId, action: 'unbanned' }, 'Ban personaggio rimosso', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('CharacterBanController.unbanCharacter', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        errorResponse('Errore durante la rimozione del ban', 'CHARACTER_UNBAN_ERROR', undefined, 500, getRequestId(req))
      );
    }
  }
}
