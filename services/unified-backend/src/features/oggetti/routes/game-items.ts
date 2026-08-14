import { Router } from 'express';
import { ItemController } from '../controllers/ItemController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

/**
 * @route GET /items
 * @desc Get available items for character
 * @access Private (Character required)
 * @query category - Filter by item category
 * @query locationId - Filter by location availability
 * @query maxPrice - Maximum price filter (in pence)
 * @query minPrice - Minimum price filter (in pence)
 * @query search - Search in name/description
 * @query includeUnavailable - Include unavailable items (true/false)
 * @query sortBy - Sort field (name, basePrice, category)
 * @query sortOrder - Sort order (asc, desc)
 * @query page - Page number
 * @query limit - Items per page
 */
router.get('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:items:list'),
  ItemController.getAvailableItems
);

/**
 * @route GET /items/categories
 * @desc Get item categories with statistics
 * @access Private (Character required)
 */
router.get('/categories',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:items:categories'),
  ItemController.getItemCategories
);

/**
 * @route GET /items/search
 * @desc Search items by text query
 * @access Private (Character required)
 * @query q - Search query (minimum 2 characters)
 * @query category - Filter by category
 * @query maxPrice - Maximum price filter
 * @query limit - Maximum results (default 10)
 */
router.get('/search',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:items:search'),
  ItemController.searchItems
);

/**
 * @route GET /items/location/:locationId
 * @desc Get items available at specific location
 * @access Private (Character required)
 * @query category - Filter by category
 * @query sortBy - Sort field
 * @query sortOrder - Sort order
 */
router.get('/location/:locationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:items:list'),
  ItemController.getLocationItems
);

/**
 * @route GET /items/:itemId
 * @desc Get detailed item information
 * @access Private (Character required)
 */
router.get('/:itemId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:items:read'),
  ItemController.getItemDetails
);

export default router;
