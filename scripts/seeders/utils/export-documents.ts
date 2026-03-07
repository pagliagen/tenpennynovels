import * as fs from 'fs/promises';
import * as path from 'path';
import { getConnection } from './connection';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Export Documents + Subtypes from Database
 *
 * Downloads all documents and subtypes from MongoDB and creates:
 * 1. {slug}.content files (TipTap Delta JSON)
 * 2. {slug}.description files (plain text)
 * 3. documents.csv (document metadata with subtypeSlug and isPublic)
 * 4. subtypes.csv (subtype metadata)
 *
 * Usage:
 *   npm run export:dev:documents
 */
async function exportDocumentsAndSubtypes() {
  const { client, db } = await getConnection();

  try {
    // Phase 1: Export subtypes
    console.log('📍 PHASE 1: Exporting Subtypes');
    const subtypesCollection = db.collection('documentsubtypes');
    const subtypes = await subtypesCollection.find({}).sort({ type: 1, order: 1 }).toArray();

    console.log(`[Export] Found ${subtypes.length} subtypes`);

    const subtypeIdToSlug = new Map<string, string>();
    const subtypeCsvData = [];

    for (const st of subtypes) {
      subtypeIdToSlug.set(st._id.toString(), st.slug);
      subtypeCsvData.push({
        slug: st.slug,
        title: st.title,
        type: st.type,
        order: st.order
      });
      console.log(`[Export] ✓ ${st.type}/${st.slug}`);
    }

    const subtypeCsvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '../data/subtypes.csv'),
      header: [
        { id: 'slug', title: 'slug' },
        { id: 'title', title: 'title' },
        { id: 'type', title: 'type' },
        { id: 'order', title: 'order' }
      ]
    });

    await subtypeCsvWriter.writeRecords(subtypeCsvData);
    console.log(`[Export] ✓ subtypes.csv written: ${subtypeCsvData.length} rows\n`);

    // Phase 2: Export documents
    console.log('📄 PHASE 2: Exporting Documents');
    const documentsCollection = db.collection('documents');
    const documents = await documentsCollection
      .find({ deleted: { $ne: true } })
      .sort({ type: 1, parentId: 1, order: 1 })
      .toArray();

    console.log(`[Export] Found ${documents.length} documents`);

    const dataDir = path.join(__dirname, '../data/documents');
    await fs.mkdir(dataDir, { recursive: true });

    const csvData = [];

    for (const doc of documents) {
      try {
        const slug = doc.slug;

        await fs.writeFile(
          path.join(dataDir, `${slug}.content`),
          JSON.stringify(doc.contentDelta || {}, null, 2),
          'utf8'
        );

        await fs.writeFile(
          path.join(dataDir, `${slug}.description`),
          doc.description || '',
          'utf8'
        );

        const subtypeSlug = doc.subtypeId ? subtypeIdToSlug.get(doc.subtypeId.toString()) || '' : '';

        csvData.push({
          _id: doc._id.toString(),
          slug: doc.slug,
          title: doc.title,
          type: doc.type,
          subtypeSlug,
          parentId: doc.parentId?.toString() || '',
          order: doc.order || 0,
          tags: (doc.tags || []).join('|'),
          isVisible: String(doc.visible !== false),
          isDraft: String(doc.isDraft === true),
          isPublic: String(doc.isPublic === true),
          version: doc.version || 1,
          createdAt: doc.createdAt?.toISOString() || '',
          updatedAt: doc.updatedAt?.toISOString() || ''
        });

        console.log(`[Export] ✓ ${slug} (${doc.type}/${subtypeSlug}${doc.parentId ? ', child' : ''})`);
      } catch (error: any) {
        console.error(`[Export] ❌ Failed to export ${doc.slug || doc._id}:`, error.message);
      }
    }

    const csvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '../data/documents.csv'),
      header: [
        { id: '_id', title: '_id' },
        { id: 'slug', title: 'slug' },
        { id: 'title', title: 'title' },
        { id: 'type', title: 'type' },
        { id: 'subtypeSlug', title: 'subtypeSlug' },
        { id: 'parentId', title: 'parentId' },
        { id: 'order', title: 'order' },
        { id: 'tags', title: 'tags' },
        { id: 'isVisible', title: 'isVisible' },
        { id: 'isDraft', title: 'isDraft' },
        { id: 'isPublic', title: 'isPublic' },
        { id: 'version', title: 'version' },
        { id: 'createdAt', title: 'createdAt' },
        { id: 'updatedAt', title: 'updatedAt' }
      ]
    });

    await csvWriter.writeRecords(csvData);

    console.log(`[Export] ✓ documents.csv written: ${csvData.length} rows\n`);
    console.log('✅ EXPORT COMPLETE - Subtypes + Documents');

  } catch (error) {
    console.error('[Export] ❌ Export error:', error);
    throw error;
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exportDocumentsAndSubtypes().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
