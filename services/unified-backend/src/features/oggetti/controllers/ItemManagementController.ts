import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { logger } from '@modules/admin/utils/logger';
import { Item, ItemCategory, ITEM_CATEGORY_LABELS, CharacterInventory, ShopItem } from '../models/Item';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId, deleteResponse } from '@shared/utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';

export class ItemManagementController {

  /**
   * Get list of all items with management info
   * GET /admin/items
   */
  static async getItems(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      // CWE-943: `as string` è solo un cast a compile-time — a runtime
      // req.query.category può essere un oggetto (?category[$where]=...,
      // qs lo trasforma), e finirebbe diretto nel filtro Mongo. Guardia
      // typeof reale invece del cast.
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const isPublic = typeof req.query.isPublic === 'string' ? req.query.isPublic : undefined;
      const isAdminOnly = typeof req.query.isAdminOnly === 'string' ? req.query.isAdminOnly : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      // Build query
      const query: any = {};
      if (category && category !== 'all') query.category = category;
      if (isPublic !== undefined) query.isPublic = isPublic === 'true';
      if (isAdminOnly !== undefined) query.isAdminOnly = isAdminOnly === 'true';

      if (search) {
        const escapedSearch = escapeRegex(search);
        query.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { subcategory: { $regex: escapedSearch, $options: 'i' } }
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

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPreviousPage: page > 1
      };

      res.json(listResponse(
        items.map(item => ({
            _id: item._id,
            name: item.name,
            description: item.description,
            category: item.category,
            categoryLabel: ITEM_CATEGORY_LABELS[item.category as ItemCategory] || item.category,
            subcategory: item.subcategory,
            imageUrl: item.imageUrl || null,
            basePrice: item.basePrice,
            isPublic: item.isPublic,
            isAdminOnly: item.isAdminOnly,
            availableLocations: item.availableLocations || [],
            properties: {
              isStackable: item.properties?.isStackable || false,
              isConsumable: item.properties?.isConsumable || false,
              maxQuantity: item.properties?.maxQuantity,
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
        pagination,
        undefined,
        getRequestId(req)
      ));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed items list', {
        ...auditInfo,
        filters: { category, isPublic, isAdminOnly, search },
        currentPage: page,
        pageSize: limit,
        totalResults: totalItems
      });
    } catch (error: unknown) {
      logger.error('Error fetching items:', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare gli oggetti',
        'FETCH_ITEMS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching item stats:', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche degli oggetti',
        'FETCH_ITEM_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed item information
   * GET /admin/items/:itemId
   */
  static async getItemDetails(req: Request<{ itemId: string }>, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;

      const item = await Item.findById(itemId)
        .populate('createdBy', 'username')
        .populate('availableLocations', 'name type description')
        .lean();

      if (!item) {
        res.status(404).json(errorResponse(
          'Oggetto non trovato',
          'ITEM_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        itemWithStats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching item details:', {
        error: error instanceof Error ? error.message : String(error),
        itemId: req.params.itemId
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli dell\'oggetto',
        'FETCH_ITEM_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Categoria oggetto non valida',
          'INVALID_CATEGORY',
          undefined,
          400,
          getRequestId(req)
        ));
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

      res.status(201).json(createResponse(
        {
          itemId: savedItem._id.toString(),
          action: 'item_created'
        },
        'Item creato con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error creating item:', {
        error: error instanceof Error ? error.message : String(error)
      });

      let errorMessage = 'Failed to create item';
      let errorCode = 'CREATE_ITEM_ERROR';
      let statusCode = 500;

      if (error instanceof Error && error.message.includes('duplicate key')) {
        errorMessage = 'Item name already exists';
        errorCode = 'ITEM_NAME_EXISTS';
        statusCode = 409;
      }

      res.status(statusCode).json(errorResponse(
        errorMessage,
        errorCode,
        undefined,
        statusCode,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update item
   * PUT /admin/items/:itemId
   */
  static async updateItem(req: Request<{ itemId: string }>, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;
      const {
        reason, name, description, category, subcategory, imageUrl,
        isPublic, isAdminOnly, availableLocations, basePrice,
        properties, financialSettings, shopSettings
      } = req.body;

      // CWE-943: allowlist esplicita (rispecchia UpdateItemData del
      // frontend management) invece di spalmare req.body — un oggetto con
      // chiave "$set"/"$where" a livello root verrebbe interpretato come
      // vero operatore Mongo. Ogni campo è copiato solo se del tipo
      // atteso, mai passato così com'è.
      const updateData: Record<string, unknown> = {};
      if (typeof name === 'string') updateData.name = name;
      if (typeof description === 'string') updateData.description = description;
      if (typeof category === 'string') updateData.category = category;
      if (typeof subcategory === 'string') updateData.subcategory = subcategory;
      if (typeof imageUrl === 'string') updateData.imageUrl = imageUrl;
      if (typeof isPublic === 'boolean') updateData.isPublic = isPublic;
      if (typeof isAdminOnly === 'boolean') updateData.isAdminOnly = isAdminOnly;
      if (Array.isArray(availableLocations)) updateData.availableLocations = availableLocations;
      if (typeof basePrice === 'number') updateData.basePrice = basePrice;
      if (properties && typeof properties === 'object' && !Array.isArray(properties)) updateData.properties = properties;
      if (financialSettings && typeof financialSettings === 'object' && !Array.isArray(financialSettings)) updateData.financialSettings = financialSettings;
      if (shopSettings && typeof shopSettings === 'object' && !Array.isArray(shopSettings)) updateData.shopSettings = shopSettings;

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

      // Validate category if provided
      if (updateData.category && !Object.values(ItemCategory).includes(updateData.category as ItemCategory)) {
        res.status(400).json(errorResponse(
          'Categoria oggetto non valida',
          'INVALID_CATEGORY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const item = await Item.findByIdAndUpdate(
        itemId,
        updateData,
        { returnDocument: 'after', runValidators: true }
      );

      if (!item) {
        res.status(404).json(errorResponse(
          'Oggetto non trovato',
          'ITEM_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(updateResponse(
        {
          itemId,
          action: 'item_updated'
        },
        'Item aggiornato con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating item:', {
        error: error instanceof Error ? error.message : String(error),
        itemId: req.params.itemId
      });

      res.status(500).json(errorResponse(
        'Impossibile aggiornare l\'oggetto',
        'UPDATE_ITEM_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete item (soft delete by setting isAdminOnly to true and removing from public availability)
   * DELETE /admin/items/:itemId
   */
  static async deleteItem(req: Request<{ itemId: string }>, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId;
      const { reason } = req.body;

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

      const item = await Item.findById(itemId);
      if (!item) {
        res.status(404).json(errorResponse(
          'Oggetto non trovato',
          'ITEM_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

        res.json(deleteResponse(
          `Item removed from availability but preserved due to ${inventoryCount} character(s) owning it`,
          getRequestId(req)
        ));
      } else {
        const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
        await item.softDelete(
          auditInfo?.adminId || req.user?.userId,
          auditInfo?.adminCharacterName || 'Unknown Admin',
          reason
        );

        logger.warn('Item soft-deleted by admin', {
          ...auditInfo,
          itemId,
          itemName: item.name,
          reason,
          category: 'item_management'
        });

        res.json(deleteResponse(
          'Item eliminato con successo',
          getRequestId(req)
        ));
      }
    } catch (error: unknown) {
      logger.error('Error deleting item:', {
        error: error instanceof Error ? error.message : String(error),
        itemId: req.params.itemId
      });

      res.status(500).json(errorResponse(
        'Impossibile eliminare l\'oggetto',
        'DELETE_ITEM_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Il motivo dell\'operazione bulk è richiesto',
          'BULK_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // CWE-943: itemIds finisce dentro $in (filtro), i campi di data
      // finiscono come valori di $set (update) — entrambi da req.body senza
      // controllo di tipo. itemIds deve essere un array di stringhe valide,
      // non un oggetto/operatore Mongo; i campi di data devono combaciare
      // col tipo atteso dallo schema.
      if (!Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every((id) => typeof id === 'string')) {
        res.status(400).json(errorResponse(
          'itemIds deve essere un array di ID validi',
          'INVALID_ITEM_IDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let result;
      switch (operation) {
        case 'set_public':
          if (typeof data?.isPublic !== 'boolean') {
            res.status(400).json(errorResponse(
              'isPublic deve essere un booleano',
              'INVALID_BULK_DATA',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
          }
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { isPublic: data.isPublic }
          );
          break;
        case 'set_admin_only':
          if (typeof data?.isAdminOnly !== 'boolean') {
            res.status(400).json(errorResponse(
              'isAdminOnly deve essere un booleano',
              'INVALID_BULK_DATA',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
          }
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { isAdminOnly: data.isAdminOnly }
          );
          break;
        case 'update_category':
          if (typeof data?.category !== 'string' || !Object.values(ItemCategory).includes(data.category as ItemCategory)) {
            res.status(400).json(errorResponse(
              'Categoria non valida',
              'INVALID_CATEGORY',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
          }
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { category: data.category }
          );
          break;
        case 'update_price': {
          const safeBasePrice = typeof data?.basePrice === 'number' ? data.basePrice : Number(data?.basePrice);
          if (!Number.isFinite(safeBasePrice) || safeBasePrice < 0) {
            res.status(400).json(errorResponse(
              'basePrice deve essere un numero valido',
              'INVALID_BULK_DATA',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
          }
          result = await Item.updateMany(
            { _id: { $in: itemIds } },
            { basePrice: safeBasePrice }
          );
          break;
        }
        default:
          res.status(400).json(errorResponse(
            'Operazione bulk non valida',
            'INVALID_BULK_OPERATION',
            undefined,
            400,
            getRequestId(req)
          ));
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

      res.json(updateResponse(
        {
          operation,
          processed: itemIds?.length || 0,
          modified: result?.modifiedCount || 0
        },
        'Operazione bulk completata con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk item operation:', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile eseguire l\'operazione bulk',
        'BULK_ITEM_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
