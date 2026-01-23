import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { listResponse, errorResponse, getRequestId } from '../utils/apiResponse';

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
      const db = mongoose.connection.db;
      if (!db) {
        logger.error('🏢 OccupationController: Database not connected');
        res.status(500).json(errorResponse(
          'Database connection not available',
          'DATABASE_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
        return;
      }

      // Fetch all occupations from the database
      const occupations = await db.collection('occupations').find({}).toArray();
      
      logger.info(`🏢 OccupationController: Found ${occupations.length} occupations`);

      // Return the occupations array
      const mappedOccupations = occupations.map(occupation => ({
        id: occupation._id.toString(),
        name: occupation.name,
        description: occupation.description,
        allowedGenders: occupation.allowedGenders || [],
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

      res.json(listResponse(
        mappedOccupations,
        {
          page: 1,
          pageSize: mappedOccupations.length,
          total: mappedOccupations.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('🏢 OccupationController: Error fetching occupations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      res.status(500).json(errorResponse(
        'Errore interno del server durante il recupero delle occupazioni',
        'OCCUPATIONS_ERROR',
        process.env.NODE_ENV === 'development' ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get occupations filtered by gender and social class
   * This is useful for the character wizard to show only relevant occupations
   */
  static async getFilteredOccupations(req: Request, res: Response): Promise<void> {
    try {
      const { gender, socialClass } = req.query;
      
      logger.info(`🏢 OccupationController: Fetching occupations filtered by gender: ${gender}, socialClass: ${socialClass}`);

      const db = mongoose.connection.db;
      if (!db) {
        logger.error('🏢 OccupationController: Database not connected');
        res.status(500).json(errorResponse(
          'Database connection not available',
          'DATABASE_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
        return;
      }

      // Build filter query
      const filter: any = {};
      
      if (gender) {
        filter.$or = [
          { allowedGenders: { $in: [gender] } },
          { allowedGenders: { $exists: false } },
          { allowedGenders: { $size: 0 } }
        ];
      }

      if (socialClass) {
        filter.socialClass = { $in: [socialClass] };
      }

      // Fetch filtered occupations
      const occupations = await db.collection('occupations').find(filter).toArray();
      
      logger.info(`🏢 OccupationController: Found ${occupations.length} filtered occupations`);

      const mappedOccupations = occupations.map(occupation => ({
        id: occupation._id.toString(),
        name: occupation.name,
        description: occupation.description,
        allowedGenders: occupation.allowedGenders || [],
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

      res.json(listResponse(
        mappedOccupations,
        {
          page: 1,
          pageSize: mappedOccupations.length,
          total: mappedOccupations.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('🏢 OccupationController: Error fetching filtered occupations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        gender: req.params?.gender,
        query: req.query,
        params: req.params
      });
      res.status(500).json(errorResponse(
        'Errore interno del server durante il recupero delle occupazioni filtrate',
        'OCCUPATIONS_FILTERED_ERROR',
        process.env.NODE_ENV === 'development' ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}