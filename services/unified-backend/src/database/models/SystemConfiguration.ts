import mongoose, { Schema, Document } from 'mongoose';

/**
 * SystemConfiguration Model
 *
 * Stores parametric system configurations including:
 * - Email templates with placeholders
 * - Game constants (character creation, experience, housing, etc.)
 * - System-wide settings
 *
 * Features:
 * - Redis caching support (via ConfigurationService)
 * - Audit trail (who/when/why changes were made)
 * - Version tracking
 * - Active/inactive toggle
 * - Type-safe configuration sections and types
 */

export interface ISystemConfiguration extends Document {
  configKey: string; // Unique identifier (e.g., 'email_template_verification', 'character_stat_total_points')
  configSection: 'email_templates' | 'character_creation' | 'experience_system' | 'housing_system' | 'economy' | 'moderation' | 'postal_system' | 'combat_system' | 'skill_check_system' | 'ticket_system' | 'system';
  configType: 'template' | 'number' | 'string' | 'boolean' | 'json';
  value: any; // For templates: {subject: string, html: string, text: string}, for numbers: number, etc.
  defaultValue: any; // Fallback if value is not set or config is deactivated
  description: string; // Description for management UI
  isActive: boolean; // If false, uses defaultValue
  metadata: {
    lastUpdatedBy?: mongoose.Types.ObjectId; // User who made the last modification
    lastUpdatedAt?: Date;
    updateReason?: string;
    version?: number; // Increments on each modification
  };
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigurationSchema = new Schema<ISystemConfiguration>(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      // Examples: 'email_template_verification', 'character_stat_total_points'
    },
    configSection: {
      type: String,
      required: true,
      enum: [
        'email_templates',
        'character_creation',
        'experience_system',
        'housing_system',
        'economy',
        'moderation',
        'postal_system',
        'combat_system',
        'skill_check_system',
        'ticket_system',
        'system',
      ],
      index: true,
    },
    configType: {
      type: String,
      required: true,
      enum: ['template', 'number', 'string', 'boolean', 'json'],
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    defaultValue: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      lastUpdatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      lastUpdatedAt: Date,
      updateReason: String,
      version: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
    collection: 'system_configurations',
  }
);

// Indexes for efficient queries
SystemConfigurationSchema.index({ configSection: 1, isActive: 1 });
SystemConfigurationSchema.index({ configKey: 1, isActive: 1 });

export const SystemConfiguration = mongoose.model<ISystemConfiguration>(
  'SystemConfiguration',
  SystemConfigurationSchema
);
