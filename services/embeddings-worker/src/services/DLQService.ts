/**
 * Dead Letter Queue Service
 * Persiste failed jobs in MongoDB per retry manuale/audit
 */

import mongoose from 'mongoose';
import { FailedJob, DLQStats } from '../types/dlq';

const FailedJobSchema = new mongoose.Schema<FailedJob>({
  jobId: { type: String, required: true, unique: true },
  eventType: {
    type: String,
    required: true,
    enum: ['document', 'document_chunk', 'chat']
  },
  eventData: { type: mongoose.Schema.Types.Mixed, required: true },
  error: { type: String, required: true },
  attempts: { type: Number, required: true },
  lastAttemptAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  retryable: { type: Boolean, default: true }
});

// Indexes for queries
FailedJobSchema.index({ retryable: 1, createdAt: -1 });
FailedJobSchema.index({ eventType: 1 });

const FailedJobModel = mongoose.model<FailedJob>('FailedEmbeddingJob', FailedJobSchema);

export class DLQService {
  /**
   * Add failed job to DLQ
   */
  static async addFailedJob(
    jobId: string,
    eventType: 'document' | 'document_chunk' | 'chat' | 'forum_post',
    eventData: any,
    error: string,
    attempts: number,
    retryable: boolean = true
  ): Promise<void> {
    try {
      await FailedJobModel.create({
        jobId,
        eventType,
        eventData,
        error,
        attempts,
        lastAttemptAt: new Date(),
        retryable
      });

      console.warn(`[DLQ] Job ${jobId} added: ${error} (retryable: ${retryable})`);
    } catch (err: any) {
      // Log but don't throw - DLQ failure shouldn't block processing
      console.error(`[DLQ] Failed to add job to DLQ: ${err.message}`);
    }
  }

  /**
   * Get failed jobs for manual retry
   */
  static async getRetryableJobs(limit: number = 100): Promise<FailedJob[]> {
    return FailedJobModel.find({ retryable: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get all failed jobs (retryable + permanent)
   */
  static async getAllFailedJobs(limit: number = 100): Promise<FailedJob[]> {
    return FailedJobModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get DLQ statistics
   */
  static async getStats(): Promise<DLQStats> {
    const [total, retryable, permanent, byEventType] = await Promise.all([
      FailedJobModel.countDocuments(),
      FailedJobModel.countDocuments({ retryable: true }),
      FailedJobModel.countDocuments({ retryable: false }),
      FailedJobModel.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } }
      ])
    ]);

    return {
      total,
      retryable,
      permanent,
      byEventType: byEventType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Remove job from DLQ (after successful retry)
   */
  static async removeJob(jobId: string): Promise<void> {
    await FailedJobModel.deleteOne({ jobId });
    console.info(`[DLQ] Job ${jobId} removed (successfully retried)`);
  }

  /**
   * Clear old failed jobs (cleanup)
   */
  static async clearOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await FailedJobModel.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.info(`[DLQ] Cleared ${result.deletedCount} jobs older than ${daysOld} days`);
    return result.deletedCount;
  }
}
