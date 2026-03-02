import { BotMemory, BotMemorySchema } from '../models/BotMemory';
import { logger } from '../utils/logger';
import { generateMemoryEmbedding, cosineSimilarity } from '../utils/embeddings';
import { Types } from 'mongoose';

export class BotMemoryService {
  /**
   * Create new memory for bot
   */
  async createMemory(
    botId: Types.ObjectId,
    locationId: string,
    type: 'conversation' | 'event' | 'observation',
    content: string,
    participants: string[],
    emotionalImpact: number = 0,
    importance: number = 50,
    dbContext?: any
  ): Promise<any> {
    try {
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memory = await BotMemoryModel.create({
        botId,
        locationId,
        type,
        content,
        participants,
        emotionalImpact,
        importance,
        timestamp: new Date()
      });

      logger.debug(`[BotMemory] Created memory for bot ${botId}: ${type}`);

      // Generate embedding asynchronously (fire-and-forget)
      this.generateEmbeddingForMemory(memory._id.toString(), content, locationId, dbContext)
        .catch(error => {
          logger.error(`[BotMemory] Failed to generate embedding for memory ${memory._id}:`, error);
        });

      return memory;

    } catch (error) {
      logger.error('[BotMemory] Error creating memory:', error);
      throw error;
    }
  }

  /**
   * Get recent memories for bot
   */
  async getRecentMemories(
    botId: Types.ObjectId,
    limit: number = 10,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memories = await BotMemoryModel.find({ botId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return memories;
    } catch (error) {
      logger.error(`[BotMemory] Error fetching recent memories for bot ${botId}:`, error);
      return [];
    }
  }

  /**
   * Get memories for specific location
   */
  async getLocationMemories(
    botId: Types.ObjectId,
    locationId: string,
    limit: number = 20,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memories = await BotMemoryModel.find({
        botId,
        locationId
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return memories;
    } catch (error) {
      logger.error(`[BotMemory] Error fetching location memories:`, error);
      return [];
    }
  }

  /**
   * Get important memories (importance > 70)
   */
  async getImportantMemories(
    botId: Types.ObjectId,
    limit: number = 10,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memories = await BotMemoryModel.find({
        botId,
        importance: { $gt: 70 }
      })
        .sort({ importance: -1, timestamp: -1 })
        .limit(limit)
        .lean();

      return memories;
    } catch (error) {
      logger.error(`[BotMemory] Error fetching important memories:`, error);
      return [];
    }
  }

  /**
   * Get memories involving specific character
   */
  async getMemoriesWithCharacter(
    botId: Types.ObjectId,
    characterId: string,
    limit: number = 10,
    dbContext?: any
  ): Promise<any[]> {
    try {
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memories = await BotMemoryModel.find({
        botId,
        participants: characterId
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return memories;
    } catch (error) {
      logger.error(`[BotMemory] Error fetching memories with character:`, error);
      return [];
    }
  }

  /**
   * Get contextual memories for bot response generation
   * Combines recent, important, and location-specific memories
   */
  async getContextualMemories(
    botId: Types.ObjectId,
    locationId: string,
    characterIds: string[],
    dbContext?: any
  ): Promise<any[]> {
    try {
      // Get different types of relevant memories
      const [recentMemories, locationMemories, importantMemories] = await Promise.all([
        this.getRecentMemories(botId, 5, dbContext),
        this.getLocationMemories(botId, locationId, 5, dbContext),
        this.getImportantMemories(botId, 3, dbContext)
      ]);

      // Get memories with characters present in the location
      const characterMemories = await Promise.all(
        characterIds.slice(0, 3).map(charId =>
          this.getMemoriesWithCharacter(botId, charId, 2, dbContext)
        )
      );

      // Combine and deduplicate memories
      const allMemories = [
        ...recentMemories,
        ...locationMemories,
        ...importantMemories,
        ...characterMemories.flat()
      ];

      // Deduplicate by memory ID
      const uniqueMemories = Array.from(
        new Map(allMemories.map(m => [m._id.toString(), m])).values()
      );

      // Sort by timestamp descending and limit to 15 total
      return uniqueMemories
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);

    } catch (error) {
      logger.error('[BotMemory] Error getting contextual memories:', error);
      return [];
    }
  }

  /**
   * Update memory importance
   */
  async updateMemoryImportance(
    memoryId: Types.ObjectId,
    importance: number
  ): Promise<void> {
    try {
      await BotMemory.findByIdAndUpdate(memoryId, { importance });
      logger.debug(`[BotMemory] Updated memory ${memoryId} importance to ${importance}`);
    } catch (error) {
      logger.error('[BotMemory] Error updating memory importance:', error);
    }
  }

  /**
   * Clean up old, low-importance memories (older than 7 days and importance < 30)
   */
  async cleanupOldMemories(botId: Types.ObjectId): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await BotMemory.deleteMany({
        botId,
        timestamp: { $lt: sevenDaysAgo },
        importance: { $lt: 30 }
      });

      logger.info(`[BotMemory] Cleaned up ${result.deletedCount} old memories for bot ${botId}`);
    } catch (error) {
      logger.error('[BotMemory] Error cleaning up old memories:', error);
    }
  }

