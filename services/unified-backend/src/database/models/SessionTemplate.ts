import { Schema, Document, model, models } from 'mongoose';

export interface ISessionTemplate extends Document {
  // Template identification
  title: string;
  description: string;
  createdBy: Schema.Types.ObjectId; // Master who created it
  
  // Template categorization
  category: 'investigation' | 'social' | 'combat' | 'exploration' | 'mystery' | 'horror' | 'one_shot';
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  
  // Template structure
  estimatedDuration: number; // in minutes
  recommendedParticipants: {
    min: number;
    max: number;
  };
  
  // Scene structure
  scenes: {
    title: string;
    description: string;
    location?: Schema.Types.ObjectId;
    estimatedTime: number;
    
    // Scene requirements
    requiredSkills?: string[];
    challengeRating?: number;
    
    // Master guidance
    masterNotes: string;
    possibleOutcomes: string[];
    contingencyPlans: string[];
  }[];
  
  // Resources and preparation
  preparation: {
    masterPrep: string[];
    requiredProps: string[];
    backgroundReading: string[];
    npcList: {
      name: string;
      description: string;
      stats?: any;
      roleplayNotes: string;
    }[];
  };
  
  // Experience rewards
  experienceGuidance: {
    baseExperienceReward: number;
    baseSkillPointReward: number;
    bonusCriteria: {
      condition: string;
      bonus: number;
      type: 'experience' | 'skill_points';
    }[];
  };
  
  // Template metadata
  timesUsed: number;
  averageRating: number;
  isPublic: boolean; // Shareable with other masters
  
  createdAt: Date;
  updatedAt: Date;
}

const SessionTemplateSchema = new Schema<ISessionTemplate>({
  title: {
    type: String,
    required: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  
  category: {
    type: String,
    enum: ['investigation', 'social', 'combat', 'exploration', 'mystery', 'horror', 'one_shot'],
    required: true,
    index: true
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true,
    index: true
  },
  
  estimatedDuration: {
    type: Number,
    required: true,
    min: 30,
    max: 480 // 8 hours max
  },
  recommendedParticipants: {
    min: { 
      type: Number, 
      default: 2, 
      min: 1,
      max: 12 
    },
    max: { 
      type: Number, 
      default: 6, 
      min: 2,
      max: 12 
    }
  },
  
  scenes: [{
    title: { 
      type: String, 
      required: true,
      maxlength: 100 
    },
    description: { 
      type: String, 
      required: true,
      maxlength: 1000
    },
    location: { 
      type: Schema.Types.ObjectId, 
      ref: 'Location' 
    },
    estimatedTime: { 
      type: Number, 
      required: true,
      min: 5,
      max: 180
    },
    requiredSkills: [{
      type: String,
      maxlength: 50
    }],
    challengeRating: { 
      type: Number, 
      min: 1, 
      max: 10 
    },
    masterNotes: { 
      type: String, 
      required: true,
      maxlength: 2000
    },
    possibleOutcomes: [{
      type: String,
      maxlength: 500
    }],
    contingencyPlans: [{
      type: String,
      maxlength: 500
    }]
  }],
  
  preparation: {
    masterPrep: [{
      type: String,
      maxlength: 500
    }],
    requiredProps: [{
      type: String,
      maxlength: 200
    }],
    backgroundReading: [{
      type: String,
      maxlength: 200
    }],
    npcList: [{
      name: { 
        type: String, 
        required: true,
        maxlength: 100
      },
      description: { 
        type: String, 
        required: true,
        maxlength: 500
      },
      stats: Schema.Types.Mixed,
      roleplayNotes: { 
        type: String, 
        required: true,
        maxlength: 1000
      }
    }]
  },
  
  experienceGuidance: {
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
    bonusCriteria: [{
      condition: {
        type: String,
        required: true,
        maxlength: 200
      },
      bonus: {
        type: Number,
        required: true,
        min: 0,
        max: 20
      },
      type: { 
        type: String, 
        enum: ['experience', 'skill_points'],
        required: true
      }
    }]
  },
  
  timesUsed: { 
    type: Number, 
    default: 0,
    min: 0
  },
  averageRating: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5
  },
  isPublic: { 
    type: Boolean, 
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'session_templates'
});

// Indexes for efficient querying
SessionTemplateSchema.index({ createdBy: 1, category: 1 });
SessionTemplateSchema.index({ category: 1, difficulty: 1 });
SessionTemplateSchema.index({ isPublic: 1, averageRating: -1 });
SessionTemplateSchema.index({ tags: 1 });
SessionTemplateSchema.index({ 'scenes.location': 1 });

// Virtual for total scenes count
SessionTemplateSchema.virtual('sceneCount').get(function() {
  return this.scenes ? this.scenes.length : 0;
});

// Virtual for average scene duration
SessionTemplateSchema.virtual('averageSceneDuration').get(function() {
  if (!this.scenes || this.scenes.length === 0) return 0;
  const total = this.scenes.reduce((sum, scene) => sum + scene.estimatedTime, 0);
  return Math.round(total / this.scenes.length);
});

// Pre-save validation
SessionTemplateSchema.pre('save', async function() {
  // Validate recommended participants
  if (this.recommendedParticipants.min > this.recommendedParticipants.max) {
    throw new Error('Minimum participants cannot exceed maximum participants');
  }

  // Validate scene time consistency
  if (this.scenes && this.scenes.length > 0) {
    const totalSceneTime = this.scenes.reduce((sum, scene) => sum + scene.estimatedTime, 0);
    if (totalSceneTime > this.estimatedDuration * 1.5) {
      throw new Error('Total scene time significantly exceeds estimated duration');
    }
  }
});

export const SessionTemplate = models.SessionTemplate || model<ISessionTemplate>('SessionTemplate', SessionTemplateSchema);