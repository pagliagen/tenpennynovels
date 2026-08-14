/**
 * Backfill Script: Character.firstName
 *
 * Contesto: "name" ora coincide sempre con lo username (identità di gioco,
 * immutabile) e non è più modificabile dal wizard. Il nome di finzione (RP)
 * modificabile dal giocatore vive nel nuovo campo "firstName", mostrato solo
 * in scheda. I personaggi creati prima di questa modifica hanno "firstName"
 * vuoto: questo script lo popola copiando il valore attuale di "name" (che,
 * per i personaggi esistenti, è quello che il giocatore aveva scelto come
 * nome RP prima del vincolo sullo username).
 *
 * Aggiorna anche la config "character_creation_field_visibility": la chiave
 * "name" (visibilità del vecchio campo) diventa "firstName".
 *
 * Run once:
 *   npm run build:backend
 *   node services/unified-backend/dist/scripts/backfill-character-firstname.js
 *
 * Safety:
 * - Idempotente (safe to re-run): tocca solo firstName mancante/vuoto
 * - Puramente additivo: non modifica mai "name"
 * - --dry-run per vedere le modifiche senza applicarle
 */

import mongoose from 'mongoose';
import { Character } from '@core/character/models/Character';
import { SystemConfiguration } from '../database/models/SystemConfiguration';
import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

interface BackfillStats {
  totalCharacters: number;
  charactersUpdated: number;
  charactersErrors: number;
  fieldVisibilityUpdated: boolean;
}

async function backfillFirstName(dryRun = false): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalCharacters: 0,
    charactersUpdated: 0,
    charactersErrors: 0,
    fieldVisibilityUpdated: false,
  };

  // 1. Character.firstName ← Character.name (solo dove firstName è vuoto)
  const charactersToBackfill = await Character.find({
    $or: [{ firstName: { $exists: false } }, { firstName: null }, { firstName: '' }],
  }).select('_id name firstName');

  stats.totalCharacters = charactersToBackfill.length;
  logger.info(`[Backfill] ${stats.totalCharacters} personaggi senza firstName`);

  if (dryRun) {
    charactersToBackfill.forEach((char) => {
      logger.info(`[Backfill] DRY RUN — ${char._id}: firstName sarebbe "${char.name}"`);
    });
  } else {
    for (const char of charactersToBackfill) {
      try {
        await Character.updateOne({ _id: char._id }, { $set: { firstName: char.name } });
        stats.charactersUpdated++;
      } catch (error) {
        stats.charactersErrors++;
        logger.error(`[Backfill] Errore su personaggio ${char._id}:`, error);
      }
    }
  }

  // 2. character_creation_field_visibility: rinomina la chiave "name" → "firstName"
  const fieldVisibilityConfig = await SystemConfiguration.findOne({
    configKey: 'character_creation_field_visibility',
  });

  if (fieldVisibilityConfig) {
    const value = fieldVisibilityConfig.value as Record<string, boolean> | undefined;
    if (value && Object.prototype.hasOwnProperty.call(value, 'name') && !('firstName' in value)) {
      const { name: oldNameVisibility, ...rest } = value;
      const newValue: Record<string, boolean> = { ...rest, firstName: oldNameVisibility };

      logger.info(
        `[Backfill] character_creation_field_visibility.name (${oldNameVisibility}) → firstName`
      );

      if (!dryRun) {
        fieldVisibilityConfig.value = newValue;
        fieldVisibilityConfig.markModified('value');
        await fieldVisibilityConfig.save();
      }
      stats.fieldVisibilityUpdated = true;
    } else {
      logger.info('[Backfill] character_creation_field_visibility già a posto, nessuna modifica');
    }
  } else {
    logger.info('[Backfill] Nessuna config character_creation_field_visibility in DB (userà i default da codice)');
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    logger.info(`[Backfill] Connecting to MongoDB: ${appConfig.db.mongodbUri}`);
    await mongoose.connect(appConfig.db.mongodbUri!);
    logger.info('[Backfill] MongoDB connected');

    if (dryRun) {
      logger.info('[Backfill] DRY RUN mode - no changes will be made');
    }

    const stats = await backfillFirstName(dryRun);

    logger.info('[Backfill] ========== SUMMARY ==========');
    logger.info(`[Backfill] Personaggi senza firstName: ${stats.totalCharacters}`);
    logger.info(`[Backfill] Aggiornati: ${stats.charactersUpdated}`);
    logger.info(`[Backfill] Errori: ${stats.charactersErrors}`);
    logger.info(`[Backfill] fieldVisibility aggiornata: ${stats.fieldVisibilityUpdated}`);
    logger.info('[Backfill] ==============================');

    await mongoose.disconnect();
    process.exit(stats.charactersErrors > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[Backfill] Script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { backfillFirstName };
