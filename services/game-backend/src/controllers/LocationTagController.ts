import { Request, Response } from 'express';
import { LocationTag } from '../../../database/models';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class LocationTagController {
  /**
   * Get all active tags
   * GET /game/locations/tags
   */
  static async getTags(req: Request, res: Response): Promise<void> {
    try {
      const category = req.query.category as string | undefined;
      
      const query: any = { isActive: true };
      if (category) {
        query.category = category;
      }

      const tags = await LocationTag.find(query)
        .sort({ name: 1 })
        .lean();

      res.json(successResponse(
        { tags },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location tags error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to retrieve location tags',
        'GET_TAGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new tag (admin only)
   * POST /game/locations/tags
   */
  static async createTag(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.roles?.includes('gestore')) {
        res.status(403).json(errorResponse(
          'Only administrators can create tags',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const { name, category } = req.body;

      if (!name) {
        res.status(400).json(errorResponse(
          'name is required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const tag = await LocationTag.create({
        name: name.trim().toLowerCase(),
        category: category?.trim(),
        isActive: true,
        createdBy: user._id
      });

      logger.info(`Location tag created: ${tag.name} by ${user.username}`);

      res.json(successResponse(
        { tag },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      if (err.message.includes('duplicate') || err.message.includes('E11000')) {
        res.status(409).json(errorResponse(
          'Tag already exists',
          'TAG_EXISTS',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }
      logger.error('Create location tag error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to create location tag',
        'CREATE_TAG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update a tag (admin only)
   * PATCH /game/locations/tags/:tagId
   */
  static async updateTag(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.roles?.includes('gestore')) {
        res.status(403).json(errorResponse(
          'Only administrators can update tags',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const { tagId } = req.params;
      const { name, category, isActive } = req.body;

      const tag = await LocationTag.findById(tagId);
      if (!tag) {
        res.status(404).json(errorResponse(
          'Tag not found',
          'TAG_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (name !== undefined) tag.name = name.trim().toLowerCase();
      if (category !== undefined) tag.category = category?.trim();
      if (isActive !== undefined) tag.isActive = isActive;

      await tag.save();

      logger.info(`Location tag updated: ${tagId} by ${user.username}`);

      res.json(successResponse(
        { tag },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Update location tag error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to update location tag',
        'UPDATE_TAG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a tag (admin only)
   * DELETE /game/locations/tags/:tagId
   */
  static async deleteTag(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.roles?.includes('gestore')) {
        res.status(403).json(errorResponse(
          'Only administrators can delete tags',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const { tagId } = req.params;

      const tag = await LocationTag.findByIdAndDelete(tagId);
      if (!tag) {
        res.status(404).json(errorResponse(
          'Tag not found',
          'TAG_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Location tag deleted: ${tagId} by ${user.username}`);

      res.json(successResponse(
        { deleted: true },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Delete location tag error:', {
        message: err.message,
        stack: err.stack
      });
      res.status(500).json(errorResponse(
        'Failed to delete location tag',
        'DELETE_TAG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}

