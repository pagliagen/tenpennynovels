import mongoose, { Schema, model, Document } from 'mongoose';

// Granular skill tracking interface for occupation bonuses
export interface SkillBreakdown {
  total: number;              // Computed: base + requiredBonus + manualPoints + occupationBonus
  base: number;               // From skill definition (formula or fixed)
  requiredBonus: number;      // Auto-applied: (REQUIRED_SKILL_MINIMUM - base) for required skills
  manualPoints: number;       // Player-allocated points (ONLY these count toward budget)
  occupationBonus: number;    // From occupation.bonusSkills (BONUS_SKILL_POINTS)
}

export interface ICharacter extends Document {
  // Character basic info
  name: string; // visibile a tutti
  surname?: string; // cognome - opzionale, visibile a tutti
  age: number; // età reale - visibile solo ai master
  apparentAge: number; // età apparente - visibile a tutti
  physicalDescription: string; // aspetto fisico - visibile a tutti
  birthPlace: string; // luogo di nascita - visibile solo ai master
  publicDescription: string; // descrizione pubblica - visibile a tutti
  privateDescription: string; // biografia privata - visibile solo ai master
  gender: 'male' | 'female';

  // NEW: Anagrafica completa da background_guidato.txt
  height?: string; // altezza (es: "1.75m")
  weight?: string; // peso (es: "70kg")
  eyeColor?: string; // colore degli occhi
  hairColor?: string; // colore dei capelli
  visibleMarks?: string; // segni particolari visibili
  hiddenMarks?: string; // segni particolari non visibili (private - only master/owner)
  maritalStatus?: string; // stato civile (private - only master/owner)
  illnesses?: string; // patologie (private - only master/owner)
  educationTitle?: string; // titolo di studio (private - only master/owner)
  criminalRecord?: string; // fedina penale

  // Occupation (changed from string to ObjectId reference)
  occupation?: Schema.Types.ObjectId; // Reference to Occupation model
  occupationBonusesApplied?: boolean; // Track if occupation bonuses were applied
  selectedAlternativeSkills?: { [requirementId: string]: Schema.Types.ObjectId }; // Track chosen alternative skills
  currentOccupation?: string; // Free text field for current occupation (Info generali)

  // Character creation
  userId: Schema.Types.ObjectId;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  
  // Call of Cthulhu Stats (d100 system) - Statistiche base
  stats: {
    strength: number;        // FOR - Forza
    constitution: number;    // COS - Costituzione  
    size: number;           // TAG - Taglia
    dexterity: number;      // DES - Destrezza
    charm: number;          // FAS - Fascino (corretto da appearance)
    intelligence: number;   // INT - Intelligenza
    power: number;          // POT - Potere
    education: number;      // EDU - Educazione
  };
  
  // Call of Cthulhu Derivate (calcolate automaticamente)
  derived: {
    ideaRoll: number;       // Tiro Idea = INT
    luckRoll: number;       // Tiro Fortuna = POT
    knowledge: number;      // Conoscenze = EDU
    hitPoints: number;      // Punti Ferita = (TAG + COS) / 10 arrotondato per difetto
    sanityPoints: number;   // Punti Sanità = POT iniziali
    magicPoints: number;    // Punti Magia = POT / 5 arrotondato per difetto
    damageBonus: string;    // Bonus al Danno da tabella FOR + TAG
    build: number;          // Corporatura da tabella FOR + TAG
  };

  // Skills (Victorian London modified) - Supports both simple numbers and granular breakdown
  skills: { [skillName: string]: number | SkillBreakdown };

  // Character description (deprecated fields)
  motivations?: string; // DEPRECATED - use background.goalsAndMotivations
  fears?: string; // DEPRECATED - use background.fearsAndPhobias
  description?: string; // DEPRECATED - use publicDescription
  personalityTraits?: string[]; // DEPRECATED - use background.personality

  // NEW SYSTEM: Background guidato strutturato (da background_guidato.txt)
  background?: {
    briefHistory?: string; // Storia in breve (max 4000 caratteri)
    significantEvents?: string; // Fatti salienti
    importantRelationships?: string; // Relazioni importanti
    personality?: string; // Personalità
    ideology?: string; // Ideologia/Credo
    significantPlaces?: string; // Luoghi significativi
    fearsAndPhobias?: string; // Paure e fobie (private)
    secrets?: string; // Segreti (private)
    goalsAndMotivations?: string; // Obiettivi e motivazioni
  };

  // Completamento del background
  backgroundCompleted?: boolean; // se il background è stato completato
  backgroundCompletedAt?: Date; // quando è stato completato

  // DEPRECATED: Background guidato - ora gestito tramite questionario (kept for migration)
  backgroundResponses?: {
    questionId: string;
    response: string;
    answeredAt: Date;
    questionVersion: number;
  }[];

