/**
 * Cleanup service - purge soft-deleted files after retention period
 * Run as cron job: npm run cleanup
 */
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.CDN_STORAGE_PATH || '/cdn-storage';
const CLEANUP_RETENTION_DAYS = parseInt(process.env.CLEANUP_RETENTION_DAYS || '7', 10);
const CLEANUP_PATH = path.join(STORAGE_PATH, '.cleanup');

interface CleanupStats {
  scanned: number;
  deleted: number;
  errors: number;
  freedBytes: number;
}

/**
 * Parse timestamp from cleanup filename
 * Format: {timestamp}-{type}-{entityId}-{filename}
 * Example: 1709251200000-location-507f1f77bcf86cd799439011-banner-abc123.webp
 */
function parseCleanupFilename(filename: string): { timestamp: number } | null {
  const parts = filename.split('-');
  const timestamp = parseInt(parts[0], 10);

  if (isNaN(timestamp)) {
    return null;
  }

  return { timestamp };
}

/**
 * Check if file is older than retention period
 */
function isExpired(timestamp: number): boolean {
  const now = Date.now();
  const retentionMs = CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return (now - timestamp) > retentionMs;
}

/**
 * Run cleanup job
 */
export async function runCleanup(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    scanned: 0,
    deleted: 0,
    errors: 0,
    freedBytes: 0
  };

  try {
    // Check if cleanup directory exists
    try {
      await fs.access(CLEANUP_PATH);
    } catch {
      console.log('No cleanup directory found, nothing to clean');
      return stats;
    }

    // List all files in cleanup directory
    const files = await fs.readdir(CLEANUP_PATH);
    stats.scanned = files.length;

    console.log(`Scanning ${files.length} files in cleanup directory...`);

    // Process each file
    for (const filename of files) {
      try {
        const parsed = parseCleanupFilename(filename);

        if (!parsed) {
          console.warn(`Skipping invalid cleanup filename: ${filename}`);
          continue;
        }

        // Check if expired
        if (isExpired(parsed.timestamp)) {
          const filePath = path.join(CLEANUP_PATH, filename);

          // Get file size before deletion
          const fileStat = await fs.stat(filePath);
          stats.freedBytes += fileStat.size;

          // Delete file
          await fs.unlink(filePath);
          stats.deleted++;

          console.log(`Deleted expired file: ${filename} (${fileStat.size} bytes)`);
        }
      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
        stats.errors++;
      }
    }

    // Log summary
    console.log('\nCleanup summary:');
    console.log(`- Scanned: ${stats.scanned} files`);
    console.log(`- Deleted: ${stats.deleted} files`);
    console.log(`- Errors: ${stats.errors}`);
    console.log(`- Freed: ${(stats.freedBytes / 1024 / 1024).toFixed(2)} MB`);

    return stats;
  } catch (error) {
    console.error('Cleanup job failed:', error);
    throw error;
  }
}

/**
 * Schedule cleanup job (run every 24 hours)
 */
export function scheduleCleanup(): void {
  const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24', 10);
  const intervalMs = CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;

  console.log(`Scheduling cleanup job every ${CLEANUP_INTERVAL_HOURS} hours`);

  // Run immediately on startup
  runCleanup().catch(console.error);

  // Schedule recurring
  setInterval(() => {
    runCleanup().catch(console.error);
  }, intervalMs);
}

// If run directly (npm run cleanup)
if (require.main === module) {
  runCleanup()
    .then((stats) => {
      console.log('\nCleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
