import { Request, Response } from 'express';
import { ApiResponse } from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { Occupation } from '../../../../packages/database/models/Occupation';

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
      const socialClass = req.query.socialClass as string;
      const isActive = req.query.isActive as string;
      const search = req.query.search as string;

      // Build query
      const query: any = {};
      if (category && category !== 'all') query.category = category;
      if (socialClass && socialClass !== 'all') query.socialClass = socialClass;
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
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const response: ApiResponse<{
        occupations: any[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          limit: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          occupations: occupations.map(occ => ({
            _id: occ._id,
            name: occ.name,
            description: occ.description,
            category: occ.category,
            socialClass: occ.socialClass,
            contacts: occ.contacts,
            earnings: occ.earnings,
            isActive: occ.isActive,
            // Skills system
            requiredSkills: occ.requiredSkills || [],
            bonusSkills: occ.bonusSkills || [],
            typicalEmployers: occ.typicalEmployers || [],
            careerProgression: occ.careerProgression || [],
            createdBy: occ.createdBy,
            createdAt: occ.createdAt,
            updatedAt: occ.updatedAt,
            // Skills count
            requiredSkillsCount: (occ.requiredSkills || []).length,
            bonusSkillsCount: (occ.bonusSkills || []).length
          })),
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            limit,
            hasMore: page < Math.ceil(totalItems / limit)
          }
        },
        timestamp: new Date().toISOString()
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupations list', {
        ...auditInfo,
        filters: { category, socialClass, isActive, search },
        page,
        limit,
        totalResults: totalItems
      });

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching occupations:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le occupazioni',
        code: 'FETCH_OCCUPATIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        byCategory,
        bySocialClass
      ] = await Promise.all([
        Occupation.countDocuments(),
        Occupation.countDocuments({ isActive: true }),
        Occupation.countDocuments({ isActive: false }),
        Occupation.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Occupation.aggregate([
          { $unwind: '$socialClass' },
          { $group: { _id: '$socialClass', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      const stats = {
        total,
        active,
        inactive,
        byCategory: byCategory.map(cat => ({ name: cat._id, count: cat.count })),
        bySocialClass: bySocialClass.map(sc => ({ name: sc._id, count: sc.count }))
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupation stats', {
        ...auditInfo
      });

      const response: ApiResponse<any> = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching occupation stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le statistiche delle occupazioni',
        code: 'FETCH_OCCUPATION_STATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get detailed occupation information
   * GET /admin/occupations/:occupationId
   */
  static async getOccupationDetails(req: Request, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;

      const occupation = await Occupation.findById(occupationId)
        .populate('createdBy', 'username')
        .lean();

      if (!occupation) {
        const response: ApiResponse = {
          success: false,
          error: 'Occupazione non trovata',
          code: 'OCCUPATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed occupation details', {
        ...auditInfo,
        occupationId,
        occupationName: Array.isArray(occupation) ? 'Multiple Occupations' : occupation.name
      });

      const response: ApiResponse<any> = {
        success: true,
        data: occupation,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching occupation details:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i dettagli dell\'occupazione',
        code: 'FETCH_OCCUPATION_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse<{ occupationId: string; action: string }> = {
        success: true,
        data: {
          occupationId: savedOccupation._id.toString(),
          action: 'occupation_created'
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
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

      const response: ApiResponse = {
        success: false,
        error: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString()
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * Update occupation
   * PUT /admin/occupations/:occupationId
   */
  static async updateOccupation(req: Request, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;
      const { reason, ...updateData } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'aggiornamento è richiesto',
          code: 'UPDATE_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const occupation = await Occupation.findByIdAndUpdate(
        occupationId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!occupation) {
        const response: ApiResponse = {
          success: false,
          error: 'Occupazione non trovata',
          code: 'OCCUPATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse<{ occupationId: string; action: string }> = {
        success: true,
        data: {
          occupationId,
          action: 'occupation_updated'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating occupation:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare l\'occupazione',
        code: 'UPDATE_OCCUPATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Delete occupation
   * DELETE /admin/occupations/:occupationId
   */
  static async deleteOccupation(req: Request, res: Response): Promise<void> {
    try {
      const occupationId = req.params.occupationId;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'eliminazione è richiesto',
          code: 'DELETION_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const occupation = await Occupation.findById(occupationId);
      if (!occupation) {
        const response: ApiResponse = {
          success: false,
          error: 'Occupazione non trovata',
          code: 'OCCUPATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Soft delete: set isActive to false instead of actual deletion
      await Occupation.findByIdAndUpdate(occupationId, { isActive: false });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Occupation deactivated by admin', {
        ...auditInfo,
        occupationId,
        occupationName: occupation.name,
        reason,
        category: 'occupation_management'
      });

      const response: ApiResponse<{ occupationId: string; action: string }> = {
        success: true,
        data: {
          occupationId,
          action: 'occupation_deactivated'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error deactivating occupation:', { 
        error: error instanceof Error ? error.message : String(error), 
        occupationId: req.params.occupationId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile disattivare l\'occupazione',
        code: 'DELETE_OCCUPATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'operazione bulk è richiesto',
          code: 'BULK_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
          const response: ApiResponse = {
            success: false,
            error: 'Operazione bulk non valida',
            code: 'INVALID_BULK_OPERATION',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
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

      const response: ApiResponse<{ operation: string; processed: number; modified: number }> = {
        success: true,
        data: {
          operation,
          processed: occupationIds?.length || 0,
          modified: result?.modifiedCount || 0
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in bulk occupation operation:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eseguire l\'operazione bulk',
        code: 'BULK_OCCUPATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Bulk update skill values for all occupations
   * POST /admin/occupations/bulk-update-skills
   */
  static async bulkUpdateSkillValues(req: Request, res: Response): Promise<void> {
    try {
      const { skillType, fieldToUpdate, newValue, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'aggiornamento bulk è richiesto',
          code: 'BULK_UPDATE_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!skillType || !fieldToUpdate || newValue === undefined) {
        const response: ApiResponse = {
          success: false,
          error: 'skillType, fieldToUpdate e newValue sono richiesti',
          code: 'MISSING_PARAMETERS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (typeof newValue !== 'number' || newValue < 0 || newValue > 100) {
        const response: ApiResponse = {
          success: false,
          error: 'newValue deve essere un numero tra 0 e 100',
          code: 'INVALID_VALUE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      let result;
      if (skillType === 'required' && fieldToUpdate === 'baseValue') {
        // Update baseValue for all requiredSkills in all occupations
        result = await Occupation.updateMany(
          { 'requiredSkills.0': { $exists: true } },
          { $set: { 'requiredSkills.$[].baseValue': newValue } }
        );
      } else if (skillType === 'bonus' && fieldToUpdate === 'bonusValue') {
        // Update bonusValue for all bonusSkills in all occupations
        result = await Occupation.updateMany(
          { 'bonusSkills.0': { $exists: true } },
          { $set: { 'bonusSkills.$[].bonusValue': newValue } }
        );
      } else {
        const response: ApiResponse = {
          success: false,
          error: 'Combinazione skillType o fieldToUpdate non valida',
          code: 'INVALID_SKILL_TYPE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk skill values updated by admin', {
        ...auditInfo,
        skillType,
        fieldToUpdate,
        newValue,
        updatedCount: result?.modifiedCount || 0,
        reason,
        category: 'occupation_management'
      });

      const response: ApiResponse<{ updatedCount: number }> = {
        success: true,
        data: {
          updatedCount: result?.modifiedCount || 0
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in bulk skill values update:', {
        error: error instanceof Error ? error.message : String(error)
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eseguire l\'aggiornamento bulk dei valori delle abilità',
        code: 'BULK_SKILL_UPDATE_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}