  // DEPRECATED: Campi derivati per backward compatibility
  guidedBackground?: {
    phobias: string[];
    pastTraumas: string[];
    beliefSystem: 'razionalista' | 'spiritualista' | 'occultista' | 'agnostico' | 'religioso';
    significantBonds: string;
    secrets: string;
  };
  
  // Character appearance
  avatar?: string; // URL or path to character avatar image (for chat/location lists)
  profileImage?: string; // URL or path to character profile image (for character sheet)
  audioTheme?: string; // URL or path to character theme audio
  prestavolto?: string; // Famous person/character used as face reference
  
  // Equipment and possessions
  equipment: string[]; // Item IDs
  
  // Game state
  currentLocation: Schema.Types.ObjectId;
  isActive: boolean; // Currently selected character
  
  // Character gameplay roles (separate from admin roles)
  gameplayRoles: ('personaggio' | 'master' | 'moderatore' | 'gestore')[];
  
  // Approval workflow
  reviewHistory: {
    reviewedBy: Schema.Types.ObjectId;
    reviewedAt: Date;
    action: 'approve' | 'reject' | 'request_changes';
    note?: string;
    feedback?: {
      stats?: string;
      skills?: string;
      background?: string;
      description?: string;
      equipment?: string;
    };
    priority?: 'high' | 'normal' | 'low';
  }[];
  
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Schema.Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Activity tracking
  lastActive: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  resubmissionDeadline?: Date;
}

