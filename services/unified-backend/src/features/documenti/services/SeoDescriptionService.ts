/**
 * SeoDescriptionService
 *
 * Fire-and-forget service that calls the AI gateway to generate a SEO
 * description for a document and saves it back to the DB.
 *
 * Triggered from the Document post-save hook when contentDelta changes.
 * Only runs if AI gateway URL is configured and reachable.
 */

import Document from '../models/Document';
import { aiGatewayClient } from '@modules/game/services/AIGatewayClient';
import { appConfig } from '@config/runtime';
import { logger } from '@shared/utils/logger';

export class SeoDescriptionService {
  /**
   * Generate a SEO description via AI gateway and persist it on the document.
   * Non-blocking: caller should NOT await this.
   */
  static async generateAndSave(documentId: string, title: string, content: string): Promise<void> {
    if (!appConfig.services.aiGateway.url) return;

    try {
      const description = await aiGatewayClient.generateSeoDescription(title, content);

      if (!description) {
        logger.warn(`[SeoDescription] No description returned for document ${documentId}`);
        return;
      }

      await Document.updateOne({ _id: documentId }, { $set: { description } });
      logger.info(`[SeoDescription] Saved for document ${documentId} (${description.length} chars)`);
    } catch (error) {
      logger.error(`[SeoDescription] Failed for document ${documentId}:`, error);
    }
  }
}
