import mongoose, { Document, Schema } from 'mongoose';

// Character Finances Interface
export interface ICharacterFinances extends Document {
  characterId: mongoose.Types.ObjectId; // Reference to character
  socialClass: string; // Current social class name
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