import mongoose, { Schema, model, Document } from 'mongoose';
import { SocialClass } from '../../shared/types/socialClass';

export interface IOccupation extends Document {
  // Basic info
  name: string;
  description: string;

  // Social and economic context
  socialClass: SocialClass[];

  // Category for organization (from esperienze_pregresse.txt - 18 categories)
  category: 'avventurieri' | 'arti_creative' | 'artisti_spettacolo' | 'sport' | 'affari' |
           'religiosi' | 'criminali' | 'giornalismo' | 'lavoro_rurale' | 'lavoro_urbano' |
           'tutori_ordine' | 'professione_legale' | 'operatori_sanitari' | 'salute_mentale' |
           'forze_armate' | 'politica' | 'studiosi' | 'professioni_varie';

  // Display information
  contacts: string; // e.g., "altri medici, alta società, polizia locale"
  earnings: string; // e.g., "Lower Middle Class - Alta Borghesia"

  // Skills system
  requiredSkills?: Array<{
    skillId?: string;
    skillName: string;
    baseValue: number; // Base skill value when acquired (default 40)
    isFixed?: boolean;
    alternatives?: Array<{
      skillId?: string;
      skillName: string;
    }>;
  }>;
  bonusSkills?: Array<{
    skillId?: string;
    skillName: string;
    bonusValue: number;
  }>;

  // Victorian context
  typicalEmployers: string[]; // Who typically employs this occupation
  careerProgression?: string[]; // Possible advancement paths (occupation IDs)

  // Prerequisites and restrictions
  allowedGenders?: string[]; // Allowed genders for this occupation
  prerequisites?: {
    minimumAge?: number;
    maximumAge?: number;
  };

  // Availability
  isActive: boolean; // Can be selected by players

  // Management
  createdBy: Schema.Types.ObjectId;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacterOccupationHistory extends Document {
  characterId: Schema.Types.ObjectId;
  occupationId: string; // String ID from occupation database
  occupationName: string; // Cached for performance
  
  // Period of employment
  startedAt: Date;
  endedAt?: Date; // null if current occupation
  
  // Employment details
  employer?: string; // Specific employer name
  location?: string; // Where they worked
  actualSalary?: number; // What they actually earned (may differ from base)
  
  // Performance and reputation
  reputation: number; // How well they performed (1-10)
  achievements?: string[]; // Notable accomplishments
  
  // Reason for leaving
  endReason?: 'promotion' | 'dismissal' | 'resignation' | 'retirement' | 'death' | 'career_change' | 'other';
  endReasonDetails?: string;
  
  // Current status
  isCurrent: boolean;
  
  // Skills gained from this occupation
  skillsGained?: { [skillName: string]: number };
  
  // Reputation effects
  socialClassChangeReason?: string; // If occupation caused social class change
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const OccupationSchema = new Schema<IOccupation>({
  // Basic info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },

  // Social context
  socialClass: [{
    type: String,
    enum: ['destitute', 'poor', 'modest', 'lower_middle', 'middle_class', 'wealthy', 'affluent', 'elite'],
    required: true
  }],

  // Category (from esperienze_pregresse.txt - 18 categories)
  category: {
    type: String,
    required: true,
    enum: [
      'avventurieri', 'arti_creative', 'artisti_spettacolo', 'sport', 'affari',
      'religiosi', 'criminali', 'giornalismo', 'lavoro_rurale', 'lavoro_urbano',
      'tutori_ordine', 'professione_legale', 'operatori_sanitari', 'salute_mentale',
      'forze_armate', 'politica', 'studiosi', 'professioni_varie'
    ]
  },

  // Display information
  contacts: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  earnings: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  // Skills system
  requiredSkills: [{
    skillId: String,
    skillName: {
      type: String,
      required: true
    },
    baseValue: {
      type: Number,
      required: true,
      default: 40,
      min: 0
    },
    isFixed: {
      type: Boolean,
      default: false
    },
    alternatives: [{
      skillId: String,
      skillName: {
        type: String,
        required: true
      }
    }]
  }],
  bonusSkills: [{
    skillId: String,
    skillName: {
      type: String,
      required: true
    },
    bonusValue: {
      type: Number,
      required: true,
      min: 0
    }
  }],

  // Victorian context
  typicalEmployers: [{
    type: String,
    trim: true
  }],
  careerProgression: [String],
  
  // Availability
  isActive: {
    type: Boolean,
    default: true
  },

  // Management
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'occupations'
});

const CharacterOccupationHistorySchema = new Schema<ICharacterOccupationHistory>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  occupationId: {
    type: String,
    required: true,
    trim: true
  },
  occupationName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Employment period
  startedAt: {
    type: Date,
    required: true
  },
  endedAt: Date,
  
  // Employment details
  employer: {
    type: String,
    trim: true,
    maxlength: 200
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200
  },
  actualSalary: {
    type: Number,
    min: 0
  },
  
  // Performance
  reputation: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 5
  },
  achievements: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  
  // End of employment
  endReason: {
    type: String,
    enum: ['promotion', 'dismissal', 'resignation', 'retirement', 'death', 'career_change', 'other']
  },
  endReasonDetails: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Status
  isCurrent: {
    type: Boolean,
    default: false
  },
  
  // Skills and progression
  skillsGained: { type: Map, of: Number },
  socialClassChangeReason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  collection: 'character_occupation_history'
});

// Indexes
// name already has unique constraint
OccupationSchema.index({ category: 1, isActive: 1 });
OccupationSchema.index({ socialClass: 1 });

CharacterOccupationHistorySchema.index({ characterId: 1, startedAt: -1 });
CharacterOccupationHistorySchema.index({ occupationId: 1 });

// Only one current occupation per character
CharacterOccupationHistorySchema.index(
  { characterId: 1, isCurrent: 1 }, 
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

// Methods
// No prerequisite checking method needed - occupations are freely selectable

CharacterOccupationHistorySchema.methods.endOccupation = function(reason: string, details?: string) {
  this.endedAt = new Date();
  this.endReason = reason;
  this.endReasonDetails = details;
  this.isCurrent = false;
};

// Pre-save middleware to ensure only one current occupation
CharacterOccupationHistorySchema.pre('save', async function() {
  if (this.isModified('isCurrent') && this.isCurrent) {
    // Set all other occupations for this character to not current
    await (this.constructor as any).updateMany(
      { characterId: this.characterId, _id: { $ne: this._id } },
      { isCurrent: false }
    );
  }
});

export const Occupation = mongoose.models.Occupation || model<IOccupation>('Occupation', OccupationSchema);
export const CharacterOccupationHistory = mongoose.models.CharacterOccupationHistory || model<ICharacterOccupationHistory>('CharacterOccupationHistory', CharacterOccupationHistorySchema);