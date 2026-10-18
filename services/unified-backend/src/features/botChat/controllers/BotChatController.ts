import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { Location } from '@core/location/models/Location';
import { Chat } from '@core/chat/models/Chat';
import { ChatActionType } from '@core/chat/actionTypes/ChatActionType';
import { ChatSceneService } from '@features/fineSessione/api';
import { ChatWebSocketService } from '@modules/game/services/ChatWebSocketService';
import { logger } from '@modules/game/logger';
import { appConfig } from '@config/runtime';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';

const MAX_CONTENT_LENGTH = 1200;
/** Stesso limite di Chat.position. */
const MAX_POSITION_LENGTH = 50;

/**
 * Pubblica un messaggio `standard` pubblico a nome di un personaggio bot.
 * Chiamato solo da bot-service/ (secret condiviso, vedi botServiceAuth).
 *
 * Il personaggio deve appartenere all'utente di sistema dei bot e essere
 * approvato: il secret non permette di scrivere a nome di un giocatore vero.
 */
export class BotChatController {
  static async postMessage(req: Request, res: Response): Promise<void> {
    const { characterId, locationId, content, position } = (req.body ?? {}) as Record<string, unknown>;

    if (
      typeof characterId !== 'string' || typeof locationId !== 'string' || typeof content !== 'string' ||
      (position !== undefined && typeof position !== 'string')
    ) {
      res.status(400).json(errorResponse('characterId, locationId e content sono obbligatori (position, se presente, è una stringa)', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
      return;
    }
    const text = content.trim();
    if (text.length === 0 || text.length > MAX_CONTENT_LENGTH) {
      res.status(400).json(errorResponse(`content deve avere da 1 a ${MAX_CONTENT_LENGTH} caratteri`, 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
      return;
    }

    try {
      const [character, location] = await Promise.all([
        Character.findById(characterId).lean(),
        Location.findById(locationId).lean(),
      ]);

      if (!character || String(character.userId) !== appConfig.services.botService.systemUserId) {
        res.status(403).json(errorResponse('Personaggio non autorizzato come bot', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }
      if (character.playerStatus !== 'approved') {
        res.status(403).json(errorResponse('Il personaggio bot non è approvato', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }
      if (!location) {
        res.status(404).json(errorResponse('Location non trovata', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Il tag è quello del giocatore a cui il bot risponde. I tag sono liberi (es.
      // "Bancone", "Tavolo 2"), come nel ChatController: la location ne elenca solo
      // alcuni (Ingresso, Uscita), quindi non si valida contro quella lista.
      const tag = typeof position === 'string' ? position.trim().slice(0, MAX_POSITION_LENGTH) : '';
      const validPosition = tag || undefined;

      const saved = await Chat.createAction({
        actionType: ChatActionType.STANDARD,
        characterId: character._id.toString(),
        characterName: character.name,
        characterSurname: character.surname,
        characterAvatar: character.avatar,
        content: text,
        locationId: location._id.toString(),
        locationName: location.name,
        visibility: 'public',
        position: validPosition,
        timestamp: new Date(),
      });

      ChatSceneService.handleStandardMessage({
        chatMessageId: saved._id.toString(),
        locationId: saved.locationId,
        locationName: location.name,
        characterId: saved.characterId,
        characterName: saved.characterName,
        content: saved.content,
        timestamp: saved.timestamp,
      }).catch((error) => {
        logger.error('[BotChat] ChatScene handleStandardMessage failed', { error, locationId });
      });

      const message = {
        _id: saved._id.toString(),
        actionType: saved.actionType,
        characterId: saved.characterId,
        characterName: saved.characterName,
        characterAvatar: saved.characterAvatar || undefined,
        locationId: saved.locationId,
        content: saved.content,
        visibility: saved.visibility,
        position: saved.position || undefined,
        editHistory: [],
        timestamp: saved.timestamp.toISOString(),
      };
      ChatWebSocketService.emitMessageCreated({
        locationId: saved.locationId,
        message,
        locationName: location.name,
        locationSlug: location.slug,
      });

      res.status(201).json(successResponse({ _id: message._id }));
    } catch (error: unknown) {
      logger.error('[BotChat] postMessage failed', { error, characterId, locationId });
      res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
