import { Request, Response } from 'express';
import { Character, CharacterWallet, Transaction, Item, ShopItem, CharacterInventory, Location, Corporation, CharacterFinances, SocialClassConfig } from '@database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';

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
        res.status(404).json(errorResponse(
          'Portafoglio non trovato',
          'WALLET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Defense in depth: Verify character is APPROVED
      if (character.playerStatus !== 'approved') {
        logger.warn('SECURITY: DRAFT character attempted to access wallet', {
          characterId,
          status: character.playerStatus,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono accedere al portafoglio',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const wallet = character.walletId;
      const totalPence = wallet.cash + wallet.deposit;

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

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

      res.status(500).json(errorResponse(
        'Impossibile recuperare il portafoglio',
        'GET_WALLET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Non puoi trasferire denaro a te stesso',
          'INVALID_TRANSFER_TARGET',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const [fromCharacter, toCharacter] = await Promise.all([
        Character.findById(characterId).populate('walletId'),
        Character.findById(targetCharacterId).populate('walletId')
      ]) as any[];

      if (!fromCharacter || !toCharacter || !fromCharacter.walletId || !toCharacter.walletId) {
        res.status(404).json(errorResponse(
          'Personaggio o portafoglio non trovato',
          'CHARACTER_WALLET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Defense in depth: Verify sender is APPROVED
      if (fromCharacter.status !== 'approved') {
        logger.warn('SECURITY: DRAFT character attempted money transfer', {
          fromCharacterId: characterId,
          toCharacterId: targetCharacterId,
          amount,
          status: fromCharacter.status,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono trasferire denaro',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Verify recipient is APPROVED
      if (toCharacter.status !== 'approved') {
        res.status(403).json(errorResponse(
          'Il destinatario deve essere un personaggio approvato',
          'RECIPIENT_NOT_APPROVED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check sufficient funds
      const fromWallet = fromCharacter.walletId;
      const availableFunds = type === 'cash' ? fromWallet.cash : fromWallet.deposit;

      if (availableFunds < amount) {
        res.status(400).json(errorResponse(
          'Fondi insufficienti',
          'INSUFFICIENT_FUNDS',
          {
            requested: amount,
            available: availableFunds,
            type
          },
          400,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

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

      res.status(500).json(errorResponse(
        'Impossibile trasferire denaro',
        'TRANSFER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

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

        // Require approved character
        if (character.playerStatus !== 'approved') {
          res.status(403).json(errorResponse(
            'L\'accesso al negozio richiede un personaggio approvato',
            'CHARACTER_NOT_APPROVED',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }

        finances = await CharacterFinances.findOne({ characterId });
      }

      // Get all public items
      const items = await Item.find({ isPublic: true })
        .select('name description category subcategory basePrice rarity properties prerequisites financialSettings imageUrl')
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
          rarity: item.rarity,
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

      // Check if character is approved to access shop
      if (character.playerStatus !== 'approved') {
        res.status(403).json(errorResponse(
          'L\'accesso al negozio richiede un personaggio approvato',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
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
   * POST /game/economy/purchase
   * Purchase item from shop or general store
   */
  static async purchaseItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, quantity = 1, locationId, isGeneralStore = false } = req.body;
      const characterId = req.character!.characterId;

      // Get character and inventory
      const [character, inventory] = await Promise.all([
        Character.findById(characterId).populate('walletId corporations'),
        CharacterInventory.findOne({ characterId }).populate('items')
      ]) as any[];

      if (!character || !inventory) {
        res.status(404).json(errorResponse(
          'Personaggio o inventario non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Defense in depth: Verify character is APPROVED
      if (character.playerStatus !== 'approved') {
        logger.warn('SECURITY: DRAFT character attempted item purchase', {
          characterId,
          itemId,
          quantity,
          status: character.playerStatus,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono acquistare articoli',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      let item: any;
      let itemPrice: number;
      let actualItemId: string;

      if (isGeneralStore) {
        // Purchase from general store: itemId is Item ID
        item = await Item.findById(itemId);

        if (!item) {
          res.status(404).json(errorResponse(
            'Articolo non trovato',
            'ITEM_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Check if item is public
        if (!item.isPublic) {
          res.status(404).json(errorResponse(
            'Articolo non disponibile nel mercato generale',
            'ITEM_NOT_AVAILABLE',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        itemPrice = item.basePrice;
        actualItemId = item._id.toString();
      } else {
        // Purchase from location shop: itemId is ShopItem ID
        const shopItem = await ShopItem.findById(itemId).populate('itemId');

        if (!shopItem) {
          res.status(404).json(errorResponse(
            'Articolo non trovato',
            'ITEM_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Verify item is visible and available
        if (!EconomyController.canPurchaseItem(shopItem, character)) {
          res.status(404).json(errorResponse(
            'Articolo non disponibile',
            'ITEM_NOT_AVAILABLE',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Check stock
        if (shopItem.currentStock < quantity) {
          res.status(400).json(errorResponse(
            'Scorte insufficienti',
            'INSUFFICIENT_STOCK',
            {
              requested: quantity,
              available: shopItem.currentStock
            },
            400,
            getRequestId(req)
          ));
          return;
        }

        item = shopItem.itemId;
        itemPrice = shopItem.price;
        actualItemId = item._id.toString();
      }

      // Check requirements
      if (!EconomyController.meetsRequirements(item, character)) {
        res.status(400).json(errorResponse(
          'Requisiti non soddisfatti',
          'REQUIREMENTS_NOT_MET',
          item.prerequisites,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Calculate total cost
      const totalCost = itemPrice * quantity;
      const wallet = character.walletId;
      const availableFunds = wallet.cash + wallet.deposit;

      if (availableFunds < totalCost) {
        res.status(400).json(errorResponse(
          'Fondi insufficienti',
          'INSUFFICIENT_FUNDS',
          {
            required: totalCost,
            available: availableFunds
          },
          400,
          getRequestId(req)
        ));
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

      // Update item stock (only for location shops)
      if (!isGeneralStore) {
        const shopItem = await ShopItem.findById(itemId);
        if (shopItem) {
          shopItem.currentStock -= quantity;
          await shopItem.save();
        }
      }

      // Add to inventory
      const existingItem = inventory.items.find((invItem: any) => invItem.itemId.toString() === actualItemId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        inventory.items.push({
          itemId: actualItemId,
          quantity,
          acquiredAt: new Date(),
          acquiredThrough: 'purchase',
          acquiredFrom: isGeneralStore ? 'general_store' : locationId,
          isEquipped: false,
          isVisible: true,
          timesUsed: 0
        } as any);
      }

      // Save all changes
      await Promise.all([wallet.save(), inventory.save()]);

      // TODO: Publish Redis events
      // redis.publish('economy:purchase', { characterId, itemId, quantity, totalCost, shopId: locationId, stockRemaining: item.currentStock });

      logger.info('Item purchased', {
        characterId,
        itemId,
        quantity,
        totalCost,
        remainingStock: item.currentStock
      });

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

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

      res.status(500).json(errorResponse(
        'Impossibile acquistare l\'articolo',
        'PURCHASE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
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

      // Defense in depth: Verify character is APPROVED
      if (character.playerStatus !== 'approved') {
        logger.warn('SECURITY: DRAFT character attempted shop restock', {
          characterId,
          shopId,
          status: character.playerStatus,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono rifornire negozi',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
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