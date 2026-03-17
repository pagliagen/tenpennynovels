import { Client } from 'basic-ftp';
import { createReadStream } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { appConfig } from '@config/runtime';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const IDLE_TIMEOUT_MS = 30_000;

export class FTPSyncService {
  private client: Client | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = appConfig.cdn.ftp.enabled;
  }

  async uploadFile(remotePath: string, localPath: string): Promise<void> {
    if (!this.enabled) {
      logger.debug(`FTP sync disabled, skipping upload: ${remotePath}`);
      return;
    }

    await this.withRetry(async (client) => {
      const remoteDir = path.posix.dirname(
        path.posix.join(appConfig.cdn.ftp.basePath, remotePath)
      );
      await client.ensureDir(remoteDir);

      const fullRemotePath = path.posix.join(appConfig.cdn.ftp.basePath, remotePath);
      await client.uploadFrom(createReadStream(localPath), fullRemotePath);
      logger.info(`FTP: uploaded ${remotePath}`);
    });
  }

  async deleteFile(remotePath: string): Promise<void> {
    if (!this.enabled) {
      logger.debug(`FTP sync disabled, skipping delete: ${remotePath}`);
      return;
    }

    await this.withRetry(async (client) => {
      const fullRemotePath = path.posix.join(appConfig.cdn.ftp.basePath, remotePath);
      try {
        await client.remove(fullRemotePath);
        logger.info(`FTP: deleted ${remotePath}`);
      } catch (err: any) {
        if (err.code === 550) {
          logger.warn(`FTP: file not found on remote: ${remotePath}`);
        } else {
          throw err;
        }
      }
    });
  }

  private async withRetry(operation: (client: Client) => Promise<void>): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const client = await this.getClient();
        await operation(client);
        this.scheduleDisconnect();
        return;
      } catch (err: any) {
        lastError = err;
        logger.warn(`FTP: attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);

        this.disconnect();

        if (attempt < MAX_RETRIES) {
          const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    logger.error(`FTP: all ${MAX_RETRIES} attempts failed for operation`);
    throw lastError;
  }

  private async getClient(): Promise<Client> {
    if (this.client) {
      this.clearIdleTimer();
      return this.client;
    }

    const client = new Client();
    client.ftp.verbose = !appConfig.isProduction;

    await client.access({
      host: appConfig.cdn.ftp.host,
      port: appConfig.cdn.ftp.port,
      user: appConfig.cdn.ftp.user,
      password: appConfig.cdn.ftp.password,
      secure: appConfig.cdn.ftp.secure,
      secureOptions: { rejectUnauthorized: false }, // Ignore SSL certificate mismatch (hosting condiviso)
    });

    logger.info('FTP: connected to remote server');
    this.client = client;
    return client;
  }

  private scheduleDisconnect(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.disconnect();
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private disconnect(): void {
    this.clearIdleTimer();
    if (this.client) {
      try {
        this.client.close();
      } catch { /* safe to ignore */ }
      this.client = null;
      logger.debug('FTP: disconnected');
    }
  }
}
