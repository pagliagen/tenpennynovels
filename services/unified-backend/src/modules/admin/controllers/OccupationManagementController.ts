import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { Occupation } from '@database/models/Occupation';
import { Character } from '@database/models/Character';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class OccupationManagementController {
  /**
   * Get list of all occupations with management info
   * GET /admin/occupations
   */
  static async getOccupations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const category = req.query.category as string;
      const isActive = req.query.isActive as string;
      const search = req.query.search as string;

      // Build query
      const query: any = {};
      if (category && category !== 'all') query.category = category;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const totalItems = await Occupation.countDocuments(query);
      const occupations = await Occupation.find(query)
        .populate('createdBy', 'username')
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType')
        .populate('bonusSkills.skillId', 'name category')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const pagination = {
        page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupations list', {
        ...auditInfo,
        filters: { category, isActive, search },
        page,
        pageSize: limit,
        totalResults: totalItems
      });

      res.json(listResponse(
        occupations.map(occ => ({
          _id: occ._id,
          name: occ.name,
          description: occ.description,
          category: occ.category,
          contacts: occ.contacts,
          earnings: occ.earnings,
          image: occ.image || null,
          isActive: occ.isActive,
          requiredSkillSlots: occ.requiredSkillSlots || [],
          bonusSkills: occ.bonusSkills || [],
          createdBy: occ.createdBy,
          createdAt: occ.createdAt,
          updatedAt: occ.updatedAt,
        })),
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching occupations:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le occupazioni',
        'FETCH_OCCUPATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get occupation statistics
   * GET /admin/occupations/stats
   */
  static async getOccupationStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        total,
        active,
        inactive,
        byCategory
      ] = await Promise.all([
        Occupation.countDocuments(),
        Occupation.countDocuments({ isActive: true }),
        Occupation.countDocuments({ isActive: false }),
        Occupation.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      const stats = {
        total,
        active,
        inactive,
        byCategory: byCategory.map(cat => ({ name: cat._id, count: cat.count }))
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupation stats', {
        ...auditInfo
      });

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching occupation stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche delle occupazioni',
        'FETCH_OCCUPATION_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed occupation information
   * GET /admin/occupations/:occupationId
   */
  static async getOccupationDetails(req: Request<{ occupationId: string }>, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;

      const occupation = await Occupation.findById(occupationId)
        .populate('createdBy', 'username')
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType')
        .populate('bonusSkills.skillId', 'name category')
        .lean();

      if (!occupation) {
        res.status(404).json(errorResponse(
          'Occupazione non trovata',
          'OCCUPATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupation details', {
        ...auditInfo,
        occupationId,
        occupationName: Array.isArray(occupation) ? 'Multiple Occupations' : occupation.name
      });

      res.json(successResponse(
        occupation,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching occupation details:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli dell\'occupazione',
        'FETCH_OCCUPATION_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create new occupation
   * POST /admin/occupations
   */
  static async createOccupation(req: Request, res: Response): Promise<void> {
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      const occupation = new Occupation({
        ...req.body,
        createdBy: auditInfo!.adminId
      });

      const savedOccupation = await occupation.save();

      logger.info('New occupation created by admin', {
        ...auditInfo,
        occupationId: savedOccupation._id,
        occupationName: savedOccupation.name,
        category: 'occupation_management'
      });

      res.status(201).json(createResponse(
        {
          occupationId: savedOccupation._id.toString(),
          action: 'occupation_created'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      // Enhanced error logging
      logger.error('Error creating occupation:', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error?.name,
        errorStack: error?.stack,
        validationErrors: error?.errors ? Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        })) : undefined,
        requestBody: JSON.stringify(req.body, null, 2)
      });

      let errorMessage = 'Failed to create occupation';
      let errorCode = 'CREATE_OCCUPATION_ERROR';
      let statusCode = 500;

      // Handle different error types
      if (error.name === 'ValidationError') {
        // Mongoose validation error
        errorMessage = Object.keys(error.errors)
          .map(key => `${key}: ${error.errors[key].message}`)
          .join(', ');
        errorCode = 'VALIDATION_ERROR';
        statusCode = 400;
      } else if (error.code === 11000 || (error instanceof Error && error.message.includes('duplicate key'))) {
        // Duplicate key error
        errorMessage = 'Occupation name already exists';
        errorCode = 'OCCUPATION_NAME_EXISTS';
        statusCode = 409;
      }

      res.status(statusCode).json(errorResponse(
        errorMessage,
        errorCode,
        undefined,
        statusCode,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update occupation
   * PUT /admin/occupations/:occupationId
   */
  static async updateOccupation(req: Request<{ occupationId: string }>, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;
      const { reason, ...updateData } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'aggiornamento è richiesto',
          'UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const occupation = await Occupation.findByIdAndUpdate(
        occupationId,
        updateData,
        { returnDocument: 'after', runValidators: true }
      );

      if (!occupation) {
        res.status(404).json(errorResponse(
          'Occupazione non trovata',
          'OCCUPATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Occupation updated by admin', {
        ...auditInfo,
        occupationId,
        occupationName: occupation.name,
        reason,
        category: 'occupation_management'
      });

      res.json(updateResponse(
        {
          occupationId,
          action: 'occupation_updated'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating occupation:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare l\'occupazione',
        'UPDATE_OCCUPATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete occupation
   * DELETE /admin/occupations/:occupationId
   */
  static async deleteOccupation(req: Request<{ occupationId: string }>, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'eliminazione è richiesto',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const occupation = await Occupation.findById(occupationId);
      if (!occupation) {
        res.status(404).json(errorResponse(
          'Occupazione non trovata',
          'OCCUPATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      const charactersUsingOccupation = await Character.countDocuments({
        status: { $ne: 'DELETED' },
        'occupation.occupationId': new mongoose.Types.ObjectId(occupationId)
      });

      if (charactersUsingOccupation > 0) {
        await Occupation.findByIdAndUpdate(occupationId, { isActive: false });
        logger.warn('Occupation deactivated by admin (in use)', {
          ...auditInfo,
          occupationId,
          occupationName: occupation.name,
          reason,
          charactersUsingOccupation,
          category: 'occupation_management'
        });
        res.json(deleteResponse(
          `Occupazione disattivata. ${charactersUsingOccupation} personaggio/i la stanno utilizzando.`,
          getRequestId(req)
        ));
      } else {
        await occupation.softDelete(
          auditInfo?.adminId || (req as any).user?.userId,
          auditInfo?.adminCharacterName || 'Unknown Admin',
          reason
        );
        logger.warn('Occupation soft-deleted by admin', {
          ...auditInfo,
          occupationId,
          occupationName: occupation.name,
          reason,
          category: 'occupation_management'
        });
        res.json(deleteResponse(
          'Occupazione eliminata con successo',
          getRequestId(req)
        ));
      }
    } catch (error: any) {
      logger.error('Error deactivating occupation:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile disattivare l\'occupazione',
        'DELETE_OCCUPATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk occupation operations
   * POST /admin/occupations/bulk
   */
  static async bulkOccupationOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, occupationIds, data, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'operazione bulk è richiesto',
          'BULK_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let result;
      switch (operation) {
        case 'activate':
          result = await Occupation.updateMany(
            { _id: { $in: occupationIds } },
            { isActive: true }
          );
          break;
        case 'deactivate':
          result = await Occupation.updateMany(
            { _id: { $in: occupationIds } },
            { isActive: false }
          );
          break;
        case 'update_category':
          result = await Occupation.updateMany(
            { _id: { $in: occupationIds } },
            { category: data.category }
          );
          break;
        default:
          res.status(400).json(errorResponse(
            'Operazione bulk non valida',
            'INVALID_BULK_OPERATION',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk occupation operation by admin', {
        ...auditInfo,
        operation,
        occupationCount: occupationIds?.length || 0,
        modifiedCount: result?.modifiedCount || 0,
        reason,
        category: 'occupation_management'
      });

      res.json(updateResponse(
        {
          operation,
          processed: occupationIds?.length || 0,
          modified: result?.modifiedCount || 0
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error in bulk occupation operation:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eseguire l\'operazione bulk',
        'BULK_OCCUPATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk update bonus skill values for all occupations
   * POST /admin/occupations/bulk-update-skills
   */
  static async bulkUpdateSkillValues(req: Request, res: Response): Promise<void> {
    try {
      const { newValue, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'aggiornamento bulk è richiesto',
          'BULK_UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (typeof newValue !== 'number' || newValue < 0 || newValue > 100) {
        res.status(400).json(errorResponse(
          'newValue deve essere un numero tra 0 e 100',
          'INVALID_VALUE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const result = await Occupation.updateMany(
        { 'bonusSkills.0': { $exists: true } },
        { $set: { 'bonusSkills.$[].bonusValue': newValue } }
      );

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk bonus skill values updated by admin', {
        ...auditInfo,
        newValue,
        updatedCount: result?.modifiedCount || 0,
        reason,
        category: 'occupation_management'
      });

      res.json(updateResponse(
        {
          updatedCount: result?.modifiedCount || 0
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error in bulk skill values update:', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile eseguire l\'aggiornamento bulk dei valori delle abilità',
        'BULK_SKILL_UPDATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
