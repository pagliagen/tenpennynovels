import * as fs from 'fs/promises';
import * as path from 'path';
import { getConnection } from './connection';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const documents = await documentsCollection
      .find({ deleted: { $ne: true } })
      .sort({ type: 1, parentId: 1, order: 1 })
      .toArray();

    console.log(`[Export] Found ${documents.length} documents`);

    // Validation warnings
    const issues: string[] = [];
    for (const doc of documents) {
      if (!doc.slug) issues.push(`Document ${doc._id} missing slug`);
      if (!doc.title) issues.push(`Document ${doc._id} missing title`);
      if (!doc.type) issues.push(`Document ${doc._id} missing type`);
      if (!doc.contentDelta || Object.keys(doc.contentDelta).length === 0) {
        issues.push(`Document ${doc.slug} has empty contentDelta`);
      }
    }

    if (issues.length > 0) {
      console.warn('[Export] ⚠️  Validation warnings:');
      issues.forEach(i => console.warn(`  - ${i}`));
      console.log('');
    }

    const dataDir = path.join(__dirname, '../data/documents');
    await fs.mkdir(dataDir, { recursive: true });

    const csvData = [];

    for (const doc of documents) {
      try {
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
          isVisible: String(doc.visible !== false),  // Transform: visible → isVisible
          isDraft: String(doc.isDraft === true),     // Explicit string: "true" or "false"
          version: doc.version || 1,
          createdAt: doc.createdAt?.toISOString() || '',
          updatedAt: doc.updatedAt?.toISOString() || ''
        });

        console.log(`[Export] ✓ ${slug} (${doc.type}${doc.parentId ? ', child' : ''}${doc.isDraft ? ', draft' : ''})`);
      } catch (error: any) {
        console.error(`[Export] ❌ Failed to export ${doc.slug || doc._id}:`, error.message);
        // Continue with next document instead of crashing
      }
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

    const stats = {
      total: documents.length,
      byType: {
        ambientazione: documents.filter(d => d.type === 'ambientazione').length,
        approfondimenti: documents.filter(d => d.type === 'approfondimenti').length,
        regolamento: documents.filter(d => d.type === 'regolamento').length
      },
      roots: documents.filter(d => !d.parentId).length,
      children: documents.filter(d => d.parentId).length,
      drafts: documents.filter(d => d.isDraft).length,
      hidden: documents.filter(d => !d.visible).length,
      hasDescription: documents.filter(d => d.description).length
    };

    console.log(`[Export] ✓ CSV written: ${csvData.length} rows\n`);
    console.log(`[Export] 📊 Statistics:`);
    console.log(`  Total: ${stats.total} documents`);
    console.log(`  By Type: ambientazione=${stats.byType.ambientazione}, approfondimenti=${stats.byType.approfondimenti}, regolamento=${stats.byType.regolamento}`);
    console.log(`  Hierarchy: ${stats.roots} roots, ${stats.children} children`);
    console.log(`  Flags: ${stats.drafts} drafts, ${stats.hidden} hidden`);
    console.log(`  Files: ${stats.total} .content, ${stats.hasDescription} .description`);
    console.log(`\n[Export] ✅ Export complete`);

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
