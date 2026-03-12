import { Request, Response } from 'express';
import { CharacterNotes } from '@database/models';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class CharacterNotesController {
  /**
   * Get block notes for current character
   * GET /game/block-notes
   */
  static async getNotes(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const locationId = req.query.locationId as string | undefined;

      const query: any = { characterId: character.characterId };
      if (locationId) {
        query.locationId = locationId;
      }

      const notes = await CharacterNotes.findOne(query).lean();

      res.json(successResponse(
        { notes: notes || null },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Get block notes error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to retrieve block notes',
        'GET_NOTES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Save or update block notes
   * POST /game/block-notes
   */
  static async saveNotes(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { content, locationId } = req.body;

      if (content === undefined) {
        res.status(400).json(errorResponse(
          'content is required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const query: any = { characterId: character.characterId };
      if (locationId) {
        query.locationId = locationId;
      }

      const notes = await CharacterNotes.findOneAndUpdate(
        query,
        {
          characterId: character.characterId,
          locationId: locationId || undefined,
          content: content.trim()
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      logger.info(`Block notes saved for character ${character.characterId}`);

      res.json(successResponse(
        { notes },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Save block notes error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to save block notes',
        'SAVE_NOTES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete block notes
   * DELETE /game/block-notes/:notesId
   */
  static async deleteNotes(req: Request<{ notesId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { notesId } = req.params;

      const notes = await CharacterNotes.findById(notesId);
      if (!notes) {
        res.status(404).json(errorResponse(
          'Notes not found',
          'NOTES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check ownership
      if (notes.characterId.toString() !== character.characterId) {
        res.status(403).json(errorResponse(
          'You can only delete your own notes',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      await CharacterNotes.findByIdAndDelete(notesId);

      logger.info(`Block notes deleted: ${notesId} by ${character.characterId}`);

      res.json(successResponse(
        { deleted: true },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Delete block notes error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to delete block notes',
        'DELETE_NOTES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}

