import { Request, Response } from 'express';
import { Character, Item, Location } from '@database/models';
import { CDNService, CDNEntityType } from '../services/CDNService';
import { aiGatewayClient } from '@modules/game/services/AIGatewayClient';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { getSocketIO } from '@modules/game/websocket/socketInstance';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';
import { logger } from '../utils/logger';

type EntityType = 'character' | 'item' | 'location';

interface ActiveJob {
  jobId: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  createdAt: number;
}

// key = `${entityType}:${entityId}`
const activeJobs = new Map<string, ActiveJob>();
// reverse lookup: jobId → mapKey
const jobIdIndex = new Map<string, string>();

const JOB_TIMEOUT_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, job] of activeJobs) {
    if (now - job.createdAt > JOB_TIMEOUT_MS) {
      emitToUser(job.userId, 'image_generation_failed', {
        entityType: job.entityType,
        entityId: job.entityId,
        error: 'Job scaduto (timeout)',
      });
      activeJobs.delete(key);
      jobIdIndex.delete(job.jobId);
    }
  }
}, 60_000);

function emitToUser(userId: string, event: string, data: Record<string, any>): void {
  const io = getSocketIO();
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  } else {
    logger.warn('Socket.IO not available, cannot emit event', { event });
  }
}

function extractCharacterPayload(record: any): Record<string, any> {
  return {
    name: record.name,
    surname: record.surname,
    gender: record.gender,
    age: record.age,
    apparentAge: record.apparentAge,
    physicalDescription: record.physicalDescription,
    eyeColor: record.eyeColor,
    hairColor: record.hairColor,
    height: record.height,
    prestavolto: record.prestavolto,
  };
}

function extractItemPayload(record: any): Record<string, any> {
  return {
    name: record.name,
    description: record.description,
    category: record.category,
    subcategory: record.subcategory,
  };
}

function extractLocationPayload(record: any): Record<string, any> {
  return {
    name: record.name,
    description: record.description,
    district: record.district,
    locationLevel: record.locationLevel,
  };
}

const PAYLOAD_EXTRACTORS: Record<EntityType, (record: any) => Record<string, any>> = {
  character: extractCharacterPayload,
  item: extractItemPayload,
  location: extractLocationPayload,
};

const CDN_TYPE_MAP: Record<EntityType, CDNEntityType> = {
  character: 'characters',
  item: 'items',
  location: 'locations',
};

function getImageField(entityType: EntityType): string {
  switch (entityType) {
    case 'character': return 'avatar';
    case 'item': return 'imageUrl';
    case 'location': return 'imageUrl';
  }
}

function getModel(entityType: EntityType) {
  switch (entityType) {
    case 'character': return Character;
    case 'item': return Item;
    case 'location': return Location;
  }
}

export class ImageGenerationController {

