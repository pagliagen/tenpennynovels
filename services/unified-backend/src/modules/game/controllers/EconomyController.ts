import { Request, Response } from 'express';
import { Character, Item, ShopItem, CharacterInventory, Location, Corporation, CharacterFinances } from '@database/models';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class EconomyController {
  /**
   * GET /game/economy/general-store
   * Get all public items from the general catalog (London)
   * This is cache-friendly and returns base items, not shop-specific data
   */
  static async getGeneralStore(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character?.characterId;

      // Get character if authenticated
      let character = null;
      let finances = null;

      if (characterId) {
        character = await Character.findById(characterId);
        if (!character) {
          res.status(404).json(errorResponse(
            'Personaggio non trovato',
            'CHARACTER_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        finances = await CharacterFinances.findOne({ characterId });
      }

      // Get all public items
      const items = await Item.find({ isPublic: true })
        .select('name description category subcategory basePrice properties prerequisites financialSettings imageUrl')
        .lean();

      // Format with financial info if authenticated
      const formattedItems = items.map((item: any) => {
        // Create item object with 'requirements' field for meetsRequirements compatibility
        // Map prerequisites field names to match meetsRequirements expectations
        const itemWithRequirements = {
          ...item,
          requirements: {
            occupations: item.prerequisites?.requiredOccupations || [],
            corporations: item.prerequisites?.requiredCorporations || [],
            skills: item.prerequisites?.minimumSkills || {},
            socialClass: item.prerequisites?.requiredSocialClass || [],
            financialClasses: item.prerequisites?.requiredFinancialClasses || []
          }
        };

        return {
          id: item._id,
          name: item.name,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          price: item.basePrice,
          priceFormatted: EconomyController.formatCurrency(item.basePrice),
          properties: item.properties,
          requirements: item.prerequisites,
          imageUrl: item.imageUrl,

          // Add financial info if character authenticated
          ...(finances && character && {
            canPurchase: EconomyController.meetsRequirements(itemWithRequirements, character),
            canPurchaseWithCash: (finances.cash + finances.bankDeposit) >= item.basePrice,
            canPurchaseWithCredit: EconomyController.canPurchaseWithCredit(itemWithRequirements, finances, item.basePrice),
            creditEligible: item.financialSettings?.eligibleForCredit || false,
            socialClasses: item.financialSettings?.socialClassesEligible || []
          })
        };
      });

      res.json(successResponse(
        {
          items: formattedItems,
          ...(finances && {
            character: {
              finances: {
                cash: finances.cash,
                bankDeposit: finances.bankDeposit,
                totalWealth: finances.cash + finances.bankDeposit,
                socialClass: finances.socialClass,
                creditLine: {
                  maxWeekly: finances.creditLine.maxWeekly,
                  currentAvailable: finances.creditLine.currentAvailable,
                  nextResetDate: finances.creditLine.nextResetDate
                }
              }
            }
          })
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get general store error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        params: req.params,
        query: req.query
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare il catalogo generale',
        'GENERAL_STORE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/economy/shops/:locationId
   * Get shop items for a location with access filtering and financial options
   * Query params: filter (credit_only|all)
   */
  static async getShopItems(req: Request<{ locationSlug: string }>, res: Response): Promise<void> {
    try {
      const { locationSlug } = req.params;
      const { filter = 'all' } = req.query;
      const characterId = req.character!.characterId;

      // Get character 
      const character = await Character.findById(characterId) as any;
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Try to find location by ID, then by slug
      const location = await Location.findOne({ slug: locationSlug });
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

      // Check location access
      if (locationSlug !== 'london') {
        const hasAccess = await EconomyController.checkLocationAccess(location, character);
        if (!hasAccess) {
          res.status(404).json(errorResponse(
            'Accesso alla location non valido',
            'INVALID_LOCATION_ACCESS',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Check if shop is enabled
        if (!location.settings.shop) {
          res.status(404).json(errorResponse(
            'Negozio non trovato',
            'SHOP_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }
      }

      // Get character finances
      const finances = await CharacterFinances.findOne({ characterId });

      // Get shop items with item details populated
      let allItems = [];
      if (locationSlug === 'london') {
        allItems = await ShopItem.find({}).populate('itemId');
      } else {
        allItems = await ShopItem.find({ locationId: location._id }).populate('itemId');
      }

      // Filter by character permissions and visibility
      let availableItems = allItems.filter((item: any) =>
        EconomyController.canPurchaseItem(item, character)
      );

      // Apply financial filtering
      if (finances && filter === 'credit_only') {
        // First filter: show only items that are credit-eligible
        availableItems = availableItems.filter((shopItem: any) => {
          const item = shopItem.itemId;
          return item.financialSettings?.eligibleForCredit === true;
        });

        // Second filter: apply social class filtering
        availableItems = availableItems.filter((shopItem: any) =>
          EconomyController.canPurchaseBySocialClass(shopItem.itemId, finances.socialClass)
        );

        // Third filter: check if affordable with credit
        availableItems = availableItems.filter((shopItem: any) => {
          const canAffordWithCredit = finances.creditLine?.currentAvailable >= shopItem.price;
          return canAffordWithCredit;
        });
      }

      // Format items with financial info
      const itemsWithFinancialInfo = availableItems.map((shopItem: any) => {
        const item = shopItem.itemId;
        return {
          id: shopItem._id,
          itemId: item._id,
          name: item.name,
          description: item.description,
          price: shopItem.price,
          priceFormatted: EconomyController.formatCurrency(shopItem.price),
          inStock: shopItem.currentStock > 0,
          currentStock: shopItem.currentStock,
          maxStock: shopItem.maxStock,
          category: item.category || 'General',
          requirements: item.prerequisites,
          canPurchase: EconomyController.meetsRequirements(item, character),
          // Financial info if available
          ...(finances && {
            canPurchaseWithCash: (finances.cash + finances.bankDeposit) >= shopItem.price,
            canPurchaseWithCredit: EconomyController.canPurchaseWithCredit(item, finances, shopItem.price),
            creditEligible: item.financialSettings?.eligibleForCredit || false,
            socialClasses: item.financialSettings?.socialClassesEligible || []
          })
        };
      });

      res.json(successResponse(
        {
          location: {
            id: location._id,
            name: location.name,
            slug: location.slug,
            description: location.description
          },
          shop: {
            items: itemsWithFinancialInfo
          },
          // Include character financial info if available
          ...(finances && {
            character: {
              finances: {
                cash: finances.cash,
                bankDeposit: finances.bankDeposit,
                totalWealth: finances.cash + finances.bankDeposit,
                socialClass: finances.socialClass,
                creditLine: {
                  maxWeekly: finances.creditLine.maxWeekly,
                  currentAvailable: finances.creditLine.currentAvailable,
                  nextResetDate: finances.creditLine.nextResetDate
                }
              }
            }
          }),
          filters: {
            current: filter,
            available: ['all', 'credit_only']
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get shop items error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        locationSlug: req.params?.locationSlug,
        filter: req.query?.filter,
        params: req.params,
        query: req.query
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare gli articoli del negozio',
        'SHOP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Check if item can be purchased with credit line
   */
  private static canPurchaseWithCredit(item: any, finances: any, price?: number): boolean {
    if (!item.financialSettings?.eligibleForCredit) return false;
    const itemPrice = price || item.basePrice;
    return finances.creditLine.currentAvailable >= itemPrice;
  }

  /**
   * Map internal English social class names to item class names for compatibility
   */
  private static mapSocialClassToItemClass(characterSocialClass: string): string {
    const classMapping: { [key: string]: string } = {
      'destitute': 'Lower Class',
      'poor': 'Lower Class',
      'modest': 'Working Class',
      'lower_middle': 'Middle Class',
      'middle_class': 'Middle Class',
      'wealthy': 'Upper Class',
      'affluent': 'Upper Class',
      'elite': 'Upper Class'
    };

    return classMapping[characterSocialClass] || characterSocialClass;
  }

  /**
   * Check if character's social class can purchase item
   */
  private static canPurchaseBySocialClass(item: any, characterSocialClass: string): boolean {
    // If item has no social class restrictions, everyone can buy
    if (!item.financialSettings?.socialClassesEligible || item.financialSettings.socialClassesEligible.length === 0) {
      return true;
    }

    // Map character's Italian class name to English item class name
    const mappedClass = EconomyController.mapSocialClassToItemClass(characterSocialClass);

    // Check if mapped social class is in allowed list
    return item.financialSettings.socialClassesEligible.includes(mappedClass);
  }

  /**
   * POST /game/economy/shops/:shopId/restock
   * Restock shop items (corporation officers only)
   */
  static async restockShop(req: Request<{ shopId: string }>, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { itemId, quantity, payFromTreasury } = req.body;
      const characterId = req.character!.characterId;

      // Get character and verify corporation access
      const character = await (Character.findById(characterId).populate('corporations') as any);
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get shop location and verify corporation ownership
      const location = await (Location.findById(shopId) as any);
      if (!location || !location.corporationId) {
        res.status(404).json(errorResponse(
          'Shop not found',
          'SHOP_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is corporation officer
      const isCorporationMember = character.corporations.some(
        (corp: any) => corp.id.toString() === location.corporationId.toString()
      );

      if (!isCorporationMember) {
        res.status(403).json(errorResponse(
          'Accesso negato',
          'ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get item and corporation
      const [item, corporation] = await Promise.all([
        ShopItem.findOne({ _id: itemId, locationId: shopId }),
        Corporation.findById(location.corporationId)
      ]) as any[];

      if (!item || !corporation) {
        res.status(404).json(errorResponse(
          'Articolo o corporazione non trovata',
          'ITEM_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Calculate restock cost
      const restockCost = item.basePrice ? item.basePrice * quantity : item.price * quantity * 0.7; // 30% margin

      if (payFromTreasury) {
        if ((corporation.treasury || 0) < restockCost) {
          res.status(400).json(errorResponse(
            'Fondi del tesoro insufficienti',
            'TREASURY_INSUFFICIENT_FUNDS',
            {
              required: restockCost,
              available: corporation.treasury || 0
            },
            400,
            getRequestId(req)
          ));
          return;
        }

        // Deduct from treasury
        corporation.treasury = (corporation.treasury || 0) - restockCost;
        await corporation.save();
      }

      // Update item stock
      item.currentStock = Math.min(item.currentStock + quantity, item.maxStock);
      await item.save();

      // TODO: Publish Redis event
      // redis.publish('economy:stock_restocked', { shopId, itemId, quantityAdded: quantity, corporationId: corporation.id, costPaid: restockCost });

      logger.info('Shop restocked', {
        shopId,
        itemId,
        quantityAdded: quantity,
        costPaid: restockCost,
        corporationId: corporation.id,
        restockedBy: characterId
      });

      res.json(successResponse(
        {
          restocked: {
            itemId,
            quantityAdded: quantity,
            newStock: item.currentStock,
            costPaid: restockCost,
            paidFrom: payFromTreasury ? 'treasury' : 'personal'
          },
          treasury: {
            previousBalance: (corporation.treasury || 0) + restockCost,
            newBalance: corporation.treasury || 0
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Restock shop error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        shopId: req.params?.shopId,
        requestBody: req.body,
        params: req.params
      });

      res.status(500).json(errorResponse(
        'Impossibile rifornire il negozio',
        'RESTOCK_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static formatCurrency(pence: number): string {
    return `${pence} penny`;
  }

  private static async checkLocationAccess(location: any, character: any): Promise<boolean> {
    if (!location.private && location.visible) return true;

    if (location.private) {
      if (location.ownerId?.toString() === character.id) return true;

      if (location.corporationId && character.corporations) {
        const isMember = character.corporations.some(
          (corp: any) => corp.id.toString() === location.corporationId.toString()
        );
        if (isMember) return true;
      }
    }

    return false;
  }

  private static canPurchaseItem(shopItem: any, character: any): boolean {
    // Get the actual item data from the populated itemId
    const item = shopItem.itemId;

    // Must have item data populated
    if (!item) return false;

    // Must be public (visible to all) or available in location
    if (!item.isPublic && (!item.availableLocations || item.availableLocations.length === 0)) return false;

    // Must be in stock
    if (shopItem.currentStock <= 0) return false;

    // Check requirements on the actual item
    return EconomyController.meetsRequirements(item, character);
  }

  private static meetsRequirements(item: any, character: any): boolean {
    if (!item.requirements) return true;

    // Check skill requirements
    if (item.requirements.skills) {
      for (const skillReq of item.requirements.skills as any[]) {
        const characterSkill = character.skills[skillReq.skill] || 0;
        if (characterSkill < skillReq.minimum) {
          return false;
        }
      }
    }

    // Check occupation requirements
    if (item.requirements.occupations && item.requirements.occupations.length > 0) {
      if (!item.requirements.occupations.includes(character.occupation)) {
        return false;
      }
    }

    // Check corporation requirements
    if (item.requirements.corporations && item.requirements.corporations.length > 0) {
      const characterCorps = character.corporations?.map((c: any) => c.id.toString()) || [];
      const hasRequiredCorp = item.requirements.corporations.some(
        (reqCorp: any) => characterCorps.includes(reqCorp.toString())
      );
      if (!hasRequiredCorp) return false;
    }

    return true;
  }

}