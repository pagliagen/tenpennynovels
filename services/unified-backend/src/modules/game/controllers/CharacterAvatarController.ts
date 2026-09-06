import { Request, Response } from 'express';
import multer from 'multer';
import { Character } from '@core/character/models/Character';
import { CDNService } from '../../admin/services/CDNService';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';

// memoryStorage bufferizza l'intero file in RAM: senza un tetto un upload
// molto grande può esaurire la memoria del processo (typescript:S5693).
// 10MB come CDNController — un avatar/ritratto reale non lo supera mai.
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo file non supportato: ${file.mimetype}`));
    }
  }
});

/**
 * Upload avatar/ritratto dalla scheda personaggio (owner o master).
 * Riusa CDNService (stesso storage del pannello gestione, type "characters"),
 * ma con auth di gioco invece del gate admin — un giocatore normale non ha
 * accesso a /admin/cdn/upload, che richiede permessi da staff.
 */
export class CharacterAvatarController {
  static async uploadAvatar(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const file = req.file;

      if (!file) {
        res.status(400).json(errorResponse('Nessun file fornito', 'NO_FILE', undefined, 400, getRequestId(req)));
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

      const result = await CDNService.processAndUpload(file, 'characters', characterId);

      // avatar (chat/liste location) e profileImage (scheda) restano allineati:
      // un solo upload aggiorna il ritratto ovunque compaia il personaggio.
      character.avatar = result.url;
      character.profileImage = result.url;
      await character.save();

      logger.info('Character avatar uploaded', { characterId, url: result.url, size: result.size });

      res.status(201).json(successResponse(result, 'Avatar caricato con successo', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error uploading character avatar:', error);
      const message = error instanceof Error ? error.message : 'Errore durante il caricamento';
      res.status(500).json(errorResponse(message, 'AVATAR_UPLOAD_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
