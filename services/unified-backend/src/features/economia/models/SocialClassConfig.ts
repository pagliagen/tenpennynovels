import mongoose, { Document, Schema } from 'mongoose';
import { softDeletePlugin, SoftDeleteMethods } from '@database/plugins/softDeletePlugin';

// Social Class Configuration Interface
export interface ISocialClassConfig extends Document, SoftDeleteMethods {
  name: string; // English name for internal logic: "destitute", "poor", etc.
  label: string; // Italian label for UI display: "Indigente", "Povero", etc.
  minFinanceSkill: number; // Minimum FINANZA skill value
  maxFinanceSkill: number; // Maximum FINANZA skill value
  weeklyCredit: number; // Weekly credit line, in pence
  initialWealth: {
    minCash: number; // Minimum starting cash, in pence
    maxCash: number; // Maximum starting cash, in pence
    hasPrivateApartment: boolean; // Whether they get a private apartment
    apartmentType?: string; // Type of apartment if any
    bonusItems: string[]; // Array of item IDs for bonus starting items
  };
  displayOrder: number; // For UI ordering
  description?: string; // Optional description for UI
}

// Social Class Configuration Schema
const SocialClassConfigSchema = new Schema<ISocialClassConfig>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  minFinanceSkill: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  maxFinanceSkill: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  weeklyCredit: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  initialWealth: {
    minCash: {
      type: Number,
      required: true,
      min: 0
    },
    maxCash: {
      type: Number,
      required: true,
      min: 0
    },
    hasPrivateApartment: {
      type: Boolean,
      default: false
    },
    apartmentType: {
      type: String,
      trim: true
    },
    bonusItems: [{
      type: String, // Item IDs
      trim: true
    }]
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
SocialClassConfigSchema.index({ minFinanceSkill: 1, maxFinanceSkill: 1 });
SocialClassConfigSchema.index({ displayOrder: 1 });

SocialClassConfigSchema.plugin(softDeletePlugin, {
  uniqueKeys: ['name'],
  deletedByField: 'Character'
});

export const SocialClassConfig = mongoose.models.SocialClassConfig || mongoose.model<ISocialClassConfig>('SocialClassConfig', SocialClassConfigSchema);
