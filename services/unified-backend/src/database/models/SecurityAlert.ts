/**
 * SecurityAlert Model
 *
 * Stores security-related alerts for audit trail.
 */

import mongoose, { Schema, type Types } from 'mongoose';

export type SecurityAlertType =
  | 'suspicious_login'
  | 'password_change'
  | 'failed_login'
  | 'account_locked'
  | 'unusual_location';

export type SecurityAlertSeverity = 'low' | 'medium' | 'high';

/** Campi persistiti (documento MongoDB) */
export interface ISecurityAlert {
  userId: Types.ObjectId;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  ipAddress: string;
  location?: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const SecurityAlertSchema = new Schema<ISecurityAlert>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['suspicious_login', 'password_change', 'failed_login', 'account_locked', 'unusual_location'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    location: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

SecurityAlertSchema.index({ userId: 1, timestamp: -1 });
SecurityAlertSchema.index({ severity: 1, acknowledged: 1 });

export const SecurityAlert = mongoose.model<ISecurityAlert>('SecurityAlert', SecurityAlertSchema);
