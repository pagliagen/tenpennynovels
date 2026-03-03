import { Request, Response } from 'express';
import { LocationAction } from '@database/models/LocationAction';
import { Location } from '@database/models/Location';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { listResponse, successResponse, errorResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class LocationActionManagementController {

  static async getLocationActions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        locationId, 
        actionType, 
        characterId,
        visibility,
        startDate,
        endDate,
        page = 1, 
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      // Build filter
      const filter: any = {};
      
      if (locationId) filter.locationId = locationId;
      if (actionType) filter.actionType = actionType;
      if (characterId) filter.characterId = characterId;
      if (visibility) filter.visibility = visibility;
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate as string);
        if (endDate) filter.timestamp.$lte = new Date(endDate as string);
      }

      // Build sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const actions = await LocationAction.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await LocationAction.countDocuments(filter);

      // Get location and character info for actions
      const actionsWithDetails = await Promise.all(actions.map(async (action) => {
        const location = await Location.findById(action.locationId).select('name type');
        const character = await Character.findById(action.characterId).select('name surname status gameplayRoles');

        return {
          id: action._id,
          actionType: action.actionType,
          content: action.content,
          timestamp: action.timestamp,
          visibility: action.visibility,
          
          character: character ? {
            id: character._id,
            name: character.name,
            surname: character.surname,
            status: character.status,
            gameplayRoles: character.gameplayRoles
          } : {
            id: action.characterId,
            name: action.characterName,
            surname: action.characterSurname,
            status: 'unknown'
          },
          
          location: location ? {
            id: location._id,
            name: location.name,
            type: location.type
          } : {
            id: action.locationId,
            name: 'Unknown Location'
          },

          // Additional details based on action type
          diceResult: action.diceResult,
          itemEffect: action.itemEffect,
          targetCharacters: action.targetCharacters,
          characterRoles: action.characterRoles
        };
      }));

      logger.info('Location actions retrieved', {
        total,
        page: Number(page),
        pageSize: Number(limit),
        filters: { locationId, actionType, characterId, visibility }
      });

      const pagination = {
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        pageSize: Number(limit),
        hasNextPage: Number(page) < Math.ceil(total / Number(limit)),
        hasPrevPage: page > 1
      };

      res.json(listResponse(
        actionsWithDetails,
        pagination,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving location actions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_LOCATION_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getLocationActionStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '7d', locationId } = req.query;
      
      // Calculate time range
      const now = new Date();
      let startTime = new Date();
      
      switch (timeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          break;
        case '24h':
          startTime.setHours(now.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          break;
        default:
          startTime.setDate(now.getDate() - 7);
      }

      const matchFilter: any = {
        timestamp: { $gte: startTime }
      };
      
      if (locationId) matchFilter.locationId = locationId;

      // Action type breakdown
      const actionTypeStats = await LocationAction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$actionType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Visibility breakdown
      const visibilityStats = await LocationAction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$visibility',
            count: { $sum: 1 }
          }
        }
      ]);

      // Most active locations
      const locationStats = await LocationAction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$locationId',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'locations',
            localField: '_id',
            foreignField: '_id',
            as: 'location'
          }
        },
        { $unwind: '$location' },
        {
          $project: {
            locationId: '$_id',
            locationName: '$location.name',
            locationType: '$location.type',
            actionCount: '$count'
          }
        }
      ]);

      // Most active characters
      const characterStats = await LocationAction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$characterId',
            count: { $sum: 1 },
            characterName: { $first: '$characterName' },
            characterSurname: { $first: '$characterSurname' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            characterId: '$_id',
            characterName: { $concat: ['$characterName', ' ', { $ifNull: ['$characterSurname', ''] }] },
            actionCount: '$count'
          }
        }
      ]);

      // Hourly activity pattern
      const hourlyActivity = await LocationAction.aggregate([
        { $match: matchFilter },
        {
          $project: {
            hour: { $hour: '$timestamp' }
          }
        },
        {
          $group: {
            _id: '$hour',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const statistics = {
        timeRange,
        totalActions: await LocationAction.countDocuments(matchFilter),
        actionTypeBreakdown: actionTypeStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        visibilityBreakdown: visibilityStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        mostActiveLocations: locationStats,
        mostActiveCharacters: characterStats,
        hourlyActivity: hourlyActivity.map(h => ({
          hour: h._id,
          count: h.count
        })),
        insights: {
          averageActionsPerDay: Math.ceil(
            await LocationAction.countDocuments(matchFilter) / 
            Math.max(1, Math.ceil((now.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24)))
          ),
          peakHour: hourlyActivity.length > 0 ? 
            hourlyActivity.reduce((max, curr) => curr.count > max.count ? curr : max)._id : 
            null
        }
      };

      logger.info('Location action statistics retrieved', {
        timeRange,
        totalActions: statistics.totalActions,
        locationId
      });

      res.json(successResponse(
        { statistics },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving location action statistics:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_LOCATION_ACTION_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async deleteLocationAction(req: Request<{ actionId: string }>, res: Response): Promise<void> {
    try {
      const { actionId } = req.params;
      const { reason } = req.body;

      const action = await LocationAction.findById(actionId);
      if (!action) {
        res.status(404).json(errorResponse(
          'Location action not found',
          'LOCATION_ACTION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get additional details for audit log
      const location = await Location.findById(action.locationId).select('name');
      const character = await Character.findById(action.characterId).select('name surname');

      await LocationAction.findByIdAndDelete(actionId);

      // Audit log
      auditLogger.logSuccess({
        action: 'LOCATION_ACTION_DELETED',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'LOCATION_ACTION',
        resourceId: actionId,
        details: {
          actionType: action!.actionType,
          content: action!.content.substring(0, 100),
          characterId: action!.characterId,
          characterName: character ? `${character.name} ${character.surname}` : action!.characterName,
          locationId: action!.locationId,
          locationName: location?.name || 'Unknown',
          reason: reason || 'Action deleted by admin',
          originalTimestamp: action!.timestamp
        },
      });

      logger.info('Location action deleted', {
        actionId,
        actionType: action!.actionType,
        characterId: action!.characterId,
        locationId: action!.locationId,
        adminId: req.user?.userId,
        reason
      });

      res.json(deleteResponse(
        'Location action deleted successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting location action:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'DELETE_LOCATION_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async bulkDeleteLocationActions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        locationId, 
        characterId, 
        actionType, 
        startDate, 
        endDate,
        reason 
      } = req.body;

      if (!locationId && !characterId && !actionType && !startDate && !endDate) {
        res.status(400).json(errorResponse(
          'At least one filter criteria is required for bulk deletion',
          'BULK_DELETE_FILTER_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Build filter for bulk delete
      const filter: any = {};
      if (locationId) filter.locationId = locationId;
      if (characterId) filter.characterId = characterId;
      if (actionType) filter.actionType = actionType;
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      // Count actions to be deleted
      const actionCount = await LocationAction.countDocuments(filter);
      
      if (actionCount === 0) {
        res.json(successResponse(
          {
            message: 'No actions found matching the criteria',
            deletedCount: 0
          },
          undefined,
          getRequestId(req)
        ));
        return;
      }

      // Perform bulk delete
      const deleteResult = await LocationAction.deleteMany(filter);

      // Audit log
      auditLogger.logSuccess({
        action: 'LOCATION_ACTIONS_BULK_DELETED',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'LOCATION_ACTION',
        resourceId: 'bulk',
        details: {
          deletedCount: deleteResult.deletedCount,
          filter,
          reason: reason || 'Bulk deletion by admin'
        },
      });

      logger.info('Bulk location actions deleted', {
        deletedCount: deleteResult.deletedCount,
        filter,
        adminId: req.user?.userId,
        reason
      });

      res.json(deleteResponse(
        `Successfully deleted ${deleteResult.deletedCount} location actions`,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error bulk deleting location actions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'BULK_DELETE_LOCATION_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getLocationActionTypes(req: Request, res: Response): Promise<void> {
    try {
      // Get all action types with counts and descriptions
      const actionTypes = await LocationAction.aggregate([
        {
          $group: {
            _id: '$actionType',
            count: { $sum: 1 },
            latestAction: { $max: '$timestamp' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const actionTypeDescriptions: Record<string, string> = {
        'standard': 'Regular character actions and roleplay',
        'master': 'Master/Game Master actions and narration',
        'moderation': 'Moderation actions by staff',
        'whisper': 'Private messages between characters',
        'ooc': 'Out of character communication',
        'dice_roll': 'Dice roll actions and results',
        'skill_check': 'Skill check attempts and results',
        'stat_check': 'Attribute check attempts and results',
        'item_use': 'Item usage and effects'
      };

      const formattedActionTypes = actionTypes.map(type => ({
        actionType: type._id,
        count: type.count,
        latestAction: type.latestAction,
        description: actionTypeDescriptions[type._id] || 'Unknown action type'
      }));

      res.json(successResponse(
        {
          actionTypes: formattedActionTypes,
          totalTypes: actionTypes.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving action types:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'GET_ACTION_TYPES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async exportLocationActions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        locationId, 
        startDate, 
        endDate, 
        actionType,
        format = 'json'
      } = req.query;

      // Build filter
      const filter: any = {};
      if (locationId) filter.locationId = locationId;
      if (actionType) filter.actionType = actionType;
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate as string);
        if (endDate) filter.timestamp.$lte = new Date(endDate as string);
      }

      const actions = await LocationAction.find(filter)
        .sort({ timestamp: 1 })
        .limit(10000); // Limit for performance

      const exportData = actions.map(action => ({
        id: action._id,
        actionType: action.actionType,
        characterId: action.characterId,
        characterName: action.characterName,
        characterSurname: action.characterSurname,
        content: action.content,
        locationId: action.locationId,
        timestamp: action.timestamp,
        visibility: action.visibility,
        diceResult: action.diceResult,
        itemEffect: action.itemEffect,
        targetCharacters: action.targetCharacters,
        characterRoles: action.characterRoles
      }));

      // Audit log
      auditLogger.logSuccess({
        action: 'LOCATION_ACTIONS_EXPORTED',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'LOCATION_ACTION',
        resourceId: 'export',
        details: {
          exportedCount: exportData.length,
          filter,
          format
        },
      });

      logger.info('Location actions exported', {
        exportedCount: exportData.length,
        filter,
        format,
        adminId: req.user?.userId
      });

      if (format === 'csv') {
        // Simple CSV export
        const headers = 'ID,Action Type,Character,Content,Location ID,Timestamp,Visibility\n';
        const csvData = exportData.map(action => 
          `"${action.id}","${action.actionType}","${action.characterName} ${action.characterSurname || ''}","${action.content.replace(/"/g, '""')}","${action.locationId}","${action.timestamp}","${action.visibility}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="location_actions.csv"');
        res.send(headers + csvData);
      } else {
        // JSON export
        res.json(successResponse(
          {
            actions: exportData,
            exportInfo: {
              totalActions: exportData.length,
              exportDate: new Date(),
              filter
            }
          },
          undefined,
          getRequestId(req)
        ));
      }

    } catch (error: any) {
      logger.error('Error exporting location actions:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'EXPORT_LOCATION_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
