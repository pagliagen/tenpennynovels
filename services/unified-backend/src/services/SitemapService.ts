/**
 * SitemapService
 *
 * Generates sitemap index + sub-sitemaps for tenpennynovels.com
 * All files are written to apps/landing/public/ (single source of truth).
 *
 * Output:
 *   sitemap.xml            - Sitemap Index pointing to sub-sitemaps
 *   sitemap-landing.xml    - Static pages (tenpennynovels.com)
 *   sitemap-documents.xml  - Public documents (documenti.tenpennynovels.com)
 */

import fs from 'fs/promises';
import path from 'path';
import Document from '@database/models/Document';
import { logger } from '@shared/utils/logger';

const LANDING_DOMAIN = 'https://tenpennynovels.com';
const DOCUMENTS_DOMAIN = 'https://documenti.tenpennynovels.com';
const OUTPUT_DIR = process.env.SITEMAP_OUTPUT_DIR
  || path.join(__dirname, '../../../../apps/landing/public');

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export class SitemapService {
  static async generate(): Promise<void> {
    try {
      logger.info('[SitemapService] Generating sitemaps...');

      const today = new Date().toISOString().split('T')[0];

      const landingXml = this.buildUrlsetXml(this.getStaticPages());
      const { xml: documentsXml, count: docCount } = await this.buildDocumentsSitemap();
      const indexXml = this.buildSitemapIndex(today);

      await Promise.all([
        fs.writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), indexXml, 'utf-8'),
        fs.writeFile(path.join(OUTPUT_DIR, 'sitemap-landing.xml'), landingXml, 'utf-8'),
        fs.writeFile(path.join(OUTPUT_DIR, 'sitemap-documents.xml'), documentsXml, 'utf-8'),
      ]);

      logger.info(`[SitemapService] Done. Landing: ${this.getStaticPages().length} URLs, Documents: ${docCount} URLs`);
    } catch (error) {
      logger.error('[SitemapService] Generation failed:', error);
    }
  }

  private static getStaticPages(): SitemapUrl[] {
    return [
      { loc: `${LANDING_DOMAIN}/`, lastmod: '2026-02-27', changefreq: 'weekly', priority: 1.0 },
      { loc: `${LANDING_DOMAIN}/credits`, lastmod: '2026-03-07', changefreq: 'monthly', priority: 0.5 },
    ];
  }

  private static async buildDocumentsSitemap(): Promise<{ xml: string; count: number }> {
    const documents = await Document.find({
      isPublic: true,
      isDraft: false,
      visible: true,
      deletedAt: { $exists: false },
    })
      .select('type path lastUpdated')
      .lean();

    const urls: SitemapUrl[] = documents.map((doc: any) => ({
      loc: `${DOCUMENTS_DOMAIN}/${doc.type}/${doc.path}`,
      lastmod: doc.lastUpdated
        ? new Date(doc.lastUpdated).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      changefreq: 'monthly' as const,
      priority: 0.7,
    }));

    return { xml: this.buildUrlsetXml(urls), count: urls.length };
  }

  private static buildSitemapIndex(lastmod: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${LANDING_DOMAIN}/sitemap-landing.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${LANDING_DOMAIN}/sitemap-documents.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>
`;
  }

  private static buildUrlsetXml(urls: SitemapUrl[]): string {
    const entries = urls
      .map(
        (u) => `  <url>
    <loc>${this.escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
