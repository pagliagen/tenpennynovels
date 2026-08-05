import { Router } from 'express';
import { LocationManagementController } from '../controllers/LocationManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

// --- List, hierarchy, stats (GET collection-level) ---

router.get(
  '/',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_locations_list', 'location_management'),
  LocationManagementController.getLocations
);

router.get(
  '/hierarchy',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_hierarchy', 'location_management'),
  LocationManagementController.getLocationHierarchy
);

router.get(
  '/stats',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_stats', 'location_management'),
  LocationManagementController.getLocationStats
);

// --- Create & reorder (POST/PUT collection-level) ---

router.post(
  '/',
  requireViewPermission('locations.create'),
  AdminAuthMiddleware.logAdminAction('create_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.createLocation
);

router.put(
  '/reorder',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('reorder_locations', 'location_management'),
  LocationManagementController.reorderLocations
);

// --- Single location CRUD ---

router.get(
  '/:locationId',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_details', 'location_management'),
  LocationManagementController.getLocationDetails
);

router.put(
  '/:locationId',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('update_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.updateLocation
);

router.patch(
  '/:locationId/settings',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('update_location_settings', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.updateLocationSettings
);

// No sensitiveOperationLimit here: dragging markers on the map editor fires
// one request per drop, easily more than the 10/hour sensitive-op budget.
router.patch(
  '/:locationId/map-position',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('update_location_map_position', 'location_management'),
  LocationManagementController.updateLocationMapPosition
);

router.delete(
  '/:locationId',
  requireViewPermission('locations.delete'),
  AdminAuthMiddleware.logAdminAction('delete_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.deleteLocation
);

// --- Sub-resources ---

router.get(
  '/:locationId/activity',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_activity', 'location_management'),
  LocationManagementController.getLocationActivity
);

router.get(
  '/:locationId/occupants',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_occupants', 'location_management'),
  LocationManagementController.getLocationOccupants
);

router.put(
  '/:locationId/access',
  requireViewPermission('locations.manage_access'),
  AdminAuthMiddleware.logAdminAction('update_location_access', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.manageLocationAccess
);

router.post(
  '/:locationId/evacuate',
  requireViewPermission('locations.manage_access'),
  AdminAuthMiddleware.logAdminAction('evacuate_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.evacuateLocation
);

export { router as locationRoutes };
