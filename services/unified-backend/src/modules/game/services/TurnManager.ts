import { Types } from 'mongoose';
import { GamingSession, Location, Character } from '@database/models';
import { logger } from '../utils/logger';

export interface TurnInfo {
  sessionId: string;
  currentTurnIndex: number;
  currentCharacterId: string;
  currentCharacterName: string;
  isBot: boolean;
  turnPhase: 'player' | 'bot' | 'waiting';
  turnOrder: string[];
  nextCharacterId?: string;
}

/**
 * TurnManager handles turn-based gameplay in gaming sessions
 * Manages the cyclic turn order: [playerA, playerB, ..., bot]
 */
export class TurnManager {
  /**
   * Initialize turn order for a session
   * Order: [playerA, playerB, ..., bot] cyclical
   */
  async initializeTurnOrder(
    sessionId: Types.ObjectId | string,
    locationId: string
  ): Promise<TurnInfo | null> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session) {
        logger.error(`[TurnManager] Session ${sessionId} not found`);
        return null;
      }

      const location = await Location.findById(locationId);
      if (!location) {
        logger.error(`[TurnManager] Location ${locationId} not found`);
        return null;
      }

      // Get active player characters in location (exclude bots)
      const playerCharacterIds = location.occupants
        .filter((occ: any) => occ.isActive)
        .map((occ: any) => occ.characterId);

      const players = await Character.find({
        _id: { $in: playerCharacterIds },
        bot_id: { $exists: false } // Exclude bots
      }).select('_id name');

      // Find bot in location (if present)
      const botCharacter = await Character.findOne({
        currentLocation: locationId,
        bot_id: { $exists: true }
      }).select('_id name bot_id');

      if (players.length === 0) {
        logger.warn(`[TurnManager] No players in location ${locationId}`);
        return null;
      }

      // Build turn order: players + bot (if present)
      const turnOrder: Types.ObjectId[] = players.map(p => p._id);
      if (botCharacter) {
        turnOrder.push(botCharacter._id);
      }

      // Update session
      session.turnOrder = turnOrder;
      session.currentTurnIndex = 0;
      session.turnPhase = 'player';
      session.lastTurnAt = new Date();
      session.botCharacterId = botCharacter?._id;
      await session.save();

      logger.info(`[TurnManager] Turn order initialized for session ${sessionId}: ${turnOrder.length} participants`);

      return this.getCurrentTurnInfo(sessionId);

    } catch (error) {
      logger.error('[TurnManager] Error initializing turn order:', error);
      return null;
    }
  }

  /**
   * Get info about current turn
   */
  async getCurrentTurnInfo(sessionId: Types.ObjectId | string): Promise<TurnInfo | null> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session || !session.turnOrder || session.turnOrder.length === 0) {
        return null;
      }

      const currentCharacterId = session.turnOrder[session.currentTurnIndex || 0];
      const currentCharacter = await Character.findById(currentCharacterId);

      if (!currentCharacter) {
        logger.warn(`[TurnManager] Current turn character not found: ${currentCharacterId}`);
        return null;
      }

      const isBot = !!currentCharacter.bot_id;

      // Calculate next character
      const nextIndex = ((session.currentTurnIndex || 0) + 1) % session.turnOrder.length;
      const nextCharacterId = session.turnOrder[nextIndex];

      return {
        sessionId: session._id.toString(),
        currentTurnIndex: session.currentTurnIndex || 0,
        currentCharacterId: currentCharacterId.toString(),
        currentCharacterName: currentCharacter.name,
        isBot,
        turnPhase: session.turnPhase || 'player',
        turnOrder: session.turnOrder.map((id: any) => id.toString()),
        nextCharacterId: nextCharacterId?.toString()
      };

    } catch (error) {
      logger.error('[TurnManager] Error getting current turn info:', error);
      return null;
    }
  }

  /**
   * Advance to next turn
   */
  async advanceTurn(sessionId: Types.ObjectId | string): Promise<TurnInfo | null> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session || !session.turnOrder || session.turnOrder.length === 0) {
        logger.warn(`[TurnManager] Cannot advance turn: session has no turn order`);
        return null;
      }

      // Advance index (cyclical)
      const nextIndex = ((session.currentTurnIndex || 0) + 1) % session.turnOrder.length;
      session.currentTurnIndex = nextIndex;
      session.lastTurnAt = new Date();

      // Determine if it's bot turn
      const nextCharacterId = session.turnOrder[nextIndex];
      const nextCharacter = await Character.findById(nextCharacterId);

      if (nextCharacter?.bot_id) {
        session.turnPhase = 'bot';
        session.botTurnsPending = (session.botTurnsPending || 0) + 1;

        logger.info(`[TurnManager] Advanced to BOT turn (index ${nextIndex})`);
      } else {
        session.turnPhase = 'player';

        logger.info(`[TurnManager] Advanced to PLAYER turn (index ${nextIndex})`);
      }

      await session.save();

      return this.getCurrentTurnInfo(sessionId);

    } catch (error) {
      logger.error('[TurnManager] Error advancing turn:', error);
      return null;
    }
  }

  /**
   * Check if it's bot turn
   */
  async isBotTurn(sessionId: Types.ObjectId | string): Promise<boolean> {
    const turnInfo = await this.getCurrentTurnInfo(sessionId);
    return turnInfo?.isBot || false;
  }

  /**
   * Mark bot turn as completed
   */
  async completeBotTurn(sessionId: Types.ObjectId | string): Promise<void> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session) return;

      if (session.botTurnsPending && session.botTurnsPending > 0) {
        session.botTurnsPending -= 1;
      }

      // Automatically advance to next turn
      await this.advanceTurn(sessionId);

      logger.info(`[TurnManager] Bot turn completed for session ${sessionId}`);

    } catch (error) {
      logger.error('[TurnManager] Error completing bot turn:', error);
    }
  }

  /**
   * Add character to turn order (character enters location)
   */
  async addCharacterToTurnOrder(
    sessionId: Types.ObjectId | string,
    characterId: Types.ObjectId
  ): Promise<void> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session) return;

      // Initialize turnOrder if not exists
      if (!session.turnOrder) {
        session.turnOrder = [];
      }

      // Check if already present
      const isAlreadyInOrder = session.turnOrder.some((id: any) => id.equals(characterId));
      if (isAlreadyInOrder) {
        logger.debug(`[TurnManager] Character ${characterId} already in turn order`);
        return;
      }

      // Determine if it's a bot
      const character = await Character.findById(characterId);
      const isBot = !!character?.bot_id;

      if (isBot) {
        // Bot goes always at the end
        session.turnOrder.push(characterId);
        session.botCharacterId = characterId;
      } else {
        // Player: insert before bot (if present)
        const botIndex = await this.findBotIndexInTurnOrder(session.turnOrder);

        if (botIndex >= 0) {
          session.turnOrder.splice(botIndex, 0, characterId);
        } else {
          session.turnOrder.push(characterId);
        }
      }

      await session.save();
      logger.info(`[TurnManager] Character ${characterId} added to turn order`);

    } catch (error) {
      logger.error('[TurnManager] Error adding character to turn order:', error);
    }
  }

  /**
   * Remove character from turn order (character leaves location)
   */
  async removeCharacterFromTurnOrder(
    sessionId: Types.ObjectId | string,
    characterId: Types.ObjectId
  ): Promise<void> {
    try {
      const session = await GamingSession.findById(sessionId);
      if (!session || !session.turnOrder) return;

      const characterIndex = session.turnOrder.findIndex((id: any) => id.equals(characterId));
      if (characterIndex === -1) {
        logger.debug(`[TurnManager] Character ${characterId} not in turn order`);
        return;
      }

      // Remove
      session.turnOrder.splice(characterIndex, 1);

      // Adjust currentTurnIndex if necessary
      if (session.currentTurnIndex !== undefined && session.currentTurnIndex >= session.turnOrder.length) {
        session.currentTurnIndex = session.turnOrder.length > 0 ? 0 : undefined;
      }

      // If was the bot, remove reference
      const character = await Character.findById(characterId);
      if (character?.bot_id && session.botCharacterId?.equals(characterId)) {
        session.botCharacterId = undefined;
      }

      await session.save();
      logger.info(`[TurnManager] Character ${characterId} removed from turn order`);

    } catch (error) {
      logger.error('[TurnManager] Error removing character from turn order:', error);
    }
  }

  /**
   * Helper: find bot index in turn order
   */
  private async findBotIndexInTurnOrder(turnOrder: Types.ObjectId[]): Promise<number> {
    for (let i = 0; i < turnOrder.length; i++) {
      const char = await Character.findById(turnOrder[i]);
      if (char?.bot_id) {
        return i;
      }
    }
    return -1;
  }
}

export const turnManager = new TurnManager();
