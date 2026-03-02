/**
 * LocalStorage migrations
 *
 * Gestisce la migrazione di dati tra versioni diverse
 */

import { STORAGE_VERSION, STORAGE_KEYS } from '@/constants/config';

/**
 * Migration function type
 */
type MigrationFn = (data: unknown) => unknown;

/**
 * Migration registry
 */
const migrations: Record<string, MigrationFn> = {
  // Example migration from v1.0.0 to v2.0.0
  '1.0.0': (data: unknown) => {
    // Transform data structure
    console.log('[Migration] Migrating from 1.0.0 to 2.0.0');
    return data; // Return transformed data
  }
};

/**
 * Apply migrations to data
 */
export function applyMigrations(fromVersion: string, data: unknown): unknown {
  let currentData = data;

  // Apply each migration in order
  const versions = Object.keys(migrations).sort();

  for (const version of versions) {
    if (version > fromVersion && version <= STORAGE_VERSION) {
      console.log(`[Migration] Applying migration for version ${version}`);
      currentData = migrations[version](currentData);
    }
  }

  return currentData;
}

/**
 * Migrate column visibility data
 */
export function migrateColumnVisibility(tableName: string): Record<string, boolean> | null {
  const key = `${STORAGE_KEYS.COLUMN_VISIBILITY_PREFIX}${tableName}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);

    // Check if it has version info
    if (parsed.version) {
      if (parsed.version !== STORAGE_VERSION) {
        console.warn(`[Migration] Column visibility version mismatch for "${tableName}": ${parsed.version} -> ${STORAGE_VERSION}`);
        // Apply migrations
        const migrated = applyMigrations(parsed.version, parsed.data);
        // Save migrated data
        localStorage.setItem(key, JSON.stringify({
          version: STORAGE_VERSION,
          data: migrated
        }));
        return migrated as Record<string, boolean>;
      }
      return parsed.data as Record<string, boolean>;
    }

    // Old format without version - reset
    console.warn(`[Migration] Resetting unversioned column visibility for "${tableName}"`);
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error(`[Migration] Error migrating column visibility for "${tableName}":`, error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Run all necessary migrations on app startup
 */
export function runStorageMigrations(): void {
  console.log(`[Migration] Running storage migrations to version ${STORAGE_VERSION}`);

  // Check version in localStorage
  const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);

  if (!storedVersion) {
    console.log('[Migration] First run, setting version');
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
    return;
  }

  if (storedVersion !== STORAGE_VERSION) {
    console.log(`[Migration] Version change: ${storedVersion} -> ${STORAGE_VERSION}`);

    // Run migrations here
    // ...

    // Update version
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
  }
}
