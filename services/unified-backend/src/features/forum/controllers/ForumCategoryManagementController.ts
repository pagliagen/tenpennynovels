import { Request, Response } from 'express';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { ForumCategory } from '../models/ForumCategory';
import { ForumTopic } from '../models/ForumTopic';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { logger } from '@modules/admin/utils/logger';
import { errorResponse, listResponse, createResponse, updateResponse, getRequestId, deleteResponse } from '@shared/utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';

function createSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: 'it' });
}

export class ForumCategoryManagementController {

  /**
   * GET /admin/forum-categories
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as string) || 'sortOrder';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? -1 : 1;
      const isVisible = req.query.isVisible as string;

      const filter: Record<string, unknown> = {};
      if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { slug: { $regex: escapedSearch, $options: 'i' } },
        ];
      }
      if (isVisible === 'true' || isVisible === 'false') filter.isVisible = isVisible === 'true';

      const [categories, total] = await Promise.all([
        ForumCategory.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ForumCategory.countDocuments(filter),
      ]);

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        pageSize: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };

      res.json(listResponse(
        categories.map(c => ({
          _id: c._id,
          slug: c.slug,
          title: c.title,
          description: c.description,
          sortOrder: c.sortOrder,
          isVisible: c.isVisible,
          color: c.color,
          defaultAccessRules: c.defaultAccessRules,
          createdAt: c.createdAt,
          createdBy: c.createdBy,
        })),
        pagination,
        undefined,
        getRequestId(req),
      ));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum categories list', {
        ...auditInfo,
        filters: { search, isVisible },
        currentPage: page,
        pageSize: limit,
        totalResults: total,
      });
    } catch (error: unknown) {
      logger.error('Error fetching forum categories:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare le categorie del forum',
        'FETCH_FORUM_CATEGORIES_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * GET /admin/forum-categories/:categoryId
   */
  static async getCategoryDetails(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;

      if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ success: false, error: 'ID categoria non valido', code: 'INVALID_CATEGORY_ID' });
        return;
      }

      const category = await ForumCategory.findById(categoryId).lean();
      if (!category) {
        res.status(404).json({ success: false, error: 'Categoria non trovata', code: 'CATEGORY_NOT_FOUND' });
        return;
      }

      res.json({ success: true, data: category });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum category details', { ...auditInfo, categoryId });
    } catch (error: unknown) {
      logger.error('Error fetching forum category details:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli della categoria',
        'FETCH_FORUM_CATEGORY_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * POST /admin/forum-categories
   */
  static async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, sortOrder, isVisible, color, defaultAccessRules } = req.body;

      if (!title || title.trim().length < 3) {
        res.status(400).json({ success: false, error: 'Il titolo deve avere almeno 3 caratteri', code: 'VALIDATION_ERROR' });
        return;
      }

      const slug = createSlug(title);
      const existing = await ForumCategory.findOne({ slug });
      if (existing) {
        res.status(409).json({ success: false, error: 'Esiste già una categoria con questo titolo', code: 'DUPLICATE_CATEGORY' });
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      const category = await ForumCategory.create({
        slug,
        title: title.trim(),
        description: description?.trim(),
        sortOrder: sortOrder ?? 0,
        isVisible: isVisible ?? true,
        color,
        defaultAccessRules: Array.isArray(defaultAccessRules) && defaultAccessRules.length > 0 ? defaultAccessRules : [{ type: 'public' }],
        createdAt: new Date(),
        createdBy: {
          characterId: new mongoose.Types.ObjectId(auditInfo?.adminId || 'system'),
          characterName: auditInfo?.adminCharacterName || auditInfo?.adminUsername || 'Admin',
        },
      });

      res.status(201).json(createResponse(
        {
          _id: category._id,
          slug: category.slug,
          title: category.title,
        },
        'Categoria creata con successo',
        getRequestId(req),
      ));

      logger.info('Admin created forum category', { ...auditInfo, categoryId: category._id, slug: category.slug });
    } catch (error: unknown) {
      logger.error('Error creating forum category:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile creare la categoria',
        'CREATE_FORUM_CATEGORY_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * PUT /admin/forum-categories/:categoryId
   */
  static async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
      const { title, description, sortOrder, isVisible, color, defaultAccessRules } = req.body;

      if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ success: false, error: 'ID categoria non valido', code: 'INVALID_CATEGORY_ID' });
        return;
      }

      const category = await ForumCategory.findById(categoryId);
      if (!category) {
        res.status(404).json({ success: false, error: 'Categoria non trovata', code: 'CATEGORY_NOT_FOUND' });
        return;
      }

      const update: Record<string, unknown> = {};
      if (title !== undefined) {
        const trimmedTitle = title.trim();
        if (trimmedTitle.length < 3) {
          res.status(400).json({ success: false, error: 'Il titolo deve avere almeno 3 caratteri', code: 'VALIDATION_ERROR' });
          return;
        }
        update.title = trimmedTitle;
        const newSlug = createSlug(trimmedTitle);
        if (newSlug !== category.slug) {
          const slugExists = await ForumCategory.findOne({ slug: newSlug, _id: { $ne: category._id } });
          if (slugExists) {
            res.status(409).json({ success: false, error: 'Esiste già una categoria con questo titolo', code: 'DUPLICATE_SLUG' });
            return;
          }
          update.slug = newSlug;
        }
      }
      if (description !== undefined) update.description = description?.trim();
      if (sortOrder !== undefined) update.sortOrder = sortOrder;
      if (isVisible !== undefined) update.isVisible = isVisible;
      if (color !== undefined) update.color = color;
      if (defaultAccessRules !== undefined) update.defaultAccessRules = defaultAccessRules;

      const updated = await ForumCategory.findByIdAndUpdate(categoryId, { $set: update }, { new: true }).lean();

      if (!updated) {
        res.status(404).json({ success: false, error: 'Categoria non trovata dopo aggiornamento', code: 'CATEGORY_NOT_FOUND' });
        return;
      }

      // Keep the denormalized categorySlug on topics in sync if the slug changed
      if (update.slug) {
        await ForumTopic.updateMany({ categoryId: updated._id }, { $set: { categorySlug: updated.slug } });
      }

      res.json(updateResponse(
        {
          _id: updated._id,
          slug: updated.slug,
          title: updated.title,
        },
        'Categoria aggiornata con successo',
        getRequestId(req),
      ));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin updated forum category', { ...auditInfo, categoryId, changes: Object.keys(update) });
    } catch (error: unknown) {
      logger.error('Error updating forum category:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la categoria',
        'UPDATE_FORUM_CATEGORY_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * DELETE /admin/forum-categories/:categoryId
   *
   * Topics under the category are NOT cascade-deleted: they're orphaned back
   * to "uncategorized" (categoryId/categorySlug unset) so no forum content is
   * ever lost by removing an organizational grouping.
   */
  static async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;

      if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ success: false, error: 'ID categoria non valido', code: 'INVALID_CATEGORY_ID' });
        return;
      }

      const category = await ForumCategory.findById(categoryId);
      if (!category) {
        res.status(404).json({ success: false, error: 'Categoria non trovata', code: 'CATEGORY_NOT_FOUND' });
        return;
      }

      const { modifiedCount } = await ForumTopic.updateMany(
        { categoryId: category._id },
        { $unset: { categoryId: '', categorySlug: '' } }
      );

      await ForumCategory.deleteOne({ _id: category._id });

      res.json(deleteResponse('Categoria eliminata con successo. Gli argomenti associati restano non categorizzati.', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin deleted forum category', {
        ...auditInfo,
        categoryId,
        slug: category.slug,
        orphanedTopics: modifiedCount,
      });
    } catch (error: unknown) {
      logger.error('Error deleting forum category:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile eliminare la categoria',
        'DELETE_FORUM_CATEGORY_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
