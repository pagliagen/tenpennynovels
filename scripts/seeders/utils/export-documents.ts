import * as fs from 'fs/promises';
import * as path from 'path';
import { getConnection } from './connection';
import { createObjectCsvWriter } from 'csv-writer';

/**
 * Export Documents from Database
 *
 * Downloads all documents from MongoDB and creates:
 * 1. {slug}.content files (TipTap Delta JSON)
 * 2. {slug}.description files (plain text)
 * 3. documents.csv (remaining fields)
 *
 * Usage:
 *   npm run export:documents
 *   MONGO_URI="mongodb+srv://..." npm run export:documents  # Production
 */
async function exportDocuments() {
  const { client, db } = await getConnection();

  try {
    const documentsCollection = db.collection('documents');
    const documents = await documentsCollection.find({}).toArray();

    console.log(`[Export] Found ${documents.length} documents`);

    const dataDir = path.join(__dirname, '../data/documents');
    await fs.mkdir(dataDir, { recursive: true });

    const csvData = [];

    for (const doc of documents) {
      const slug = doc.slug;

      // Write content file (TipTap Delta JSON)
      await fs.writeFile(
        path.join(dataDir, `${slug}.content`),
        JSON.stringify(doc.contentDelta || {}, null, 2),
        'utf8'
      );

      // Write description file (plain text)
      await fs.writeFile(
        path.join(dataDir, `${slug}.description`),
        doc.description || '',
        'utf8'
      );

      // CSV row (remaining fields)
      csvData.push({
        _id: doc._id.toString(),
        slug: doc.slug,
        title: doc.title,
        type: doc.type,
        parentId: doc.parentId?.toString() || '',
        order: doc.order || 0,
        tags: (doc.tags || []).join('|'),
        isVisible: doc.isVisible || false,
        isDraft: doc.isDraft || false,
        version: doc.version || 1,
        createdAt: doc.createdAt?.toISOString() || '',
        updatedAt: doc.updatedAt?.toISOString() || ''
      });

      console.log(`[Export] ✓ ${slug}`);
    }

    // Write CSV
    const csvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '../data/documents.csv'),
      header: [
        { id: '_id', title: '_id' },
        { id: 'slug', title: 'slug' },
        { id: 'title', title: 'title' },
        { id: 'type', title: 'type' },
        { id: 'parentId', title: 'parentId' },
        { id: 'order', title: 'order' },
        { id: 'tags', title: 'tags' },
        { id: 'isVisible', title: 'isVisible' },
        { id: 'isDraft', title: 'isDraft' },
        { id: 'version', title: 'version' },
        { id: 'createdAt', title: 'createdAt' },
        { id: 'updatedAt', title: 'updatedAt' }
      ]
    });

    await csvWriter.writeRecords(csvData);
    console.log(`[Export] ✓ CSV written: ${csvData.length} rows`);
    console.log(`[Export] ✅ Export complete`);

  } catch (error) {
    console.error('[Export] Error:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// CLI execution (ESM compatible)
import { fileURLToPath } from 'url';

if (import.meta.url === `file://${process.argv[1]}`) {
  exportDocuments().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
