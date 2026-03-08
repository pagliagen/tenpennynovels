import { Request, Response } from 'express';
import multer from 'multer';
import { CDNService, CDNEntityType } from '../services/CDNService';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';

const VALID_TYPES: CDNEntityType[] = ['locations', 'items', 'characters'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo file non supportato: ${file.mimetype}`));
    }
  },
});

export class CDNController {
  static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      const { type, entityId } = req.body;
      const reqId = getRequestId(req);

      if (!file) {
        res.status(400).json(errorResponse('Nessun file fornito', 'NO_FILE', undefined, 400, reqId));
        return;
      }

      if (!type || !VALID_TYPES.includes(type)) {
        res.status(400).json(errorResponse(`Tipo non valido. Ammessi: ${VALID_TYPES.join(', ')}`, 'INVALID_TYPE', undefined, 400, reqId));
        return;
      }

      if (!entityId || typeof entityId !== 'string' || entityId.length < 10) {
        res.status(400).json(errorResponse('entityId non valido', 'INVALID_ENTITY_ID', undefined, 400, reqId));
        return;
      }

      const result = await CDNService.processAndUpload(file, type as CDNEntityType, entityId);

      logger.info(`CDN upload: ${type}/${entityId} by admin`, {
        hash: result.hash,
        size: result.size,
      });

      res.status(201).json(createResponse(result, 'Immagine caricata con successo', reqId));
    } catch (error: any) {
      logger.error('CDN upload error:', { error: error.message, stack: error.stack });
      const reqId = getRequestId(req);
      res.status(500).json(errorResponse(error.message || 'Errore durante l\'upload', 'UPLOAD_ERROR', undefined, 500, reqId));
    }
  }

  static async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const { type, entityId, filename } = req.params;
      const reqId = getRequestId(req);

      if (!VALID_TYPES.includes(type as CDNEntityType)) {
        res.status(400).json(errorResponse('Tipo non valido', 'INVALID_TYPE', undefined, 400, reqId));
        return;
      }

      if (!entityId || !filename) {
        res.status(400).json(errorResponse('entityId e filename sono obbligatori', 'MISSING_PARAMS', undefined, 400, reqId));
        return;
      }

      if (filename.includes('..') || filename.includes('/')) {
        res.status(400).json(errorResponse('Filename non valido', 'INVALID_FILENAME', undefined, 400, reqId));
        return;
      }

      await CDNService.deleteImage(type as CDNEntityType, entityId as string, filename as string);

      logger.info(`CDN delete: ${type}/${entityId}/${filename}`);
      res.json(successResponse({ deleted: true }, 'Immagine eliminata', reqId));
    } catch (error: any) {
      logger.error('CDN delete error:', { error: error.message });
      const reqId = getRequestId(req);
      res.status(500).json(errorResponse(error.message || 'Errore durante la cancellazione', 'DELETE_ERROR', undefined, 500, reqId));
    }
  }

  static async listImages(req: Request, res: Response): Promise<void> {
    try {
      const { type, entityId } = req.params;
      const reqId = getRequestId(req);

      if (!VALID_TYPES.includes(type as CDNEntityType)) {
        res.status(400).json(errorResponse('Tipo non valido', 'INVALID_TYPE', undefined, 400, reqId));
        return;
      }

      if (!entityId) {
        res.status(400).json(errorResponse('entityId obbligatorio', 'MISSING_ENTITY_ID', undefined, 400, reqId));
        return;
      }

      const files = await CDNService.listImages(type as CDNEntityType, entityId as string);
      res.json(successResponse({ files }, undefined, reqId));
    } catch (error: any) {
      logger.error('CDN list error:', { error: error.message });
      const reqId = getRequestId(req);
      res.status(500).json(errorResponse(error.message || 'Errore durante la lista', 'LIST_ERROR', undefined, 500, reqId));
    }
  }
}
