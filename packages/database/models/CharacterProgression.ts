import { Schema, Document, model, models } from 'mongoose';

export interface ICharacterProgression extends Document {
  characterId: Schema.Types.ObjectId;
  
  // Current available points
  availableExperiencePoints: number;
  availableSkillPoints: number;
  
  // Lifetime totals
  totalExperienceEarned: number;
  totalSkillPointsEarned: number;
  totalExperienceSpent: number;
  totalSkillPointsSpent: number;
  
  // Progression statistics
  statsImproved: {
    stat: string;
    timesImproved: number;
    totalPointsSpent: number;
    currentValue: number;
    startingValue: number;
  }[];
  
  skillsImproved: {
    skill: string;
    timesImproved: number;
    totalPointsSpent: number;
    currentValue: number;
    startingValue: number;
    lastImprovedAt: Date;
  }[];
  
  // Progression milestones
  milestones: {
    type: 'stat_milestone' | 'skill_milestone' | 'total_progression' | 'roleplay_achievement';
    achievement: string;
    description: string;
    achievedAt: Date;
    rewardGranted?: {
      experiencePoints?: number;
      skillPoints?: number;
      specialReward?: string;
    };
  }[];
  
  // Activity tracking for automation
  activityMetrics: {
    daysActive: number;
    messagesThisWeek: number;
    sessionsParticipated: number;
    lastDailyGrant: Date;
    lastActivityCheck: Date;
    consecutiveActiveDays: number;
    longestActiveStreak: number;
  };
  
  // Spending history summary
  recentSpending: {
    spentAt: Date;
    type: 'skill' | 'stat';
    target: string;
    pointsSpent: number;
    resultValue: number;
  }[];
  
  // Configuration
  settings: {
    autoSpendEnabled: boolean;
    preferredSkillCategories: string[];
    spendingNotifications: boolean;
  };
  
  lastUpdated: Date;
  createdAt: Date;
}

const CharacterProgressionSchema = new Schema<ICharacterProgression>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    unique: true
  },
  
  availableExperiencePoints: {
    type: Number,
    default: 0,
    min: 0
  },
  availableSkillPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalExperienceEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSkillPointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalExperienceSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSkillPointsSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  
  statsImproved: [{
    stat: {
      type: String,
      enum: ['strength', 'constitution', 'size', 'dexterity', 'charm', 'intelligence', 'power', 'education']
    },
    timesImproved: { type: Number, default: 0 },
    totalPointsSpent: { type: Number, default: 0 },
    currentValue: { type: Number, required: true },
    startingValue: { type: Number, required: true }
  }],
  
  skillsImproved: [{
    skill: { type: String, required: true },
    timesImproved: { type: Number, default: 0 },
    totalPointsSpent: { type: Number, default: 0 },
    currentValue: { type: Number, required: true },
    startingValue: { type: Number, required: true },
    lastImprovedAt: { type: Date, default: Date.now }
  }],
  
  milestones: [{
    type: {
      type: String,
      enum: ['stat_milestone', 'skill_milestone', 'total_progression', 'roleplay_achievement']
    },
    achievement: String,
    description: String,
    achievedAt: { type: Date, default: Date.now },
    rewardGranted: {
      experiencePoints: Number,
      skillPoints: Number,
      specialReward: String
    }
  }],
  
  activityMetrics: {
    daysActive: { type: Number, default: 0 },
    messagesThisWeek: { type: Number, default: 0 },
    sessionsParticipated: { type: Number, default: 0 },
    lastDailyGrant: Date,
    lastActivityCheck: Date,
    consecutiveActiveDays: { type: Number, default: 0 },
    longestActiveStreak: { type: Number, default: 0 }
  },
  
  recentSpending: [{
    spentAt: { type: Date, required: true },
    type: {
      type: String,
      enum: ['skill', 'stat'],
      required: true
    },
    target: { type: String, required: true },
    pointsSpent: { type: Number, required: true },
    resultValue: { type: Number, required: true }
  }],
  
  settings: {
    autoSpendEnabled: { type: Boolean, default: false },
    preferredSkillCategories: [String],
    spendingNotifications: { type: Boolean, default: true }
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'character_progression'
});

// Indexes for efficient queries
CharacterProgressionSchema.index({ characterId: 1 });
CharacterProgressionSchema.index({ lastUpdated: -1 });
CharacterProgressionSchema.index({ 'activityMetrics.lastDailyGrant': 1 });

export const CharacterProgression = models.CharacterProgression || model<ICharacterProgression>('CharacterProgression', CharacterProgressionSchema);