/**
 * SitemapService
 *
 * Generates one autonomous sitemap.xml per domain:
 *   - apps/landing/public/sitemap.xml   → tenpennynovels.com URLs
 *   - apps/documents/public/sitemap.xml → documenti.tenpennynovels.com URLs
 *
 * Each domain owns its sitemap: no cross-domain references, no sitemap index.
 */

import fs from 'fs/promises';
import path from 'path';
// boundary-allow: debito dichiarato, SitemapService.ts resta fuori dalla feature documenti (Fase 6.5) fino al consolidamento del core (Fase 7)
import Document from '@features/documenti/models/Document';
import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

const LANDING_DOMAIN = 'https://tenpennynovels.com';
const DOCUMENTS_DOMAIN = 'https://documenti.tenpennynovels.com';
const LANDING_OUTPUT_DIR = appConfig.sitemapOutputDir;
const DOCUMENTS_OUTPUT_DIR = appConfig.documentsSitemapOutputDir;
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

      // Landing sitemap → apps/landing/public/sitemap.xml
      const landingLastMod = await this.readLandingLastModStamp();
      const landingUrls = this.getStaticPages(landingLastMod);
      const landingXml = this.buildUrlsetXml(landingUrls);

      this.validateSitemapXml(landingXml, 'landing/sitemap.xml');
      await this.writeToDir(LANDING_OUTPUT_DIR, [['sitemap.xml', landingXml]]);

      // Documents sitemap → apps/documents/public/sitemap.xml
      const { xml: documentsXml, count: docCount } = await this.buildDocumentsSitemap();

      this.validateSitemapXml(documentsXml, 'documents/sitemap.xml');
      await this.writeToDir(DOCUMENTS_OUTPUT_DIR, [['sitemap.xml', documentsXml]]);

      logger.info(
        `[SitemapService] Done. Landing: ${landingUrls.length} URLs, Documents: ${docCount} URLs`,
      );
    } catch (error) {
      logger.error('[SitemapService] Generation failed:', error);
    }
  }

  /**
   * Validate sitemap XML for spec compliance
   * Throws if invalid (malformed XML, size limit exceeded)
   */
  private static validateSitemapXml(xml: string, filename: string): void {
    // Basic XML structure validation
    if (!xml.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
      throw new Error(`[${filename}] Invalid sitemap: missing XML declaration`);
    }
    if (!xml.includes('<urlset')) {
      throw new Error(`[${filename}] Invalid sitemap: missing root element`);
    }

    // Check size (50MB limit per sitemap spec)
    const sizeBytes = Buffer.byteLength(xml, 'utf-8');
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (sizeBytes > MAX_SIZE) {
      throw new Error(
        `[${filename}] Sitemap exceeds 50MB limit: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB`
      );
    }

    logger.debug(
      `[SitemapService] ${filename} validated: ${(sizeBytes / 1024).toFixed(2)}KB`
    );
  }

  private static async writeToDir(dir: string, files: Array<[string, string]>): Promise<void> {
    // Test write permission - FAIL FAST if directory not accessible
    try {
      await fs.access(dir, fs.constants.W_OK);
    } catch (error) {
      const errorMsg = `[SitemapService] Output directory not writable: ${dir}`;
      logger.error(errorMsg, error);
      throw new Error(errorMsg); // FAIL FAST (no silent skip)
    }

    // Write files sequentially for better error tracking
    for (const [name, content] of files) {
      const filePath = path.join(dir, name);
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`[SitemapService] Written ${filePath} (${content.length} bytes)`);
    }
  }

  private static getStaticPages(lastmod: string): SitemapUrl[] {
    return [
      { loc: `${LANDING_DOMAIN}/`, lastmod, changefreq: 'weekly', priority: 1.0 },
      { loc: `${LANDING_DOMAIN}/credits`, lastmod, changefreq: 'monthly', priority: 0.5 },
    ];
  }

  /** Data commit deployata (CI) o fallback se il file non c’è. */
  private static async readLandingLastModStamp(): Promise<string> {
    const stampPath = path.join(LANDING_OUTPUT_DIR, LANDING_LASTMOD_STAMP);
    try {
      const raw = (await fs.readFile(stampPath, 'utf-8')).trim().split(/\r?\n/)[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    } catch {
      /* missing or unreadable */
    }
    return LANDING_LASTMOD_FALLBACK;
  }

  /**
   * lastmod from Mongo: prefer lastUpdated (kept in sync by Document pre-save), else createdAt.
   * Defensive: If date < 2000-01-01 (epoch bug), fallback to createdAt or today.
   */
  private static documentLastMod(doc: { lastUpdated?: Date; createdAt?: Date }): string {
    const EPOCH_THRESHOLD = new Date('2000-01-01T00:00:00Z');
    const date = doc.lastUpdated || doc.createdAt || new Date();
    const parsedDate = new Date(date);

    // Defensive: If date < 2000-01-01 (epoch bug from migration or invalid data)
    if (parsedDate < EPOCH_THRESHOLD) {
      const fallback =
        doc.createdAt && new Date(doc.createdAt) > EPOCH_THRESHOLD
          ? new Date(doc.createdAt)
          : new Date();
      return fallback.toISOString().split('T')[0];
    }

    return parsedDate.toISOString().split('T')[0];
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
