import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Skill, ISkill } from '@database/models/Skill';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import {
  translateCategory,
  reverseCategoryTranslation,
  getAllCategoriesItalian
} from '@shared/translations/skillCategories';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

export class SkillManagementController {

  /**
   * Get all skills with filtering, searching and pagination
   */
  static async getSkills(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        category = '',
        visible = '',
        defaultSkill = '',
        isPlaceholder = '',
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      // Build filter object
      const filter: any = {};
      
      // Text search
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Category filter - accept Italian, convert to English for DB query
      if (category) {
        const englishCategory = reverseCategoryTranslation(category as string);
        if (englishCategory) {
          filter.category = englishCategory;
        } else {
          // If not found in translations, try using as-is (backward compatibility)
          filter.category = category;
        }
      }

      // Visibility filter
      if (visible !== '') {
        filter.visible = visible === 'true';
      }

      // Default skill filter
      if (defaultSkill !== '') {
        filter.defaultSkill = defaultSkill === 'true';
      }

      // Placeholder filter
      if (isPlaceholder !== '') {
        filter.isPlaceholder = isPlaceholder === 'true';
      }

      // Calculate skip for pagination
      const skipCount = (Number(page) - 1) * Number(limit);

      // Sort configuration
      const sortConfig: any = {};
      sortConfig[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [skills, totalSkills] = await Promise.all([
        Skill.find(filter)
          .sort(sortConfig)
          .skip(skipCount)
          .limit(Number(limit))
          .lean(),
        Skill.countDocuments(filter)
      ]);

      // Translate categories in response
      const translatedSkills = skills.map(skill => ({
        ...skill,
        category: translateCategory(skill.category as any),
        categoryKey: skill.category // Keep original English key for editing
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(totalSkills / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPreviousPage = Number(page) > 1;

      res.json(successResponse(
        {
          skills: translatedSkills,
          pagination: {
            page: Number(page),
            totalPages,
            totalSkills,
            pageSize: Number(limit),
            hasNext: hasNextPage,
            hasPrev: hasPreviousPage
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching skills:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le abilità',
        'SKILLS_FETCH_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get skills statistics and analytics
   */
  static async getSkillStats(req: Request, res: Response): Promise<void> {
    try {
      // Aggregate skill statistics
      const [
        totalSkills,
        skillsByCategory,
        skillsByType,
        recentlyUpdated
      ] = await Promise.all([
        Skill.countDocuments(),
        Skill.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Skill.aggregate([
          {
            $group: {
              _id: null,
              visible: { $sum: { $cond: ['$visible', 1, 0] } },
              hidden: { $sum: { $cond: ['$visible', 0, 1] } },
              defaultSkills: { $sum: { $cond: ['$defaultSkill', 1, 0] } },
              specialSkills: { $sum: { $cond: ['$defaultSkill', 0, 1] } },
              placeholderSkills: { $sum: { $cond: ['$isPlaceholder', 1, 0] } },
              academicSkills: { $sum: { $cond: ['$canRollWithoutPoints', 0, 1] } }
            }
          }
        ]),
        Skill.find()
          .sort({ updatedAt: -1 })
          .limit(5)
          .select('name category updatedAt')
          .lean()
      ]);

      // Get usage statistics from characters
      const skillUsageStats = await Character.aggregate([
        { $match: { status: { $ne: 'DELETED' } } },
        { $unwind: '$skills' },
        {
          $group: {
            _id: '$skills.name',
            avgValue: { $avg: '$skills.value' },
            maxValue: { $max: '$skills.value' },
            usageCount: { $sum: 1 }
          }
        },
        { $sort: { usageCount: -1 } },
        { $limit: 10 }
      ]);

      const stats = skillsByType[0] || {
        visible: 0,
        hidden: 0,
        defaultSkills: 0,
        specialSkills: 0,
        placeholderSkills: 0,
        academicSkills: 0
      };

      res.json(successResponse(
        {
          total: totalSkills,
          byCategory: skillsByCategory.map(cat => ({
            category: cat._id,
            count: cat.count
          })),
          byType: {
            visible: stats.visible,
            hidden: stats.hidden,
            defaultSkills: stats.defaultSkills,
            specialSkills: stats.specialSkills,
            placeholderSkills: stats.placeholderSkills,
            academicSkills: stats.academicSkills
          },
          usage: skillUsageStats,
          recentlyUpdated
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching skill statistics:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche delle abilità',
        'SKILL_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed information about a specific skill
   */
  static async getSkillDetails(req: Request<{ skillId: string }>, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(skillId)) {
        res.status(400).json(errorResponse(
          'Formato ID abilità non valido',
          'INVALID_SKILL_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const skill = await Skill.findById(skillId).lean();

      if (!skill) {
        res.status(404).json(errorResponse(
          'Abilità non trovata',
          'SKILL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get usage statistics for this skill
      const usageStats = await Character.aggregate([
        { $match: { status: { $ne: 'DELETED' }, 'skills.name': Array.isArray(skill) ? '' : skill.name } },
        { $unwind: '$skills' },
        { $match: { 'skills.name': Array.isArray(skill) ? '' : skill.name } },
        {
          $group: {
            _id: null,
            totalCharacters: { $sum: 1 },
            averageValue: { $avg: '$skills.value' },
            minValue: { $min: '$skills.value' },
            maxValue: { $max: '$skills.value' },
            values: { $push: '$skills.value' }
          }
        }
      ]);

      const usage = usageStats[0] || {
        totalCharacters: 0,
        averageValue: 0,
        minValue: 0,
        maxValue: 0,
        values: []
      };

      // Calculate value distribution
      const valueDistribution = usage.values.reduce((acc: any, value: number) => {
        const range = Math.floor(value / 10) * 10;
        const key = `${range}-${range + 9}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      res.json(successResponse(
        {
          skill,
          usage: {
            totalCharacters: usage.totalCharacters,
            averageValue: Math.round(usage.averageValue * 100) / 100,
            minValue: usage.minValue,
            maxValue: usage.maxValue,
            distribution: valueDistribution
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching skill details:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli dell\'abilità',
        'SKILL_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new skill
   */
  static async createSkill(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        baseValue = 0,
        category = 'general',
        description,
        visible = true,
        defaultSkill = true,
        isPlaceholder = false,
        placeholderType,
        predefinedValues,
        canRollWithoutPoints = true
      } = req.body;

      // Validation
      if (!name || !description) {
        res.status(400).json(errorResponse(
          'Nome e descrizione sono obbligatori',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Convert Italian category to English for DB storage
      let englishCategory = category;
      if (category && category !== 'general') {
        const converted = reverseCategoryTranslation(category);
        if (converted) {
          englishCategory = converted;
        } else {
          // If not found in translations, check if it's already in English
          // (backward compatibility)
          englishCategory = category;
        }
      }

      // Check if skill with same name already exists
      const existingSkill = await Skill.findOne({ name: name.trim() });
      if (existingSkill) {
        res.status(409).json(errorResponse(
          'Esiste già un\'abilità con questo nome',
          'DUPLICATE_SKILL_NAME',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Create new skill
      const newSkill = new Skill({
        name: name.trim(),
        baseValue,
        category: englishCategory, // Store in English
        description: description.trim(),
        visible,
        defaultSkill,
        isPlaceholder,
        placeholderType: placeholderType?.trim(),
        predefinedValues: predefinedValues || [],
        canRollWithoutPoints
      });

      await newSkill.save();

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'unknown',
        username: req.user?.username || 'unknown',
        action: 'CREATE_SKILL',
        resource: 'SKILL',
        resourceId: newSkill._id.toString(),
        details: {
          skillId: newSkill._id,
          skillName: newSkill.name,
          category: newSkill.category
        },
        request: req
      });

      // Return with Italian translation
      const skillResponse = {
        ...newSkill.toObject(),
        category: translateCategory(newSkill.category as any),
        categoryKey: newSkill.category // Keep original English key
      };

      res.status(201).json(createResponse(
        {
          skill: skillResponse,
          message: 'Abilità creata con successo'
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error creating skill:', error);
      res.status(500).json(errorResponse(
        'Impossibile creare l\'abilità',
        'SKILL_CREATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update an existing skill
   */
  static async updateSkill(req: Request<{ skillId: string }>, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;
      const {
        name,
        baseValue,
        category,
        description,
        visible,
        defaultSkill,
        isPlaceholder,
        placeholderType,
        predefinedValues,
        canRollWithoutPoints,
        reason
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(skillId)) {
        res.status(400).json(errorResponse(
          'Formato ID abilità non valido',
          'INVALID_SKILL_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const skill = await Skill.findById(skillId);
      if (!skill) {
        res.status(404).json(errorResponse(
          'Abilità non trovata',
          'SKILL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check for name conflicts if name is being changed
      if (name && name.trim() !== skill.name) {
        const existingSkill = await Skill.findOne({ name: name.trim(), _id: { $ne: skillId } });
        if (existingSkill) {
          res.status(409).json(errorResponse(
            'Esiste già un\'abilità con questo nome',
            'DUPLICATE_SKILL_NAME',
            undefined,
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Store old values for audit
      const oldValues = {
        name: skill.name,
        category: skill.category,
        visible: skill.visible
      };

      // Convert Italian category to English if provided
      let englishCategory = category;
      if (category !== undefined) {
        const converted = reverseCategoryTranslation(category);
        if (converted) {
          englishCategory = converted;
        }
        // If not found in translations, use as-is (backward compatibility)
      }

      // Update skill
      if (name !== undefined) skill.name = name.trim();
      if (baseValue !== undefined) skill.baseValue = baseValue;
      if (category !== undefined) skill.category = englishCategory; // Use English category
      if (description !== undefined) skill.description = description.trim();
      if (visible !== undefined) skill.visible = visible;
      if (defaultSkill !== undefined) skill.defaultSkill = defaultSkill;
      if (isPlaceholder !== undefined) skill.isPlaceholder = isPlaceholder;
      if (placeholderType !== undefined) skill.placeholderType = placeholderType?.trim();
      if (predefinedValues !== undefined) skill.predefinedValues = predefinedValues;
      if (canRollWithoutPoints !== undefined) skill.canRollWithoutPoints = canRollWithoutPoints;

      await skill.save();

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'unknown',
        username: req.user?.username || 'unknown',
        action: 'UPDATE_SKILL',
        resource: 'SKILL',
        resourceId: skill._id.toString(),
        details: {
          skillId: skill._id,
          skillName: skill.name,
          oldValues,
          newValues: {
            name: skill.name,
            category: skill.category,
            visible: skill.visible
          },
          reason: reason || 'No reason provided'
        },
        request: req
      });

      // Return with Italian translation
      const skillResponse = {
        ...skill.toObject(),
        category: translateCategory(skill.category as any),
        categoryKey: skill.category // Keep original English key
      };

      res.json(updateResponse(
        {
          skill: skillResponse,
          message: 'Abilità aggiornata con successo'
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating skill:', error);
      res.status(500).json(errorResponse(
        'Impossibile aggiornare l\'abilità',
        'SKILL_UPDATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a skill (soft delete if in use)
   */
  static async deleteSkill(req: Request<{ skillId: string }>, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;
      const { reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(skillId)) {
        res.status(400).json(errorResponse(
          'Formato ID abilità non valido',
          'INVALID_SKILL_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const skill = await Skill.findById(skillId);
      if (!skill) {
        res.status(404).json(errorResponse(
          'Abilità non trovata',
          'SKILL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if skill is in use by characters
      const charactersUsingSkill = await Character.countDocuments({
        status: { $ne: 'DELETED' },
        'skills.name': skill.name
      });

      let inUse = false;

      if (charactersUsingSkill > 0) {
        skill.visible = false;
        await skill.save();
        inUse = true;
      } else {
        const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
        await skill.softDelete(
          auditInfo?.adminId || (req as any).user?.userId,
          auditInfo?.adminCharacterName || 'Unknown Admin',
          reason
        );
      }

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'unknown',
        username: req.user?.username || 'unknown',
        action: inUse ? 'SOFT_DELETE_SKILL' : 'DELETE_SKILL',
        resource: 'SKILL',
        resourceId: skill._id.toString(),
        details: {
          skillId: skill._id,
          skillName: skill.name,
          reason: reason || 'No reason provided',
          charactersAffected: charactersUsingSkill
        },
        request: req
      });

      res.json(deleteResponse(
        inUse 
          ? `Skill hidden (soft delete) - ${charactersUsingSkill} characters are using this skill`
          : 'Skill deleted successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting skill:', error);
      res.status(500).json(errorResponse(
        'Impossibile eliminare l\'abilità',
        'SKILL_DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk operations on multiple skills
   */
  static async bulkOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, skillIds, data, reason } = req.body;

      if (!operation || !skillIds || !Array.isArray(skillIds)) {
        res.status(400).json(errorResponse(
          'Operation e skillIds sono richiesti',
          'MISSING_BULK_PARAMS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const validSkillIds = skillIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validSkillIds.length === 0) {
        res.status(400).json(errorResponse(
          'Nessun ID abilità valido fornito',
          'INVALID_SKILL_IDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let result;
      const processedCount = validSkillIds.length;
      let successCount = 0;
      const failed: Array<{ skillId: string; error: string }> = [];

      try {
        switch (operation) {
          case 'hide':
            result = await Skill.updateMany(
              { _id: { $in: validSkillIds } },
              { visible: false }
            );
            successCount = result.modifiedCount;
            break;

          case 'show':
            result = await Skill.updateMany(
              { _id: { $in: validSkillIds } },
              { visible: true }
            );
            successCount = result.modifiedCount;
            break;

          case 'update_category':
            if (!data?.category) {
              res.status(400).json(errorResponse(
                'La categoria è richiesta per l\'operazione update_category',
                'MISSING_CATEGORY',
                undefined,
                400,
                getRequestId(req)
              ));
              return;
            }
            result = await Skill.updateMany(
              { _id: { $in: validSkillIds } },
              { category: data.category }
            );
            successCount = result.modifiedCount;
            break;

          case 'delete':
            // Check which skills are in use and can't be hard deleted
            const skillsInUse = await Character.distinct('skills.name', {
              status: { $ne: 'DELETED' },
              'skills.name': { $in: await Skill.distinct('name', { _id: { $in: validSkillIds } }) }
            });

            // Get skills to process
            const skillsToProcess = await Skill.find({ _id: { $in: validSkillIds } });

            for (const skill of skillsToProcess) {
              try {
                if (skillsInUse.includes(skill.name)) {
                  // Soft delete
                  await Skill.findByIdAndUpdate(skill._id, { visible: false });
                } else {
                  // Hard delete
                  await Skill.findByIdAndDelete(skill._id);
                }
                successCount++;
              } catch (error: any) {
                failed.push({
                  skillId: skill._id.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
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

        // Audit log
        auditLogger.logSuccess({
          userId: req.user?.userId || 'unknown',
          username: req.user?.username || 'unknown',
          action: 'BULK_SKILL_OPERATION',
          resource: 'SKILL',
          resourceId: 'bulk',
          details: {
            operation,
            skillIds: validSkillIds,
            processedCount,
            successCount,
            failedCount: failed.length,
            reason: reason || 'No reason provided'
          },
          request: req
        });

        res.json(successResponse(
          {
            operation,
            processedCount,
            successCount,
            failedCount: failed.length,
            failed
          },
          undefined,
          getRequestId(req)
        ));

      } catch (error: any) {
        logger.error('Bulk operation failed:', error);
        res.status(500).json(errorResponse(
          'Operazione bulk fallita',
          'BULK_OPERATION_FAILED',
          undefined,
          500,
          getRequestId(req)
        ));
      }

    } catch (error: any) {
      logger.error('Error in bulk operations:', error);
      res.status(500).json(errorResponse(
        'Impossibile eseguire le operazioni bulk',
        'BULK_OPERATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reorder skills within a category
   */
  static async reorderSkills(req: Request, res: Response): Promise<void> {
    try {
      const { skillOrders } = req.body; // Array of { skillId, sortOrder }

      if (!skillOrders || !Array.isArray(skillOrders)) {
        res.status(400).json(errorResponse(
          'L\'array skillOrders è richiesto',
          'MISSING_SKILL_ORDERS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Update sort orders
      const updatePromises = skillOrders.map((item: { skillId: string; sortOrder: number }) => 
        Skill.findByIdAndUpdate(
          item.skillId,
          { sortOrder: item.sortOrder },
          { returnDocument: 'after' }
        )
      );

      await Promise.all(updatePromises);

      // Audit log
      auditLogger.logSuccess({
        userId: req.user?.userId || 'unknown',
        username: req.user?.username || 'unknown',
        action: 'REORDER_SKILLS',
        resource: 'SKILL',
        resourceId: 'bulk',
        details: {
          reorderedCount: skillOrders.length,
          skillOrders
        },
        request: req
      });

      res.json(successResponse(
        {
          message: 'Skills reordered successfully',
          reorderedCount: skillOrders.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error reordering skills:', error);
      res.status(500).json(errorResponse(
        'Impossibile riordinare le abilità',
        'SKILL_REORDER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
