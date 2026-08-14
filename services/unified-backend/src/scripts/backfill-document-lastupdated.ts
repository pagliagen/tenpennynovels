/**
 * Backfill Script: Document lastUpdated Timestamps
 *
 * Fixes documents with invalid/missing lastUpdated dates (epoch 1970, null, undefined).
 * Critical for SEO sitemap - ensures proper lastmod timestamps.
 *
 * Run once:
 *   npm run build:backend
 *   node services/unified-backend/dist/scripts/backfill-document-lastupdated.js
 *
 * Safety:
 * - Idempotent (safe to re-run)
 * - Only updates documents with invalid dates
 * - Logs all changes for audit
 */

import mongoose from 'mongoose';
// boundary-allow: debito dichiarato, script one-shot resta fuori dalla feature documenti (Fase 6.5) fino al consolidamento del core (Fase 7)
import Document from '@features/documenti/models/Document';
import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

const EPOCH_THRESHOLD = new Date('2000-01-01T00:00:00Z');

interface BackfillStats {
  total: number;
  withInvalidDate: number;
  updated: number;
  errors: number;
}

async function backfillLastUpdated(dryRun = false): Promise<BackfillStats> {
  const stats: BackfillStats = {
    total: 0,
    withInvalidDate: 0,
    updated: 0,
    errors: 0,
  };

  try {
    // Find documents with invalid lastUpdated
    const docsWithInvalidDate = await Document.find({
      $or: [
        { lastUpdated: null },
        { lastUpdated: { $exists: false } },
        { lastUpdated: { $lt: EPOCH_THRESHOLD } },
      ],
    }).lean();

    stats.total = await Document.countDocuments();
    stats.withInvalidDate = docsWithInvalidDate.length;

    logger.info(
      `[Backfill] Found ${stats.withInvalidDate}/${stats.total} documents with invalid lastUpdated`
    );

    if (stats.withInvalidDate === 0) {
      logger.info('[Backfill] No documents to update. Exiting.');
      return stats;
    }

    if (dryRun) {
      logger.info('[Backfill] DRY RUN mode - no changes will be made');
      logger.info('[Backfill] Documents that would be updated:');
      docsWithInvalidDate.forEach((doc: any) => {
        logger.info(
          `  - ${doc.type}/${doc.path} (${doc.title}) - lastUpdated: ${doc.lastUpdated || 'null'}`
        );
      });
      return stats;
    }

    // Update documents
    for (const docData of docsWithInvalidDate) {
      try {
        // Fetch full document (not lean) for save hooks
        const doc = await Document.findById(docData._id);
        if (!doc) {
          logger.warn(`[Backfill] Document ${docData._id} not found (skipping)`);
          continue;
        }

        // Set lastUpdated to createdAt or current date
        const newLastUpdated =
          doc.createdAt && doc.createdAt > EPOCH_THRESHOLD ? doc.createdAt : new Date();

        doc.lastUpdated = newLastUpdated;
        await doc.save();

        stats.updated++;
        logger.info(
          `[Backfill] Updated ${doc.type}/${doc.path} - lastUpdated: ${newLastUpdated.toISOString()}`
        );
      } catch (error) {
        stats.errors++;
        logger.error(`[Backfill] Error updating document ${docData._id}:`, error);
      }
    }

    logger.info(
      `[Backfill] Completed. Updated: ${stats.updated}, Errors: ${stats.errors}`
    );
  } catch (error) {
    logger.error('[Backfill] Fatal error:', error);
    throw error;
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    // Connect to MongoDB
    logger.info(`[Backfill] Connecting to MongoDB: ${appConfig.db.mongodbUri}`);
    await mongoose.connect(appConfig.db.mongodbUri!);
    logger.info('[Backfill] MongoDB connected');

    // Run backfill
    const stats = await backfillLastUpdated(dryRun);

    // Summary
    logger.info('[Backfill] ========== SUMMARY ==========');
    logger.info(`[Backfill] Total documents: ${stats.total}`);
    logger.info(`[Backfill] Documents with invalid date: ${stats.withInvalidDate}`);
    logger.info(`[Backfill] Updated: ${stats.updated}`);
    logger.info(`[Backfill] Errors: ${stats.errors}`);
    logger.info('[Backfill] ==============================');

    // Exit
    await mongoose.disconnect();
    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[Backfill] Script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { backfillLastUpdated };
