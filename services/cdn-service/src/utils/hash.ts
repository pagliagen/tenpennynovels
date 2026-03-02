/**
 * Hash utilities for content-addressable storage
 */
import crypto from 'crypto';

/**
 * Generate SHA256 hash of buffer content
 * Used for content-addressable file naming (cache busting)
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
}

/**
 * Generate safe filename from hash
 * Format: {type}-{hash}.{ext}
 * Example: banner-a1b2c3d4e5f6.webp
 */
export function generateFilename(type: string, hash: string, extension: string): string {
  return `${type}-${hash}.${extension}`;
}
