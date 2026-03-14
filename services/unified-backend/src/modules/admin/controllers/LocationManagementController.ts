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
import { Location } from '@database/models/Location';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';
import { escapeRegex } from '@shared/utils/validation';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;
  const query: any = { slug };
  if (excludeId) query._id = { $ne: excludeId };

  while (await Location.findOne(query)) {
    slug = `${baseSlug}-${counter}`;
    query.slug = slug;
    counter++;
  }
  return slug;
}

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
      const search = req.query.search as string;
      const locationLevel = req.query.locationLevel as string;

      const query: any = {};

      if (district) {
        query.district = district;
      }

      if (locationLevel) {
        query.locationLevel = locationLevel;
      }

      if (!showHidden) {
        query['settings.visible'] = true;
      }

      if (search) {
        const escapedSearch = escapeRegex(search);
        query.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { district: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      const totalItems = await Location.countDocuments(query);
      const totalPages = Math.ceil(totalItems / pageSize);

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const locations = await Location.find(query)
        .sort(sort)
        .populate('createdBy', 'username')
        .populate('lastModifiedBy', 'username')
        .populate('parentLocation', 'name slug')
        .lean();

      const transformedLocations: LocationManagement[] = locations.map((loc: any) => {
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
          parentLocation: loc.parentLocation?._id?.toString() || loc.parentLocation?.toString() || null,
          parentLocationName: loc.parentLocation?.name || null,
          sortOrder: loc.sortOrder || 0,
          imageUrl: loc.imageUrl || null,
          tags: loc.tags || [],
          positions: loc.positions || [],
          maxOccupants: loc.maxOccupants || null,
          settings: {
            visible: loc.settings?.visible ?? true,
            chat: loc.settings?.chat ?? true,
            shop: loc.settings?.shop ?? false,
            private: loc.settings?.private ?? false,
            bot_enabled: loc.bot_enabled ?? false
          },
          statistics: {
            totalVisits: loc.statistics?.totalVisits || 0,
            uniqueVisitors: loc.statistics?.uniqueVisitors || 0,
            currentOccupants: loc.occupants?.filter((o: any) => o.isActive)?.length || 0,
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
        page,
        totalPages,
        totalItems,
        pageSize,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed locations list', {
        ...auditInfo,
        filters: { district, showHidden, sortBy, sortOrder, search, locationLevel },
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
  static async getLocationDetails(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;

      const location = await Location.findById(locationId)
        .populate('createdBy', 'username')
        .populate('lastModifiedBy', 'username')
        .populate('parentLocation', 'name slug locationLevel')
        .lean();

      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const childCount = await Location.countDocuments({ parentLocation: locationId });

      const avgStayMinutes = location.statistics?.averageStayTime || 0;
      const avgStayTime = avgStayMinutes >= 60
        ? `${Math.floor(avgStayMinutes / 60)}h ${avgStayMinutes % 60}m`
        : `${avgStayMinutes}m`;

      const locationDetail = {
        id: location._id.toString(),
        name: location.name,
        slug: location.slug,
        district: location.district,
        description: location.description,
        locationLevel: location.locationLevel,
        parentLocation: location.parentLocation?._id?.toString() || null,
        parentLocationName: location.parentLocation?.name || null,
        sortOrder: location.sortOrder || 0,
        imageUrl: location.imageUrl || null,
        tags: location.tags || [],
        positions: location.positions || [],
        maxOccupants: location.maxOccupants || null,
        childCount,
        settings: {
          visible: location.settings?.visible ?? true,
          chat: location.settings?.chat ?? true,
          shop: location.settings?.shop ?? false,
          private: location.settings?.private ?? false,
          bot_enabled: location.bot_enabled ?? false
        },
        statistics: {
          totalVisits: location.statistics?.totalVisits || 0,
          uniqueVisitors: location.statistics?.uniqueVisitors || 0,
          currentOccupants: location.occupants?.filter((o: any) => o.isActive)?.length || 0,
          averageStayTime: avgStayTime,
          messagesExchanged: location.statistics?.messagesExchanged || 0
        },
        management: {
          createdBy: location.createdBy?.username || 'system',
          lastModified: location.updatedAt?.toISOString() || location.createdAt?.toISOString(),
          modifiedBy: location.lastModifiedBy?.username || location.createdBy?.username || 'system'
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location details', {
        ...auditInfo,
        locationId,
        locationName: location.name
      });

      res.json(successResponse(
        locationDetail,
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
  static async updateLocationSettings(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const updates: LocationSettingsUpdate = req.body;

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

      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const updateData: any = {};
      if (updates.visible !== undefined) updateData['settings.visible'] = updates.visible;
      if (updates.chat !== undefined) updateData['settings.chat'] = updates.chat;
      if (updates.shop !== undefined) updateData['settings.shop'] = updates.shop;
      if (updates.private !== undefined) updateData['settings.private'] = updates.private;
      if (updates.bot_enabled !== undefined) updateData.bot_enabled = updates.bot_enabled;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.maxOccupants !== undefined) updateData.maxOccupants = updates.maxOccupants;

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (auditInfo?.adminId) {
        updateData.lastModifiedBy = auditInfo.adminId;
      }

      await Location.findByIdAndUpdate(locationId, { $set: updateData });

      logger.info('Location settings updated by admin', {
        ...auditInfo,
        locationId,
        updates: {
          visible: updates.visible,
          chat: updates.chat,
          shop: updates.shop,
          private: updates.private,
          bot_enabled: updates.bot_enabled,
          description: updates.description,
          reason: updates.reason
        },
        category: 'location_management'
      });

      res.json(updateResponse(
        {
          locationId,
          action: 'settings_updated',
          updatedFields: Object.keys(updateData)
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
   * Create a new location
   * POST /admin/locations
   */
  static async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const {
        name, district, description, settings, locationLevel,
        parentLocation, imageUrl, tags, positions, maxOccupants
      } = req.body;

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

      if (!description || description.trim().length === 0) {
        res.status(400).json(errorResponse(
          'La descrizione è richiesta',
          'DESCRIPTION_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!locationLevel || !['root', 'district', 'location'].includes(locationLevel)) {
        res.status(400).json(errorResponse(
          'Il livello della location è richiesto (root, district, location)',
          'LOCATION_LEVEL_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (parentLocation) {
        const parent = await Location.findById(parentLocation);
        if (!parent) {
          res.status(400).json(errorResponse(
            'La location padre non esiste',
            'PARENT_LOCATION_NOT_FOUND',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      const slug = await generateUniqueSlug(name);

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      const siblingCount = await Location.countDocuments({
        parentLocation: parentLocation || { $exists: false }
      });

      const newLocation = await Location.create({
        name: name.trim(),
        slug,
        description: description.trim(),
        district: district?.trim() || (locationLevel === 'root' ? name.trim() : ''),
        locationLevel,
        parentLocation: parentLocation || undefined,
        imageUrl: imageUrl || undefined,
        tags: tags || [],
        positions: positions || [],
        maxOccupants: maxOccupants || undefined,
        sortOrder: siblingCount,
        settings: {
          visible: settings?.visible ?? true,
          chat: settings?.chat ?? true,
          shop: settings?.shop ?? false,
          private: settings?.private ?? false
        },
        bot_enabled: settings?.bot_enabled ?? false,
        statistics: {
          totalVisits: 0,
          uniqueVisitors: 0,
          averageStayTime: 0,
          messagesExchanged: 0,
          peakHours: []
        },
        createdBy: auditInfo?.adminId || req.user?.userId
      });

      logger.info('New location created by admin', {
        ...auditInfo,
        locationId: newLocation._id.toString(),
        locationName: name,
        locationLevel,
        district,
        parentLocation,
        category: 'location_management'
      });

      res.status(201).json(createResponse(
        {
          locationId: newLocation._id.toString(),
          slug: newLocation.slug,
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
   * Update location
   * PUT /admin/locations/:locationId
   */
  static async updateLocation(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;
      const {
        name, district, description, settings, locationLevel,
        parentLocation, imageUrl, tags, positions, maxOccupants, sortOrder
      } = req.body;

      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (parentLocation === locationId) {
        res.status(400).json(errorResponse(
          'Una location non può essere padre di se stessa',
          'SELF_PARENT_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name.trim();
        if (name.trim() !== location.name) {
          updateData.slug = await generateUniqueSlug(name.trim(), locationId);
        }
      }
      if (district !== undefined) updateData.district = district.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (locationLevel !== undefined) updateData.locationLevel = locationLevel;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
      if (tags !== undefined) updateData.tags = tags;
      if (positions !== undefined) updateData.positions = positions;
      if (maxOccupants !== undefined) updateData.maxOccupants = maxOccupants;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      if (parentLocation !== undefined) {
        updateData.parentLocation = parentLocation || null;
      }

      if (settings) {
        if (settings.visible !== undefined) updateData['settings.visible'] = settings.visible;
        if (settings.chat !== undefined) updateData['settings.chat'] = settings.chat;
        if (settings.shop !== undefined) updateData['settings.shop'] = settings.shop;
        if (settings.private !== undefined) updateData['settings.private'] = settings.private;
        if (settings.bot_enabled !== undefined) updateData.bot_enabled = settings.bot_enabled;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (auditInfo?.adminId) {
        updateData.lastModifiedBy = auditInfo.adminId;
      }

      await Location.findByIdAndUpdate(locationId, { $set: updateData });

      logger.info('Location updated by admin', {
        ...auditInfo,
        locationId,
        updates: Object.keys(updateData),
        category: 'location_management'
      });

      res.json(updateResponse(
        {
          locationId,
          action: 'location_updated',
          updatedFields: Object.keys(updateData)
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
   * Delete a location (soft delete)
   * DELETE /admin/locations/:locationId
   */
  static async deleteLocation(req: Request<{ locationId: string }>, res: Response): Promise<void> {
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

      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const activeOccupants = location.occupants?.filter((o: any) => o.isActive) || [];
      if (activeOccupants.length > 0 && !forceDelete) {
        res.status(409).json(errorResponse(
          `La location ha ${activeOccupants.length} occupanti attivi. Usa forceDelete per forzare l'eliminazione.`,
          'LOCATION_HAS_OCCUPANTS',
          { occupantCount: activeOccupants.length },
          409,
          getRequestId(req)
        ));
        return;
      }

      const childCount = await Location.countDocuments({ parentLocation: locationId });
      if (childCount > 0 && !forceDelete) {
        res.status(409).json(errorResponse(
          `La location ha ${childCount} sotto-location. Usa forceDelete per forzare l'eliminazione.`,
          'LOCATION_HAS_CHILDREN',
          { childCount },
          409,
          getRequestId(req)
        ));
        return;
      }

      if (childCount > 0 && forceDelete) {
        await Location.updateMany(
          { parentLocation: locationId },
          { $set: { parentLocation: location.parentLocation || null } }
        );
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      await location.softDelete(
        auditInfo?.adminId || req.user?.userId,
        auditInfo?.adminCharacterName || 'Unknown Admin',
        reason
      );

      logger.warn('Location deleted by admin', {
        ...auditInfo,
        locationId,
        locationName: location.name,
        reason,
        forceDelete: !!forceDelete,
        childrenMoved: childCount > 0 && forceDelete,
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
   * Get location hierarchy tree
   * GET /admin/locations/hierarchy
   */
  static async getLocationHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const locations = await Location.find({})
        .sort({ locationLevel: 1, sortOrder: 1, name: 1 })
        .select('name slug district locationLevel parentLocation sortOrder settings.visible settings.private imageUrl occupants')
        .lean();

      interface TreeNode {
        id: string;
        name: string;
        slug: string;
        district: string;
        locationLevel: string;
        sortOrder: number;
        visible: boolean;
        private: boolean;
        imageUrl: string | null;
        currentOccupants: number;
        children: TreeNode[];
      }

      const nodeMap = new Map<string, TreeNode>();
      const rootNodes: TreeNode[] = [];

      for (const loc of locations) {
        const node: TreeNode = {
          id: loc._id.toString(),
          name: loc.name,
          slug: loc.slug,
          district: loc.district,
          locationLevel: loc.locationLevel,
          sortOrder: loc.sortOrder || 0,
          visible: loc.settings?.visible ?? true,
          private: loc.settings?.private ?? false,
          imageUrl: loc.imageUrl || null,
          currentOccupants: loc.occupants?.filter((o: any) => o.isActive)?.length || 0,
          children: []
        };
        nodeMap.set(node.id, node);
      }

      for (const loc of locations) {
        const id = loc._id.toString();
        const parentId = loc.parentLocation?.toString();
        const node = nodeMap.get(id)!;

        if (parentId && nodeMap.has(parentId)) {
          nodeMap.get(parentId)!.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }

      const totalLocations = locations.length;
      const publicLocations = locations.filter(l => !l.settings?.private).length;
      const privateLocations = totalLocations - publicLocations;

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location hierarchy', { ...auditInfo });

      res.json(successResponse(
        {
          tree: rootNodes,
          totalLocations,
          publicLocations,
          privateLocations
        },
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
      const [
        total,
        hiddenCount,
        privateCount,
        chatEnabledCount,
        shopEnabledCount,
        allLocations
      ] = await Promise.all([
        Location.countDocuments({}),
        Location.countDocuments({ 'settings.visible': false }),
        Location.countDocuments({ 'settings.private': true }),
        Location.countDocuments({ 'settings.chat': true }),
        Location.countDocuments({ 'settings.shop': true }),
        Location.find({}).select('district occupants statistics').lean()
      ]);

      const districtCounts = new Map<string, number>();
      let activeOccupants = 0;
      let totalVisitsToday = 0;
      let messagesExchangedTotal = 0;

      for (const loc of allLocations) {
        const d = loc.district || 'Sconosciuto';
        districtCounts.set(d, (districtCounts.get(d) || 0) + 1);
        activeOccupants += loc.occupants?.filter((o: any) => o.isActive)?.length || 0;
        totalVisitsToday += loc.statistics?.totalVisits || 0;
        messagesExchangedTotal += loc.statistics?.messagesExchanged || 0;
      }

      const topDistricts = Array.from(districtCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const stats = {
        total,
        visible: total - hiddenCount,
        hidden: hiddenCount,
        private: privateCount,
        withChat: chatEnabledCount,
        withShop: shopEnabledCount,
        activeOccupants,
        totalVisits: totalVisitsToday,
        messagesExchanged: messagesExchangedTotal,
        topDistricts
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location stats', { ...auditInfo });

      res.json(successResponse(
        stats,
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
   * Get location activity and visitor analytics
   * GET /admin/locations/:locationId/activity
   */
  static async getLocationActivity(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;

      const location = await Location.findById(locationId)
        .select('statistics occupants name')
        .lean();

      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const activity = {
        visits: {
          totalVisits: location.statistics?.totalVisits || 0,
          uniqueVisitors: location.statistics?.uniqueVisitors || 0,
          averageStayTime: `${location.statistics?.averageStayTime || 0}m`,
          peakHours: location.statistics?.peakHours || []
        },
        communication: {
          messagesExchanged: location.statistics?.messagesExchanged || 0,
          averageMessagesPerVisit: location.statistics?.totalVisits
            ? Math.round((location.statistics.messagesExchanged / location.statistics.totalVisits) * 10) / 10
            : 0,
          activeConversations: 0,
          npcsActivated: 0
        },
        currentOccupants: (location.occupants || []).map((o: any) => ({
          characterId: o.characterId?.toString(),
          characterName: o.characterName,
          enteredAt: o.enteredAt?.toISOString(),
          isActive: o.isActive,
          lastSeen: o.lastSeen?.toISOString(),
          currentTag: o.currentTag
        }))
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location activity', {
        ...auditInfo,
        locationId
      });

      res.json(successResponse(
        activity,
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
   * Get current occupants of a location
   * GET /admin/locations/:locationId/occupants
   */
  static async getLocationOccupants(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const locationId = req.params.locationId;

      const location = await Location.findById(locationId)
        .select('occupants')
        .lean();

      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const occupants = (location.occupants || []).map((o: any) => ({
        characterId: o.characterId?.toString(),
        characterName: o.characterName,
        enteredAt: o.enteredAt?.toISOString(),
        isActive: o.isActive,
        lastSeen: o.lastSeen?.toISOString(),
        currentTag: o.currentTag
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed location occupants', {
        ...auditInfo,
        locationId,
        occupantCount: occupants.length
      });

      res.json(successResponse(
        occupants,
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
   * Manage location access control
   * PUT /admin/locations/:locationId/access
   */
  static async manageLocationAccess(req: Request<{ locationId: string }>, res: Response): Promise<void> {
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

      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

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
   * Reorder sibling locations
   * PUT /admin/locations/reorder
   */
  static async reorderLocations(req: Request, res: Response): Promise<void> {
    try {
      const { parentId, orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json(errorResponse(
          'Lista orderedIds richiesta',
          'ORDERED_IDS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const bulkOps = orderedIds.map((id: string, index: number) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { sortOrder: index } }
        }
      }));

      await Location.bulkWrite(bulkOps);

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Locations reordered by admin', {
        ...auditInfo,
        parentId,
        reorderedCount: orderedIds.length,
        category: 'location_management'
      });

      res.json(updateResponse(
        {
          action: 'locations_reordered',
          count: orderedIds.length
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error reordering locations:', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile riordinare le location',
        'REORDER_LOCATIONS_ERROR',
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
  static async evacuateLocation(req: Request<{ locationId: string }>, res: Response): Promise<void> {
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

      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const activeOccupants = location.occupants?.filter((o: any) => o.isActive) || [];
      const movedCount = activeOccupants.length;

      await Location.findByIdAndUpdate(locationId, {
        $set: { 'occupants.$[elem].isActive': false }
      }, {
        arrayFilters: [{ 'elem.isActive': true }]
      });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Location evacuated by admin', {
        ...auditInfo,
        locationId,
        targetLocationId,
        reason,
        movedUsers: movedCount,
        category: 'location_management'
      });

      res.json(successResponse(
        {
          locationId,
          action: 'location_evacuated',
          movedUsers: movedCount
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
