import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { CharacterInventory, Item } from '../models/Item';
import { logger } from '@modules/game/logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';
import { isValidObjectId } from '@shared/utils/validation';

async function assertOwner(characterId: string, userId: string) {
  const character = await Character.findById(characterId);
  if (!character) return { character: null, isOwner: false };
  return { character, isOwner: character.userId.toString() === userId };
}

export class CharacterInventoryActionsController {
  /**
   * GET /characters/:characterId/inventory
   * Inventario "grezzo" (righe di CharacterInventory, non il merge legacy con lo
   * starting kit usato da GET /characters/:id?view=sheet): necessario per equip/
   * disequip/butta/cedi, che operano sull'_id della singola riga di inventario,
   * non sull'Item catalogato (i due ID sono diversi e la vista scheda non espone
   * il primo).
   */
  static async listInventory(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const inventory = await CharacterInventory.findOne({ characterId }).lean();
      const rawItems = (inventory?.items || []).filter((entry: any) => isOwner || isMaster || entry.isVisible !== false);

      const itemIds = rawItems.map((entry: any) => entry.itemId);
      const itemDefs = await Item.find({ _id: { $in: itemIds } }).select('name description category imageUrl image').lean();
      const itemDefMap = new Map(itemDefs.map((i: any) => [i._id.toString(), i]));

      interface InventoryItemView {
        inventoryItemId: string | undefined;
        itemId: string;
        name: string;
        description: string;
        category: string | undefined;
        imageUrl: string | undefined;
        quantity: number;
        isEquipped: boolean;
        isVisible: boolean;
      }

      const items: InventoryItemView[] = rawItems.map((entry: any) => {
        const def = itemDefMap.get(entry.itemId.toString());
        return {
          // _id (non il campo custom "id" del sub-schema, mai popolato in pratica):
          // è quello che CharacterInventory.items.id()/removeItem() usano davvero.
          inventoryItemId: entry._id?.toString(),
          itemId: entry.itemId.toString(),
          name: entry.customName || def?.name || 'Oggetto sconosciuto',
          description: entry.customDescription || def?.description || '',
          category: def?.category,
          imageUrl: def?.imageUrl || def?.image,
          quantity: entry.quantity,
          isEquipped: !!entry.isEquipped,
          isVisible: entry.isVisible !== false
        };
      });

      res.json(successResponse({
        equipped: items.filter((i: InventoryItemView) => i.isEquipped),
        unequipped: items.filter((i: InventoryItemView) => !i.isEquipped)
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing character inventory:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * PATCH /characters/:characterId/inventory/:inventoryItemId/equip
   * body: { equip: boolean }
   */
  static async setEquipped(req: Request<{ characterId: string; inventoryItemId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, inventoryItemId } = req.params;
      const equip = !!req.body?.equip;
      const userId = req.user!.userId;

      const { character, isOwner } = await assertOwner(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può equipaggiare i propri oggetti', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const inventory = await CharacterInventory.findOne({ characterId });
      const item = inventory?.items.id(inventoryItemId);
      if (!inventory || !item) {
        res.status(404).json(errorResponse('Oggetto non trovato nell\'inventario', 'INVENTORY_ITEM_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      item.isEquipped = equip;
      inventory.lastUpdated = new Date();
      await inventory.save();

      res.json(successResponse({ inventoryItemId, isEquipped: item.isEquipped }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error toggling item equip state:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * DELETE /characters/:characterId/inventory/:inventoryItemId
   * body: { quantity? } — "butta" un oggetto (o parte della pila)
   */
  static async discardItem(req: Request<{ characterId: string; inventoryItemId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, inventoryItemId } = req.params;
      const quantity = Number(req.body?.quantity) || undefined;
      const userId = req.user!.userId;

      const { character, isOwner } = await assertOwner(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può disfarsi dei propri oggetti', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const inventory = await CharacterInventory.findOne({ characterId });
      if (!inventory) {
        res.status(404).json(errorResponse('Inventario non trovato', 'INVENTORY_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const removed = (inventory as any).removeItem(inventoryItemId, quantity ?? 1e9);
      if (!removed) {
        res.status(404).json(errorResponse('Oggetto non trovato nell\'inventario', 'INVENTORY_ITEM_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      await inventory.save();

      res.json(successResponse({ discarded: true }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error discarding item:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/inventory/:inventoryItemId/transfer
   * body: { toCharacterId, quantity }
   * Cessione istantanea a un altro personaggio (nessuna accettazione richiesta).
   */
  static async transferItem(req: Request<{ characterId: string; inventoryItemId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, inventoryItemId } = req.params;
      const { toCharacterId } = req.body || {};
      const quantity = Number(req.body?.quantity) || 1;
      const userId = req.user!.userId;

      if (!toCharacterId) {
        res.status(400).json(errorResponse('Destinatario mancante', 'MISSING_RECIPIENT', undefined, 400, getRequestId(req)));
        return;
      }
      if (toCharacterId === characterId) {
        res.status(400).json(errorResponse('Non puoi cedere un oggetto a te stesso', 'INVALID_RECIPIENT', undefined, 400, getRequestId(req)));
        return;
      }
      // toCharacterId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value anywhere below (NoSQL injection guard)
      if (typeof toCharacterId !== 'string' || !isValidObjectId(toCharacterId)) {
        res.status(400).json(errorResponse('Destinatario non valido', 'INVALID_RECIPIENT', undefined, 400, getRequestId(req)));
        return;
      }

      const { character, isOwner } = await assertOwner(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può cedere i propri oggetti', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const recipient = await Character.findById(toCharacterId);
      if (!recipient || recipient.playerStatus !== 'approved') {
        res.status(404).json(errorResponse('Personaggio destinatario non trovato o non approvato', 'RECIPIENT_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const sourceInventory = await CharacterInventory.findOne({ characterId });
      const sourceItem = sourceInventory?.items.id(inventoryItemId);
      if (!sourceInventory || !sourceItem) {
        res.status(404).json(errorResponse('Oggetto non trovato nell\'inventario', 'INVENTORY_ITEM_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (sourceItem.quantity < quantity) {
        res.status(400).json(errorResponse('Quantità insufficiente', 'INSUFFICIENT_QUANTITY', undefined, 400, getRequestId(req)));
        return;
      }

      const item = await Item.findById(sourceItem.itemId);
      if (!item) {
        res.status(404).json(errorResponse('Definizione oggetto non trovata', 'ITEM_DEFINITION_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      let recipientInventory = await CharacterInventory.findOne({ characterId: toCharacterId });
      if (!recipientInventory) {
        recipientInventory = new CharacterInventory({ characterId: toCharacterId, items: [], lastUpdated: new Date() });
      }

      // Rimuovi dal cedente
      (sourceInventory as any).removeItem(inventoryItemId, quantity);
      // Aggiungi al destinatario (si accumula se già presente e stackabile, come da comportamento addItem esistente)
      (recipientInventory as any).addItem(sourceItem.itemId, quantity, 'trade', {
        customName: sourceItem.customName,
        acquiredFrom: characterId
      });

      await sourceInventory.save();
      await recipientInventory.save();

      logger.info('Item transferred between characters', { fromCharacterId: characterId, toCharacterId, itemId: sourceItem.itemId.toString(), quantity });

      res.json(successResponse({ transferred: true, itemName: item.name, quantity, toCharacterName: recipient.name }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error transferring item:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
