import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { Item, ItemCategory, IItem, CharacterInventory, Shop, ShopItem } from '../../../../packages/database/models/Item';

export class ItemManagementController {
  
  /**
   * Get list of all items with management info
   * GET /admin/items
   */
  static async getItems(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const category = req.query.category as string;
      const rarity = req.query.rarity as string;
      const isPublic = req.query.isPublic as string;
      const isAdminOnly = req.query.isAdminOnly as string;
      const search = req.query.search as string;

      // Build query
      const query: any = {};
      if (category && category !== 'all') query.category = category;
      if (rarity && rarity !== 'all') query.rarity = rarity;
      if (isPublic !== undefined) query.isPublic = isPublic === 'true';
      if (isAdminOnly !== undefined) query.isAdminOnly = isAdminOnly === 'true';
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { subcategory: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const totalItems = await Item.countDocuments(query);
      const items = await Item.find(query)
        .populate('createdBy', 'username')
        .populate('availableLocations', 'name type')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const response: ApiResponse<{
        items: any[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          limit: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          items: items.map(item => ({
            _id: item._id,
            name: item.name,
            description: item.description,
            category: item.category,
            subcategory: item.subcategory,
            basePrice: item.basePrice,
            rarity: item.rarity,
            isPublic: item.isPublic,
            isAdminOnly: item.isAdminOnly,
            availableLocations: item.availableLocations || [],
            properties: {
              isStackable: item.properties?.isStackable || false,
              isConsumable: item.properties?.isConsumable || false,
              maxQuantity: item.properties?.maxQuantity,
              weight: item.properties?.weight,
              durability: item.properties?.durability
            },
            shopSettings: {
              canBePurchased: item.shopSettings?.canBePurchased !== false,
              canBeSold: item.shopSettings?.canBeSold !== false,
              hasLimitedStock: item.shopSettings?.hasLimitedStock || false
            },
            financialSettings: {
              eligibleForCredit: item.financialSettings?.eligibleForCredit !== false
            },
            createdBy: item.createdBy,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            hasPrerequisites: !!item.prerequisites,
            prerequisiteCount: item.prerequisites ? 
              Object.keys(item.prerequisites).filter(key => 
                item.prerequisites && item.prerequisites[key as keyof typeof item.prerequisites]
              ).length : 0
          })),
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            limit,
            hasMore: page < Math.ceil(totalItems / limit)
          }
        },
        timestamp: new Date().toISOString()
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed items list', {
        ...auditInfo,
        filters: { category, rarity, isPublic, isAdminOnly, search },
        page,
        limit,
        totalResults: totalItems
      });

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching items:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare gli oggetti',
        code: 'FETCH_ITEMS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get item statistics
   * GET /admin/items/stats
   */
  static async getItemStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        total,
        publicItems,
        adminOnlyItems,
        byCategory,
        byRarity,
        consumableItems,
        stackableItems,
        withPrerequisites
      ] = await Promise.all([
        Item.countDocuments(),
        Item.countDocuments({ isPublic: true }),
        Item.countDocuments({ isAdminOnly: true }),
        Item.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Item.aggregate([
          { $group: { _id: '$rarity', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Item.countDocuments({ 'properties.isConsumable': true }),
        Item.countDocuments({ 'properties.isStackable': true }),
        Item.countDocuments({ prerequisites: { $exists: true, $ne: null } })
      ]);

      // Calculate price statistics
      const priceStats = await Item.aggregate([
        { 
          $group: { 
            _id: null,
            avgPrice: { $avg: '$basePrice' },
            minPrice: { $min: '$basePrice' },
            maxPrice: { $max: '$basePrice' }
          } 
        }
      ]);

      // Get shop availability statistics
      const shopStats = await Item.aggregate([
        {
          $group: {
            _id: null,
            canBePurchased: { $sum: { $cond: ['$shopSettings.canBePurchased', 1, 0] } },
            canBeSold: { $sum: { $cond: ['$shopSettings.canBeSold', 1, 0] } },
            hasLimitedStock: { $sum: { $cond: ['$shopSettings.hasLimitedStock', 1, 0] } }
          }
        }
      ]);

      const stats = {
        total,
        publicItems,
        adminOnlyItems,
        consumableItems,
        stackableItems,
        withPrerequisites,
        byCategory: byCategory.map(cat => ({ name: cat._id, count: cat.count })),
        byRarity: byRarity.map(r => ({ name: r._id, count: r.count })),
        priceStats: priceStats.length > 0 ? {
          average: Math.round(priceStats[0].avgPrice || 0),
          minimum: priceStats[0].minPrice || 0,
          maximum: priceStats[0].maxPrice || 0
        } : null,
        shopStats: shopStats.length > 0 ? shopStats[0] : {
          canBePurchased: 0,
          canBeSold: 0,
          hasLimitedStock: 0
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed item stats', {
        ...auditInfo
      });

      const response: ApiResponse<any> = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching item stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le statistiche degli oggetti',
        code: 'FETCH_ITEM_STATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get detailed item information
   * GET /admin/items/:itemId
   */
  static async getItemDetails(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;

      const item = await Item.findById(itemId)
        .populate('createdBy', 'username')
        .populate('availableLocations', 'name type description')
        .lean();

      if (!item) {
        const response: ApiResponse = {
          success: false,
          error: 'Oggetto non trovato',
          code: 'ITEM_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get inventory statistics for this item
      const [inventoryStats, shopStats] = await Promise.all([
        CharacterInventory.aggregate([
          { $unwind: '$items' },
          { $match: { 'items.itemId': new mongoose.Types.ObjectId(itemId) } },
          {
            $group: {
              _id: null,
              totalOwned: { $sum: '$items.quantity' },
              ownersCount: { $sum: 1 },
              avgQuantityPerOwner: { $avg: '$items.quantity' }
            }
          }
        ]),
        ShopItem.aggregate([
          { $match: { itemId: new mongoose.Types.ObjectId(itemId) } },
          {
            $group: {
              _id: null,
              shopsSellingCount: { $sum: 1 },
              totalStockAcrossShops: { $sum: '$currentStock' },
              avgPriceAcrossShops: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' }
            }
          }
        ])
      ]);

      const itemWithStats = {
        ...item,
        stats: {
          inventory: inventoryStats[0] || {
            totalOwned: 0,
            ownersCount: 0,
            avgQuantityPerOwner: 0
          },
          shops: shopStats[0] || {
            shopsSellingCount: 0,
            totalStockAcrossShops: 0,
            avgPriceAcrossShops: 0,
            minPrice: 0,
            maxPrice: 0
          }
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed item details', {
        ...auditInfo,
        itemId,
        itemName: Array.isArray(item) ? 'Multiple Items' : item.name
      });

      const response: ApiResponse<any> = {
        success: true,
        data: itemWithStats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching item details:', { 
        error: error instanceof Error ? error.message : String(error), 
        itemId: req.params.itemId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i dettagli dell\'oggetto',
        code: 'FETCH_ITEM_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Create new item
   * POST /admin/items
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      
      // Validate category
      if (!Object.values(ItemCategory).includes(req.body.category)) {
        const response: ApiResponse = {
          success: false,
          error: 'Categoria oggetto non valida',
          code: 'INVALID_CATEGORY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = new Item({
        ...req.body,
        createdBy: auditInfo!.adminId
      });

      const savedItem = await item.save();

      logger.info('New item created by admin', {
        ...auditInfo,
        itemId: savedItem._id,
        itemName: savedItem.name,
        category: 'item_management'
      });

      const response: ApiResponse<{ itemId: string; action: string }> = {
        success: true,
        data: {
          itemId: savedItem._id.toString(),
          action: 'item_created'
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error creating item:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      let errorMessage = 'Failed to create item';
      let errorCode = 'CREATE_ITEM_ERROR';
      
      if (error instanceof Error && error.message.includes('duplicate key')) {
        errorMessage = 'Item name already exists';
        errorCode = 'ITEM_NAME_EXISTS';
      }
      
      const response: ApiResponse = {
        success: false,
        error: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString()
      };
      
      res.status(error instanceof Error && error.message.includes('duplicate key') ? 409 : 500).json(response);
    }
  }

  /**
   * Update item
   * PUT /admin/items/:itemId
   */
  static async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;
      const { reason, ...updateData } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'aggiornamento è richiesto',
          code: 'UPDATE_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate category if provided
      if (updateData.category && !Object.values(ItemCategory).includes(updateData.category)) {
        const response: ApiResponse = {
          success: false,
          error: 'Categoria oggetto non valida',
          code: 'INVALID_CATEGORY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await Item.findByIdAndUpdate(
        itemId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!item) {
        const response: ApiResponse = {
          success: false,
          error: 'Oggetto non trovato',
          code: 'ITEM_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Item updated by admin', {
        ...auditInfo,
        itemId,
        itemName: item.name,
        reason,
        category: 'item_management'
      });

      const response: ApiResponse<{ itemId: string; action: string }> = {
        success: true,
        data: {
          itemId,
          action: 'item_updated'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating item:', { 
        error: error instanceof Error ? error.message : String(error), 
        itemId: req.params.itemId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare l\'oggetto',
        code: 'UPDATE_ITEM_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Delete item (soft delete by setting isAdminOnly to true and removing from public availability)
   * DELETE /admin/items/:itemId
   */
  static async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'eliminazione è richiesto',
          code: 'DELETION_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await Item.findById(itemId);
      if (!item) {
        const response: ApiResponse = {
          success: false,
          error: 'Oggetto non trovato',
          code: 'ITEM_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if item is in use (has inventory entries)
      const inventoryCount = await CharacterInventory.countDocuments({
        'items.itemId': new mongoose.Types.ObjectId(itemId)
      });

      if (inventoryCount > 0) {
        // Soft delete: make admin-only and remove from public availability
        await Item.findByIdAndUpdate(itemId, {
          isAdminOnly: true,
          isPublic: false,
          'shopSettings.canBePurchased': false,
          availableLocations: []
        });

        const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
        logger.warn('Item soft-deleted by admin (in use)', {
          ...auditInfo,
          itemId,
          itemName: item.name,
          reason,
          inventoryCount,
          category: 'item_management'
        });

        const response: ApiResponse<{ itemId: string; action: string; message: string }> = {
          success: true,
          data: {
            itemId,
            action: 'item_soft_deleted',
            message: `Item removed from availability but preserved due to ${inventoryCount} character(s) owning it`
          },
          timestamp: new Date().toISOString()
        };

        res.json(response);
      } else {
        // Hard delete: item not in use
        await Item.findByIdAndDelete(itemId);

        const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
        logger.warn('Item deleted by admin', {
          ...auditInfo,
          itemId,
          itemName: item.name,
          reason,
          category: 'item_management'
        });

        const response: ApiResponse<{ itemId: string; action: string }> = {
          success: true,
          data: {
            itemId,
            action: 'item_deleted'
          },
          timestamp: new Date().toISOString()
        };

        res.json(response);
      }
    } catch (error: any) {
      logger.error('Error deleting item:', { 
        error: error instanceof Error ? error.message : String(error), 
        itemId: req.params.itemId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eliminare l\'oggetto',
        code: 'DELETE_ITEM_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Bulk item operations
   * POST /admin/items/bulk
   */
  static async bulkItemOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, itemIds, data, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'operazione bulk è richiesto',
          code: 'BULK_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      let result;
      switch (operation) {
        case 'set_public':
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { isPublic: data.isPublic }
          );
          break;
        case 'set_admin_only':
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { isAdminOnly: data.isAdminOnly }
          );
          break;
        case 'update_category':
          if (!Object.values(ItemCategory).includes(data.category)) {
            const response: ApiResponse = {
              success: false,
              error: 'Categoria non valida',
              code: 'INVALID_CATEGORY',
              timestamp: new Date().toISOString()
            };
            res.status(400).json(response);
            return;
          }
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { category: data.category }
          );
          break;
        case 'update_rarity':
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { rarity: data.rarity }
          );
          break;
        case 'update_price':
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { basePrice: data.basePrice }
          );
          break;
        default:
          const response: ApiResponse = {
            success: false,
            error: 'Operazione bulk non valida',
            code: 'INVALID_BULK_OPERATION',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk item operation by admin', {
        ...auditInfo,
        operation,
        itemCount: itemIds?.length || 0,
        modifiedCount: result?.modifiedCount || 0,
        reason,
        category: 'item_management'
      });

      const response: ApiResponse<{ operation: string; processed: number; modified: number }> = {
        success: true,
        data: {
          operation,
          processed: itemIds?.length || 0,
          modified: result?.modifiedCount || 0
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in bulk item operation:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eseguire l\'operazione bulk',
        code: 'BULK_ITEM_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}