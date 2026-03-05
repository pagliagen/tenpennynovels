import * as path from 'path';
import { getConnection } from './connection.js';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Export Routes from Database
 *
 * Downloads all routes from MongoDB and creates routes.csv with hierarchical structure
 * using parentPath references instead of ObjectId (portable across environments)
 *
 * CSV Schema:
 * - slug: URL segment (e.g., "folklore", "armi")
 * - parentPath: Full path of parent route (e.g., "approfondimenti" for child "armi")
 * - type: "ambientazione" | "approfondimenti" | "regolamento"
 * - kind: "document" | "category" | "redirect"
 * - rootDocumentSlug: Document slug reference (for kind=document)
 * - redirectTo: Redirect target (for kind=redirect)
 * - title, description: DEPRECATED (kept for backward compat)
 * - isPublic, enabled: Boolean flags (string "true"/"false")
 *
 * Usage:
 *   npm run export:dev:routes
 *   npm run export:prod:routes  # Production
 */
async function exportRoutes() {
  const { client, db } = await getConnection();

  try {
    const routesCol = db.collection('routes');
    const documentsCol = db.collection('documents');

    // Fetch routes sorted by path depth (roots first, then children)
    const routes = await routesCol
      .find({ deleted: { $ne: true } })
      .sort({ type: 1, path: 1 })
      .toArray();

    console.log(`[Export] Found ${routes.length} routes`);

    // Build document _id → slug map for reverse lookup
    const allDocs = await documentsCol.find({}).toArray();
    const docIdToSlug = new Map<string, string>();
    for (const doc of allDocs) {
      docIdToSlug.set(doc._id.toString(), doc.slug);
    }

    // Validation warnings
    const issues: string[] = [];
    for (const route of routes) {
      if (!route.slug) issues.push(`Route ${route._id} missing slug`);
      if (!route.path) issues.push(`Route ${route._id} missing path`);
      if (!route.type) issues.push(`Route ${route._id} missing type`);
      if (!route.kind) issues.push(`Route ${route._id} missing kind`);

      // Validate kind-specific requirements
      if (route.kind === 'document' && !route.rootDocumentId) {
        issues.push(`Route ${route.path} (kind=document) missing rootDocumentId`);
      }
      if (route.kind === 'redirect' && !route.redirectTo) {
        issues.push(`Route ${route.path} (kind=redirect) missing redirectTo`);
      }
    }

    if (issues.length > 0) {
      console.warn('[Export] ⚠️  Validation warnings:');
      issues.forEach(i => console.warn(`  - ${i}`));
      console.log('');
    }

    const csvData = [];

    for (const route of routes) {
      try {
        // Derive slug from path (last segment)
        const pathParts = route.path.split('/');
        const slug = pathParts[pathParts.length - 1];

        // Derive parentPath (all segments except last)
        let parentPath = '';
        if (pathParts.length > 1) {
          parentPath = pathParts.slice(0, -1).join('/');
        }

        // Resolve rootDocumentId → slug
        let rootDocumentSlug = '';
        if (route.rootDocumentId) {
          rootDocumentSlug = docIdToSlug.get(route.rootDocumentId.toString()) || '';
          if (!rootDocumentSlug) {
            console.warn(`  ⚠️  Document not found for route ${route.path} (rootDocumentId=${route.rootDocumentId})`);
          }
        }

        csvData.push({
          slug,
          parentPath,
          type: route.type,
          kind: route.kind,
          rootDocumentSlug,
          redirectTo: route.redirectTo || '',
          title: route.title || '',
          description: route.description || '',
          isPublic: String(route.isPublic !== false),  // Default true
          enabled: String(route.enabled !== false),    // Default true
          displayCategory: route.displayCategory || ''
        });

        console.log(`[Export] ✓ ${route.path} (${route.kind})`);
      } catch (error: any) {
        console.error(`[Export] ❌ Failed to export route ${route.path || route._id}:`, error.message);
        // Continue with next route instead of crashing
      }
    }

    // Write CSV
    const csvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '../data/routes.csv'),
      header: [
        { id: 'slug', title: 'slug' },
        { id: 'parentPath', title: 'parentPath' },
        { id: 'type', title: 'type' },
        { id: 'kind', title: 'kind' },
        { id: 'rootDocumentSlug', title: 'rootDocumentSlug' },
        { id: 'redirectTo', title: 'redirectTo' },
        { id: 'title', title: 'title' },
        { id: 'description', title: 'description' },
        { id: 'isPublic', title: 'isPublic' },
        { id: 'enabled', title: 'enabled' },
        { id: 'displayCategory', title: 'displayCategory' }
      ]
    });

    await csvWriter.writeRecords(csvData);

    // Stats
    const stats = {
      total: routes.length,
      byKind: {
        document: routes.filter(r => r.kind === 'document').length,
        category: routes.filter(r => r.kind === 'category').length,
        redirect: routes.filter(r => r.kind === 'redirect').length
      },
      byType: {
        ambientazione: routes.filter(r => r.type === 'ambientazione').length,
        approfondimenti: routes.filter(r => r.type === 'approfondimenti').length,
        regolamento: routes.filter(r => r.type === 'regolamento').length
      },
      roots: routes.filter(r => !r.path.includes('/')).length,
      children: routes.filter(r => r.path.includes('/')).length
    };

    console.log(`\n[Export] ✓ CSV written: ${csvData.length} rows\n`);
    console.log(`[Export] 📊 Statistics:`);
    console.log(`  Total: ${stats.total} routes`);
    console.log(`  By Kind: document=${stats.byKind.document}, category=${stats.byKind.category}, redirect=${stats.byKind.redirect}`);
    console.log(`  By Type: ambientazione=${stats.byType.ambientazione}, approfondimenti=${stats.byType.approfondimenti}, regolamento=${stats.byType.regolamento}`);
    console.log(`  Hierarchy: ${stats.roots} roots, ${stats.children} children`);
    console.log(`\n[Export] ✅ Export complete`);

  } catch (error) {
    console.error('[Export] ❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('[Export] 👋 Done');
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  exportRoutes().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default exportRoutes;
