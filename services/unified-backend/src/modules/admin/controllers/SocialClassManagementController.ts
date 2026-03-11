import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SocialClassConfig, ISocialClassConfig } from '@database/models/SocialClassConfig';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class SocialClassManagementController {

  /**
   * Get all social class configurations with filtering and pagination
   */
  static async getSocialClasses(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        sortBy = 'displayOrder',
        sortOrder = 'asc'
      } = req.query;

      // Build filter object
      const filter: any = {};
      
      // Text search
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { label: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Sorting
      const sortField = sortBy as string;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      const sort: any = { [sortField]: sortDirection };

      // Execute query
      const [socialClasses, total] = await Promise.all([
        SocialClassConfig.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SocialClassConfig.countDocuments(filter)
      ]);

      // Add usage statistics for each social class
      const socialClassesWithStats = await Promise.all(
        socialClasses.map(async (socialClass) => {
          // Count characters using this social class (based on FINANZA skill range)
          const characterCount = await Character.countDocuments({
            'skills.finanza.value': {
              $gte: socialClass.minFinanceSkill,
              $lte: socialClass.maxFinanceSkill
            },
            status: { $ne: 'DELETED' }
          });

          return {
            ...socialClass,
            usage: {
              characterCount
            }
          };
        })
      );

      const totalPages = Math.ceil(total / limitNum);

      res.json(successResponse(
        {
          socialClasses: socialClassesWithStats,
          pagination: {
            page: pageNum,
            totalPages,
            totalCount: total,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            pageSize: limitNum
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching social classes:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching social classes',
        'FETCH_SOCIAL_CLASSES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get social class statistics and analytics
   */
  static async getSocialClassStats(req: Request, res: Response): Promise<void> {
    try {
      // Basic counts
      const totalClasses = await SocialClassConfig.countDocuments({});

      // Finance skill distribution across classes
      const financeDistribution = await SocialClassConfig.aggregate([
        {
          $project: {
            name: 1,
            label: 1,
            minFinanceSkill: 1,
            maxFinanceSkill: 1,
            range: { $subtract: ['$maxFinanceSkill', '$minFinanceSkill'] },
            midpoint: { $divide: [{ $add: ['$minFinanceSkill', '$maxFinanceSkill'] }, 2] }
          }
        },
        {
          $sort: { displayOrder: 1 }
        }
      ]);

      // Wealth distribution analysis
      const wealthDistribution = await SocialClassConfig.aggregate([
        {
          $project: {
            name: 1,
            label: 1,
            weeklyCredit: 1,
            avgStartingCash: { $divide: [{ $add: ['$initialWealth.minCash', '$initialWealth.maxCash'] }, 2] },
            hasPrivateApartment: '$initialWealth.hasPrivateApartment',
            bonusItemsCount: { $size: '$initialWealth.bonusItems' }
          }
        },
        {
          $sort: { displayOrder: 1 }
        }
      ]);

      // Character distribution across social classes
      const characterDistribution = await Character.aggregate([
        {
          $match: {
            status: { $ne: 'DELETED' },
            'skills.finanza.value': { $exists: true }
          }
        },
        {
          $lookup: {
            from: 'socialclassconfigs',
            let: { financeValue: '$skills.finanza.value' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $lte: ['$minFinanceSkill', '$$financeValue'] },
                      { $gte: ['$maxFinanceSkill', '$$financeValue'] }
                    ]
                  }
                }
              }
            ],
            as: 'socialClass'
          }
        },
        {
          $unwind: {
            path: '$socialClass',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: {
              classId: '$socialClass._id',
              className: '$socialClass.name',
              classLabel: '$socialClass.label'
            },
            characterCount: { $sum: 1 },
            avgFinanceSkill: { $avg: '$skills.finanza.value' },
            minFinanceSkill: { $min: '$skills.finanza.value' },
            maxFinanceSkill: { $max: '$skills.finanza.value' }
          }
        },
        {
          $sort: { '_id.classLabel': 1 }
        }
      ]);

      // Housing distribution
      const housingDistribution = await SocialClassConfig.aggregate([
        {
          $group: {
            _id: '$initialWealth.hasPrivateApartment',
            count: { $sum: 1 },
            classes: { $push: { name: '$name', label: '$label' } }
          }
        }
      ]);

      // Economic analysis
      const economicAnalysis = await SocialClassConfig.aggregate([
        {
          $group: {
            _id: null,
            totalWeeklyCredit: { $sum: '$weeklyCredit' },
            avgWeeklyCredit: { $avg: '$weeklyCredit' },
            maxWeeklyCredit: { $max: '$weeklyCredit' },
            minWeeklyCredit: { $min: '$weeklyCredit' },
            avgMinStartingCash: { $avg: '$initialWealth.minCash' },
            avgMaxStartingCash: { $avg: '$initialWealth.maxCash' },
            totalBonusItems: { $sum: { $size: '$initialWealth.bonusItems' } }
          }
        }
      ]);

      // Recent modifications
      const recentModifications = await SocialClassConfig.find({})
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('name label updatedAt')
        .lean();

      res.json(successResponse(
        {
          overview: {
            totalClasses,
            characterDistribution,
            financeDistribution,
            wealthDistribution
          },
          economics: economicAnalysis[0] || {
            totalWeeklyCredit: 0,
            avgWeeklyCredit: 0,
            maxWeeklyCredit: 0,
            minWeeklyCredit: 0,
            avgMinStartingCash: 0,
            avgMaxStartingCash: 0,
            totalBonusItems: 0
          },
          housing: housingDistribution,
          recentModifications
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching social class statistics:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching social class statistics',
        'FETCH_SOCIAL_CLASS_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get social class details by ID
   */
  static async getSocialClassDetails(req: Request<{ socialClassId: string }>, res: Response): Promise<void> {
    try {
      const { socialClassId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(socialClassId)) {
        res.status(400).json(errorResponse(
          'Invalid social class ID',
          'INVALID_SOCIAL_CLASS_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const socialClass = await SocialClassConfig.findById(socialClassId).lean();

      if (!socialClass) {
        res.status(404).json(errorResponse(
          'Social class not found',
          'SOCIAL_CLASS_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get characters in this social class
      const characters = await Character.find({
        'skills.finanza.value': {
          $gte: (socialClass as any).minFinanceSkill,
          $lte: (socialClass as any).maxFinanceSkill
        },
        status: { $ne: 'DELETED' }
      })
      .select('name surname basicInfo skills.finanza.value createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

      // Character statistics
      const characterStats = {
        total: characters.length,
        avgFinanceSkill: characters.length > 0 
          ? characters.reduce((sum, char) => sum + (char.skills?.finanza?.value || 0), 0) / characters.length 
          : 0,
        distribution: characters.reduce((acc: any, char) => {
          const financeValue = char.skills?.finanza?.value || 0;
          const range = `${Math.floor(financeValue / 10) * 10}-${Math.floor(financeValue / 10) * 10 + 9}`;
          acc[range] = (acc[range] || 0) + 1;
          return acc;
        }, {})
      };

      res.json(successResponse(
        {
          socialClass,
          characters: characters.map(char => ({
            _id: char._id,
            name: char.name,
            surname: char.surname,
            fullName: char.basicInfo?.fullName || `${char.name} ${char.surname || ''}`.trim(),
            financeSkill: char.skills?.finanza?.value || 0,
            createdAt: char.createdAt
          })),
          statistics: characterStats
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching social class details:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching social class details',
        'FETCH_SOCIAL_CLASS_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new social class configuration
   */
  static async createSocialClass(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      const {
        name,
        label,
        minFinanceSkill,
        maxFinanceSkill,
        weeklyCredit = 0,
        initialWealth,
        displayOrder = 0,
        description
      } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Social class name is required',
          'SOCIAL_CLASS_NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!label || label.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Social class label is required',
          'SOCIAL_CLASS_LABEL_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!minFinanceSkill || !maxFinanceSkill) {
        res.status(400).json(errorResponse(
          'Finance skill range (min/max) is required',
          'FINANCE_SKILL_RANGE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (minFinanceSkill > maxFinanceSkill) {
        res.status(400).json(errorResponse(
          'Minimum finance skill cannot be greater than maximum',
          'INVALID_FINANCE_SKILL_RANGE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!initialWealth || typeof initialWealth.minCash === 'undefined' || typeof initialWealth.maxCash === 'undefined') {
        res.status(400).json(errorResponse(
          'Initial wealth configuration (minCash, maxCash) is required',
          'INITIAL_WEALTH_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (initialWealth.minCash > initialWealth.maxCash) {
        res.status(400).json(errorResponse(
          'Minimum starting cash cannot be greater than maximum',
          'INVALID_INITIAL_WEALTH_RANGE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check for name conflicts
      const existingClass = await SocialClassConfig.findOne({ 
        name: new RegExp(`^${name.trim()}$`, 'i') 
      });

      if (existingClass) {
        res.status(409).json(errorResponse(
          'Social class with this name already exists',
          'SOCIAL_CLASS_NAME_EXISTS',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Check for overlapping finance skill ranges
      const overlappingClass = await SocialClassConfig.findOne({
        $or: [
          {
            $and: [
              { minFinanceSkill: { $lte: minFinanceSkill } },
              { maxFinanceSkill: { $gte: minFinanceSkill } }
            ]
          },
          {
            $and: [
              { minFinanceSkill: { $lte: maxFinanceSkill } },
              { maxFinanceSkill: { $gte: maxFinanceSkill } }
            ]
          },
          {
            $and: [
              { minFinanceSkill: { $gte: minFinanceSkill } },
              { maxFinanceSkill: { $lte: maxFinanceSkill } }
            ]
          }
        ]
      });

      if (overlappingClass) {
        res.status(409).json(errorResponse(
          `Finance skill range overlaps with existing class "${overlappingClass!.label}" (${overlappingClass!.minFinanceSkill}-${overlappingClass!.maxFinanceSkill})`,
          'FINANCE_SKILL_RANGE_OVERLAP',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Create new social class
      const socialClass = new SocialClassConfig({
        name: name.trim(),
        label: label.trim(),
        minFinanceSkill: Math.max(1, Math.min(99, minFinanceSkill)),
        maxFinanceSkill: Math.max(1, Math.min(99, maxFinanceSkill)),
        weeklyCredit: Math.max(0, weeklyCredit),
        initialWealth: {
          minCash: Math.max(0, initialWealth.minCash),
          maxCash: Math.max(0, initialWealth.maxCash),
          hasPrivateApartment: initialWealth.hasPrivateApartment === true,
          apartmentType: initialWealth.apartmentType?.trim() || undefined,
          bonusItems: Array.isArray(initialWealth.bonusItems) ? initialWealth.bonusItems : []
        },
        displayOrder,
        description: description?.trim() || undefined
      });

      await socialClass!.save();

      // Audit log
      auditLogger.logSuccess({
        userId: user._id.toString(),
        username: user.username,
        action: 'CREATE_SOCIAL_CLASS',
        resource: 'SOCIAL_CLASS',
        resourceId: socialClass._id?.toString(),
        details: { 
          socialClassId: socialClass._id, 
          name: socialClass.name, 
          label: socialClass.label,
          financeRange: `${socialClass.minFinanceSkill}-${socialClass.maxFinanceSkill}`
        },
        request: req
      });

      logger.info(`Social class created: ${socialClass.label}`, { 
        socialClassId: socialClass._id, 
        adminId: user._id 
      });

      res.status(201).json(createResponse(
        { socialClass },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error creating social class:', error);
      res.status(500).json(errorResponse(
        'Internal server error while creating social class',
        'CREATE_SOCIAL_CLASS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update a social class configuration
   */
  static async updateSocialClass(req: Request<{ socialClassId: string }>, res: Response): Promise<void> {
    try {
      const { socialClassId } = req.params;
      const { user } = req as any;
      const { reason, ...updateData } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Update reason is required',
          'UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(socialClassId)) {
        res.status(400).json(errorResponse(
          'Invalid social class ID',
          'INVALID_SOCIAL_CLASS_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const socialClass = await SocialClassConfig.findById(socialClassId);
      if (!socialClass) {
        res.status(404).json(errorResponse(
          'Social class not found',
          'SOCIAL_CLASS_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validation for finance skill range if being updated
      if (updateData.minFinanceSkill !== undefined || updateData.maxFinanceSkill !== undefined) {
        const newMin = updateData.minFinanceSkill !== undefined ? updateData.minFinanceSkill : socialClass.minFinanceSkill;
        const newMax = updateData.maxFinanceSkill !== undefined ? updateData.maxFinanceSkill : socialClass.maxFinanceSkill;

        if (newMin > newMax) {
          res.status(400).json(errorResponse(
            'Minimum finance skill cannot be greater than maximum',
            'INVALID_FINANCE_SKILL_RANGE',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }

        // Check for overlapping ranges with other classes
        const overlappingClass = await SocialClassConfig.findOne({
          _id: { $ne: socialClassId },
          $or: [
            {
              $and: [
                { minFinanceSkill: { $lte: newMin } },
                { maxFinanceSkill: { $gte: newMin } }
              ]
            },
            {
              $and: [
                { minFinanceSkill: { $lte: newMax } },
                { maxFinanceSkill: { $gte: newMax } }
              ]
            },
            {
              $and: [
                { minFinanceSkill: { $gte: newMin } },
                { maxFinanceSkill: { $lte: newMax } }
              ]
            }
          ]
        });

        if (overlappingClass) {
          res.status(409).json(errorResponse(
            `Finance skill range would overlap with existing class "${overlappingClass!.label}" (${overlappingClass!.minFinanceSkill}-${overlappingClass!.maxFinanceSkill})`,
            'FINANCE_SKILL_RANGE_OVERLAP',
            undefined,
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Validation for initial wealth if being updated
      if (updateData.initialWealth && 
          updateData.initialWealth.minCash !== undefined && 
          updateData.initialWealth.maxCash !== undefined) {
        if (updateData.initialWealth.minCash > updateData.initialWealth.maxCash) {
          res.status(400).json(errorResponse(
            'Minimum starting cash cannot be greater than maximum',
            'INVALID_INITIAL_WEALTH_RANGE',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      // Store original data for audit
      const originalData = socialClass.toObject();

      // Apply updates
      Object.keys(updateData).forEach(key => {
        if (key === 'initialWealth' && updateData[key]) {
          // Merge initialWealth changes
          socialClass!.initialWealth = {
            ...socialClass.initialWealth,
            ...updateData[key]
          };
        } else if (updateData[key] !== undefined) {
          (socialClass as any)[key] = updateData[key];
        }
      });

      // Ensure bounds on numeric values
      if (updateData.minFinanceSkill !== undefined) {
        socialClass!.minFinanceSkill = Math.max(1, Math.min(99, updateData.minFinanceSkill));
      }
      if (updateData.maxFinanceSkill !== undefined) {
        socialClass!.maxFinanceSkill = Math.max(1, Math.min(99, updateData.maxFinanceSkill));
      }
      if (updateData.weeklyCredit !== undefined) {
        socialClass!.weeklyCredit = Math.max(0, updateData.weeklyCredit);
      }

      await socialClass!.save();

      // Audit log
      auditLogger.logSuccess({
        action: 'UPDATE_SOCIAL_CLASS',
        resource: 'SOCIAL_CLASS',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          socialClassId: socialClass!._id, 
          name: socialClass!.name,
          label: socialClass!.label,
          reason: reason.trim(),
          changes: updateData 
        },
        request: req
      });

      logger.info(`Social class updated: ${socialClass!.label}`, { 
        socialClassId: socialClass!._id, 
        adminId: user._id,
        reason: reason.trim()
      });

      res.json(updateResponse(
        { socialClass },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating social class:', error);
      res.status(500).json(errorResponse(
        'Internal server error while updating social class',
        'UPDATE_SOCIAL_CLASS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a social class configuration
   */
  static async deleteSocialClass(req: Request<{ socialClassId: string }>, res: Response): Promise<void> {
    try {
      const { socialClassId } = req.params;
      const { user } = req as any;
      const { reason, forceDelete = false } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Deletion reason is required',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(socialClassId)) {
        res.status(400).json(errorResponse(
          'Invalid social class ID',
          'INVALID_SOCIAL_CLASS_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const socialClass = await SocialClassConfig.findById(socialClassId);
      if (!socialClass) {
        res.status(404).json(errorResponse(
          'Social class not found',
          'SOCIAL_CLASS_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check for characters using this social class
      const affectedCharacters = await Character.countDocuments({
        'skills.finanza.value': {
          $gte: socialClass.minFinanceSkill,
          $lte: socialClass.maxFinanceSkill
        },
        status: { $ne: 'DELETED' }
      });

      if (affectedCharacters > 0 && !forceDelete) {
        res.status(409).json(errorResponse(
          `Cannot delete social class. ${affectedCharacters} characters are currently using this class. Use forceDelete to proceed.`,
          'SOCIAL_CLASS_IN_USE',
          {
            affectedCharacters
          },
          409,
          getRequestId(req)
        ));
        return;
      }

      await socialClass.softDelete(
        user?.activeCharacterId || user?._id,
        user?.activeCharacterName || user?.username || 'Unknown Admin',
        reason.trim()
      );

      auditLogger.logSuccess({
        action: 'DELETE_SOCIAL_CLASS',
        resource: 'SOCIAL_CLASS',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          socialClassId: socialClass!._id, 
          name: socialClass!.name,
          label: socialClass!.label,
          reason: reason.trim(),
          forceDelete,
          affectedCharacters
        },
        request: req
      });

      logger.info(`Social class deleted: ${socialClass!.label}`, { 
        socialClassId: socialClass!._id, 
        adminId: user._id,
        reason: reason.trim(),
        forceDelete,
        affectedCharacters
      });

      res.json(deleteResponse(
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting social class:', error);
      res.status(500).json(errorResponse(
        'Internal server error while deleting social class',
        'DELETE_SOCIAL_CLASS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reorder social classes by updating display order
   */
  static async reorderSocialClasses(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      const { classOrders } = req.body;

      if (!Array.isArray(classOrders) || classOrders.length === 0) {
        res.status(400).json(errorResponse(
          'Class orders array is required',
          'CLASS_ORDERS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate the input
      for (const order of classOrders) {
        if (!order.socialClassId || typeof order.displayOrder !== 'number') {
          res.status(400).json(errorResponse(
            'Each class order must have socialClassId and displayOrder',
            'INVALID_CLASS_ORDER',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      let processed = 0;
      let errors: any[] = [];

      // Process each reorder request
      for (const order of classOrders) {
        try {
          const result = await SocialClassConfig.findByIdAndUpdate(
            order.socialClassId,
            { displayOrder: order.displayOrder },
            { returnDocument: 'after' }
          );

          if (result) {
            processed++;
          } else {
            errors.push({
              socialClassId: order.socialClassId,
              error: 'Social class not found'
            });
          }
        } catch (error: any) {
          errors.push({
            socialClassId: order.socialClassId,
            error: error.message
          });
        }
      }

      // Audit log
      auditLogger.logSuccess({
        action: 'REORDER_SOCIAL_CLASSES',
        resource: 'SOCIAL_CLASS',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          processed,
          errors: errors.length,
          classOrders
        },
        request: req
      });

      logger.info(`Social classes reordered`, { 
        processed,
        errors: errors.length,
        adminId: user._id
      });

      res.json(successResponse(
        {
          processed,
          errors
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error reordering social classes:', error);
      res.status(500).json(errorResponse(
        'Internal server error while reordering social classes',
        'REORDER_SOCIAL_CLASSES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get character distribution across social classes
   */
  static async getCharacterDistribution(req: Request, res: Response): Promise<void> {
    try {
      const {
        socialClassId = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 25
      } = req.query;

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Build aggregation pipeline
      const pipeline: any[] = [
        {
          $match: {
            status: status ? status : { $ne: 'DELETED' },
            'skills.finanza.value': { $exists: true }
          }
        },
        {
          $lookup: {
            from: 'socialclassconfigs',
            let: { financeValue: '$skills.finanza.value' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $lte: ['$minFinanceSkill', '$$financeValue'] },
                      { $gte: ['$maxFinanceSkill', '$$financeValue'] }
                    ]
                  }
                }
              }
            ],
            as: 'socialClass'
          }
        },
        {
          $unwind: {
            path: '$socialClass',
            preserveNullAndEmptyArrays: true
          }
        }
      ];

      // Filter by specific social class if requested
      if (socialClassId) {
        pipeline.push({
          $match: {
            'socialClass._id': new mongoose.Types.ObjectId(socialClassId as string)
          }
        });
      }

      // Add sorting
      const sortField = sortBy as string;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      pipeline.push({ $sort: { [sortField]: sortDirection } });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Character.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push({ $skip: skip }, { $limit: limitNum });

      // Add projection for cleaner output
      pipeline.push({
        $project: {
          name: 1,
          surname: 1,
          'basicInfo.fullName': 1,
          'skills.finanza.value': 1,
          status: 1,
          createdAt: 1,
          socialClass: {
            _id: '$socialClass._id',
            name: '$socialClass.name',
            label: '$socialClass.label',
            displayOrder: '$socialClass.displayOrder'
          }
        }
      });

      const characters = await Character.aggregate(pipeline);

      const totalPages = Math.ceil(total / limitNum);

      res.json(successResponse(
        {
          characters: characters.map(char => ({
            _id: char._id,
            name: char.name,
            surname: char.surname,
            fullName: char.basicInfo?.fullName || `${char.name} ${char.surname || ''}`.trim(),
            financeSkill: char.skills?.finanza?.value || 0,
            status: char.status,
            socialClass: char.socialClass || null,
            createdAt: char.createdAt
          })),
          pagination: {
            page: pageNum,
            totalPages,
            totalCount: total,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            pageSize: limitNum
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching character distribution:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching character distribution',
        'FETCH_CHARACTER_DISTRIBUTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

}