import mongoose, { Schema, model, Document } from 'mongoose';
// Use relative import instead of alias to fix seed script compatibility
import { calculateAllDerivedStats, getCharacterCreationConfig, type CharacterStats, type DerivedStats } from '../../shared/services/CharacterCreationConfigService';
import { escapeRegex } from '@shared/utils/validation';
import { softDeletePlugin, SoftDeleteMethods } from '../plugins/softDeletePlugin';
import { NotificationService } from '@features/tickets/api';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('character-model');

// Granular skill tracking interface for occupation bonuses
export interface SkillBreakdown {
  total: number;              // Computed: base + requiredBonus + manualPoints + occupationBonus
  base: number;               // From skill definition (formula or fixed)
  requiredBonus: number;      // Auto-applied: (REQUIRED_SKILL_MINIMUM - base) for required skills
  manualPoints: number;       // Player-allocated points (ONLY these count toward budget)
  occupationBonus: number;    // From occupation.bonusSkills (BONUS_SKILL_POINTS)
  category?: string;          // Skill category (general, combat, knowledge, social, artistic, technical, etc.)
}

export interface ICharacter extends Document, SoftDeleteMethods {
  // Character type and referent
  characterType: 'pg_principale' | 'pg_master' | 'png';
  referentCharacterId?: Schema.Types.ObjectId; // For PNG only - points to user's PG principale

  // Character basic info
  name: string; // identità di gioco (UNIQUE) - coincide con lo username dell'account, non modificabile dal giocatore
  firstName?: string; // nome di finzione (RP) - editabile dal giocatore, visibile solo in scheda
  surname?: string; // cognome - opzionale, visibile a tutti
  age?: number; // età reale - visibile solo ai master (opzionale per PNG/Master)
  apparentAge?: number; // età apparente - visibile a tutti (opzionale per PNG/Master)
  birthDate?: string; // data di nascita in formato gg/mm/yyyy (es: "14/4/1844") - visibile solo ai master
  physicalDescription?: string; // aspetto fisico - visibile a tutti (opzionale per PNG/Master)
  birthPlace?: string; // luogo di nascita - visibile solo ai master (opzionale per PNG/Master)
  publicDescription?: string; // descrizione pubblica - visibile a tutti (opzionale)
  privateDescription?: string; // biografia privata - visibile solo ai master (opzionale per PNG/Master)
  gender?: 'male' | 'female'; // opzionale per PNG/Master

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
  criminalRecord?: string;
  pathologies?: string;    // patologie psicologiche/fisiche (private - only master/owner)

  // Occupation (changed from string to ObjectId reference)
  occupation?: Schema.Types.ObjectId; // Reference to Occupation model
  occupationBonusesApplied?: boolean; // Track if occupation bonuses were applied
  selectedAlternativeSkills?: { [requirementId: string]: Schema.Types.ObjectId }; // Track chosen alternative skills
  currentOccupation?: string; // Free text field for current occupation (Info generali)

  // Character creation
  userId: Schema.Types.ObjectId;
  
  // Call of Cthulhu Stats (d100 system) - Statistiche base
  stats: {
    strength: number;        // FOR - Forza
    constitution: number;    // COS - Costituzione  
    size: number;           // TAG - Taglia
    dexterity: number;      // DES - Destrezza
    appearance: number;     // APP - Aspetto
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
    sanity: number;         // Punti Sanità = POT iniziali
    maxSanity: number;      // Sanità massima = 99
    magicPoints: number;    // Punti Magia = POT / 5 arrotondato per difetto
    movementRate: number;   // Tasso di Movimento = dipendente da DES e FOR (default 8)
    bonusDamage: string;    // Bonus al Danno da tabella FOR + TAG
    build: number;          // Corporatura da tabella FOR + TAG
  };

  // Combat tracking (TiroContrapposto Phase 2)
  combat?: {
    currentHP: number;           // Current hit points
    maxHP: number;               // Maximum hit points (from derived.hitPoints)
    temporaryHP?: number;        // Temporary HP from buffs/spells
    wounds?: Array<{
      damage: number;
      source: string;            // What caused the wound
      timestamp: Date;
    }>;
    conditions?: Array<{         // Status effects
      name: string;              // e.g., "Stunned", "Bleeding", "Poisoned"
      duration?: number;         // Rounds remaining
      appliedAt: Date;
    }>;
    isDead: boolean;
    isIncapacitated: boolean;    // 0 HP but not dead
  };

