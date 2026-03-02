import { CharacterSnapshot, CharacterSnapshotSchema } from '../models/CharacterSnapshot';
import { logger } from '../utils/logger';

export class CharacterSnapshotService {
  /**
   * Update or create character snapshot from sync data
   */
  async updateSnapshot(characterData: any, dbContext?: any): Promise<void> {
    try {
      const CharacterSnapshotModel = dbContext
        ? dbContext.getModel('CharacterSnapshot', CharacterSnapshotSchema)
        : CharacterSnapshot;

      const { characterId } = characterData;

      if (!characterId) {
        logger.warn('[CharacterSnapshot] No characterId provided in sync data');
        return;
      }

      // Extract relevant data for snapshot
      const snapshotData = {
        characterId,
        name: characterData.name || 'Unknown',
        surname: characterData.surname,
        age: characterData.age,
        gender: characterData.gender || 'male',
        appearance: {
          height: characterData.height,
          eyeColor: characterData.eyeColor,
          hairColor: characterData.hairColor,
          physicalDescription: characterData.physicalDescription
        },
        background: {
          briefHistory: characterData.background?.briefHistory,
          personality: characterData.background?.personality,
          significantEvents: characterData.background?.significantEvents
        },
        occupation: characterData.occupation,
        socialClass: characterData.socialClass,
        mainStats: {
          strength: characterData.stats?.strength,
          intelligence: characterData.stats?.intelligence,
          charm: characterData.stats?.charm
        },
        mainSkills: this.extractTopSkills(characterData.skills),
        lastSyncedAt: new Date()
      };

      // Upsert snapshot
      await CharacterSnapshotModel.findOneAndUpdate(
        { characterId },
        snapshotData,
        { upsert: true, new: true }
      );

      logger.info(`[CharacterSnapshot] Updated snapshot for character ${characterId}`);

    } catch (error) {
      logger.error('[CharacterSnapshot] Error updating snapshot:', error);
      throw error;
    }
  }

  /**
   * Get character snapshot by ID
   */
  async getSnapshot(characterId: string, dbContext?: any): Promise<any | null> {
    try {
      const CharacterSnapshotModel = dbContext
        ? dbContext.getModel('CharacterSnapshot', CharacterSnapshotSchema)
        : CharacterSnapshot;

      const snapshot = await CharacterSnapshotModel.findOne({ characterId });
      return snapshot;
    } catch (error) {
      logger.error(`[CharacterSnapshot] Error fetching snapshot for ${characterId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple character snapshots
   */
  async getSnapshots(characterIds: string[], dbContext?: any): Promise<any[]> {
    try {
      const CharacterSnapshotModel = dbContext
        ? dbContext.getModel('CharacterSnapshot', CharacterSnapshotSchema)
        : CharacterSnapshot;

      const snapshots = await CharacterSnapshotModel.find({
        characterId: { $in: characterIds }
      });
      return snapshots;
    } catch (error) {
      logger.error('[CharacterSnapshot] Error fetching snapshots:', error);
      return [];
    }
  }

  /**
   * Extract top skills from character skills data
   * Returns only skills with value > 50, up to 10 skills
   */
  private extractTopSkills(skills: any): { [skillName: string]: number } {
    if (!skills) return {};

    const topSkills: { [skillName: string]: number } = {};
    const skillEntries: [string, any][] = [];

    // Handle both Map and object formats
    if (skills instanceof Map) {
      skills.forEach((value, key) => {
        const skillValue = typeof value === 'object' ? value.total : value;
        if (skillValue > 50) {
          skillEntries.push([key, skillValue]);
        }
      });
    } else if (typeof skills === 'object') {
      Object.entries(skills).forEach(([key, value]: [string, any]) => {
        const skillValue = typeof value === 'object' ? value.total : value;
        if (skillValue > 50) {
          skillEntries.push([key, skillValue]);
        }
      });
    }

    // Sort by value descending and take top 10
    skillEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([key, value]) => {
        topSkills[key] = value;
      });

    return topSkills;
  }

  /**
   * Clean up old snapshots (older than 30 days)
   */
  async cleanupOldSnapshots(dbContext?: any): Promise<void> {
    try {
      const CharacterSnapshotModel = dbContext
        ? dbContext.getModel('CharacterSnapshot', CharacterSnapshotSchema)
        : CharacterSnapshot;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await CharacterSnapshotModel.deleteMany({
        lastSyncedAt: { $lt: thirtyDaysAgo }
      });

      logger.info(`[CharacterSnapshot] Cleaned up ${result.deletedCount} old snapshots`);
    } catch (error) {
      logger.error('[CharacterSnapshot] Error cleaning up old snapshots:', error);
    }
  }
}

export const characterSnapshotService = new CharacterSnapshotService();
