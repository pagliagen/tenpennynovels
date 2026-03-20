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
import { appConfig } from '@config/runtime';

const LANDING_DOMAIN = 'https://tenpennynovels.com';
const DOCUMENTS_DOMAIN = 'https://documenti.tenpennynovels.com';
const OUTPUT_DIR = appConfig.sitemapOutputDir;
const LANDING_LASTMOD_STAMP = 'landing-sitemap-lastmod.txt';
/** Usato in locale / VPS senza file stamp (deploy CI scrive la data del commit in public/) */
const LANDING_LASTMOD_FALLBACK = '2026-02-27';

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

      const landingLastMod = await this.readLandingLastModStamp();
      const landingUrls = this.getStaticPages(landingLastMod);
      const landingXml = this.buildUrlsetXml(landingUrls);
      const { xml: documentsXml, count: docCount } = await this.buildDocumentsSitemap();
      const indexXml = this.buildSitemapIndex(today);

      const files: Array<[string, string]> = [
        ['sitemap.xml', indexXml],
        ['sitemap-landing.xml', landingXml],
        ['sitemap-documents.xml', documentsXml],
      ];

      await this.writeToDir(OUTPUT_DIR, files);

      logger.info(
        `[SitemapService] Done. Landing: ${landingUrls.length} URLs, Documents: ${docCount} URLs`,
      );
    } catch (error) {
      logger.error('[SitemapService] Generation failed:', error);
    }
  }

  private static async writeToDir(dir: string, files: Array<[string, string]>): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      logger.warn(
        `[SitemapService] Output directory missing or not accessible, skipping write: ${dir}`,
      );
      return;
    }
    await Promise.all(
      files.map(([name, content]) => fs.writeFile(path.join(dir, name), content, 'utf-8')),
    );
    logger.info(`[SitemapService] Written ${files.length} files to ${dir}`);
  }

  private static getStaticPages(lastmod: string): SitemapUrl[] {
    return [
      { loc: `${LANDING_DOMAIN}/`, lastmod, changefreq: 'weekly', priority: 1.0 },
      { loc: `${LANDING_DOMAIN}/credits`, lastmod, changefreq: 'monthly', priority: 0.5 },
    ];
  }

  /** Data commit deployata (CI) o fallback se il file non c’è. */
  private static async readLandingLastModStamp(): Promise<string> {
    const stampPath = path.join(OUTPUT_DIR, LANDING_LASTMOD_STAMP);
    try {
      const raw = (await fs.readFile(stampPath, 'utf-8')).trim().split(/\r?\n/)[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    } catch {
      /* missing or unreadable */
    }
    return LANDING_LASTMOD_FALLBACK;
  }

  /** lastmod from Mongo: prefer lastUpdated (kept in sync by Document pre-save), else createdAt. */
  private static documentLastMod(doc: { lastUpdated?: Date; createdAt?: Date }): string {
    const d = doc.lastUpdated || doc.createdAt;
    if (d) return new Date(d).toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
  }

  private static async buildDocumentsSitemap(): Promise<{ xml: string; count: number }> {
    const documents = await Document.find({
      isPublic: true,
      isDraft: false,
      visible: true,
      deletedAt: { $exists: false },
    })
      .select('type path lastUpdated createdAt')
      .lean();

    const urls: SitemapUrl[] = documents.map((doc: any) => ({
      loc: `${DOCUMENTS_DOMAIN}/${doc.type}/${doc.path}`,
      lastmod: this.documentLastMod(doc),
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
