import { Request, Response } from 'express';
import {
  ApiResponse,
  LocationManagement,
  LocationSettingsUpdate,
  LocationActivity,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { Location } from '../../../database/models/Location';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class LocationManagementController {
  /**
   * Get list of all locations with management info
   * GET /admin/locations
   */
  static async getLocations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const pageSize = parseInt(req.query.pageSize as string) || limit;
      const district = req.query.district as string;
      const showHidden = req.query.showHidden === 'true';
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = req.query.sortOrder as string || 'asc';

      // Build query filters
      const query: any = {};

      // District filter
      if (district) {
        query.district = district;
      }

      // Visibility filter
      if (!showHidden) {
        query['settings.visible'] = true;
      }

      // Count total items for pagination
      const totalItems = await Location.countDocuments(query);
      const totalPages = Math.ceil(totalItems / pageSize);

      // Build sort object - simple sort by name for hierarchical display
      const sort: any = { name: sortOrder === 'asc' ? 1 : -1 };

      // Execute query WITHOUT pagination (needed for hierarchical tree building in frontend)
      const locations = await Location.find(query)
        .sort(sort)
        .populate('createdBy', 'username')
        .populate('lastModifiedBy', 'username')
        .populate('parentLocation', 'name')
        .lean();

      // Transform to LocationManagement format
      const transformedLocations: LocationManagement[] = locations.map((loc: any) => {
        // Calculate average stay time
        const avgStayMinutes = loc.statistics?.averageStayTime || 0;
        const avgStayTime = avgStayMinutes >= 60
          ? `${Math.floor(avgStayMinutes / 60)}h ${avgStayMinutes % 60}m`
          : `${avgStayMinutes}m`;

        return {
          id: loc._id.toString(),
          name: loc.name,
          slug: loc.slug,
          district: loc.district,
          description: loc.description,
          locationLevel: loc.locationLevel,
          parentLocation: loc.parentLocation?._id?.toString() || loc.parentLocation?.toString(),
          parentLocationName: loc.parentLocation?.name || null,
          sortOrder: loc.sortOrder,
          settings: {
            visible: loc.settings?.visible ?? true,
            chat: loc.settings?.chat ?? true,
            shop: loc.settings?.shop ?? false,
            private: loc.settings?.private ?? false
          },
          statistics: {
            totalVisits: loc.statistics?.totalVisits || 0,
            uniqueVisitors: loc.statistics?.uniqueVisitors || 0,
            currentOccupants: loc.occupants?.length || 0,
            averageStayTime: avgStayTime,
            messagesExchanged: loc.statistics?.messagesExchanged || 0
          },
          management: {
            createdBy: loc.createdBy?.username || 'system',
            lastModified: loc.updatedAt?.toISOString() || loc.createdAt?.toISOString(),
            modifiedBy: loc.lastModifiedBy?.username || loc.createdBy?.username || 'system'
          }
        };
      });

      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        limit: pageSize,
        hasMore: page < totalPages
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed locations list', {
        ...auditInfo,
        filters: { district, showHidden, sortBy, sortOrder },
        page,
        pageSize,
        totalItems
      });

      res.json(successResponse(
        {
          locations: transformedLocations,
          pagination
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching locations:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le location',
        'FETCH_LOCATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed location information
   * GET /admin/locations/:locationId
   */
  static async getLocationDetails(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;

      // TODO: Implement database query
      const mockLocation: LocationManagement = {
        id: locationId,
        name: 'Whitechapel Hospital',
        district: 'Whitechapel',
        description: 'A Victorian-era hospital serving the poor of East London',
        settings: {
          visible: true,
          chat: true,
          shop: false,
          private: false
        },
        statistics: {
          totalVisits: 450,
          uniqueVisitors: 89,
          currentOccupants: 3,
          averageStayTime: '45m',
          messagesExchanged: 1250
        },
        management: {
          createdBy: 'system',
          lastModified: '2024-01-15T10:00:00Z',
          modifiedBy: 'admin1'
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location details', {
        ...auditInfo,
        locationId,
        locationName: mockLocation.name
      });

      res.json(successResponse(
        mockLocation,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching location details:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli della location',
        'FETCH_LOCATION_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update location settings
   * PATCH /admin/locations/:locationId/settings
   */
  static async updateLocationSettings(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const updates: LocationSettingsUpdate = req.body;

      // Validate required reason
      if (!updates.reason || updates.reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'aggiornamento è richiesto',
          'UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement location settings update
      // - Update location in database
      // - Create audit log entry
      // - Publish Redis event for real-time updates
      // - Notify affected users if visibility changed

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Location settings updated by admin', {
        ...auditInfo,
        locationId,
        updates: {
          visible: updates.visible,
          chat: updates.chat,
          shop: updates.shop,
          private: updates.private,
          description: updates.description,
          reason: updates.reason
        },
        category: 'location_management'
      });

      // TODO: Send Redis event
      // await redisClient.publish('location:settings_updated', {
      //   locationId,
      //   updates,
      //   updatedBy: req.user?.userId,
      //   timestamp: new Date().toISOString()
      // });

      res.json(updateResponse(
        {
          locationId,
          action: 'settings_updated'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating location settings:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare le impostazioni della location',
        'UPDATE_LOCATION_SETTINGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get location activity and visitor analytics
   * GET /admin/locations/:locationId/activity
   */
  static async getLocationActivity(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const period = req.query.period as string || '7d';

      // TODO: Implement database query for location activity
      const mockActivity: LocationActivity = {
        visits: {
          totalVisits: 450,
          uniqueVisitors: 89,
          averageStayTime: '45m',
          peakHours: ['14:00', '15:00', '20:00', '21:00']
        },
        communication: {
          messagesExchanged: 1250,
          averageMessagesPerVisit: 2.8,
          activeConversations: 12,
          npcsActivated: 5
        },
        visitors: [
          {
            characterId: 'char1',
            characterName: 'John Smith',
            visitCount: 15,
            totalTimeSpent: '8h 45m',
            messagesPosted: 89,
            lastVisit: '2024-01-15T14:30:00Z'
          },
          {
            characterId: 'char2',
            characterName: 'Mary Watson',
            visitCount: 8,
            totalTimeSpent: '3h 20m',
            messagesPosted: 45,
            lastVisit: '2024-01-14T18:15:00Z'
          }
        ],
        timeline: [
          {
            date: '2024-01-15',
            visits: 25,
            messages: 78,
            uniqueVisitors: 12
          },
          {
            date: '2024-01-14',
            visits: 18,
            messages: 45,
            uniqueVisitors: 9
          }
        ]
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location activity', {
        ...auditInfo,
        locationId,
        period
      });

      res.json(successResponse(
        mockActivity,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching location activity:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare l\'attività della location',
        'FETCH_LOCATION_ACTIVITY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new location
   * POST /admin/locations
   */
  static async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const { name, district, description, settings } = req.body;

      // Validate required fields
      if (!name || name.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il nome della location è richiesto',
          'LOCATION_NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!district || district.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il distretto è richiesto',
          'DISTRICT_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement location creation
      // - Create location in database
      // - Set default settings
      // - Create audit log entry
      // - Publish Redis event

      const newLocationId = 'loc_' + Date.now();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('New location created by admin', {
        ...auditInfo,
        locationId: newLocationId,
        locationName: name,
        district,
        settings,
        category: 'location_management'
      });

      res.status(201).json(createResponse(
        {
          locationId: newLocationId,
          action: 'location_created'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error creating location:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Impossibile creare la location',
        'CREATE_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a location
   * DELETE /admin/locations/:locationId
   */
  static async deleteLocation(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const { reason, forceDelete } = req.body;

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

      // TODO: Implement location deletion
      // - Check if location has active users (unless forceDelete)
      // - Move users to safe location if forced
      // - Delete location from database
      // - Create audit log entry
      // - Publish Redis event

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Location deleted by admin', {
        ...auditInfo,
        locationId,
        reason,
        forceDelete: !!forceDelete,
        category: 'location_management'
      });

      res.json(deleteResponse(
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error deleting location:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eliminare la location',
        'DELETE_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get current occupants of a location
   * GET /admin/locations/:locationId/occupants
   */
  static async getLocationOccupants(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;

      // TODO: Implement real-time occupants query
      const mockOccupants = [
        {
          characterId: 'char1',
          characterName: 'John Smith',
          playerUsername: 'player1',
          joinedAt: '2024-01-15T14:30:00Z',
          isActive: true,
          lastActivity: '2024-01-15T15:45:00Z'
        },
        {
          characterId: 'char2',
          characterName: 'Mary Watson',
          playerUsername: 'player2',
          joinedAt: '2024-01-15T15:00:00Z',
          isActive: false,
          lastActivity: '2024-01-15T15:30:00Z'
        }
      ];

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location occupants', {
        ...auditInfo,
        locationId,
        occupantCount: mockOccupants.length
      });

      res.json(successResponse(
        mockOccupants,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching location occupants:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare gli occupanti della location',
        'FETCH_LOCATION_OCCUPANTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get location hierarchy
   * GET /admin/locations/hierarchy
   */
  static async getLocationHierarchy(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement location hierarchy query
      const mockHierarchy = {
        districts: [
          {
            name: 'Whitechapel',
            locationCount: 15,
            locations: [
              { id: '1', name: 'Whitechapel Hospital', private: false },
              { id: '2', name: 'The Ten Bells', private: false },
              { id: '3', name: 'Mary Kelly\'s Room', private: true }
            ]
          },
          {
            name: 'Marylebone',
            locationCount: 8,
            locations: [
              { id: '4', name: 'Baker Street 221B', private: true },
              { id: '5', name: 'Regent\'s Park', private: false }
            ]
          }
        ],
        totalLocations: 23,
        publicLocations: 17,
        privateLocations: 6
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location hierarchy', {
        ...auditInfo
      });

      res.json(successResponse(
        mockHierarchy,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching location hierarchy:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la gerarchia delle location',
        'FETCH_LOCATION_HIERARCHY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get location statistics
   * GET /admin/locations/stats
   */
  static async getLocationStats(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement location stats query
      const mockStats = {
        total: 23,
        visible: 20,
        private: 6,
        withChat: 18,
        withShop: 5,
        activeOccupants: 45,
        totalVisitsToday: 127,
        messagesExchangedToday: 892,
        topDistricts: [
          { name: 'Whitechapel', count: 15 },
          { name: 'Marylebone', count: 8 }
        ],
        recentActivity: [
          {
            locationId: '1',
            locationName: 'Whitechapel Hospital',
            action: 'settings_updated',
            timestamp: '2024-01-15T15:30:00Z',
            adminUser: 'admin1'
          }
        ]
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location stats', {
        ...auditInfo
      });

      res.json(successResponse(
        mockStats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching location stats:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche delle location',
        'FETCH_LOCATION_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update location
   * PUT /admin/locations/:locationId
   */
  static async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const { name, district, description, settings, reason } = req.body;

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

      // TODO: Implement location update
      // - Update location in database
      // - Create audit log entry
      // - Publish Redis event for real-time updates

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Location updated by admin', {
        ...auditInfo,
        locationId,
        updates: { name, district, description, settings },
        reason,
        category: 'location_management'
      });

      res.json(updateResponse(
        {
          locationId,
          action: 'location_updated'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating location:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la location',
        'UPDATE_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Manage location access control
   * PUT /admin/locations/:locationId/access
   */
  static async manageLocationAccess(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const { characterAccess, corporationAccess, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo della modifica di accesso è richiesto',
          'ACCESS_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement access control update
      // - Update location access rules
      // - Create audit log entry
      // - Notify affected users

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Location access updated by admin', {
        ...auditInfo,
        locationId,
        characterAccess: characterAccess?.length || 0,
        corporationAccess: corporationAccess?.length || 0,
        reason,
        category: 'location_management'
      });

      res.json(updateResponse(
        {
          locationId,
          action: 'access_updated'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating location access:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare l\'accesso alla location',
        'UPDATE_LOCATION_ACCESS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk location operations
   * POST /admin/locations/bulk
   */
  static async bulkLocationOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, locationIds, data, reason } = req.body;

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

      // TODO: Implement bulk operations
      // - Process bulk update/delete/settings change
      // - Create audit log entries
      // - Publish Redis events

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk location operation by admin', {
        ...auditInfo,
        operation,
        locationCount: locationIds?.length || 0,
        reason,
        category: 'location_management'
      });

      res.json(successResponse(
        {
          operation,
          processed: locationIds?.length || 0
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error in bulk location operation:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eseguire l\'operazione bulk',
        'BULK_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Force move all users from a location (emergency)
   * POST /admin/locations/:locationId/evacuate
   */
  static async evacuateLocation(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const { targetLocationId, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'evacuazione è richiesto',
          'EVACUATION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement location evacuation
      // - Get all current occupants
      // - Move them to target location or default safe location
      // - Send notifications to affected users
      // - Create audit log entry
      // - Publish Redis events

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Location evacuated by admin', {
        ...auditInfo,
        locationId,
        targetLocationId,
        reason,
        category: 'location_management'
      });

      res.json(successResponse(
        {
          locationId,
          action: 'location_evacuated',
          movedUsers: 3
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error evacuating location:', { 
        error: error instanceof Error ? error.message : String(error), 
        locationId: req.params.locationId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile evacuare la location',
        'EVACUATE_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}