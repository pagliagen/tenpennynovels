import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { CharacterMasterNote } from '@database/models/CharacterMasterNote';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';
import { isValidObjectId } from '@shared/utils/validation';

export class CharacterMasterNoteController {
  /**
   * GET /characters/:characterId/master-notes
   * @query category - 'general' | 'damage' (opzionale)
   */
  static async listNotes(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { category } = req.query;
      const userId = req.user!.userId;

      // characterId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value anywhere below (NoSQL injection guard)
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

      // Wrap in $eq per CodeQL's own guidance: guarantees a query-operator
      // object can never be interpreted as anything but a literal value to match.
      const filter: Record<string, unknown> = { characterId: { $eq: characterId } };
      if (category === 'general' || category === 'damage') {
        filter.category = { $eq: category };
      }

      const notes = await CharacterMasterNote.find(filter).sort({ createdAt: -1 }).lean();
      res.json(successResponse({ notes }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing master notes:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/master-notes
   * Solo master. body: { content, category? }
   */
  static async createNote(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { content, category } = req.body || {};
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;

      if (!isMaster) {
        res.status(403).json(errorResponse('Solo il master può scrivere note su un personaggio', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }
      if (!content?.trim()) {
        res.status(400).json(errorResponse('Il contenuto della nota è obbligatorio', 'MISSING_CONTENT', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const note = await CharacterMasterNote.create({
        characterId,
        authorId: req.character!.characterId,
        authorName: req.character!.characterName || 'Master',
        category: category === 'damage' ? 'damage' : 'general',
        content: content.trim()
      });

      logger.info('Master note created', { characterId, category: note.category, authorId: req.character!.characterId });

      res.status(201).json(successResponse({ note }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error creating master note:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
