/**
 * Script: Generate Sitemap
 *
 * Generates sitemap index + sub-sitemaps and writes them to SITEMAP_OUTPUT_DIR
 * (default: apps/landing/public/).
 *
 * Usage:
 *   cd services/unified-backend
 *   npm run generate:sitemap
 */

// CRITICAL: require() non viene hoistato come gli ES import
// dotenv DEVE caricarsi prima che appConfig legga process.env
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
});

if (process.env.NODE_ENV === 'production') {
  require('module-alias/register');
}

async function main() {
  // Import dinamici: si eseguono dopo il require('dotenv') qui sopra
  const mongoose = (await import('mongoose')).default;
  const { appConfig } = await import('@config/runtime');
  const { SitemapService } = await import('../services/SitemapService');

  console.log('[generate-sitemap] Connecting to MongoDB...');
  await mongoose.connect(appConfig.db.mongodbUri as string);
  console.log('[generate-sitemap] Connected. Generating sitemaps...');

  await SitemapService.generate();

  console.log('[generate-sitemap] Done. Disconnecting...');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[generate-sitemap] Fatal error:', err);
  process.exit(1);
});