  // Skills (Victorian London modified) - Supports both simple numbers and granular breakdown
  skills: { [skillName: string]: number | SkillBreakdown };

  // Dynamic skills (specializations of placeholder skills like "Lingua straniera (Italiano)")
  dynamicSkills?: Array<{
    skillName: string;          // Full specialized skill name (e.g., "Lingua straniera (Italiano)")
    basedOnTemplate: string;    // Template skill name (e.g., "Lingua straniera")
    customValue: string;        // Specialization value (e.g., "Italiano")
    value: number;              // Current skill value
    category: string;           // Skill category
    // Breakdown mirrors SkillBreakdown. The wizard always sends these (see
    // transformForBackend in wizardStore.ts) but until now the schema didn't
    // declare them, so Mongoose silently stripped them on save - only `value`
    // survived, making it impossible to know how many were manualPoints vs
    // requiredBonus for skill-point-budget validation.
    base?: number;
    requiredBonus?: number;
    manualPoints?: number;
    occupationBonus?: number;
  }>;

  // Background guidato strutturato
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

  // Forum stats (denormalized counts for performance)
  forumStats?: {
    followerCount: number; // Number of characters following this character
    followingCount: number; // Number of characters this character follows
    postCount: number; // Total number of forum posts
    lastForumActivityAt?: Date; // Last time character interacted with forum
  };

  // Character appearance
  avatar?: string; // URL or path to character avatar image (for chat/location lists)
  profileImage?: string; // URL or path to character profile image (for character sheet)
  audioTheme?: string; // URL or path to character theme audio
  prestavolto?: string; // Famous person/character used as face reference

  // Prestavolto approval workflow (face claim management)
  prestavoltoStatus?: 'approved' | 'pending_duplicate' | 'pending_change' | null;
  prestavoltoApprovedBy?: Schema.Types.ObjectId;
  prestavoltoApprovedAt?: Date;
  prestavoltoHistory?: Array<{
    oldValue: string | null;
    newValue: string;
    changedAt: Date;
    changedBy: Schema.Types.ObjectId;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: Schema.Types.ObjectId;
    approvedAt?: Date;
    notes?: string;
  }>;

  // PNG Light system (max 5 fake identities for chat masking)
  fakePngs?: Array<{
    // NOTE: _id auto-generated by Mongoose for subdocuments
    name: string;
    surname?: string;
    avatar?: string;
    createdAt: Date;
    updatedAt?: Date;
  }>;
  activeFakePngId?: Schema.Types.ObjectId;

  // Equipment and possessions
  equipment: string[]; // Item IDs
  
  // Game state
  currentLocation: Schema.Types.ObjectId;
  isActive: boolean; // Currently selected character

  // Permission system: gameplayRoles drives both game and admin (admin = player→personaggio, master→master, mod→moderatore)
  playerStatus: 'draft' | 'pending' | 'approved';
  /** Priorità in coda approvazione (solo significativo se playerStatus === 'pending') */
  reviewPriority?: 'high' | 'normal' | 'low';
  canAccessAdminPanel: boolean; // Gate for admin panel access
  isGestore: boolean; // Bypass all permissions
  gameplayRoles: ('player' | 'master' | 'moderatore')[];
  characterPermissions: string[]; // Game permission overrides (e.g. '-game:chat:send' to deny)
  adminPermissions: string[]; // Override permessi management (formato @config/permissions: section.action, deny con -prefix)

  /** Moderazione: ban sul singolo PG (full / chat_only / forum_only) */
  isBanned?: boolean;
  banScope?: 'full' | 'chat_only' | 'forum_only';
  banReason?: string;
  bannedAt?: Date;
  bannedUntil?: Date | null;
  bannedBy?: Schema.Types.ObjectId;
  bannedByName?: string;

  // Approval workflow
  reviewHistory: {
    reviewedBy: Schema.Types.ObjectId;
    reviewedAt: Date;
    action: 'approve' | 'reject' | 'request_changes' | 'draft';
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
  approvedByName?: string;
  approvedAt?: Date;
  rejectedBy?: Schema.Types.ObjectId;
  rejectedByName?: string;
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
  // Character type and referent
  characterType: {
    type: String,
    enum: ['pg_principale', 'pg_master', 'png'],
    default: 'pg_principale',
    required: true
  },
  referentCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: false
  },

