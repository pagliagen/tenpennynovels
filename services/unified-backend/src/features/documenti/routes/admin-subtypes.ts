import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import DocumentSubtype from '../models/DocumentSubtype';
import Document from '../models/Document';
import { logger } from '@modules/admin/utils/logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';
import { ALL_DOCUMENT_TYPES, isDocumentType, type DocumentType } from '../constants/documentTypes';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * GET /admin/subtypes?type=ambientazione|regolamento
 */
router.get('/',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.query;

      // CWE-943: qs può trasformare ?type[$where]=x in un oggetto — typeof
      // esplicito prima del confronto, il cast `as string` non protegge a runtime.
      const filter: any = {};
      if (isDocumentType(type)) {
        filter.type = type;
      }

      const subtypes = await DocumentSubtype.find(filter).sort({ type: 1, order: 1 }).lean();

      res.json(successResponse(subtypes, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error fetching subtypes:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore recupero subtypes',
        'GET_SUBTYPES_ERROR',
        undefined, 500, getRequestId(req)
      ));
    }
  }
);

/**
 * POST /admin/subtypes
 * Body: { slug, title, type }
 */
router.post('/',
  AdminAuthMiddleware.requireGranularPermission('documents.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, title, type } = req.body;

      // CWE-943: slug finisce in un filtro Mongoose (findOne) più sotto —
      // deve essere una stringa, non un oggetto/operatore.
      if (!slug || !title || !type || typeof slug !== 'string' || typeof type !== 'string') {
        res.status(400).json(errorResponse(
          'slug, title e type sono obbligatori',
          'VALIDATION_ERROR',
          undefined, 400, getRequestId(req)
        ));
        return;
      }

      if (!isDocumentType(type)) {
        res.status(400).json(errorResponse(
          `type deve essere uno fra: ${ALL_DOCUMENT_TYPES.join(', ')}`,
          'INVALID_TYPE',
          undefined, 400, getRequestId(req)
        ));
        return;
      }
      // Verificato dal type guard sopra: uno dei letterali validi.
      const safeType: DocumentType = type;

      const existing = await DocumentSubtype.findOne({ type: safeType, slug });
      if (existing) {
        res.status(409).json(errorResponse(
          'Esiste già un subtype con questo slug per questo tipo',
          'DUPLICATE_SLUG',
          undefined, 409, getRequestId(req)
        ));
        return;
      }

      // Auto-assign order (append at end)
      const maxOrder = await DocumentSubtype.findOne({ type: safeType }).sort({ order: -1 }).lean();
      const order = (maxOrder?.order ?? -1) + 1;

      const subtype = await DocumentSubtype.create({ slug, title, type: safeType, order });

      logger.info(`DocumentSubtype created: ${subtype._id} (${type}/${slug})`);

      res.status(201).json(successResponse(subtype, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error creating subtype:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore creazione subtype',
        'CREATE_SUBTYPE_ERROR',
        undefined, 500, getRequestId(req)
      ));
    }
  }
);

/**
 * PATCH /admin/subtypes/:id
 * Body: { slug?, title? }
 */
router.patch('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { slug, title, expandedByDefault } = req.body;

      // CWE-943: slug finisce in un filtro Mongoose (findOne) più sotto —
      // deve essere una stringa, non un oggetto/operatore.
      const safeSlug = typeof slug === 'string' ? slug : undefined;

      const subtype = await DocumentSubtype.findById(id);
      if (!subtype) {
        res.status(404).json(errorResponse(
          'Subtype non trovato',
          'SUBTYPE_NOT_FOUND',
          undefined, 404, getRequestId(req)
        ));
        return;
      }

      if (safeSlug && safeSlug !== subtype.slug) {
        const existing = await DocumentSubtype.findOne({ type: subtype.type, slug: safeSlug });
        if (existing) {
          res.status(409).json(errorResponse(
            'Esiste già un subtype con questo slug per questo tipo',
            'DUPLICATE_SLUG',
            undefined, 409, getRequestId(req)
          ));
          return;
        }
        subtype.slug = safeSlug;
      }

      if (typeof title === 'string' && title) subtype.title = title;
      if (typeof expandedByDefault === 'boolean') subtype.expandedByDefault = expandedByDefault;
      await subtype.save();

      // If slug changed, recalculate paths for all documents in this subtype
      if (safeSlug) {
        const docs = await Document.find({ subtypeId: subtype._id });
        for (const doc of docs) {
          doc.path = `${subtype.slug}/${doc.slug}`;
          await doc.save();
        }
      }

      res.json(successResponse(subtype, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error updating subtype:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore aggiornamento subtype',
        'UPDATE_SUBTYPE_ERROR',
        undefined, 500, getRequestId(req)
      ));
    }
  }
);

/**
 * DELETE /admin/subtypes/:id
 */
router.delete('/:id',
  AdminAuthMiddleware.requireGranularPermission('documents.delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const docCount = await Document.countDocuments({ subtypeId: id, deleted: { $ne: true } });
      if (docCount > 0) {
        res.status(400).json(errorResponse(
          `Impossibile eliminare: ${docCount} documenti ancora associati a questo subtype`,
          'SUBTYPE_HAS_DOCUMENTS',
          { documentCount: docCount },
          400, getRequestId(req)
        ));
        return;
      }

      const subtype = await DocumentSubtype.findByIdAndDelete(id);
      if (!subtype) {
        res.status(404).json(errorResponse(
          'Subtype non trovato',
          'SUBTYPE_NOT_FOUND',
          undefined, 404, getRequestId(req)
        ));
        return;
      }

      logger.info(`DocumentSubtype deleted: ${id}`);

      res.json(successResponse(null, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error deleting subtype:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore eliminazione subtype',
        'DELETE_SUBTYPE_ERROR',
        undefined, 500, getRequestId(req)
      ));
    }
  }
);

/**
 * PUT /admin/subtypes/reorder
 * Body: { type, orderedIds: string[] }
 */
router.put('/reorder',
  AdminAuthMiddleware.requireGranularPermission('documents.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, orderedIds } = req.body;

      if (!type || !Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json(errorResponse(
          'type e orderedIds (array non vuoto) sono obbligatori',
          'VALIDATION_ERROR',
          undefined, 400, getRequestId(req)
        ));
        return;
      }

      const bulkOps = orderedIds.map((id: string, index: number) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: index } }
        }
      }));

      await DocumentSubtype.bulkWrite(bulkOps);

      logger.info(`Reordered ${orderedIds.length} subtypes for type=${type}`);

      res.json(successResponse(null, undefined, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error reordering subtypes:', error);
      res.status(500).json(errorResponse(
        error.message || 'Errore riordinamento subtypes',
        'REORDER_SUBTYPES_ERROR',
        undefined, 500, getRequestId(req)
      ));
    }
  }
);

export default router;
