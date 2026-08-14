import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { logger } from '@modules/game/logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';
import { isValidObjectId } from '@shared/utils/validation';
import { ChatSceneService } from '../services/ChatSceneService';

export class ChatSceneController {
  /**
   * GET /characters/:characterId/chat-scenes
   * Elenca le scene (aperte o chiuse) a cui il personaggio ha partecipato.
   */
  static async listScenes(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      if (typeof characterId !== 'string' || !isValidObjectId(characterId)) {
        res.status(400).json(errorResponse('ID personaggio non valido', 'INVALID_CHARACTER_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const scenes = await ChatSceneService.getScenesForCharacter(characterId);
      res.json(successResponse({ scenes }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing chat scenes:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * GET /characters/:characterId/chat-scenes/:sceneId/transcript
   * Scarica il transcript della scena, solo se il personaggio vi ha partecipato.
   */
  static async downloadTranscript(req: Request<{ characterId: string; sceneId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, sceneId } = req.params;
      const userId = req.user!.userId;

      if (typeof characterId !== 'string' || !isValidObjectId(characterId)) {
        res.status(400).json(errorResponse('ID personaggio non valido', 'INVALID_CHARACTER_ID', undefined, 400, getRequestId(req)));
        return;
      }
      if (typeof sceneId !== 'string' || !isValidObjectId(sceneId)) {
        res.status(400).json(errorResponse('ID scena non valido', 'INVALID_SCENE_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const data = await ChatSceneService.getSceneTranscript(sceneId, characterId);
      if (!data) {
        res.status(404).json(errorResponse('Scena non trovata per questo personaggio', 'SCENE_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      res.json(successResponse({
        sceneId,
        locationId: data.scene.locationId,
        locationName: data.scene.locationName,
        title: data.scene.title,
        startedAt: data.scene.startedAt,
        closedAt: data.scene.closedAt,
        messageCount: data.messageCount,
        transcript: data.transcript
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error building scene transcript:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * PUT /characters/:characterId/chat-scenes/:sceneId
   * Aggiorna titolo/riassunto della propria copia personale della scena.
   * Solo il proprietario può modificarla (a differenza di listScenes/
   * downloadTranscript, il master NON ha accesso in scrittura: il riassunto
   * è una riflessione privata del personaggio, non un log di moderazione).
   */
  static async updateScene(req: Request<{ characterId: string; sceneId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, sceneId } = req.params;
      const userId = req.user!.userId;

      if (typeof characterId !== 'string' || !isValidObjectId(characterId)) {
        res.status(400).json(errorResponse('ID personaggio non valido', 'INVALID_CHARACTER_ID', undefined, 400, getRequestId(req)));
        return;
      }
      if (typeof sceneId !== 'string' || !isValidObjectId(sceneId)) {
        res.status(400).json(errorResponse('ID scena non valido', 'INVALID_SCENE_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const isOwner = character.userId.toString() === userId;
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può modificare la propria scena', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const { title, summary } = req.body || {};
      if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 150)) {
        res.status(400).json(errorResponse('Titolo non valido (max 150 caratteri)', 'INVALID_TITLE', undefined, 400, getRequestId(req)));
        return;
      }
      if (summary !== undefined && (typeof summary !== 'string' || summary.length > 10000)) {
        res.status(400).json(errorResponse('Riassunto non valido (max 10000 caratteri)', 'INVALID_SUMMARY', undefined, 400, getRequestId(req)));
        return;
      }

      const scene = await ChatSceneService.updateScene(sceneId, characterId, {
        title: title !== undefined ? title.trim() : undefined,
        summary: summary !== undefined ? summary.trim() : undefined
      });
      if (!scene) {
        res.status(404).json(errorResponse('Scena non trovata per questo personaggio', 'SCENE_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      res.json(successResponse({ scene }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error updating chat scene:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
