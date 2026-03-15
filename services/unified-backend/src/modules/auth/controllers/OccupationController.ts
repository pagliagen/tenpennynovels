import { Request, Response } from 'express';
import { db } from '@database/models';
import { logger } from '../logger';
import { successResponse, errorResponse, listResponse } from '../utils/apiResponse';
import { appConfig } from '@config/runtime';

/**
 * Controller for occupation-related endpoints
 * This provides read-only access to occupation data for the frontend
 */
export class OccupationController {
  /**
   * Get all occupations available in the system
   * This endpoint is used by the landing page for the occupation dropdown
   * and by the character wizard for occupation selection
   */
  static async getAllOccupations(req: Request, res: Response): Promise<void> {
    try {
      logger.info('🏢 OccupationController: Fetching all occupations');

      // Access the occupations collection directly
      const database = db.getConnection().db;
      if (!database) {
        logger.error('🏢 OccupationController: Database not connected');
        errorResponse(res, 
          'Database connection not available',
          'DATABASE_ERROR',
          undefined,
          500);
        return;
      }

      // Fetch all occupations from the database
      const occupations = await database.collection('occupations').find({}).toArray();
      
      logger.info(`🏢 OccupationController: Found ${occupations.length} occupations`);

      // Return the occupations array
      const mappedOccupations = occupations.map(occupation => ({
        id: occupation._id.toString(),
        name: occupation.name,
        description: occupation.description,
        socialClass: occupation.socialClass || [],
        dailySalary: occupation.dailySalary || 0,
        socialRespectability: occupation.socialRespectability || 0,
        category: occupation.category || 'Other',
        prerequisites: occupation.prerequisites || {},
        benefits: occupation.benefits || {},
        workingConditions: occupation.workingConditions || '',
        rarity: occupation.rarity || 'common',
        startingItems: occupation.startingItems || []
      }));

      listResponse(res, 
        mappedOccupations,
        {
          currentPage: 1,
          pageSize: mappedOccupations.length,
          total: mappedOccupations.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        undefined);

    } catch (error: any) {
      logger.error('🏢 OccupationController: Error fetching occupations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      errorResponse(res, 
        'Errore interno del server durante il recupero delle occupazioni',
        'OCCUPATIONS_ERROR',
        !appConfig.isProduction ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500);
    }
  }

  /**
   * Get occupations filtered by social class
   * This is useful for the character wizard to show only relevant occupations
   */
  static async getFilteredOccupations(req: Request, res: Response): Promise<void> {
    try {
      const { socialClass } = req.query;
      
      logger.info(`🏢 OccupationController: Fetching occupations filtered by socialClass: ${socialClass}`);

      const database = db.getConnection().db;
      if (!database) {
        logger.error('🏢 OccupationController: Database not connected');
        errorResponse(res, 
          'Database connection not available',
          'DATABASE_ERROR',
          undefined,
          500);
        return;
      }

      // Build filter query
      const filter: any = {};

      if (socialClass) {
        filter.socialClass = { $in: [socialClass] };
      }

      // Fetch filtered occupations
      const occupations = await database.collection('occupations').find(filter).toArray();
      
      logger.info(`🏢 OccupationController: Found ${occupations.length} filtered occupations`);

      const mappedOccupations = occupations.map(occupation => ({
        id: occupation._id.toString(),
        name: occupation.name,
        description: occupation.description,
        socialClass: occupation.socialClass || [],
        dailySalary: occupation.dailySalary || 0,
        socialRespectability: occupation.socialRespectability || 0,
        category: occupation.category || 'Other',
        prerequisites: occupation.prerequisites || {},
        benefits: occupation.benefits || {},
        workingConditions: occupation.workingConditions || '',
        rarity: occupation.rarity || 'common',
        startingItems: occupation.startingItems || []
      }));

      listResponse(res, 
        mappedOccupations,
        {
          currentPage: 1,
          pageSize: mappedOccupations.length,
          total: mappedOccupations.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        undefined);

    } catch (error: any) {
      logger.error('🏢 OccupationController: Error fetching filtered occupations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        gender: req.params?.gender,
        query: req.query,
        params: req.params
      });
      errorResponse(res, 
        'Errore interno del server durante il recupero delle occupazioni filtrate',
        'OCCUPATIONS_FILTERED_ERROR',
        !appConfig.isProduction ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500);
    }
  }
}