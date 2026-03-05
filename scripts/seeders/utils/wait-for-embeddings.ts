import { ObjectId } from 'mongodb';

/**
 * Wait for Chunk Embeddings to Complete
 *
 * Waits until all chunks for a document have their embeddings generated.
 * Polls MongoDB to check if contentEmbedding field exists for all active chunks.
 *
 * @param db - MongoDB database instance
 * @param documentId - Document ObjectId
 * @param maxWaitMs - Maximum wait time in milliseconds (default: 30000)
 * @returns {Promise<boolean>} true if all embeddings complete, false if timeout
 */
export async function waitForChunkEmbeddings(
  db: any,
  documentId: ObjectId,
  maxWaitMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const chunksCollection = db.collection('documentchunks');  // FIX: Match DocumentSeeder collection name (no underscore)

  while (Date.now() - startTime < maxWaitMs) {
    const chunks = await chunksCollection.find({
      documentId,
      isActive: true
    }).toArray();

    if (chunks.length === 0) {
      console.log(`[Wait] No chunks found for document ${documentId}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    const totalChunks = chunks.length;
    const chunksWithEmbeddings = chunks.filter((c: any) =>
      c.contentEmbedding && c.contentEmbedding.length > 0
    ).length;

    console.log(`[Wait] Document ${documentId}: Embeddings ${chunksWithEmbeddings}/${totalChunks}`);

    if (chunksWithEmbeddings === totalChunks) {
      console.log(`[Wait] ✓ All embeddings complete for document ${documentId}`);
      return true; // All chunks have embeddings
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.warn(`[Wait] ⚠ Timeout waiting for embeddings (document ${documentId})`);
  return false; // Timeout
}
