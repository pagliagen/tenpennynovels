import { Schema, Document, model, models } from 'mongoose';

export interface IGamingSession extends Document {
  // Session identification
  title: string;
  description?: string;
  
  // Master information
  masterId: Schema.Types.ObjectId;
  masterName: string;
  
  // Session scheduling
  sessionDate: Date;
  startTime: Date;
  endTime?: Date;
  estimatedDuration?: number; // in minutes
  
  // Location and setting
  primaryLocation: Schema.Types.ObjectId;
  additionalLocations?: Schema.Types.ObjectId[];
  settingNotes?: string;
  
  // Session type and difficulty
  sessionType?: 'investigation' | 'social' | 'combat' | 'exploration' | 'event' | 'one_shot' | 'campaign_episode';
  difficultyLevel?: 'easy' | 'medium' | 'hard' | 'extreme';
  campaignId?: Schema.Types.ObjectId; // If part of ongoing campaign
  
  // Participants
  participants: {
    characterId: Schema.Types.ObjectId;
    characterName: string;
    joinedAt: Date;
    leftAt?: Date;
    wasActive: boolean; // For XP calculation
    participationScore: number; // 0-10, for XP modifiers
  }[];
  
  // Session content
  summary?: string;
  significantEvents?: string[];
  plotHooks?: string[];
  npcsIntroduced?: string[];
  
  // Experience and rewards
  experienceAssigned: boolean;
  baseExperienceReward?: number;
  baseSkillPointReward?: number;
  experienceMultiplier?: number; // Based on difficulty and quality
  
  experienceGrants: Schema.Types.ObjectId[]; // References to ExperienceGrant documents
  
  // Master notes (private)
  masterNotes?: string;
  playerFeedback?: {
    characterId: Schema.Types.ObjectId;
    feedback: string;
    rating?: number; // 1-5 stars
    submittedAt: Date;
  }[];
  
  // Session metrics
  messagesExchanged?: number;
  averageResponseTime?: number; // in minutes
  totalActiveTime?: number; // in minutes
  
  // Status
  status: 'planned' | 'active' | 'completed' | 'cancelled' | 'postponed';
  
  // Quest management fields
  turnOrder?: Schema.Types.ObjectId[]; // Order of turns for quest
  actionModeActive?: boolean; // Whether action mode is currently active
  actionModeEndsAt?: Date; // When action mode ends
  lastMasterScreenAt?: Date; // Last time master sent a screen message
  currentQuestStatus?: 'planning' | 'active' | 'completed' | 'cancelled'; // Quest-specific status
  
  // Admin oversight
  requiresReview?: boolean;
  reviewedBy?: Schema.Types.ObjectId;
  reviewNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const GamingSessionSchema = new Schema<IGamingSession>({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 2000
  },
  
  masterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  masterName: {
    type: String,
    required: true
  },
  
  sessionDate: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  estimatedDuration: {
    type: Number,
    min: 30,
    max: 480 // 8 hours max
  },
  
  primaryLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  additionalLocations: [{
    type: Schema.Types.ObjectId,
    ref: 'Location'
  }],
  settingNotes: String,
  
  sessionType: {
    type: String,
    enum: ['investigation', 'social', 'combat', 'exploration', 'event', 'one_shot', 'campaign_episode'],
    required: true
  },
  difficultyLevel: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extreme'],
    required: true
  },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  
  participants: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    characterName: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    wasActive: {
      type: Boolean,
      default: true
    },
    participationScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    }
  }],
  
  summary: String,
  significantEvents: [String],
  plotHooks: [String],
  npcsIntroduced: [String],
  
  experienceAssigned: {
    type: Boolean,
    default: false
  },
  baseExperienceReward: {
    type: Number,
    default: 5,
    min: 0,
    max: 50
  },
  baseSkillPointReward: {
    type: Number,
    default: 3,
    min: 0,
    max: 25
  },
  experienceMultiplier: {
    type: Number,
    default: 1.0,
    min: 0.5,
    max: 3.0
  },
  
  experienceGrants: [{
    type: Schema.Types.ObjectId,
    ref: 'ExperienceGrant'
  }],
  
  masterNotes: String,
  playerFeedback: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character'
    },
    feedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  messagesExchanged: Number,
  averageResponseTime: Number,
  totalActiveTime: Number,
  
  status: {
    type: String,
    enum: ['planned', 'active', 'completed', 'cancelled', 'postponed'],
    default: 'planned'
  },
  
  // Quest management fields
  turnOrder: [{
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }],
  actionModeActive: {
    type: Boolean,
    default: false
  },
  actionModeEndsAt: Date,
  lastMasterScreenAt: Date,
  currentQuestStatus: {
    type: String,
    enum: ['planning', 'active', 'completed', 'cancelled']
  },
  
  requiresReview: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  reviewNotes: String
}, {
  timestamps: true,
  collection: 'gaming_sessions'
});

// Indexes
GamingSessionSchema.index({ masterId: 1, sessionDate: -1 });
GamingSessionSchema.index({ status: 1, sessionDate: 1 });
GamingSessionSchema.index({ 'participants.characterId': 1 });
GamingSessionSchema.index({ primaryLocation: 1, sessionDate: 1 });

export const GamingSession = models.GamingSession || model<IGamingSession>('GamingSession', GamingSessionSchema);