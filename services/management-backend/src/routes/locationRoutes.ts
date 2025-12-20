import { Router } from 'express';
import { LocationManagementController } from '../controllers/LocationManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All location routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Location listing and management routes - require locations.read permission
router.get(
  '/',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_locations_list', 'location_management'),
  LocationManagementController.getLocations
);

router.post(
  '/',
  requireViewPermission('locations.create'),
  AdminAuthMiddleware.logAdminAction('create_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.createLocation
);

// Individual location management routes
router.get(
  '/:locationId',
  requireViewPermission('locations.read'),
  AdminAuthMiddleware.logAdminAction('view_location_details', 'location_management'),
  LocationManagementController.getLocationDetails
);

router.patch(
  '/:locationId/settings',
  requireViewPermission('locations.update'),
  AdminAuthMiddleware.logAdminAction('update_location_settings', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.updateLocationSettings
);

router.delete(
  '/:locationId',
  requireViewPermission('locations.delete'),
  AdminAuthMiddleware.logAdminAction('delete_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.deleteLocation
);

// Location activity and monitoring routes
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

// Emergency location management
router.post(
  '/:locationId/evacuate',
  requireViewPermission('locations.manage_access'),
  AdminAuthMiddleware.logAdminAction('evacuate_location', 'location_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  LocationManagementController.evacuateLocation
);

export { router as locationRoutes };