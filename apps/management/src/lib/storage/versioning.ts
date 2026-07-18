/**
 * LocalStorage versioning system
 */

import { STORAGE_VERSION } from '@/constants/config';
import { logger } from '@/lib/logger';

/**
 * Versioned storage data
 */
interface VersionedData<T> {
  version: string;
  data: T;
}

/**
 * Get versioned data from localStorage
 */
export function getVersionedData<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as VersionedData<T>;

    // Check version
    if (parsed.version !== STORAGE_VERSION) {
      logger.warn(`[Storage] Version mismatch for "${key}": stored ${parsed.version}, expected ${STORAGE_VERSION}`);
      // Clear old version
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    logger.error(`[Storage] Error reading "${key}":`, { error });
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Set versioned data to localStorage
 */
export function setVersionedData<T>(key: string, data: T): void {
  try {
    const versioned: VersionedData<T> = {
      version: STORAGE_VERSION,
      data
    };

    localStorage.setItem(key, JSON.stringify(versioned));
  } catch (error) {
    logger.error(`[Storage] Error writing "${key}":`, { error });
  }
}

/**
 * Remove versioned data from localStorage
 */
export function removeVersionedData(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Clear all versioned data with a specific prefix
 */
export function clearVersionedDataByPrefix(prefix: string): void {
  const keys = Object.keys(localStorage);

  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  });
}
