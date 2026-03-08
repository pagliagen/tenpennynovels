import { BotRelationship, BotRelationshipSchema } from '../models/BotRelationship';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export class RelationshipService {
  /**
   * Get or create relationship between bot and character
   */
  async getOrCreateRelationship(
    botId: Types.ObjectId,
    characterId: string,
    characterName: string,
    dbContext?: any
  ): Promise<any> {
    try {
      const BotRelationshipModel = dbContext
        ? dbContext.getModel('BotRelationship', BotRelationshipSchema)
        : BotRelationship;

      let relationship = await BotRelationshipModel.findOne({
        botId,
        characterId
      });

      if (!relationship) {
        // Create new relationship with neutral values
        relationship = await BotRelationshipModel.create({
          botId,
          characterId,
          characterName,
          sentiment: 0,
          trustLevel: 50,
          familiarity: 0,
          lastInteraction: new Date(),
          interactionCount: 0,
          significantEvents: [],
          notes: ''
        });

        logger.info(`[Relationship] Created new relationship: bot ${botId} - character ${characterId}`);
      }

      return relationship;
    } catch (error) {
      logger.error('[Relationship] Error getting/creating relationship:', error);
      throw error;
    }
  }

  /**
   * Update relationship after interaction
   */
  async updateRelationship(
    botId: Types.ObjectId,
    characterId: string,
    characterName: string,
    sentimentChange: number = 0,
    trustChange: number = 0,
    familiarityIncrease: number = 1,
    eventDescription?: string,
    dbContext?: any
  ): Promise<any> {
    try {
      const relationship = await this.getOrCreateRelationship(botId, characterId, characterName, dbContext);

      // Update sentiment (clamped to -100, 100)
      relationship.sentiment = Math.max(-100, Math.min(100, relationship.sentiment + sentimentChange));

      // Update trust level (clamped to 0, 100)
      relationship.trustLevel = Math.max(0, Math.min(100, relationship.trustLevel + trustChange));

      // Increase familiarity (clamped to 0, 100)
      relationship.familiarity = Math.min(100, relationship.familiarity + familiarityIncrease);

      // Update interaction tracking
      relationship.lastInteraction = new Date();
      relationship.interactionCount += 1;

      // Add significant event if provided
      if (eventDescription && Math.abs(sentimentChange) > 5) {
        relationship.significantEvents.push({
          description: eventDescription,
          sentimentChange,
          timestamp: new Date()
        });

        // Keep only last 10 significant events
        if (relationship.significantEvents.length > 10) {
          relationship.significantEvents = relationship.significantEvents.slice(-10);
        }
      }

      await relationship.save();

      logger.debug(`[Relationship] Updated relationship: bot ${botId} - character ${characterId}`, {
        sentiment: relationship.sentiment,
        trustLevel: relationship.trustLevel,
        familiarity: relationship.familiarity
      });

      return relationship;
    } catch (error) {
      logger.error('[Relationship] Error updating relationship:', error);
      throw error;
    }
  }

  /**
   * Get relationship data
   */
  async getRelationship(
    botId: Types.ObjectId,
    characterId: string,
    dbContext?: any
  ): Promise<any | null> {
    try {
      const BotRelationshipModel = dbContext
        ? dbContext.getModel('BotRelationship', BotRelationshipSchema)
        : BotRelationship;

      const relationship = await BotRelationshipModel.findOne({
        botId,
        characterId
      });

      return relationship;
    } catch (error) {
      logger.error('[Relationship] Error fetching relationship:', error);
      return null;
    }
  }

  /**
   * Get all relationships for a bot
   */
  async getAllRelationships(botId: Types.ObjectId, dbContext?: any): Promise<any[]> {
    try {
      const BotRelationshipModel = dbContext
        ? dbContext.getModel('BotRelationship', BotRelationshipSchema)
        : BotRelationship;

      const relationships = await BotRelationshipModel.find({ botId })
        .sort({ lastInteraction: -1 })
        .lean();

      return relationships;
    } catch (error) {
      logger.error('[Relationship] Error fetching all relationships:', error);
      return [];
    }
  }

  /**
   * Get relationships for multiple characters
   */
  async getRelationshipsForCharacters(
    botId: Types.ObjectId,
    characterIds: string[],
    dbContext?: any
  ): Promise<any[]> {
    try {
      const BotRelationshipModel = dbContext
        ? dbContext.getModel('BotRelationship', BotRelationshipSchema)
        : BotRelationship;

      const relationships = await BotRelationshipModel.find({
        botId,
        characterId: { $in: characterIds }
      }).lean();

      return relationships;
    } catch (error) {
      logger.error('[Relationship] Error fetching multiple relationships:', error);
      return [];
    }
  }

  /**
   * Calculate sentiment change based on action content
   * Simple heuristic for now, can be enhanced with NLP
   */
  calculateSentimentChange(actionContent: string, botPersonality: any): number {
    const content = actionContent.toLowerCase();

    // Positive keywords
    const positiveKeywords = ['grazie', 'aiuto', 'amico', 'bene', 'piacere', 'felice', 'ottimo'];
    const positiveCount = positiveKeywords.filter(kw => content.includes(kw)).length;

    // Negative keywords
    const negativeKeywords = ['idiota', 'stupido', 'male', 'cattivo', 'odio', 'nemico', 'brutto'];
    const negativeCount = negativeKeywords.filter(kw => content.includes(kw)).length;

    // Calculate base change
    let change = (positiveCount * 3) - (negativeCount * 5);

    // Apply personality modifier (emotional range)
    if (botPersonality?.emotionalRange) {
      const emotionalSensitivity = (botPersonality.emotionalRange.max - botPersonality.emotionalRange.min) / 20;
      change *= emotionalSensitivity;
    }

    // Clamp to reasonable range
    return Math.max(-10, Math.min(10, Math.round(change)));
  }

  /**
   * Update relationship notes
   */
  async updateNotes(
    botId: Types.ObjectId,
    characterId: string,
    notes: string,
    dbContext?: any
  ): Promise<void> {
    try {
      const BotRelationshipModel = dbContext
        ? dbContext.getModel('BotRelationship', BotRelationshipSchema)
        : BotRelationship;

      await BotRelationshipModel.findOneAndUpdate(
        { botId, characterId },
        { notes }
      );

      logger.debug(`[Relationship] Updated notes for bot ${botId} - character ${characterId}`);
    } catch (error) {
      logger.error('[Relationship] Error updating notes:', error);
    }
  }

  /**
   * Get relationship summary for bot context
   */
  getRelationshipSummary(relationship: any): string {
    if (!relationship) return 'Sconosciuto';

    const sentimentLabel =
      relationship.sentiment > 50 ? 'molto positivo' :
      relationship.sentiment > 20 ? 'positivo' :
      relationship.sentiment > -20 ? 'neutrale' :
      relationship.sentiment > -50 ? 'negativo' : 'molto negativo';

    const trustLabel =
      relationship.trustLevel > 70 ? 'alta fiducia' :
      relationship.trustLevel > 40 ? 'fiducia moderata' : 'poca fiducia';

    const familiarityLabel =
      relationship.familiarity > 70 ? 'conosce bene' :
      relationship.familiarity > 40 ? 'conoscenza media' : 'appena conosciuto';

    return `${relationship.characterName}: ${familiarityLabel}, sentimento ${sentimentLabel}, ${trustLabel} (${relationship.interactionCount} interazioni)`;
  }
}

export const relationshipService = new RelationshipService();