  /**
   * POST /admin/image-gen/generate/:entityType/:entityId
   * Starts image generation asynchronously and responds immediately.
   */
  static async startGeneration(req: Request, res: Response): Promise<void> {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const style = req.query.style as string | undefined;
    const reqId = getRequestId(req);

    if (!['character', 'item', 'location'].includes(entityType)) {
      res.status(400).json(errorResponse('entityType non valido', 'INVALID_ENTITY_TYPE', undefined, 400, reqId));
      return;
    }

    const mapKey = `${entityType}:${entityId}`;
    if (activeJobs.has(mapKey)) {
      res.status(409).json(errorResponse('Generazione già in corso per questa entità', 'ALREADY_GENERATING', undefined, 409, reqId));
      return;
    }

    try {
      const Model = getModel(entityType as EntityType);
      const record = await Model.findById(entityId).lean();

      if (!record) {
        res.status(404).json(errorResponse('Record non trovato', 'NOT_FOUND', undefined, 404, reqId));
        return;
      }

      const healthy = await aiGatewayClient.isHealthy();
      if (!healthy) {
        res.status(503).json(errorResponse('Servizio AI non disponibile', 'AI_SERVICE_UNAVAILABLE', undefined, 503, reqId));
        return;
      }

      const payload = PAYLOAD_EXTRACTORS[entityType as EntityType](record);
      const callbackBaseUrl = process.env.UNIFIED_BACKEND_INTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
      const webhookSecret = process.env.AI_GATEWAY_WEBHOOK_SECRET || '';

      const callbackHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (webhookSecret) {
        callbackHeaders['Authorization'] = `Bearer ${webhookSecret}`;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      const userId = auditInfo?.adminId || 'unknown';

      // Fire-and-forget: send job to AI gateway, don't block the response
      aiGatewayClient.generateImage({
        entityType: entityType as EntityType,
        record: payload,
        style,
        callback: {
          url: `${callbackBaseUrl}/webhooks/ai/image-gen/callback`,
          method: 'POST',
          headers: callbackHeaders,
        },
      }).then((result) => {
        if (result?.jobId) {
          const job = activeJobs.get(mapKey);
          if (job) {
            job.jobId = result.jobId;
            jobIdIndex.set(result.jobId, mapKey);
          }
          logger.info('AI gateway accepted job', { jobId: result.jobId, entityType, entityId });
        } else {
          activeJobs.delete(mapKey);
          emitToUser(userId, 'image_generation_failed', {
            entityType,
            entityId,
            error: 'Il servizio AI non ha accettato il job',
          });
        }
      }).catch((err) => {
        activeJobs.delete(mapKey);
        logger.error('Failed to send job to AI gateway', { error: err.message, entityType, entityId });
        emitToUser(userId, 'image_generation_failed', {
          entityType,
          entityId,
          error: 'Errore di comunicazione con il servizio AI',
        });
      });

      // Track the job immediately with a temporary jobId
      const tempJobId = `pending-${Date.now()}`;
      activeJobs.set(mapKey, {
        jobId: tempJobId,
        entityType: entityType as EntityType,
        entityId,
        userId,
        createdAt: Date.now(),
      });

      logger.info('Image generation requested', {
        ...auditInfo,
        entityType,
        entityId,
      });

      res.json(successResponse({ entityType, entityId, status: 'generating' }));

    } catch (error: any) {
      logger.error('Error in startGeneration:', { error: error.message });
      activeJobs.delete(`${entityType}:${entityId}`);
      res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, reqId));
    }
  }

  /**
   * POST /admin/image-gen/callback
   * Receives the generated image from local-ai, saves it to CDN,
   * updates the entity record, and notifies admins via Socket.IO.
   */
  static async handleCallback(req: Request, res: Response): Promise<void> {
    const { success, jobId, entityType: cbEntityType, image, error, metadata } = req.body;

    if (!jobId) {
      res.status(400).json({ result: false, error: 'Missing jobId' });
      return;
    }

    const mapKey = jobIdIndex.get(jobId);
    const job = mapKey ? activeJobs.get(mapKey) : null;

    if (!success) {
      logger.error('Image generation failed', { jobId, error });

      const et = job?.entityType || cbEntityType;
      const eid = job?.entityId;

      if (job?.userId) {
        emitToUser(job.userId, 'image_generation_failed', {
          entityType: et,
          entityId: eid,
          error: error || 'Generazione fallita',
        });
      }

      if (mapKey) {
        activeJobs.delete(mapKey);
        jobIdIndex.delete(jobId);
      }

      res.json({ result: true, received: true });
      return;
    }

    // Reconstruct entity info from callback if job was lost (e.g. backend restart)
    const entityType = (job?.entityType || cbEntityType) as EntityType;
    const entityId = job?.entityId;

    if (!entityId) {
      logger.warn('Callback for unknown job, cannot determine entityId', { jobId });
      res.json({ result: true, received: true, warning: 'Job not found, cannot update record' });
      return;
    }

    try {
      const imageBuffer = Buffer.from(image.base64, 'base64');
      const mimeType = `image/${image.format === 'jpg' ? 'jpeg' : image.format || 'png'}`;

      const multerFile = {
        buffer: imageBuffer,
        mimetype: mimeType,
        originalname: `generated.${image.format || 'png'}`,
        size: imageBuffer.length,
      } as Express.Multer.File;

      const cdnType = CDN_TYPE_MAP[entityType];
      const cdnResult = await CDNService.processAndUpload(multerFile, cdnType, entityId);

      const imageField = getImageField(entityType);
      const Model = getModel(entityType);
      await Model.findByIdAndUpdate(entityId, { [imageField]: cdnResult.url });

      if (job?.userId) {
        emitToUser(job.userId, 'image_generation_completed', {
          entityType,
          entityId,
          imageUrl: cdnResult.url,
          metadata: metadata || {},
        });
      }

      if (mapKey) {
        activeJobs.delete(mapKey);
        jobIdIndex.delete(jobId);
      }

      logger.info('Image generation completed', {
        jobId,
        entityType,
        entityId,
        cdnUrl: cdnResult.url,
      });

      res.json({ result: true, received: true, cdnUrl: cdnResult.url });

    } catch (err: any) {
      logger.error('Error processing callback:', { jobId, error: err.message });

      if (job?.userId) {
        emitToUser(job.userId, 'image_generation_failed', {
          entityType,
          entityId,
          error: 'Errore durante il salvataggio su CDN',
        });
      }

      if (mapKey) {
        activeJobs.delete(mapKey);
        jobIdIndex.delete(jobId);
      }

      res.status(500).json({ result: false, error: err.message });
    }
  }

  /**
   * GET /admin/image-gen/active
   * Returns active generation jobs (for state sync on page refresh).
   */
  static async getActiveJobs(_req: Request, res: Response): Promise<void> {
    const jobs = Array.from(activeJobs.values()).map((job) => ({
      entityType: job.entityType,
      entityId: job.entityId,
      createdAt: job.createdAt,
    }));

    res.json(successResponse({ jobs }));
  }
}
