import { Router, Request, Response } from 'express';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import DocumentSubtype from '@database/models/DocumentSubtype';
import Document from '@database/models/Document';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '../utils/apiResponse';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * GET /admin/subtypes?type=ambientazione|regolamento
 */
router.get('/',
  AdminAuthMiddleware.requireGranularPermission('documents.read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.query;

      const filter: any = {};
      if (type && ['ambientazione', 'regolamento'].includes(type as string)) {
        filter.type = type;
      }

      const subtypes = await DocumentSubtype.find(filter).sort({ type: 1, order: 1 }).lean();

      res.json({
        result: true,
        data: subtypes,
        timestamp: new Date().toISOString()
      });
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

      if (!slug || !title || !type) {
        res.status(400).json(errorResponse(
          'slug, title e type sono obbligatori',
          'VALIDATION_ERROR',
          undefined, 400, getRequestId(req)
        ));
        return;
      }

      if (!['ambientazione', 'regolamento'].includes(type)) {
        res.status(400).json(errorResponse(
          'type deve essere "ambientazione" o "regolamento"',
          'INVALID_TYPE',
          undefined, 400, getRequestId(req)
        ));
        return;
      }

      const existing = await DocumentSubtype.findOne({ type, slug });
      if (existing) {
        res.status(409).json(errorResponse(
          'Esiste già un subtype con questo slug per questo tipo',
          'DUPLICATE_SLUG',
          undefined, 409, getRequestId(req)
        ));
        return;
      }

      // Auto-assign order (append at end)
      const maxOrder = await DocumentSubtype.findOne({ type }).sort({ order: -1 }).lean();
      const order = (maxOrder?.order ?? -1) + 1;

      const subtype = await DocumentSubtype.create({ slug, title, type, order });

      logger.info(`DocumentSubtype created: ${subtype._id} (${type}/${slug})`);

      res.status(201).json({
        result: true,
        data: subtype,
        message: 'Subtype creato con successo',
        timestamp: new Date().toISOString()
      });
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

      const subtype = await DocumentSubtype.findById(id);
      if (!subtype) {
        res.status(404).json(errorResponse(
          'Subtype non trovato',
          'SUBTYPE_NOT_FOUND',
          undefined, 404, getRequestId(req)
        ));
        return;
      }

      if (slug && slug !== subtype.slug) {
        const existing = await DocumentSubtype.findOne({ type: subtype.type, slug });
        if (existing) {
          res.status(409).json(errorResponse(
            'Esiste già un subtype con questo slug per questo tipo',
            'DUPLICATE_SLUG',
            undefined, 409, getRequestId(req)
          ));
          return;
        }
        subtype.slug = slug;
      }

      if (title) subtype.title = title;
      if (typeof expandedByDefault === 'boolean') subtype.expandedByDefault = expandedByDefault;
      await subtype.save();

      // If slug changed, recalculate paths for all documents in this subtype
      if (slug) {
        const docs = await Document.find({ subtypeId: subtype._id });
        for (const doc of docs) {
          doc.path = `${subtype.slug}/${doc.slug}`;
          await doc.save();
        }
      }

      res.json({
        result: true,
        data: subtype,
        message: 'Subtype aggiornato con successo',
        timestamp: new Date().toISOString()
      });
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

      res.json({
        result: true,
        message: 'Subtype eliminato con successo',
        timestamp: new Date().toISOString()
      });
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

      res.json({
        result: true,
        message: `${orderedIds.length} subtypes riordinati con successo`,
        timestamp: new Date().toISOString()
      });
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

export { router as subtypeRoutes };
