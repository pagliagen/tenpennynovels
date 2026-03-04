/**
 * Generate routes-config.json from folder structure
 *
 * NEW LOGIC:
 * - Each FILE generates a document route
 * - Each FOLDER generates a category route
 * - Path = relative path from type (ambientazione/regolamento)
 * - ParentId inferred from folder structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/documents');
const OUTPUT_PATH = path.join(__dirname, '../data/routes-config.json');

interface RouteConfig {
  path: string;
  type: 'ambientazione' | 'regolamento';
  kind: 'document' | 'category';
  rootDocumentSlug: string | null;
  title: string;
  description?: string;
  isPublic: boolean;
  enabled: boolean;
}

interface DocumentFrontmatter {
  slug: string;
  title: string;
  description?: string;
  parentId: string | null;
  isPublic?: boolean;
  enabled?: boolean;
  type?: 'ambientazione' | 'regolamento';
}

/**
 * Get document type from file path
 */
function getDocumentType(filePath: string): 'ambientazione' | 'regolamento' {
  if (filePath.includes('/ambientazione/')) {
    return 'ambientazione';
  }
  if (filePath.includes('/regolamento/')) {
    return 'regolamento';
  }
  return 'ambientazione';
}

/**
 * Get route path from file path relative to DATA_DIR
 * Returns null if path depth exceeds 2 segments (depth 3+ files become children, not routes)
 */
function getRoutePath(filePath: string): string | null {
  const rel = path.relative(DATA_DIR, filePath);
  // Remove file extension
  const withoutExt = rel.replace(/\.md$/, '');
  // Remove type prefix (ambientazione/ or regolamento/)
  const parts = withoutExt.split(path.sep);
  parts.shift(); // Remove ambientazione or regolamento

  // NEW: Limit to max 2 segments (e.g., "approfondimenti/criminalita")
  // Files at depth 3+ (e.g., "approfondimenti/criminalita/panoramica") return null
  if (parts.length > 2) {
    return null;
  }

  return parts.join('/');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get category title from folder name
 */
function getCategoryTitle(folderName: string): string {
  return folderName
    .split('-')
    .map(capitalize)
    .join(' ');
}

/**
 * Generate routes from folder structure
 */
async function generateRoutesConfig(): Promise<void> {
  console.log('🔍 Scanning folder structure...\n');

  // Find all markdown files
  const files = glob.sync('**/*.md', {
    cwd: DATA_DIR,
    absolute: true,
  });

  console.log(`📄 Found ${files.length} markdown files\n`);

  const routes: RouteConfig[] = [];
  const categories = new Set<string>();

  // Step 1: Create document routes for each file
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(content);
      const frontmatter = data as DocumentFrontmatter;

      if (!frontmatter.slug || !frontmatter.title) {
        console.warn(`⚠️  Skipping ${path.basename(filePath)}: missing slug or title`);
        continue;
      }

      const type = getDocumentType(filePath);
      const routePath = getRoutePath(filePath);

      // NEW: Skip files at depth 3+ (they become children, not routes)
      // But track their parent folders for route creation
      if (routePath === null) {
        // Extract parent folder path (depth 2) for files at depth 3+
        const rel = path.relative(DATA_DIR, filePath);
        const withoutExt = rel.replace(/\.md$/, '');
        const parts = withoutExt.split(path.sep);
        parts.shift(); // Remove type (ambientazione/regolamento)

        // If depth 3+, track the depth 2 parent folder
        if (parts.length > 2) {
          const depth2Path = parts.slice(0, 2).join('/'); // e.g., "approfondimenti/criminalita"
          categories.add(`${type}::${depth2Path}::document`); // Mark as document route (not category)
        }
        continue;
      }

      // Document route
      routes.push({
        path: routePath,
        type,
        kind: 'document',
        rootDocumentSlug: frontmatter.slug,
        title: frontmatter.title,
        description: frontmatter.description,
        isPublic: frontmatter.isPublic ?? false,
        enabled: frontmatter.enabled ?? true,
      });

      // Track parent folders for category routes
      const pathParts = routePath.split('/');
      if (pathParts.length > 1) {
        // Build all parent paths
        for (let i = 1; i < pathParts.length; i++) {
          const categoryPath = pathParts.slice(0, i).join('/');
          categories.add(`${type}::${categoryPath}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error parsing ${path.basename(filePath)}:`, error);
    }
  }

  // Step 2: Create routes for folders
  for (const categoryKey of categories) {
    const parts = categoryKey.split('::');
    const type = parts[0];
    const categoryPath = parts[1];
    const routeKind = parts[2] || 'category'; // Default to category if not specified
    const folderName = categoryPath.split('/').pop() || '';
    const title = getCategoryTitle(folderName);

    // Determine if this is a category (depth 1) or document (depth 2 folder with only depth 3+ children)
    const isCategory = routeKind === 'category';

    routes.push({
      path: categoryPath,
      type: type as 'ambientazione' | 'regolamento',
      kind: isCategory ? 'category' : 'document',
      rootDocumentSlug: isCategory ? null : folderName,
      title,
      isPublic: isCategory ? true : false,  // Categories public, documents private by default
      enabled: true,
    });
  }

  // Sort routes by type and path
  routes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    if (a.kind !== b.kind) {
      return a.kind === 'category' ? -1 : 1; // Categories first
    }
    return a.path.localeCompare(b.path);
  });

  console.log(`📋 Generated ${routes.length} routes:`);
  console.log(`   - ${routes.filter(r => r.kind === 'document').length} document routes`);
  console.log(`   - ${routes.filter(r => r.kind === 'category').length} category routes\n`);

  // Write to file
  const json = JSON.stringify(routes, null, 2);
  fs.writeFileSync(OUTPUT_PATH, json, 'utf-8');

  console.log(`✅ Routes config generated: ${OUTPUT_PATH}\n`);

  // Summary by type
  const ambientazione = routes.filter(r => r.type === 'ambientazione');
  const regolamento = routes.filter(r => r.type === 'regolamento');

  console.log(`📊 Summary:`);
  console.log(`   Ambientazione: ${ambientazione.length} routes`);
  console.log(`   Regolamento: ${regolamento.length} routes`);
  console.log(`   Public: ${routes.filter(r => r.isPublic).length} routes`);
  console.log(`   Private: ${routes.filter(r => !r.isPublic).length} routes`);
}

// Run
generateRoutesConfig().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