  // Character basic info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  firstName: {
    type: String,
    required: false,
    trim: true,
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
    required: false
  },
  apparentAge: {
    type: Number,
    required: false
  },
  birthDate: {
    type: String,
    trim: true,
    maxlength: 10, // Formato: gg/mm/yyyy (10 caratteri)
    validate: {
      validator: function(v: string) {
        // Valida formato gg/mm/yyyy
        if (!v) return true; // Opzionale
        return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
      },
      message: 'birthDate deve essere nel formato gg/mm/yyyy (es: "14/4/1844")'
    }
  },
  physicalDescription: {
    type: String,
    trim: true,
    maxlength: 5000,
    required: false
  },
  birthPlace: {
    type: String,
    trim: true,
    maxlength: 50,
    required: false // Opzionale per PNG/Master
  },
  publicDescription: {
    type: String,
    trim: true,
    maxlength: 5000,
    required: false
  },
  privateDescription: {
    type: String,
    trim: true,
    maxlength: 5000,
    required: false
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: false // Opzionale per PNG/Master
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
  pathologies: {
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
  playerStatus: {
    type: String,
    required: true,
    enum: ['draft', 'pending', 'approved'],
    default: 'draft'
  },
  reviewPriority: {
    type: String,
    enum: ['high', 'normal', 'low'],
    default: 'normal'
  },

  // Call of Cthulhu Stats - Statistiche base
  stats: {
    strength: { type: Number, min: 1, max: 100, default: 50 },      // FOR
    constitution: { type: Number, min: 1, max: 100, default: 50 },  // COS  
    size: { type: Number, min: 1, max: 100, default: 50 },          // TAG
    dexterity: { type: Number, min: 1, max: 100, default: 50 },     // DES
    appearance: { type: Number, min: 1, max: 100, default: 50 },    // APP - Aspetto
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
    sanity: { type: Number, default: 50 },        // SAN = POT iniziali
    maxSanity: { type: Number, default: 99 },     // SAN max = 99
    magicPoints: { type: Number, default: 10 },   // PM = POT / 5
    movementRate: { type: Number, default: 8 },   // Tasso di Movimento (default 8)
    bonusDamage: { type: String, default: "0" },  // Bonus Danno da tabella
    build: { type: Number, default: 0 }           // Corporatura da tabella
  },

  // Combat tracking (TiroContrapposto Phase 2)
  combat: {
    currentHP: { type: Number, default: function(this: ICharacter) { return this.derived?.hitPoints || 10; } },
    maxHP: { type: Number, default: function(this: ICharacter) { return this.derived?.hitPoints || 10; } },
    temporaryHP: { type: Number, default: 0 },
    wounds: [{
      damage: { type: Number, required: true },
      source: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }],
    conditions: [{
      name: { type: String, required: true },
      duration: Number,
      appliedAt: { type: Date, default: Date.now }
    }],
    isDead: { type: Boolean, default: false },
    isIncapacitated: { type: Boolean, default: false }
  },

  // Skills - Supports both simple numbers and granular SkillBreakdown objects
  skills: {
    type: Map,
    of: Schema.Types.Mixed,  // Accepts both numbers AND objects for granular tracking
    default: new Map()
  },

  // Dynamic skills - Specializations of placeholder skills (e.g., "Lingua straniera (Italiano)")
  dynamicSkills: {
    type: [{
      skillName: { type: String, required: true },      // Full specialized skill name
      basedOnTemplate: { type: String, required: true }, // Template skill name
      customValue: { type: String, required: true },    // Specialization value
      value: { type: Number, required: true },          // Current skill value
      category: { type: String, required: true },       // Skill category
      base: { type: Number, default: 0 },
      requiredBonus: { type: Number, default: 0 },
      manualPoints: { type: Number, default: 0 },
      occupationBonus: { type: Number, default: 0 }
    }],
    default: []
  },

  // Background guidato strutturato
  background: {
    briefHistory:           { type: String, trim: true, maxlength: 5000 },
    significantEvents:      { type: String, trim: true, maxlength: 5000 },
    importantRelationships: { type: String, trim: true, maxlength: 5000 },
    personality:            { type: String, trim: true, maxlength: 5000 },
    ideology:               { type: String, trim: true, maxlength: 5000 },
    significantPlaces:      { type: String, trim: true, maxlength: 5000 },
    fearsAndPhobias:        { type: String, trim: true, maxlength: 5000 },
    secrets:                { type: String, trim: true, maxlength: 5000 },
    goalsAndMotivations:    { type: String, trim: true, maxlength: 5000 }
  },

  backgroundCompleted: {
    type: Boolean,
    default: false
  },

  backgroundCompletedAt: {
    type: Date
  },

  // Forum stats (denormalized counts for performance)
  forumStats: {
    followerCount: {
      type: Number,
      default: 0,
      min: 0
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastForumActivityAt: Date
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

  // Prestavolto approval workflow (face claim management)
  prestavoltoStatus: {
    type: String,
    enum: ['approved', 'pending_duplicate', 'pending_change', null],
    default: null
  },
  prestavoltoApprovedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  prestavoltoHistory: [{
    oldValue: { type: String, default: null },
    newValue: { type: String, required: true },
    changedAt: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    notes: { type: String, maxlength: 500 }
  }],
  prestavoltoApprovedAt: {
    type: Date
  },

  // PNG Light system (max 5 fake identities for chat masking)
  fakePngs: {
    type: [{
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
      },
      surname: {
        type: String,
        trim: true,
        maxlength: 50
      },
      avatar: {
        type: String,
        trim: true,
        maxlength: 500
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: Date
    }],
    default: [],
    validate: {
      validator: function(v: any[]) {
        return !v || v.length <= 5;
      },
      message: 'Maximum 5 fake PNGs allowed per character'
    }
  },
  activeFakePngId: {
    type: Schema.Types.ObjectId,
    default: null
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
  
  // Gameplay roles (game + admin: player→personaggio, master→master, moderatore→moderatore)
  gameplayRoles: [{
    type: String,
    enum: ['player', 'master', 'moderatore'],
    default: ['player']
  }],

  canAccessAdminPanel: {
    type: Boolean,
    default: false
  },
  isGestore: {
    type: Boolean,
    default: false
  },
  characterPermissions: [{
    type: String,
    trim: true
  }],
  adminPermissions: [{
    type: String,
    trim: true
  }],

  isBanned: {
    type: Boolean,
    default: false
  },
  banScope: {
    type: String,
    enum: ['full', 'chat_only', 'forum_only'],
    required: false
  },
  banReason: {
    type: String,
    maxlength: 2000,
    trim: true
  },
  bannedAt: { type: Date },
  bannedUntil: { type: Date, default: null },
  bannedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  bannedByName: {
    type: String,
    maxlength: 200,
    trim: true
  },

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
      enum: ['approve', 'reject', 'request_changes', 'draft']
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
  approvedByName: String,
  approvedAt: Date,
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedByName: String,
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
CharacterSchema.index({ name: 1 }, { unique: true }); // Unique index for character names
CharacterSchema.index({ userId: 1, characterType: 1 }); // Fast filtering by user + type
CharacterSchema.index({ referentCharacterId: 1 }); // PNG referent lookups
CharacterSchema.index({ playerStatus: 1 });
CharacterSchema.index({ playerStatus: 1, submittedAt: 1 });
CharacterSchema.index({ occupation: 1 });
CharacterSchema.index({ currentLocation: 1 });
CharacterSchema.index({ prestavolto: 1 }); // For face claim queries (NOT unique - duplicates allowed)
CharacterSchema.index({ userId: 1, isBanned: 1 });

// Presence query optimization
CharacterSchema.index({ lastActive: -1 }); // DESC per sort recenti first
CharacterSchema.index({ currentLocation: 1, lastActive: -1 }); // Compound per cron cleanup

// Compound indexes for admin queries
CharacterSchema.index({ playerStatus: 1, 'reviewHistory.reviewedAt': -1 });
CharacterSchema.index({ playerStatus: 1, occupation: 1 });

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
  const rolePermissions: Record<string, string[]> = {
    'standard': ['player', 'master', 'moderatore'],
    'master': ['master'],
    'moderation': ['moderatore'],
    'whisper': ['player', 'master', 'moderatore'],
    'ooc': ['player', 'master', 'moderatore'],
    'dice_roll': ['player', 'master', 'moderatore'],
    'skill_check': ['player', 'master', 'moderatore'],
    'stat_check': ['player', 'master', 'moderatore'],
    'item_use': ['player', 'master', 'moderatore']
  };
  const requiredRoles = rolePermissions[actionType] || [];
  return this.isGestore || requiredRoles.some((role: string) => this.gameplayRoles.includes(role as 'player' | 'master' | 'moderatore'));
};

CharacterSchema.methods.getLatestReview = function() {
  if (this.reviewHistory.length === 0) return null;
  return this.reviewHistory.sort((a: { reviewedAt: Date }, b: { reviewedAt: Date }) => b.reviewedAt.getTime() - a.reviewedAt.getTime())[0];
};

CharacterSchema.methods.addReview = function(reviewData: Omit<ICharacter['reviewHistory'][number], 'reviewedAt'>) {
  this.reviewHistory.push({
    ...reviewData,
    reviewedAt: new Date()
  });
};

// Pre-save middleware
CharacterSchema.pre('save', async function(this: ICharacter) {
  // Validation 1: Max 1 PG Master per user
  if (this.isModified('characterType') && this.characterType === 'pg_master') {
    const existingMaster = await (this.constructor as mongoose.Model<ICharacter>).findOne({
      userId: this.userId,
      characterType: 'pg_master',
      _id: { $ne: this._id },
      isDeleted: { $ne: true }
    });

    if (existingMaster) {
      throw new Error('User already has a Master character');
    }
  }

  // Validation 2: PNG and Master must have referentCharacterId (auto-find if missing)
  // Gated on isNew/isModified like Validation 1: a Master-only account (no PG
  // principale ever created — legitimate for staff/moderation) would otherwise
  // fail this check on EVERY unrelated save() (e.g. entering a location), forever.
  if (
    (this.isNew || this.isModified('characterType')) &&
    (this.characterType === 'png' || this.characterType === 'pg_master') &&
    !this.referentCharacterId
  ) {
    const pgPrincipale = await (this.constructor as mongoose.Model<ICharacter>).findOne({
      userId: this.userId,
      characterType: 'pg_principale',
      isDeleted: { $ne: true }
    });

    if (pgPrincipale) {
      this.referentCharacterId = pgPrincipale._id as unknown as Schema.Types.ObjectId;
    } else {
      throw new Error(`${this.characterType === 'png' ? 'PNG' : 'Master'} requires a PG principale as referent`);
    }
  }

  // Validation 2b: PG principale should NOT have referentCharacterId
  if (this.characterType === 'pg_principale' && this.referentCharacterId) {
    throw new Error('PG principale cannot have referentCharacterId (only PNG/Master can reference a player character)');
  }

  // Validation 3: Simplified schema for PNG and PG Master - skip full validation
  if (this.characterType === 'png' || this.characterType === 'pg_master') {
    // PNG/Master require only: name
    if (!this.name || this.name.trim().length < 2) {
      throw new Error('Character name required (min 2 chars)');
    }

    // Clear unnecessary fields for PNG/Master
    this.skills = this.skills || {};
    this.occupation = undefined;

    // Skip full stats validation for PNG/Master - they don't need complete stats
    return; // Exit early - no need to calculate derived stats for PNG/Master
  }

  // Calculate derived statistics when base stats change
  if (this.isModified('stats')) {
    const configService = getCharacterCreationConfig();
    const config = await configService.loadConfig();

    // Prepare stats in CharacterStats format
    const characterStats: CharacterStats = {
      strength: this.stats.strength,
      dexterity: this.stats.dexterity,
      constitution: this.stats.constitution,
      size: this.stats.size,
      intelligence: this.stats.intelligence,
      education: this.stats.education,
      power: this.stats.power,
      appearance: this.stats.appearance
    };

    // Calculate all derived stats using config-based parser
    const derived = calculateAllDerivedStats(characterStats, config);

    // Assign calculated values to character
    this.derived.ideaRoll = derived.ideaRoll;
    this.derived.luckRoll = derived.luckRoll;
    this.derived.knowledge = derived.knowledge;
    this.derived.hitPoints = derived.hitPoints;
    this.derived.sanity = derived.sanity;
    this.derived.maxSanity = derived.maxSanity;
    this.derived.magicPoints = derived.magicPoints;
    this.derived.movementRate = derived.movementRate;
    this.derived.bonusDamage = derived.bonusDamage;
    this.derived.build = derived.build;
  }

  // If character becomes active, deactivate other characters for this user
  if (this.isModified('isActive') && this.isActive) {
    await (this.constructor as mongoose.Model<ICharacter>).updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isActive: false }
    );
  }

  // Set submitted date when playerStatus changes to pending
  if (this.isModified('playerStatus') && this.playerStatus === 'pending' && !this.submittedAt) {
    this.submittedAt = new Date();

    // Auto-create character_approval ticket
    try {
      const Ticket = mongoose.model('Ticket');

      // Check if ticket already exists (avoid duplicates)
      const existingTicket = await Ticket.findOne({
        category: 'character_approval',
        'createdBy.characterId': this._id,
        status: { $nin: ['closed'] }
      });

      if (!existingTicket) {
        const ticket = await Ticket.create({
          title: `Richiesta Approvazione: ${this.name}`,
          category: 'character_approval',
          priority: 'medium', // From category config
          department: 'administration', // From category config
          status: 'open',
          createdBy: {
            characterId: this._id,
            characterName: this.name,
            characterAvatar: this.avatar
          },
          categoryMetadata: {
            targetCharacterId: this._id
          },
          lastActivityAt: new Date()
        });

        // ✅ Notify staff via WebSocket
        try {
          await NotificationService.notifyNewTicket({
            _id: ticket._id,
            ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
            category: ticket.category,
            priority: 'normal',
            department: 'character_approval',
            createdBy: {
              characterId: this._id,
              characterName: this.name
            }
          });
        } catch (notifyError) {
          logger.error('Failed to send character approval notification', {
            error: notifyError instanceof Error ? notifyError.message : notifyError,
            characterId: this._id
          });
          // Non-blocking: notification failure shouldn't prevent submission
        }
      }
    } catch (error) {
      // Log error but don't fail character submission
      logger.error('Failed to create character_approval ticket', {
        error: error instanceof Error ? error.message : error,
        characterId: this._id
      });
    }
  }

  // characterPermissions: draft = deny read + wizard only; pending = deny chat/postal; approved = []
  const DRAFT_PENDING_DENIES = ['-game:chat:send', '-game:postal:send'];
  const DRAFT_ONLY = ['-game:character:read', 'game:character:wizard'];
  if (this.isModified('playerStatus') || this.isNew) {
    if (this.playerStatus === 'draft') {
      const base = [...DRAFT_PENDING_DENIES, ...DRAFT_ONLY];
      this.characterPermissions = Array.isArray(this.characterPermissions)
        ? [...new Set([...this.characterPermissions.filter(p => !base.includes(p)), ...base])]
        : base.slice();
    } else if (this.playerStatus === 'pending') {
      this.characterPermissions = Array.isArray(this.characterPermissions)
        ? [...new Set([...this.characterPermissions.filter(p => !DRAFT_PENDING_DENIES.includes(p) && !DRAFT_ONLY.includes(p)), ...DRAFT_PENDING_DENIES])]
        : DRAFT_PENDING_DENIES.slice();
    } else {
      this.characterPermissions = [];
    }
  }

  if (!this.characterPermissions) this.characterPermissions = [];
  if (!this.adminPermissions) this.adminPermissions = [];
  if (this.isGestore === undefined || this.isGestore === null) this.isGestore = false;

  // Validate activeFakePngId exists in fakePngs array
  if (this.activeFakePngId) {
    const fakeExists = this.fakePngs?.some(
      (f: any) => f._id?.toString() === this.activeFakePngId?.toString()
    );
    if (!fakeExists) {
      throw new Error('activeFakePngId must reference an existing fake PNG');
    }
  }

  // Prestavolto duplicate validation (face claim management)
  if (this.isModified('prestavolto') && this.prestavolto) {
    // Check if another character already uses this face claim
    const escapedPrestavolto = escapeRegex(this.prestavolto.trim());
    const duplicate = await (this.constructor as mongoose.Model<ICharacter>).findOne({
      prestavolto: { $regex: new RegExp(`^${escapedPrestavolto}$`, 'i') },
      _id: { $ne: this._id },
      isDeleted: { $ne: true }
    }).select('_id prestavoltoStatus');

    if (duplicate) {
      // Duplicate found
      // Only set pending_duplicate if staff hasn't already approved this duplicate
      if (this.prestavoltoStatus !== 'approved') {
        this.prestavoltoStatus = 'pending_duplicate';
      }
    } else {
      // No duplicate - reset status if it was pending_duplicate
      if (this.prestavoltoStatus === 'pending_duplicate') {
        this.prestavoltoStatus = null;
      }
    }
  }
});

// Apply soft delete plugin
CharacterSchema.plugin(softDeletePlugin, {
  uniqueKeys: ['name'],
  deletedByField: 'Character'
});

export const Character = mongoose.models.Character || model<ICharacter>('Character', CharacterSchema);