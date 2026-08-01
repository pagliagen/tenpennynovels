import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { appConfig } from '@config/runtime';

export type CDNEntityType = 'locations' | 'items' | 'characters' | 'occupations';

// Validate path segment to prevent traversal attacks
function validatePathSegment(segment: string, fieldName: string): void {
  if (!segment || typeof segment !== 'string') {
    throw new Error(`${fieldName} deve essere una stringa non vuota`);
  }
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    throw new Error(`${fieldName} contiene caratteri non consentiti`);
  }
}

export interface CDNUploadResult {
  url: string;
  hash: string;
  size: number;
}

export interface CDNFileInfo {
  filename: string;
  url: string;
  size: number;
  createdAt: Date;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

class CDNServiceImpl {
  private storagePath: string;
  private baseUrl: string;

  constructor() {
    this.storagePath = appConfig.cdn.storagePath;
    this.baseUrl = appConfig.cdn.baseUrl;
  }

  async processAndUpload(
    file: Express.Multer.File,
    type: CDNEntityType,
    entityId: string
  ): Promise<CDNUploadResult> {
    // Validate path segments to prevent traversal attacks
    validatePathSegment(entityId, 'entityId');

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Tipo file non supportato: ${file.mimetype}. Accettati: JPEG, PNG, WebP, GIF`);
    }

    const hash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex')
      .substring(0, 12);

    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    const entityDir = path.join(this.storagePath, type, entityId);
    await fs.mkdir(entityDir, { recursive: true });

    const filename = `${hash}${ext}`;
    const filePath = path.join(entityDir, filename);

    await fs.writeFile(filePath, file.buffer);

    logger.info(`CDN: uploaded ${type}/${entityId}/${filename} (${file.buffer.length} bytes)`);

    return {
      url: `${this.baseUrl}/${type}/${entityId}/${filename}`,
      hash,
      size: file.buffer.length,
    };
  }

  async deleteImage(type: CDNEntityType, entityId: string, filename: string): Promise<void> {
    // Validate path segments to prevent traversal attacks
    validatePathSegment(entityId, 'entityId');
    validatePathSegment(filename, 'filename');

    const filePath = path.join(this.storagePath, type, entityId, filename);

    try {
      await fs.unlink(filePath);
      logger.info(`CDN: deleted local ${type}/${entityId}/${filename}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      logger.warn(`CDN: file not found locally ${type}/${entityId}/${filename}`);
    }
  }

  async listImages(type: CDNEntityType, entityId: string): Promise<CDNFileInfo[]> {
    // Validate path segments to prevent traversal attacks
    validatePathSegment(entityId, 'entityId');

    const entityDir = path.join(this.storagePath, type, entityId);

    try {
      const files = await fs.readdir(entityDir);
      const results: CDNFileInfo[] = [];

      for (const file of files) {
        // Validate filename to prevent traversal attacks
        validatePathSegment(file, 'filename');
        const fp = path.join(entityDir, file);
        const stat = await fs.stat(fp);

        results.push({
          filename: file,
          url: `${this.baseUrl}/${type}/${entityId}/${file}`,
          size: stat.size,
          createdAt: stat.birthtime,
        });
      }

      return results;
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
}

export const CDNService = new CDNServiceImpl();