const CharacterSchema = new Schema<ICharacter>({
  // Character basic info
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  surname: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  age: {
    type: Number,
    min: 16,
    max: 80
  },
  apparentAge: {
    type: Number,
    min: 16,
    max: 80
  },
  physicalDescription: {
    type: String,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  birthPlace: {
    type: String,
    trim: true,
    maxlength: 50
  },
  publicDescription: {
    type: String,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  privateDescription: {
    type: String,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  gender: {
    type: String,
    enum: ['male', 'female']
  },

  // NEW: Anagrafica completa
  height: {
    type: String,
    trim: true,
    maxlength: 20
  },
  weight: {
    type: String,
    trim: true,
    maxlength: 20
  },
  eyeColor: {
    type: String,
    trim: true,
    maxlength: 50
  },
  hairColor: {
    type: String,
    trim: true,
    maxlength: 50
  },
  visibleMarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  hiddenMarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  maritalStatus: {
    type: String,
    trim: true,
    maxlength: 50
  },
  illnesses: {
    type: String,
    trim: true,
    maxlength: 500
  },
  educationTitle: {
    type: String,
    trim: true,
    maxlength: 100
  },
  criminalRecord: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Occupation (changed from string to ObjectId)
  occupation: {
    type: Schema.Types.ObjectId,
    ref: 'Occupation'
  },
  occupationBonusesApplied: {
    type: Boolean,
    default: false
  },
  selectedAlternativeSkills: {
    type: Map,
    of: Schema.Types.ObjectId
  },
  currentOccupation: {
    type: String,
    trim: true,
    maxlength: 100
  },

  // Character creation
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DELETED'],
    default: 'DRAFT'
  },
  
  // Call of Cthulhu Stats - Statistiche base
  stats: {
    strength: { type: Number, min: 1, max: 100, default: 50 },      // FOR
    constitution: { type: Number, min: 1, max: 100, default: 50 },  // COS  
    size: { type: Number, min: 1, max: 100, default: 50 },          // TAG
    dexterity: { type: Number, min: 1, max: 100, default: 50 },     // DES
    charm: { type: Number, min: 1, max: 100, default: 50 },         // FAS - Fascino
    intelligence: { type: Number, min: 1, max: 100, default: 50 },  // INT
    power: { type: Number, min: 1, max: 100, default: 50 },         // POT
    education: { type: Number, min: 1, max: 100, default: 50 }      // EDU
  },
  
  // Call of Cthulhu Derivate (calcolate automaticamente)
  derived: {
    ideaRoll: { type: Number, default: 50 },      // Tiro Idea = INT
    luckRoll: { type: Number, default: 50 },      // Tiro Fortuna = POT
    knowledge: { type: Number, default: 50 },     // Conoscenze = EDU
    hitPoints: { type: Number, default: 10 },     // PF = (TAG + COS) / 10
    sanityPoints: { type: Number, default: 50 },  // SAN = POT iniziali
    magicPoints: { type: Number, default: 10 },   // PM = POT / 5
    damageBonus: { type: String, default: "0" },  // Bonus Danno da tabella
    build: { type: Number, default: 0 }           // Corporatura da tabella
  },

  // Skills - Supports both simple numbers and granular SkillBreakdown objects
  skills: {
    type: Map,
    of: Schema.Types.Mixed,  // Accepts both numbers AND objects for granular tracking
    default: new Map()
  },

  // Character description (DEPRECATED fields)
  motivations: {
    type: String,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  fears: {
    type: String,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  description: {
    type: String,
    minlength: 50,
    maxlength: 1000
  },
  personalityTraits: [String],

  // NEW SYSTEM: Background guidato strutturato
  background: {
    briefHistory: {
      type: String,
      trim: true,
      maxlength: 4000
    },
    significantEvents: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    importantRelationships: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    personality: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    ideology: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    significantPlaces: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    fearsAndPhobias: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    secrets: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    goalsAndMotivations: {
      type: String,
      trim: true,
      maxlength: 2000
    }
  },

  backgroundCompleted: {
    type: Boolean,
    default: false
  },

  backgroundCompletedAt: {
    type: Date
  },

  // DEPRECATED: Background responses - questionario (kept for migration)
  backgroundResponses: [{
    questionId: {
      type: String,
      required: true,
      trim: true
    },
    response: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    answeredAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    questionVersion: {
      type: Number,
      required: true,
      default: 1
    }
  }],

  // DEPRECATED: Backward compatibility
  guidedBackground: {
    phobias: [{
      type: String,
      trim: true,
      maxlength: 200
    }],
    pastTraumas: [{
      type: String,
      trim: true,
      maxlength: 500
    }],
    beliefSystem: {
      type: String,
      enum: ['razionalista', 'spiritualista', 'occultista', 'agnostico', 'religioso']
    },
    significantBonds: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    secrets: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  
  // Character appearance
  avatar: {
    type: String,
    trim: true,
    maxlength: 500
  },
  profileImage: {
    type: String,
    trim: true,
    maxlength: 500
  },
  audioTheme: {
    type: String,
    trim: true,
    maxlength: 500
  },
  prestavolto: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Equipment
  equipment: [{
    type: String,
    trim: true
  }],
  
  // Game state
  currentLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Character gameplay roles
  gameplayRoles: [{
    type: String,
    enum: ['personaggio', 'master', 'moderatore', 'gestore']
  }],
  
  // Approval workflow
  reviewHistory: [{
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reviewedAt: {
      type: Date,
      required: true
    },
    action: {
      type: String,
      required: true,
      enum: ['approve', 'reject', 'request_changes']
    },
    note: String,
    feedback: {
      stats: String,
      skills: String,
      background: String,
      description: String,
      equipment: String
    },
    priority: {
      type: String,
      enum: ['high', 'normal', 'low']
    }
  }],
  
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  rejectionReason: String,
  
  // Activity
  lastActive: Date,
  
  // Submission tracking
  submittedAt: Date,
  resubmissionDeadline: Date
}, {
  timestamps: true,
  collection: 'characters'
});

// Indexes
CharacterSchema.index({ userId: 1 });
CharacterSchema.index({ name: 1 });
CharacterSchema.index({ status: 1 });
CharacterSchema.index({ status: 1, submittedAt: 1 });
CharacterSchema.index({ occupation: 1 });
CharacterSchema.index({ currentLocation: 1 });

// Compound indexes for admin queries
CharacterSchema.index({ status: 1, 'reviewHistory.reviewedAt': -1 });
CharacterSchema.index({ status: 1, occupation: 1 });

// Ensure only one active character per user
CharacterSchema.index({ userId: 1, isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// Methods
CharacterSchema.methods.hasGameplayRole = function(role: string): boolean {
  return this.gameplayRoles.includes(role);
};

CharacterSchema.methods.canPerformAction = function(actionType: string): boolean {
  const rolePermissions = {
    'standard': ['personaggio', 'master', 'moderatore', 'gestore'],
    'master': ['master', 'gestore'],
    'moderation': ['moderatore', 'gestore'],
    'whisper': ['personaggio', 'master', 'moderatore', 'gestore'],
    'ooc': ['personaggio', 'master', 'moderatore', 'gestore'],
    'dice_roll': ['personaggio', 'master', 'moderatore', 'gestore'],
    'skill_check': ['personaggio', 'master', 'moderatore', 'gestore'],
    'stat_check': ['personaggio', 'master', 'moderatore', 'gestore'],
    'item_use': ['personaggio', 'master', 'moderatore', 'gestore']
  };
  
  const requiredRoles = rolePermissions[actionType as keyof typeof rolePermissions] || [];
  return requiredRoles.some((role: string) => this.gameplayRoles.includes(role as any));
};

CharacterSchema.methods.getLatestReview = function() {
  if (this.reviewHistory.length === 0) return null;
  return this.reviewHistory.sort((a: any, b: any) => b.reviewedAt.getTime() - a.reviewedAt.getTime())[0];
};

CharacterSchema.methods.addReview = function(reviewData: any) {
  this.reviewHistory.push({
    ...reviewData,
    reviewedAt: new Date()
  });
};

// Metodi per gestire il questionario background
CharacterSchema.methods.setBackgroundResponse = function(questionId: string, response: string, questionVersion: number = 1) {
  // Trova se esiste già una risposta per questa domanda
  const existingResponseIndex = this.backgroundResponses.findIndex(
    (r: any) => r.questionId === questionId
  );
  
  const responseData = {
    questionId,
    response: response.trim(),
    answeredAt: new Date(),
    questionVersion
  };
  
  if (existingResponseIndex >= 0) {
    // Aggiorna risposta esistente
    this.backgroundResponses[existingResponseIndex] = responseData;
  } else {
    // Aggiungi nuova risposta
    this.backgroundResponses.push(responseData);
  }
};

CharacterSchema.methods.getBackgroundResponse = function(questionId: string) {
  return this.backgroundResponses.find((r: any) => r.questionId === questionId);
};

CharacterSchema.methods.checkBackgroundCompletion = async function(requiredQuestions: string[]) {
  const answeredQuestions = this.backgroundResponses.map((r: any) => r.questionId);
  const missingQuestions = requiredQuestions.filter(q => !answeredQuestions.includes(q));
  
  if (missingQuestions.length === 0) {
    this.backgroundCompleted = true;
    this.backgroundCompletedAt = new Date();
    return { completed: true, missing: [] };
  }
  
  return { completed: false, missing: missingQuestions };
};

CharacterSchema.methods.getBackgroundResponsesByVisibility = function(visibility: 'public' | 'master_only' | 'owner_only', questions: any[]) {
  const visibleQuestions = questions.filter(q => q.responseVisibility === visibility);
  const responses = [];
  
  for (const question of visibleQuestions) {
    const response = this.getBackgroundResponse(question.questionId);
    if (response) {
      responses.push({
        question: question.questionText,
        response: response.response,
        category: question.category,
        answeredAt: response.answeredAt
      });
    }
  }
  
  return responses;
};

// Helper functions for Call of Cthulhu calculations
function calculateDamageBonus(strength: number, size: number): { damageBonus: string, build: number } {
  const total = strength + size;
  
  if (total <= 64) return { damageBonus: "-2", build: -2 };
  if (total <= 84) return { damageBonus: "-1", build: -1 };
  if (total <= 124) return { damageBonus: "0", build: 0 };
  if (total <= 164) return { damageBonus: "+1d4", build: 1 };
  if (total <= 204) return { damageBonus: "+1d6", build: 2 };
  if (total <= 284) return { damageBonus: "+2d6", build: 3 };
  if (total <= 364) return { damageBonus: "+3d6", build: 4 };
  if (total <= 444) return { damageBonus: "+4d6", build: 5 };
  
  // Per valori superiori a 444
  return { damageBonus: "+5d6", build: 6 };
}

// Pre-save middleware
CharacterSchema.pre('save', async function(this: ICharacter, next) {
  // Calculate derived statistics when base stats change
  if (this.isModified('stats')) {
    // Tiro Idea = INT
    this.derived.ideaRoll = this.stats.intelligence;
    
    // Tiro Fortuna = POT
    this.derived.luckRoll = this.stats.power;
    
    // Conoscenze = EDU
    this.derived.knowledge = this.stats.education;
    
    // Punti Ferita = (TAG + COS) / 10 arrotondato per difetto
    this.derived.hitPoints = Math.floor((this.stats.size + this.stats.constitution) / 10);
    
    // Punti Sanità = POT iniziali
    this.derived.sanityPoints = this.stats.power;

    // Punti Magia = POT / 5 arrotondato per difetto
    this.derived.magicPoints = Math.floor(this.stats.power / 5);

    // Bonus al Danno e Corporatura da tabella FOR + TAG
    const damageData = calculateDamageBonus(this.stats.strength, this.stats.size);
    this.derived.damageBonus = damageData.damageBonus;
    this.derived.build = damageData.build;
  }
  
  // If character becomes active, deactivate other characters for this user
  if (this.isModified('isActive') && this.isActive) {
    await (this.constructor as any).updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isActive: false }
    );
  }
  
  // Set submitted date when status changes to PENDING_APPROVAL
  if (this.isModified('status') && this.status === 'PENDING_APPROVAL' && !this.submittedAt) {
    this.submittedAt = new Date();
  }
  
  // Set default gameplay role when approved
  if (this.isModified('status') && this.status === 'APPROVED' && this.gameplayRoles.length === 0) {
    this.gameplayRoles = ['personaggio'];
  }
  
  next();
});

export const Character = mongoose.models.Character || model<ICharacter>('Character', CharacterSchema);