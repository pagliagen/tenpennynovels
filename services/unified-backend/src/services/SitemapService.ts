/**
 * SitemapService
 *
 * Generates sitemap.xml with static pages + public documents
 * Triggered by admin panel when documents are published/unpublished/deleted
 */

import fs from 'fs/promises';
import path from 'path';
import Document from '@database/models/Document';
import { logger } from '@shared/utils/logger';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export class SitemapService {
  /**
   * Generate complete sitemap with static pages + public documents
   */
  async generateSitemap(): Promise<void> {
    try {
      logger.info('[SitemapService] Generating sitemap...');

      // Fetch all PUBLIC documents (only those visible without auth)
      const documents = await Document.find({ isPublic: true })
        .select('type slug lastUpdated')
        .lean();

      logger.info(`[SitemapService] Found ${documents.length} public documents`);

      // Static pages from landing app
      const staticPages: SitemapUrl[] = [
        { loc: 'https://tenpennynovels.com/', lastmod: '2026-02-27', changefreq: 'monthly', priority: 1.0 },
        { loc: 'https://tenpennynovels.com/register/', lastmod: '2026-02-27', changefreq: 'monthly', priority: 0.8 },
        { loc: 'https://tenpennynovels.com/forgot-password/', lastmod: '2026-02-27', changefreq: 'monthly', priority: 0.4 },
        { loc: 'https://tenpennynovels.com/privacy/', lastmod: '2025-12-01', changefreq: 'yearly', priority: 0.3 },
        { loc: 'https://tenpennynovels.com/terms/', lastmod: '2025-12-01', changefreq: 'yearly', priority: 0.3 },
        { loc: 'https://tenpennynovels.com/credits/', lastmod: '2025-12-01', changefreq: 'yearly', priority: 0.2 },
      ];

      // Dynamic document URLs (SEO-friendly slugs)
      const documentUrls: SitemapUrl[] = documents.map((doc: any) => ({
        loc: `https://documents.tenpennynovels.com/${doc.type}/${doc.slug}/`,
        lastmod: doc.lastUpdated ? new Date(doc.lastUpdated).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        changefreq: 'monthly' as const,
        priority: doc.type === 'ambientazione' ? 0.7 : 0.6,
      }));

      // Combine all URLs
      const allUrls = [...staticPages, ...documentUrls];

      // Build sitemap XML
      const xml = this.buildSitemapXML(allUrls);

      // Write to apps/landing/public/sitemap.xml
      const sitemapPath = path.join(__dirname, '../../../../../apps/landing/public/sitemap.xml');
      await fs.writeFile(sitemapPath, xml, 'utf-8');

      logger.info(`[SitemapService] Sitemap generated successfully at ${sitemapPath}`);
      logger.info(`[SitemapService] Total URLs: ${allUrls.length} (${staticPages.length} static + ${documentUrls.length} documents)`);

    } catch (error) {
      logger.error('[SitemapService] Error generating sitemap:', error);
      throw error;
    }
  }

  /**
   * Build sitemap XML from URL list
   */
  private buildSitemapXML(urls: SitemapUrl[]): string {
    const urlTags = urls
      .map(
        (url) => `
  <url>
    <loc>${this.escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${url.changefreq || 'monthly'}</changefreq>
    <priority>${url.priority !== undefined ? url.priority.toFixed(1) : '0.5'}</priority>
  </url>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}
</urlset>
`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
