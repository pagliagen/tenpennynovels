/**
 * Backfill Script: Document HTML content from contentDelta
 *
 * Fixes documents with empty/missing `content` (HTML) while `contentDelta`
 * (TipTap source) is populated — root cause: contentDelta scritto fuori dal
 * flusso Mongoose (seed/import diretto su Mongo), che non passa dal pre-save
 * hook che genera `content`. Vedi anche Document.ts pre-save hook: ora
 * rigenera content anche quando isModified('contentDelta') è false ma
 * content è vuoto, quindi questo script si limita a "toccare" ogni
 * documento affetto con un save() per farlo autoripararsi.
 *
 * Run once:
 *   npm run build
 *   node services/unified-backend/dist/scripts/backfill-document-content.js [--dry-run]
 *
 * Safety:
 * - Idempotent (safe to re-run — non fa nulla sui documenti già a posto)
 * - Passa da Document.save(): rigenera content via lo stesso HtmlGenerator
 *   usato in produzione, e ripubblica l'evento embedding (upsert idempotente
 *   grazie ai point ID deterministici su document_chunks).
 */

import mongoose from 'mongoose';
// boundary-allow: debito dichiarato, script one-shot resta fuori dalla feature documenti (Fase 6.5) fino al consolidamento del core (Fase 7)
import Document from '@features/documenti/models/Document';
import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

interface BackfillStats {
  total: number;
  affected: number;
  fixed: number;
  errors: number;
}

async function backfillContent(dryRun = false): Promise<BackfillStats> {
  const stats: BackfillStats = { total: 0, affected: 0, fixed: 0, errors: 0 };

  const affected = await Document.find({
    $or: [{ content: '' }, { content: null }, { content: { $exists: false } }],
    contentDelta: { $exists: true, $ne: null },
  }).lean();

  stats.total = await Document.countDocuments();
  stats.affected = affected.length;

  logger.info(`[Backfill] Found ${stats.affected}/${stats.total} documents with empty content but populated contentDelta`);

  if (stats.affected === 0) {
    logger.info('[Backfill] No documents to fix. Exiting.');
    return stats;
  }

  if (dryRun) {
    logger.info('[Backfill] DRY RUN mode - no changes will be made');
    affected.forEach((doc: any) => {
      logger.info(`  - ${doc.type}/${doc.path} (${doc.title})`);
    });
    return stats;
  }

  for (const docData of affected) {
    try {
      const doc = await Document.findById(docData._id);
      if (!doc) {
        logger.warn(`[Backfill] Document ${docData._id} not found (skipping)`);
        continue;
      }

      // markModified forza il pre-save hook a rigenerare content anche se
      // il valore riassegnato è identico (mantiene il fix valido pure senza
      // la condizione "content vuoto" nell'hook, se in futuro cambiasse).
      doc.markModified('contentDelta');
      await doc.save();

      stats.fixed++;
      logger.info(`[Backfill] Fixed ${doc.type}/${doc.path} - content length: ${doc.content?.length ?? 0}`);
    } catch (error) {
      stats.errors++;
      logger.error(`[Backfill] Error fixing document ${docData._id}:`, error);
    }
  }

  logger.info(`[Backfill] Completed. Fixed: ${stats.fixed}, Errors: ${stats.errors}`);
  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    logger.info(`[Backfill] Connecting to MongoDB: ${appConfig.db.mongodbUri}`);
    await mongoose.connect(appConfig.db.mongodbUri!);
    logger.info('[Backfill] MongoDB connected');

    const stats = await backfillContent(dryRun);

    logger.info('[Backfill] ========== SUMMARY ==========');
    logger.info(`[Backfill] Total documents: ${stats.total}`);
    logger.info(`[Backfill] Affected: ${stats.affected}`);
    logger.info(`[Backfill] Fixed: ${stats.fixed}`);
    logger.info(`[Backfill] Errors: ${stats.errors}`);
    logger.info('[Backfill] ==============================');

    await mongoose.disconnect();
    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[Backfill] Script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { backfillContent };
