import { LocationActionCache, LocationActionCacheSchema } from '../models/LocationActionCache';
import { logger } from '../utils/logger';

export interface ActionsByCharacter {
  characterId: string;
  characterName: string;
  actions: Array<{
    actionId: string;
    content: string;
    timestamp: Date;
    tags?: string[];
  }>;
}

/**
 * ActionHistoryService manages retrieval of historical actions
 * for providing context to bot responses
 */
export class ActionHistoryService {
  /**
   * Get recent actions grouped by character
   * Example: last 2 actions of character A, last 2 of character B, etc.
   */
  async getRecentActionsByCharacter(
    locationId: string,
    charactersLimit: number = 5,
    actionsPerCharacter: number = 2,
    dbContext?: any
  ): Promise<ActionsByCharacter[]> {
    try {
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;
      // MongoDB aggregation pipeline
      const pipeline = [
        // Filter by location and public visibility
        {
          $match: {
            locationId,
            visibility: 'public' // Only public actions
          }
        },
        // Sort by timestamp DESC
        {
          $sort: { timestamp: -1 as -1 }
        },
        // Group by characterId and collect actions
        {
          $group: {
            _id: '$characterId',
            characterName: { $first: '$characterName' },
            actions: {
              $push: {
                actionId: '$actionId',
                content: '$content',
                timestamp: '$timestamp',
                tags: '$tags'
              }
            }
          }
        },
        // Limit actions per character
        {
          $project: {
            characterId: '$_id',
            characterName: 1,
            actions: { $slice: ['$actions', actionsPerCharacter] }
          }
        },
        // Limit number of characters
        {
          $limit: charactersLimit
        }
      ];

      const results = await LocationActionCacheModel.aggregate(pipeline);

      const formatted: ActionsByCharacter[] = results.map((r: any) => ({
        characterId: r.characterId,
        characterName: r.characterName,
        actions: r.actions
      }));

      logger.debug(`[ActionHistory] Retrieved ${formatted.length} characters with recent actions`);

      return formatted;

    } catch (error) {
      logger.error('[ActionHistory] Error getting recent actions by character:', error);
      return [];
    }
  }

  /**
   * Get recent actions in a location (timeline view)
   */
  async getRecentActions(
    locationId: string,
    limit: number = 10,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;

      const actions = await LocationActionCacheModel.find({
        locationId,
        visibility: 'public'
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return actions.reverse(); // Chronological order

    } catch (error) {
      logger.error('[ActionHistory] Error getting recent actions:', error);
      return [];
    }
  }

  /**
   * Get actions from a specific gaming session
   */
  async getSessionActions(
    sessionId: string,
    limit: number = 50,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;

      const actions = await LocationActionCacheModel.find({
        sessionId,
        visibility: 'public'
      })
        .sort({ timestamp: 1 }) // Chronological order
        .limit(limit)
        .lean();

      logger.debug(`[ActionHistory] Retrieved ${actions.length} actions for session ${sessionId}`);

      return actions;

    } catch (error) {
      logger.error('[ActionHistory] Error getting session actions:', error);
      return [];
    }
  }

  /**
   * Get actions by specific character in location
   */
  async getCharacterActions(
    locationId: string,
    characterId: string,
    limit: number = 10,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;

      const actions = await LocationActionCacheModel.find({
        locationId,
        characterId,
        visibility: 'public'
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return actions.reverse(); // Chronological order

    } catch (error) {
      logger.error('[ActionHistory] Error getting character actions:', error);
      return [];
    }
  }

  /**
   * Get recent actions grouped by tag for multi-tag context
   * Used by AI bot selection to analyze actions across different zones
   */
  async getRecentActionsByTag(
    locationId: string,
    sessionId?: string,
    limit: number = 10,
    dbContext?: any
  ): Promise<Array<{
    tag: string;
    actions: any[];
  }>> {
    try {
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;
      const query: any = {
        locationId,
        visibility: 'public'
      };

      if (sessionId) {
        query.sessionId = sessionId;
      }

      // MongoDB aggregation pipeline to group by tag
      const pipeline = [
        // Filter by location and session
        {
          $match: query
        },
        // Sort by timestamp DESC
        {
          $sort: { timestamp: -1 as -1 }
        },
        // Limit to recent actions (before grouping)
        {
          $limit: limit * 5 // Get more to ensure coverage across tags
        },
        // Group by tags field
        {
          $group: {
            _id: '$tags',
            actions: {
              $push: {
                actionId: '$actionId',
                characterId: '$characterId',
                characterName: '$characterName',
                content: '$content',
                timestamp: '$timestamp',
                tags: '$tags'
              }
            }
          }
        },
        // Project and slice to limit actions per tag
        {
          $project: {
            _id: 0,
            tag: { $ifNull: ['$_id', 'default'] }, // Default tag if null/empty
            actions: { $slice: ['$actions', limit] }
          }
        },
        // Sort by most recent action in each tag
        {
          $sort: { 'actions.0.timestamp': -1 as -1 }
        }
      ];

      const results = await LocationActionCacheModel.aggregate(pipeline);

      logger.debug(`[ActionHistory] Retrieved actions from ${results.length} tags for location ${locationId}`);

      return results.map((r: any) => ({
        tag: r.tag || 'default',
        actions: r.actions
      }));

    } catch (error) {
      logger.error('[ActionHistory] Error getting actions by tag:', error);
      return [];
    }
  }
}

export const actionHistoryService = new ActionHistoryService();
