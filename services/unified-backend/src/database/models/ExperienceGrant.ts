import { Schema, Document, model, models } from 'mongoose';

export interface IExperienceGrant extends Document {
  // Grant identification
  characterId: Schema.Types.ObjectId;
  
  // Source of the grant
  grantedBy: Schema.Types.ObjectId; // Character ID of master, or 'system' for automated
  grantedByType: 'master' | 'system' | 'admin';
  grantedByName: string; // For display purposes
  
  // Grant categorization
  grantType: 'manual_master' | 'automatic_daily' | 'session_participation' | 'roleplay_bonus' | 'event_participation' | 'milestone_achievement';
  category: 'roleplay' | 'investigation' | 'combat' | 'social' | 'crafting' | 'daily' | 'special';
  
  // Points granted
  experiencePoints: number; // For improving stats
  skillPoints: number; // For improving skills
  
  // Grant context
  reason: string; // Human readable reason
  masterComment?: string; // Private comment from master
  sessionId?: Schema.Types.ObjectId; // Reference to gaming session if applicable
  
  // Session details (if applicable)
  sessionDetails?: {
    sessionDate: Date;
    sessionTitle: string;
    primaryLocation: Schema.Types.ObjectId;
    sessionType: 'investigation' | 'social' | 'combat' | 'exploration' | 'event';
    participants: Schema.Types.ObjectId[];
    difficultyRating?: 'easy' | 'medium' | 'hard' | 'extreme';
    masterNotes?: string;
  };
  
  // Visibility and status
  isVisible: boolean; // Visible to character
  isApproved: boolean; // For admin validation if needed
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  
  // Spending tracking
  isSpent: boolean;
  spentAt?: Date;
  spentOn?: {
    type: 'skill' | 'stat';
    target: string; // skill name or stat name
    previousValue: number;
    newValue: number;
    spentAmount: number;
  };
  
  // Metadata
  metadata: {
    automaticRule?: string; // For system grants
    eventId?: Schema.Types.ObjectId;
    achievementId?: string;
    bonusMultiplier?: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceGrantSchema = new Schema<IExperienceGrant>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  grantedByType: {
    type: String,
    enum: ['master', 'system', 'admin'],
    required: true
  },
  grantedByName: {
    type: String,
    required: true
  },
  
  grantType: {
    type: String,
    enum: ['manual_master', 'automatic_daily', 'session_participation', 'roleplay_bonus', 'event_participation', 'milestone_achievement'],
    required: true
  },
  category: {
    type: String,
    enum: ['roleplay', 'investigation', 'combat', 'social', 'crafting', 'daily', 'special'],
    required: true
  },
  
  experiencePoints: {
    type: Number,
    required: true,
    min: 0,
    max: 100 // Reasonable daily maximum
  },
  skillPoints: {
    type: Number,
    required: true,
    min: 0,
    max: 50 // Reasonable daily maximum
  },
  
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  masterComment: {
    type: String,
    maxlength: 1000
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'GamingSession'
  },
  
  sessionDetails: {
    sessionDate: Date,
    sessionTitle: String,
    primaryLocation: {
      type: Schema.Types.ObjectId,
      ref: 'Location'
    },
    sessionType: {
      type: String,
      enum: ['investigation', 'social', 'combat', 'exploration', 'event']
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'Character'
    }],
    difficultyRating: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'extreme']
    },
    masterNotes: String
  },
  
  isVisible: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  approvedAt: Date,
  
  isSpent: {
    type: Boolean,
    default: false
  },
  spentAt: Date,
  spentOn: {
    type: {
      type: String,
      enum: ['skill', 'stat']
    },
    target: String,
    previousValue: Number,
    newValue: Number,
    spentAmount: Number
  },
  
  metadata: {
    automaticRule: String,
    eventId: Schema.Types.ObjectId,
    achievementId: String,
    bonusMultiplier: Number
  }
}, {
  timestamps: true,
  collection: 'experience_grants'
});

// Indexes for efficient queries
ExperienceGrantSchema.index({ characterId: 1, createdAt: -1 });
ExperienceGrantSchema.index({ grantedBy: 1, grantType: 1 });
ExperienceGrantSchema.index({ sessionId: 1 });
ExperienceGrantSchema.index({ isSpent: 1, characterId: 1 });
ExperienceGrantSchema.index({ grantType: 1, category: 1, createdAt: -1 });

export const ExperienceGrant = models.ExperienceGrant || model<IExperienceGrant>('ExperienceGrant', ExperienceGrantSchema);