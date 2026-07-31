import mongoose, { Document, Schema } from 'mongoose';
import { SocialClass } from '../../shared/types/socialClass';

// Character Finances Interface
export interface ICharacterFinances extends Document {
  characterId: mongoose.Types.ObjectId; // Reference to character
  socialClass: SocialClass; // Current social class (granular 8-value system)
  financeSkillValue: number; // Current FINANZA skill value
  
  // Wealth tracking
  cash: number; // Current cash on hand in pounds
  bankDeposit: number; // Money in the bank
  
  // Weekly credit line system
  creditLine: {
    maxWeekly: number; // Maximum weekly credit based on social class
    currentAvailable: number; // How much credit is still available this week
    lastResetDate: Date; // When credit was last reset (should be every Sunday)
    nextResetDate: Date; // When credit will next reset
  };
  
  // Property and assets
  properties: [{
    type: string; // "apartment", "house", "estate", etc.
    name: string; // Name or address
    private: boolean; // Whether it's a private location in game
    locationId?: mongoose.Types.ObjectId; // Reference to Location if it exists
  }];

  // Continuative services (servitù, comunicazioni, trasporti, sicurezza) — VC is a capacity,
  // not a consumable pool: Σ(activeServices.monthlyCost where not yet freed) must stay ≤ financeSkillValue.
  // A service occupies its VC cost indefinitely once subscribed, until explicitly cancelled.
  activeServices: [{
    serviceId: mongoose.Types.ObjectId; // Reference to Service
    category: string; // Snapshot of Service.category, for quick total-committed calculation
    monthlyCost: number; // Snapshot of Service.monthlyCost at subscription time
    activatedAt: Date;
    cancelledAt?: Date; // Set only when the player cancels ("licenzia") the service
    pointsFreeAt?: Date; // Set only alongside cancelledAt — end of the already-paid-for monthly cycle
    propertyIndex?: number; // Required only when category is 'sicurezza' — index into properties[]
  }];

  // Financial history
  lastCalculated: Date; // When finances were last calculated
  createdAt: Date;
  updatedAt: Date;
}

// Character Finances Schema
const CharacterFinancesSchema = new Schema<ICharacterFinances>({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    unique: true // One finances record per character
  },
  socialClass: {
    type: String,
    required: true,
    enum: ['destitute', 'poor', 'modest', 'lower_middle', 'middle_class', 'wealthy', 'affluent', 'elite'],
    trim: true
  },
  financeSkillValue: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  cash: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  bankDeposit: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  creditLine: {
    maxWeekly: {
      type: Number,
      required: true,
      min: 0
    },
    currentAvailable: {
      type: Number,
      required: true,
      min: 0
    },
    lastResetDate: {
      type: Date,
      required: true
    },
    nextResetDate: {
      type: Date,
      required: true
    }
  },
  properties: [{
    type: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    private: {
      type: Boolean,
      default: false
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    }
  }],
  activeServices: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    category: {
      type: String,
      required: true
    },
    monthlyCost: {
      type: Number,
      required: true,
      min: 1
    },
    activatedAt: {
      type: Date,
      required: true
    },
    cancelledAt: Date,
    pointsFreeAt: Date,
    propertyIndex: Number
  }],
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries (characterId already has unique index)
CharacterFinancesSchema.index({ socialClass: 1 });
CharacterFinancesSchema.index({ 'creditLine.nextResetDate': 1 });

// Model
export const CharacterFinances = mongoose.models.CharacterFinances || mongoose.model<ICharacterFinances>('CharacterFinances', CharacterFinancesSchema);