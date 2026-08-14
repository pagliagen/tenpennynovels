/**
 * Document Chunk Service
 *
 * Manages DocumentChunk regeneration when Document.contentDelta is updated.
 * Implements soft-delete versioning and publishes events for embedding generation.
 *
 * Persistenza via driver raw su db.collection('documentchunks') (minuscolo),
 * non tramite il model Mongoose DocumentChunk (che dichiara una collection
 * diversa, 'documentChunks' — vedi ATTENZIONE in models/DocumentChunk.ts).
 */

import mongoose from 'mongoose';
import { parseChunks, ParsedChunk } from './ChunkParser';
import { redis } from '@config/runtime/redis';
import { EmbeddingEventPublisher } from '@modules/game/utils/events/embedding-publisher';
import { logger } from '@modules/admin/utils/logger';

export interface ChunkRegenerationResult {
  success: boolean;
  chunksCreated: number;
  chunksDeactivated: number;
  newVersion: number;
  error?: string;
}

export class DocumentChunkService {
  private embeddingPublisher: EmbeddingEventPublisher;

  constructor() {
    const redisPublisher = redis.getPublisher();
    this.embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
  }

  /**
   * Regenerate all chunks for a document (versioned soft-delete)
   *
   * Flow:
   * 1. Parse contentDelta → chunks (using ChunkParser)
   * 2. Deactivate old chunks (soft delete with isActive: false)
   * 3. Calculate new version number (max version + 1)
   * 4. Create new DocumentChunk records with isActive: true
   * 5. Publish Redis events for embedding generation
   *
   * @param documentId - MongoDB ObjectId as string
   * @param contentDelta - TipTap JSON Delta
   * @param documentType - 'ambientazione' | 'regolamento'
   * @param userId - User ID for audit trail
   * @param username - Username for audit trail
   * @returns Stats object with success flag, counts, version, and error details
   */
  async regenerateChunksForDocument(
    documentId: string,
    contentDelta: any,
    documentType: 'ambientazione' | 'approfondimenti' | 'regolamento',
    userId: string,
    username: string
  ): Promise<ChunkRegenerationResult> {
    try {
      const docObjectId = new mongoose.Types.ObjectId(documentId);
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error('Database connection not available');
      }

      // STEP 1: Parse contentDelta → chunks
      let parsedChunks: ParsedChunk[];
      try {
        // Ensure contentDelta is an object (handle string if needed)
        const delta = typeof contentDelta === 'string'
          ? JSON.parse(contentDelta)
          : contentDelta;

        parsedChunks = parseChunks(delta);
        logger.info(`[ChunkService] Parsed ${parsedChunks.length} chunks from contentDelta`);
      } catch (parseError: any) {
        logger.error('[ChunkService] Failed to parse contentDelta:', parseError);
        return {
          success: false,
          chunksCreated: 0,
          chunksDeactivated: 0,
          newVersion: 0,
          error: `Chunk parsing failed: ${parseError.message}`
        };
      }

      // STEP 2: Deactivate old chunks (soft delete)
      const deactivateResult = await db.collection('documentchunks').updateMany(
        { documentId: docObjectId, isActive: true },
        { $set: { isActive: false } }
      );
      const chunksDeactivated = deactivateResult.modifiedCount;
      logger.info(`[ChunkService] Deactivated ${chunksDeactivated} old chunks for document ${documentId}`);

      // STEP 3: Calculate new version
      const oldChunks = await db.collection('documentchunks')
        .find({ documentId: docObjectId })
        .sort({ version: -1 })
        .limit(1)
        .toArray();
      const newVersion = (oldChunks[0]?.version || 0) + 1;
      logger.info(`[ChunkService] New chunk version: ${newVersion}`);

      // STEP 4: Create new chunks (TWO-PHASE: H2 first, then H3 with parent references)
      let chunksCreated = 0;
      const now = new Date();
      const auditInfo = { userId, username };

      // Split by heading level
      const h2Chunks = parsedChunks.filter(c => c.headingLevel === 2);
      const h3Chunks = parsedChunks.filter(c => c.headingLevel === 3);
      logger.info(`[ChunkService] Split into ${h2Chunks.length} H2 chunks + ${h3Chunks.length} H3 sub-chunks`);

      // Map to store H2 slug → _id for H3 parent references
      const h2SlugToId = new Map<string, mongoose.Types.ObjectId>();

      // PHASE 1: Create H2 chunks first
      for (const chunk of h2Chunks) {
        const chunkData = {
          documentId: docObjectId,
          slug: chunk.slug,
          slugHistory: [chunk.slug],
          title: chunk.heading,
          headingLevel: 2,
          content: chunk.content,
          order: chunk.order,
          documentType,
          version: newVersion,
          isActive: true,
          parentChunkId: undefined,  // H2 has no parent
          parentSlug: undefined,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const chunkResult = await db.collection('documentchunks').insertOne(chunkData);
        h2SlugToId.set(chunk.slug, chunkResult.insertedId as mongoose.Types.ObjectId);
        chunksCreated++;

        // STEP 5: Publish Redis event for embedding generation
        try {
          await this.embeddingPublisher.publishDocumentChunkEvent(
            chunkResult.insertedId.toString(),
            documentId,
            chunk.slug,
            chunk.heading,
            chunk.content,
            documentType,
            chunk.order,
            2,              // headingLevel
            undefined       // parentSlug (none for H2)
          );
          logger.debug(`[ChunkService] Published embedding event for H2 chunk: ${chunk.heading}`);
        } catch (eventError: any) {
          // Non-fatal: chunks are created, embeddings can be regenerated later
          logger.error(`[ChunkService] Failed to publish embedding event for chunk ${chunk.heading}:`, eventError);
        }
      }

      // PHASE 2: Create H3 chunks with parent references
      for (const chunk of h3Chunks) {
        const parentChunkId = chunk.parentSlug ? h2SlugToId.get(chunk.parentSlug) : undefined;

        const chunkData = {
          documentId: docObjectId,
          slug: chunk.slug,
          slugHistory: [chunk.slug],
          title: chunk.heading,
          headingLevel: 3,
          content: chunk.content,
          order: chunk.order,
          documentType,
          version: newVersion,
          isActive: true,
          parentChunkId,              // Reference to parent H2
          parentSlug: chunk.parentSlug,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const chunkResult = await db.collection('documentchunks').insertOne(chunkData);
        chunksCreated++;

        // STEP 5: Publish Redis event for embedding generation
        try {
          await this.embeddingPublisher.publishDocumentChunkEvent(
            chunkResult.insertedId.toString(),
            documentId,
            chunk.slug,
            chunk.heading,
            chunk.content,
            documentType,
            chunk.order,
            3,                      // headingLevel
            chunk.parentSlug        // parentSlug
          );
          logger.debug(`[ChunkService] Published embedding event for H3 sub-chunk: ${chunk.heading}`);
        } catch (eventError: any) {
          // Non-fatal: chunks are created, embeddings can be regenerated later
          logger.error(`[ChunkService] Failed to publish embedding event for chunk ${chunk.heading}:`, eventError);
        }
      }

      logger.info(`[ChunkService] Successfully created ${chunksCreated} new chunks (v${newVersion}) for document ${documentId}`);

      return {
        success: true,
        chunksCreated,
        chunksDeactivated,
        newVersion
      };

    } catch (error: any) {
      logger.error('[ChunkService] Chunk regeneration failed:', error);
      return {
        success: false,
        chunksCreated: 0,
        chunksDeactivated: 0,
        newVersion: 0,
        error: error.message || 'Errore sconosciuto'
      };
    }
  }
}