  /**
   * Generate embedding for a memory (async, fire-and-forget)
   */
  private async generateEmbeddingForMemory(
    memoryId: string,
    content: string,
    locationId: string,
    dbContext?: any
  ): Promise<void> {
    try {
      logger.debug(`[BotMemory] Generating embedding for memory ${memoryId}`);

      const result = await generateMemoryEmbedding(content, locationId);

      if (!result.success || !result.embedding) {
        logger.warn(`[BotMemory] Failed to generate embedding: ${result.error}`);
        return;
      }

      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      await BotMemoryModel.findByIdAndUpdate(memoryId, {
        embedding: result.embedding
      });

      logger.debug(`[BotMemory] Embedding generated and saved for memory ${memoryId}`);
    } catch (error) {
      logger.error(`[BotMemory] Error generating embedding for memory ${memoryId}:`, error);
    }
  }

  /**
   * Search memories by semantic similarity to a query
   * Returns most relevant memories based on embedding similarity
   */
  async semanticMemorySearch(
    botId: Types.ObjectId,
    queryText: string,
    limit: number = 5,
    minSimilarity: number = 0.5,
    dbContext?: any
  ): Promise<any[]> {
    try {
      // Generate embedding for query
      const queryResult = await generateMemoryEmbedding(queryText, '');
      if (!queryResult.success || !queryResult.embedding) {
        logger.warn('[BotMemory] Failed to generate query embedding, falling back to recent memories');
        return this.getRecentMemories(botId, limit, dbContext);
      }

      const queryEmbedding = queryResult.embedding;

      // Fetch all memories with embeddings for this bot
      const BotMemoryModel = dbContext
        ? dbContext.getModel('BotMemory', BotMemorySchema)
        : BotMemory;

      const memories = await BotMemoryModel.find({
        botId,
        embedding: { $exists: true, $ne: [] }
      }).lean();

      if (memories.length === 0) {
        logger.debug('[BotMemory] No memories with embeddings found, falling back to recent');
        return this.getRecentMemories(botId, limit, dbContext);
      }

      // Calculate similarity scores
      const memoriesWithScores = memories.map((memory: any) => ({
        ...memory,
        similarity: cosineSimilarity(queryEmbedding, memory.embedding)
      }));

      // Filter by minimum similarity and sort by score
      const relevantMemories = memoriesWithScores
        .filter(m => m.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.debug(`[BotMemory] Semantic search found ${relevantMemories.length} relevant memories (min similarity: ${minSimilarity})`);

      return relevantMemories;

    } catch (error) {
      logger.error('[BotMemory] Error in semantic memory search:', error);
      // Fallback to recent memories on error
      return this.getRecentMemories(botId, limit, dbContext);
    }
  }
}

export const botMemoryService = new BotMemoryService();
