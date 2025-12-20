import { Request, Response } from 'express';
import { Character, CharacterWallet, Transaction, ShopItem, CharacterInventory, Location, Corporation, CharacterFinances, SocialClassConfig } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';

export class EconomyController {
  /**
   * GET /game/economy/wallet
   * Get character's wallet information
   */
  static async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      const character = await (Character.findById(characterId).populate('walletId') as any);
      if (!character || !character.walletId) {
        const response: ApiResponse = {
          success: false,
          error: 'Portafoglio non trovato',
          code: 'WALLET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const wallet = character.walletId;
      const totalPence = wallet.cash + wallet.deposit;

      const response: ApiResponse = {
        success: true,
        data: {
          wallet: {
            characterId,
            cash: wallet.cash,
            deposit: wallet.deposit,
            formatted: {
              cash: EconomyController.formatCurrency(wallet.cash),
              deposit: EconomyController.formatCurrency(wallet.deposit),
              total: EconomyController.formatCurrency(totalPence)
            }
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get wallet error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        params: req.params,
        query: req.query
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il portafoglio',
        code: 'GET_WALLET_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /game/economy/transfer
   * Transfer money between characters
   */
  static async transferMoney(req: Request, res: Response): Promise<void> {
    try {
      const { targetCharacterId, amount, type, reason } = req.body;
      const characterId = req.character!.characterId;

      if (characterId === targetCharacterId) {
        const response: ApiResponse = {
          success: false,
          error: 'Non puoi trasferire denaro a te stesso',
          code: 'INVALID_TRANSFER_TARGET',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const [fromCharacter, toCharacter] = await Promise.all([
        Character.findById(characterId).populate('walletId'),
        Character.findById(targetCharacterId).populate('walletId')
      ]) as any[];

      if (!fromCharacter || !toCharacter || !fromCharacter.walletId || !toCharacter.walletId) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio o portafoglio non trovato',
          code: 'CHARACTER_WALLET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check sufficient funds
      const fromWallet = fromCharacter.walletId;
      const availableFunds = type === 'cash' ? fromWallet.cash : fromWallet.deposit;

      if (availableFunds < amount) {
        const response: ApiResponse = {
          success: false,
          error: 'Fondi insufficienti',
          code: 'INSUFFICIENT_FUNDS',
          details: {
            requested: amount,
            available: availableFunds,
            type
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Perform transfer
      const toWallet = toCharacter.walletId;

      if (type === 'cash') {
        fromWallet.cash -= amount;
        toWallet.cash += amount;
      } else {
        fromWallet.deposit -= amount;
        toWallet.deposit += amount;
      }

      await Promise.all([fromWallet.save(), toWallet.save()]);

      // Create transaction record
      const transaction = new Transaction({
        from: characterId,
        to: targetCharacterId,
        amount,
        type,
        reason: reason || 'Money transfer',
        timestamp: new Date()
      });

      await transaction.save();

      logger.info('Money transfer completed', {
        transactionId: transaction.id,
        from: characterId,
        to: targetCharacterId,
        amount,
        type
      });

      const response: ApiResponse = {
        success: true,
        data: {
          transaction: {
            id: transaction.id,
            from: transaction.from,
            to: transaction.to,
            amount: transaction.amount,
            type: transaction.type,
            reason: transaction.reason,
            timestamp: transaction.timestamp
          },
          newBalance: {
            cash: fromWallet.cash,
            deposit: fromWallet.deposit
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Transfer money error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        params: req.params,
        requestBody: req.body
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile trasferire denaro',
        code: 'TRANSFER_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /game/economy/shops/:locationId
   * Get shop items for a location with access filtering and financial options
   * Query params: filter (credit_only|all)
   */
  static async getShopItems(req: Request, res: Response): Promise<void> {
    try {
      const { locationSlug } = req.params;
      const { filter = 'all' } = req.query;
      const characterId = req.character!.characterId;

      // Get character 
      const character = await Character.findById(characterId) as any;
      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if character is approved to access shop
      if (character.status !== 'APPROVED') {
        const response: ApiResponse = {
          success: false,
          error: 'L\'accesso al negozio richiede un personaggio approvato',
          code: 'CHARACTER_NOT_APPROVED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Try to find location by ID, then by slug
      const location = await Location.findOne({ slug: locationSlug });
      if (!location) {
        const response: ApiResponse = {
          success: false,
          error: 'Location non trovata',
          code: 'LOCATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check location access
      if (locationSlug !== 'london') {
        const hasAccess = await EconomyController.checkLocationAccess(location, character);
        if (!hasAccess) {
          const response: ApiResponse = {
            success: false,
            error: 'Accesso alla location non valido',
            code: 'INVALID_LOCATION_ACCESS',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
          return;
        }

        // Check if shop is enabled
        if (!location.settings.shop) {
          const response: ApiResponse = {
            success: false,
            error: 'Negozio non trovato',
            code: 'SHOP_NOT_FOUND',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
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
          console.log(finances.creditLine?.currentAvailable, shopItem.price);
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

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

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

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare gli articoli del negozio',
        code: 'SHOP_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
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
   * POST /game/economy/purchase
   * Purchase item from shop
   */
  static async purchaseItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, quantity, locationId } = req.body;
      const characterId = req.character!.characterId;

      // Get character, item, and inventory
      const [character, item, inventory] = await Promise.all([
        Character.findById(characterId).populate('walletId corporations'),
        ShopItem.findById(itemId),
        CharacterInventory.findOne({ characterId }).populate('items')
      ]) as any[];

      if (!character || !item || !inventory) {
        const response: ApiResponse = {
          success: false,
          error: 'Articolo o personaggio non trovato',
          code: 'ITEM_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Verify item is visible and available
      if (!item.visible || !EconomyController.canPurchaseItem(item, character)) {
        const response: ApiResponse = {
          success: false,
          error: 'Articolo non disponibile',
          code: 'ITEM_NOT_AVAILABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check stock
      if (item.currentStock < quantity) {
        const response: ApiResponse = {
          success: false,
          error: 'Scorte insufficienti',
          code: 'INSUFFICIENT_STOCK',
          details: {
            requested: quantity,
            available: item.currentStock
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Check requirements
      if (!EconomyController.meetsRequirements(item, character)) {
        const response: ApiResponse = {
          success: false,
          error: 'Requisiti non soddisfatti',
          code: 'REQUIREMENTS_NOT_MET',
          details: item.requirements,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Calculate total cost
      const totalCost = item.price * quantity;
      const wallet = character.walletId;
      const availableFunds = wallet.cash + wallet.deposit;

      if (availableFunds < totalCost) {
        const response: ApiResponse = {
          success: false,
          error: 'Fondi insufficienti',
          code: 'INSUFFICIENT_FUNDS',
          details: {
            required: totalCost,
            available: availableFunds
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Deduct money (prefer cash first, then deposit)
      let remainingCost = totalCost;
      if (wallet.cash >= remainingCost) {
        wallet.cash -= remainingCost;
      } else {
        remainingCost -= wallet.cash;
        wallet.cash = 0;
        wallet.deposit -= remainingCost;
      }

      // Update item stock
      item.currentStock -= quantity;

      // Add to inventory
      const existingItem = inventory.items.find((invItem: any) => invItem.itemId.toString() === itemId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        inventory.items.push({
          itemId,
          quantity,
          acquiredAt: new Date(),
          acquiredThrough: 'purchase',
          acquiredFrom: locationId,
          isEquipped: false,
          isVisible: true,
          timesUsed: 0
        } as any);
      }

      // Save all changes
      await Promise.all([wallet.save(), item.save(), inventory.save()]);

      // TODO: Publish Redis events
      // redis.publish('economy:purchase', { characterId, itemId, quantity, totalCost, shopId: locationId, stockRemaining: item.currentStock });

      logger.info('Item purchased', {
        characterId,
        itemId,
        quantity,
        totalCost,
        remainingStock: item.currentStock
      });

      const response: ApiResponse = {
        success: true,
        data: {
          purchase: {
            itemId,
            quantity,
            totalCost,
            totalCostFormatted: EconomyController.formatCurrency(totalCost)
          },
          newBalance: {
            cash: wallet.cash,
            deposit: wallet.deposit
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Purchase item error:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        characterId: req.character?.characterId,
        requestBody: req.body,
        params: req.params
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile acquistare l\'articolo',
        code: 'PURCHASE_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /game/economy/shops/:shopId/restock
   * Restock shop items (corporation officers only)
   */
  static async restockShop(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { itemId, quantity, payFromTreasury } = req.body;
      const characterId = req.character!.characterId;

      // Get character and verify corporation access
      const character = await (Character.findById(characterId).populate('corporations') as any);
      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get shop location and verify corporation ownership
      const location = await (Location.findById(shopId) as any);
      if (!location || !location.corporationId) {
        const response: ApiResponse = {
          success: false,
          error: 'Shop not found',
          code: 'SHOP_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if character is corporation officer
      const isCorporationMember = character.corporations.some(
        (corp: any) => corp.id.toString() === location.corporationId.toString()
      );

      if (!isCorporationMember) {
        const response: ApiResponse = {
          success: false,
          error: 'Accesso negato',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Get item and corporation
      const [item, corporation] = await Promise.all([
        ShopItem.findOne({ _id: itemId, locationId: shopId }),
        Corporation.findById(location.corporationId)
      ]) as any[];

      if (!item || !corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Articolo o corporazione non trovata',
          code: 'ITEM_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Calculate restock cost
      const restockCost = item.basePrice ? item.basePrice * quantity : item.price * quantity * 0.7; // 30% margin

      if (payFromTreasury) {
        if ((corporation.treasury || 0) < restockCost) {
          const response: ApiResponse = {
            success: false,
            error: 'Fondi del tesoro insufficienti',
            code: 'TREASURY_INSUFFICIENT_FUNDS',
            details: {
              required: restockCost,
              available: corporation.treasury || 0
            },
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

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

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile rifornire il negozio',
        code: 'RESTOCK_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
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