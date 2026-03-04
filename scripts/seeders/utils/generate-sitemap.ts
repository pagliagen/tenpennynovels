/**
 * Generate Unified Sitemap
 *
 * Creates single sitemap.xml with static pages + dynamic document routes.
 * SEO optimized with priority, changefreq, and lastmod.
 *
 * Structure:
 * - Static pages: /, /about (priority 1.0, 0.5)
 * - Ambientazione docs: /ambientazione/* (priority 0.8)
 * - Regolamento docs: /regolamento/* (priority 0.7)
 *
 * Run: npm run generate:sitemap
 */

import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
const DB_NAME = 'tenpennynovels';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://tenpennynovels.com';
const OUTPUT_PATH = join(__dirname, '../../../apps/landing/public/sitemap.xml');

interface Route {
  path: string;
  type: 'ambientazione' | 'regolamento';
  kind: 'document' | 'category';
  isPublic: boolean;
  enabled: boolean;
  updatedAt: Date;
}

/**
 * Generate sitemap XML from routes (unified: static + dynamic)
 */
function generateSitemapXML(routes: Route[]): string {
  // Static pages entries
  const staticEntries = generateStaticPagesXML();

  // Dynamic document routes
  const documentEntries = routes
    .filter(route => route.isPublic && route.enabled && route.kind === 'document')
    .map(route => {
      const url = `${BASE_URL}/${route.type}/${route.path}`;
      const lastmod = route.updatedAt.toISOString().split('T')[0]; // YYYY-MM-DD

      // Priority based on document type
      const priority = route.type === 'ambientazione' ? '0.8' : '0.7';

      // Change frequency based on content type
      const changefreq = 'monthly'; // Documents rarely change after publication

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${documentEntries}
</urlset>`;
}

/**
 * Generate static pages entries for sitemap
 */
function generateStaticPagesXML(): string {
  const now = new Date().toISOString().split('T')[0];

  return `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
}

async function generateSitemap() {
  console.log('🗺️  Unified Sitemap Generator\n');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all public enabled routes
    console.log('📄 Fetching public routes...');
    const routes = await db.collection('routes').find({
      isPublic: true,
      enabled: true
    }).toArray() as unknown as Route[];

    console.log(`   Found ${routes.length} public routes\n`);

    // Filter document routes only (exclude categories)
    const documentRoutes = routes.filter(r => r.kind === 'document');
    console.log(`   ${documentRoutes.length} document routes (excluding categories)\n`);

    // Generate unified sitemap XML (static pages + documents)
    console.log('🔨 Generating unified sitemap.xml...');
    const sitemapXML = generateSitemapXML(documentRoutes);

    // Write to file
    writeFileSync(OUTPUT_PATH, sitemapXML, 'utf-8');
    console.log(`   ✅ Written to: ${OUTPUT_PATH}\n`);

    // Stats
    const staticPagesCount = 2; // home + about
    const totalUrls = staticPagesCount + documentRoutes.length;

    console.log('📊 Sitemap Stats:');
    console.log(`   Total URLs: ${totalUrls}`);
    console.log(`   Static pages: ${staticPagesCount}`);
    console.log(`   Document pages: ${documentRoutes.length}`);
    console.log(`     - Ambientazione: ${documentRoutes.filter(r => r.type === 'ambientazione').length}`);
    console.log(`     - Regolamento: ${documentRoutes.filter(r => r.type === 'regolamento').length}\n`);

    // Show URLs
    console.log('🔗 URLs included:');
    console.log(`   - ${BASE_URL}/`);
    console.log(`   - ${BASE_URL}/about`);
    documentRoutes.forEach(route => {
      console.log(`   - ${BASE_URL}/${route.type}/${route.path}`);
    });

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Done');
  }
}

generateSitemap();
