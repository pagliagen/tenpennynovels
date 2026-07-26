import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumTopic } from '@database/models/ForumTopic';
import { ForumTopicPermissionOverride, type ForumPermissionDecision } from '@database/models/ForumTopicPermissionOverride';
import { Character } from '@database/models/Character';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, getRequestId, deleteResponse } from '@shared/utils/apiResponse';

const VALID_DECISIONS: ForumPermissionDecision[] = ['allow', 'deny'];
const VALID_KEYS = ['view', 'openThread', 'reply', 'attachImages'] as const;

/**
 * Admin CRUD for ForumTopicPermissionOverride - the per-character exceptions
 * to the 4 player-facing granular permissions (view/openThread/reply/
 * attachImages) evaluated by ForumAccessService.evaluateTopicPermissions.
 * 'moderare'/'amministrare' are NOT managed here (existing admin permission
 * system).
 */
export class ForumTopicPermissionManagementController {

  /**
   * GET /admin/forum-topics/:topicId/permissions
   */
  static async getOverrides(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;
      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        res.status(400).json({ success: false, error: 'ID argomento non valido', code: 'INVALID_TOPIC_ID' });
        return;
      }

      const overrides = await ForumTopicPermissionOverride.find({ topicId }).sort({ grantedAt: -1 }).lean();

      const characterIds = overrides.map((o) => o.characterId);
      const characters = await Character.find({ _id: { $in: characterIds } }).select('name surname').lean();
      const characterById = new Map(characters.map((c: any) => [c._id.toString(), c]));

      res.json(successResponse(overrides.map((o) => ({
        _id: o._id,
        characterId: o.characterId,
        characterName: (() => {
          const c = characterById.get(o.characterId.toString()) as any;
          return c ? (c.surname ? `${c.name} ${c.surname}` : c.name) : undefined;
        })(),
        overrides: o.overrides,
        grantedBy: o.grantedBy,
        grantedByCharacterName: o.grantedByCharacterName,
        grantedAt: o.grantedAt,
        reason: o.reason,
      })), undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error fetching forum topic permission overrides:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare i permessi',
        'FETCH_FORUM_PERMISSIONS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * PUT /admin/forum-topics/:topicId/permissions/:characterId
   * Upsert: body.overrides is a partial { view?, openThread?, reply?, attachImages?: 'allow'|'deny' }.
   * Omitted keys fall back to the topic's computed default (see evaluateTopicPermissions).
   */
  static async upsertOverride(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;
      const characterId = Array.isArray(req.params.characterId) ? req.params.characterId[0] : req.params.characterId;
      const { overrides, reason } = req.body;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        res.status(400).json({ success: false, error: 'ID argomento non valido', code: 'INVALID_TOPIC_ID' });
        return;
      }
      if (!characterId || !mongoose.Types.ObjectId.isValid(characterId)) {
        res.status(400).json({ success: false, error: 'ID personaggio non valido', code: 'INVALID_CHARACTER_ID' });
        return;
      }
      if (!overrides || typeof overrides !== 'object') {
        res.status(400).json({ success: false, error: 'overrides è obbligatorio', code: 'VALIDATION_ERROR' });
        return;
      }

      const cleanedOverrides: Record<string, ForumPermissionDecision> = {};
      for (const key of VALID_KEYS) {
        const value = overrides[key];
        if (value === undefined || value === null) continue;
        if (!VALID_DECISIONS.includes(value)) {
          res.status(400).json({ success: false, error: `Valore non valido per ${key} (atteso 'allow'|'deny')`, code: 'VALIDATION_ERROR' });
          return;
        }
        cleanedOverrides[key] = value;
      }

      const topic = await ForumTopic.findById(topicId).select('_id').lean();
      if (!topic) {
        res.status(404).json({ success: false, error: 'Argomento non trovato', code: 'TOPIC_NOT_FOUND' });
        return;
      }

      const character = await Character.findById(characterId).select('name surname').lean();
      if (!character) {
        res.status(404).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      const grantedBy = new mongoose.Types.ObjectId(auditInfo?.adminId || undefined);

      const updated = await ForumTopicPermissionOverride.findOneAndUpdate(
        { topicId, characterId },
        {
          $set: {
            overrides: cleanedOverrides,
            grantedBy,
            grantedByCharacterName: auditInfo?.adminCharacterName || auditInfo?.adminUsername || 'Admin',
            grantedAt: new Date(),
            reason: typeof reason === 'string' ? reason.trim() : undefined,
          },
        },
        { new: true, upsert: true }
      ).lean();

      res.json(successResponse(updated, 'Permessi aggiornati con successo', getRequestId(req)));

      logger.info('Admin updated forum topic permission override', {
        ...auditInfo, topicId, characterId, overrides: cleanedOverrides,
      });
    } catch (error: unknown) {
      logger.error('Error upserting forum topic permission override:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare i permessi',
        'UPDATE_FORUM_PERMISSIONS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * DELETE /admin/forum-topics/:topicId/permissions/:characterId
   * Removes the override entirely - the character reverts to the topic's computed default.
   */
  static async deleteOverride(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;
      const characterId = Array.isArray(req.params.characterId) ? req.params.characterId[0] : req.params.characterId;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId) || !characterId || !mongoose.Types.ObjectId.isValid(characterId)) {
        res.status(400).json({ success: false, error: 'ID non valido', code: 'INVALID_ID' });
        return;
      }

      await ForumTopicPermissionOverride.deleteOne({ topicId, characterId });

      res.json(deleteResponse('Override rimosso, il personaggio torna al permesso di default', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin deleted forum topic permission override', { ...auditInfo, topicId, characterId });
    } catch (error: unknown) {
      logger.error('Error deleting forum topic permission override:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile rimuovere l\'override',
        'DELETE_FORUM_PERMISSIONS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
