import cron from 'node-cron';
import { Character } from '../database/models/Character';
import { Location } from '../database/models/Location';
import { logger } from '../modules/game/utils/logger';
import { getSocketIO } from '../modules/game/websocket/socketInstance';
import { Types } from 'mongoose';

/**
 * Presence Cleanup Cron Job
 *
 * Runs every 5 minutes to clean up stale presence data:
 * - Characters with lastActive > 10min → currentLocation = null
 * - Location occupants with lastSeen > 10min → removed from array
 *
 * Threshold: 10 minutes (2× heartbeat interval max)
 *
 * Schedule: every 5 minutes
 */

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Stale Character Selection
 * Matches Character.find().select('_id name currentLocation')
 */
interface StaleCharacterData {
  _id: Types.ObjectId;
  name: string;
  currentLocation: Types.ObjectId | null;
}

async function cleanupStalePresence(): Promise<void> {
  try {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    logger.debug(`[PresenceCleanup] Running cleanup (threshold: ${staleThreshold.toISOString()})`);

    // STEP 1: Find stale characters
    const staleCharacters = await Character.find({
      currentLocation: { $ne: null },
      lastActive: { $lt: staleThreshold }
    }).select('_id name currentLocation').lean<StaleCharacterData[]>();

    if (staleCharacters.length === 0) {
      logger.debug('[PresenceCleanup] No stale characters found');
      return;
    }

    logger.info(`[PresenceCleanup] Found ${staleCharacters.length} stale characters`);

    // STEP 2: Clear Character.currentLocation atomically
    const characterUpdates = staleCharacters.map((char: StaleCharacterData) => ({
      updateOne: {
        filter: { _id: char._id },
        update: { $set: { currentLocation: null } }
      }
    }));

    if (characterUpdates.length > 0) {
      const charResult = await Character.bulkWrite(characterUpdates);
      logger.info(`[PresenceCleanup] Cleared currentLocation for ${charResult.modifiedCount} characters`);
    }

    // STEP 3: Remove from Location.occupants atomically
    const locationIds = [...new Set(
      staleCharacters
        .map((c: StaleCharacterData) => c.currentLocation?.toString())
        .filter((id): id is string => id !== undefined && id !== null)
    )];

    if (locationIds.length > 0) {
      let cleanedLocations = 0;

      for (const locationId of locationIds) {
        const result = await Location.updateOne(
          { _id: locationId },
          {
            $pull: {
              occupants: {
                lastSeen: { $lt: staleThreshold }
              }
            }
          }
        );

        if (result.modifiedCount > 0) {
          cleanedLocations++;
        }
      }

      logger.info(`[PresenceCleanup] Cleaned occupants from ${cleanedLocations} locations`);
    }

    // STEP 4: Emit WebSocket events for each stale character
    try {
      const io = getSocketIO();

      if (!io) {
        logger.warn('[PresenceCleanup] Socket.IO not available, skipping WebSocket events');
      } else {
        for (const char of staleCharacters) {
          if (char.currentLocation) {
            io.to(`location_${char.currentLocation}`).emit('player_left', {
              characterId: char._id.toString(),
              characterName: char.name,
              timestamp: new Date().toISOString(),
              reason: 'timeout'
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[PresenceCleanup] WebSocket emit failed (non-critical):', err);
    }

    logger.info(`[PresenceCleanup] Cleanup completed: ${staleCharacters.length} stale presence records removed`);
  } catch (error) {
    logger.error('[PresenceCleanup] Cron job error:', error);
  }
}

// Schedule: Every 5 minutes
const job = cron.schedule('*/5 * * * *', cleanupStalePresence);

logger.info('[PresenceCleanup] Cron job scheduled (*/5 * * * * UTC)');

export default job;
