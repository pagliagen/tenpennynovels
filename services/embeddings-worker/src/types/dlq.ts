/**
 * Dead Letter Queue Types
 * Failed job tracking for manual retry and audit
 */

export interface FailedJob {
  _id?: string;
  jobId: string;
  eventType: 'document' | 'document_chunk' | 'chat';
  eventData: any;
  error: string;
  attempts: number;
  lastAttemptAt: Date;
  createdAt: Date;
  retryable: boolean; // False se errore permanente (validation, etc.)
}

export interface DLQStats {
  total: number;
  retryable: number;
  permanent: number;
  byEventType: Record<string, number>;
}
