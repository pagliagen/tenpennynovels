/**
 * PythonEmbeddingService
 *
 * Manages Python subprocess for sentence-transformers
 * Communicates via JSON over stdin/stdout
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

interface EmbeddingRequest {
  text: string;
}

interface EmbeddingResponse {
  success: boolean;
  embedding?: number[];
  dimensions?: number;
  error?: string;
}

interface PendingRequest {
  resolve: (value: number[]) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class PythonEmbeddingService extends EventEmitter {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;
  private pendingRequests: PendingRequest[] = []; // FIFO queue
  private requestId: number = 0;

  constructor(
    private pythonPath: string = process.env.PYTHON_PATH || 'python3',
    private scriptPath: string = path.join(__dirname, '../../python/embedding_server.py'),
    private timeout: number = 30000 // 30s per request
  ) {
    super();
  }

  /**
   * Start Python subprocess
   */
  async start(): Promise<void> {
    console.log(`[Python] Starting embedding server: ${this.scriptPath}`);

    return new Promise((resolve, reject) => {
      // Spawn Python process
      this.process = spawn(this.pythonPath, [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
      });

      if (!this.process.stdout || !this.process.stdin || !this.process.stderr) {
        reject(new Error('Failed to create process streams'));
        return;
      }

      // Setup stderr logging (Python logs)
      this.process.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        console.log(`[Python] ${message}`);

        // Detect model loaded
        if (message.includes('Model ready')) {
          this.isReady = true;
          this.emit('ready');
          resolve();
        }
      });

      // Setup stdout parsing (responses)
      let buffer = '';
      this.process.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();

        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            this.handleResponse(line);
          }
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.error(`[Python] Process exited: code=${code}, signal=${signal}`);
        this.isReady = false;
        this.emit('exit', code, signal);

        // Reject all pending requests
        for (const pending of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Python process died'));
        }
        this.pendingRequests = [];
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`[Python] Process error: ${error.message}`);
        reject(error);
      });

      // Timeout for model loading (90s - download can be slow)
      setTimeout(() => {
        if (!this.isReady) {
          this.stop();
          reject(new Error('Python subprocess startup timeout (90s)'));
        }
      }, 90000);
    });
  }

  /**
   * Stop Python subprocess
   */
  async stop(): Promise<void> {
    if (this.process) {
      console.log('[Python] Stopping embedding server...');

      // Graceful shutdown - close stdin to signal Python to exit
      if (this.process.stdin) {
        this.process.stdin.end();
      }

      // Give it 5 seconds to shutdown gracefully
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            console.warn('[Python] Force killing process...');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process!.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Generate embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isReady || !this.process || !this.process.stdin) {
      throw new Error('Python subprocess not ready');
    }

    return new Promise((resolve, reject) => {
      const id = this.requestId++;

      // Set timeout
      const timeout = setTimeout(() => {
        // Remove from pending queue
        const index = this.pendingRequests.findIndex(p => p === pending);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error(`Embedding generation timeout (${this.timeout}ms)`));
      }, this.timeout);

      // Create pending request
      const pending: PendingRequest = { resolve, reject, timeout };

      // Add to queue
      this.pendingRequests.push(pending);

      // Send request
      const request: EmbeddingRequest = { text };
      try {
        this.process!.stdin!.write(JSON.stringify(request) + '\n');
      } catch (error) {
        clearTimeout(timeout);
        const index = this.pendingRequests.indexOf(pending);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(error);
      }
    });
  }

  /**
   * Handle response from Python (FIFO)
   */
  private handleResponse(line: string): void {
    try {
      const response: EmbeddingResponse = JSON.parse(line);

      // Get first pending request (FIFO)
      const pending = this.pendingRequests.shift();
      if (!pending) {
        console.warn('[Python] Received response but no pending requests');
        return;
      }

      // Clear timeout
      clearTimeout(pending.timeout);

      // Resolve or reject
      if (response.success && response.embedding) {
        pending.resolve(response.embedding);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }

    } catch (error: any) {
      console.error(`[Python] Failed to parse response: ${error.message}`);
      console.error(`[Python] Raw line: ${line}`);

      // Reject first pending if parse error
      const pending = this.pendingRequests.shift();
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Invalid JSON response from Python'));
      }
    }
  }

  /**
   * Check if service is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Get pending requests count (for monitoring)
   */
  get pendingCount(): number {
    return this.pendingRequests.length;
  }
}
