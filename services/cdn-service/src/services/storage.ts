/**
 * Storage service - filesystem operations
 * Abstraction layer for future S3 migration
 */
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.CDN_STORAGE_PATH || '/cdn-storage';
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'http://localhost:8000/cdn';

export interface StorageResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Ensure directory exists, create if not
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Get storage path for entity type
 * Format: /cdn-storage/{type}s/{entityId}/
 * Example: /cdn-storage/locations/507f1f77bcf86cd799439011/
 */
function getEntityPath(type: string, entityId: string): string {
  const typePlural = type === 'item' ? 'items' : `${type}s`; // location→locations, item→items, character→characters
  return path.join(STORAGE_PATH, typePlural, entityId);
}

/**
 * Get public URL for file
 * Format: https://cdn.tenpennynovels.com/locations/{entityId}/banner-{hash}.webp
 */
function getPublicUrl(type: string, entityId: string, filename: string): string {
  const typePlural = type === 'item' ? 'items' : `${type}s`;
  return `${CDN_BASE_URL}/${typePlural}/${entityId}/${filename}`;
}

/**
 * Save file to storage
 */
export async function saveFile(
  type: string,
  entityId: string,
  filename: string,
  buffer: Buffer
): Promise<StorageResult> {
  try {
    const entityPath = getEntityPath(type, entityId);
    await ensureDirectory(entityPath);

    const filePath = path.join(entityPath, filename);

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, filePath);

    return {
      success: true,
      path: filePath,
      url: getPublicUrl(type, entityId, filename)
    };
  } catch (error) {
    console.error('Storage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown storage error'
    };
  }
}

/**
 * Delete file (soft delete - move to .cleanup directory)
 */
export async function deleteFile(
  type: string,
  entityId: string,
  filename: string
): Promise<StorageResult> {
  try {
    const entityPath = getEntityPath(type, entityId);
    const filePath = path.join(entityPath, filename);

    // Move to .cleanup directory with timestamp
    const cleanupPath = path.join(STORAGE_PATH, '.cleanup');
    await ensureDirectory(cleanupPath);

    const timestamp = Date.now();
    const cleanupFilename = `${timestamp}-${type}-${entityId}-${filename}`;
    const cleanupFilePath = path.join(cleanupPath, cleanupFilename);

    await fs.rename(filePath, cleanupFilePath);

    return { success: true, path: cleanupFilePath };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error'
    };
  }
}

/**
 * List files in entity directory
 */
export async function listFiles(type: string, entityId: string): Promise<string[]> {
  try {
    const entityPath = getEntityPath(type, entityId);
    const files = await fs.readdir(entityPath);
    return files;
  } catch {
    return [];
  }
}

/**
 * Check if file exists
 */
export async function fileExists(type: string, entityId: string, filename: string): Promise<boolean> {
  try {
    const entityPath = getEntityPath(type, entityId);
    const filePath = path.join(entityPath, filename);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
