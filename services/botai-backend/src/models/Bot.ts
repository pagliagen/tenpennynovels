import { Schema, model, Document } from 'mongoose';

export interface IBot extends Document {
  botCharacterId: string; // ID del Character nel DB principale
  name: string;
  surname?: string; // Cognome del bot
  gender: 'male' | 'female'; // Gender identity of the bot
  publicDescription?: string; // Descrizione fisica e ruolo del bot (es: "Un barista robusto dai capelli grigi")

  // NUOVO: Assi psicologici (-3 a +3)
  psychologicalAxes: {
    rationalEmotional: number;      // -3 razionale → +3 emotivo
    controlledImpulsive: number;    // -3 controllato → +3 impulsivo
    cynicalIdealist: number;        // -3 cinico → +3 idealista
    proudSubmissive: number;        // -3 orgoglioso → +3 remissivo
    prudentParanoid: number;        // -3 prudente → +3 paranoico
    directAllusive: number;         // -3 diretto → +3 allusivo
  };

  // NUOVO: Ferita/bisogno centrale
  centralWound: {
    wound: string;           // "Paura dello scandalo", "Fame di riconoscimento"
    manifestation: string;   // Come si manifesta nel comportamento
  };

  // NUOVO: Maschera pubblica vs verità privata
  duality: {
    publicMask: string;      // Ciò che mostra in pubblico
    privateTruth: string;    // Ciò che è realmente
  };

  personality: {
    traits: string[]; // es: ["curioso", "diffidente", "gioviale"]
    coreValues: string[]; // es: ["lealtà", "ambizione"]
    speechPattern: string; // es: "parla con accento cockney"
    emotionalRange: {
      min: number; // -10 a 10
      max: number;
    };
  };
  goals: {
    shortTerm: string[]; // obiettivi immediati
    longTerm: string[]; // obiettivi a lungo termine
  };

  // MODIFICATO: Emozioni attive (array)
  activeEmotions: Array<{
    emotion: string;         // "ansia", "curiosità", "sospetto"
    intensity: number;       // 0-10
    trigger?: string;        // Cosa l'ha causata
  }>;

  // MODIFICATO: Stato emotivo con emozioni secondarie
  currentEmotionalState: {
    primaryMood: string;           // mood principale
    intensity: number;             // 1-10
    secondaryEmotions: string[];   // emozioni di sfondo
    lastUpdated: Date;
  };

  activationRules: {
    keywords: string[]; // parole che attivano il bot
    contextualRelevance: number; // 0-100, soglia per attivazione
    cooldownMinutes: number; // tempo minimo tra risposte
  };
  assignedLocations: string[]; // Array of locationId from game-backend
  tags?: string[]; // Location zone tags where bot operates (e.g., ["bancone"], ["tavolo", "bancone"])
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BotSchema = new Schema<IBot>({
  botCharacterId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  surname: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true,
    default: 'male' // Default for backward compatibility with existing bots
  },
  publicDescription: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
  },
  // Assi psicologici (-3 a +3)
  psychologicalAxes: {
    rationalEmotional: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    },
    controlledImpulsive: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    },
    cynicalIdealist: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    },
    proudSubmissive: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    },
    prudentParanoid: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    },
    directAllusive: {
      type: Number,
      required: true,
      min: -3,
      max: 3,
      default: 0
    }
  },
  // Ferita/bisogno centrale
  centralWound: {
    wound: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    manifestation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  // Maschera pubblica vs verità privata
  duality: {
    publicMask: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    privateTruth: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  personality: {
    traits: [{
      type: String,
      maxlength: 100
    }],
    coreValues: [{
      type: String,
      maxlength: 100
    }],
    speechPattern: {
      type: String,
      maxlength: 500
    },
    emotionalRange: {
      min: {
        type: Number,
        min: -10,
        max: 10,
        default: -5
      },
      max: {
        type: Number,
        min: -10,
        max: 10,
        default: 5
      }
    }
  },
  goals: {
    shortTerm: [{
      type: String,
      maxlength: 500
    }],
    longTerm: [{
      type: String,
      maxlength: 500
    }]
  },
  // Emozioni attive (array)
  activeEmotions: [{
    emotion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    intensity: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    trigger: {
      type: String,
      required: false,
      trim: true,
      maxlength: 300
    }
  }],
  // Stato emotivo con emozioni secondarie
  currentEmotionalState: {
    primaryMood: {
      type: String,
      required: true,
      maxlength: 50,
      default: 'neutro'
    },
    intensity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 5
    },
    secondaryEmotions: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  activationRules: {
    keywords: [{
      type: String,
      maxlength: 100
    }],
    contextualRelevance: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    cooldownMinutes: {
      type: Number,
      min: 0,
      max: 1440,
      default: 5
    }
  },
  assignedLocations: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'bots'
});

// Indexes
// Note: botCharacterId already indexed via unique: true
// Compound index on isActive + assignedLocations (can also be used for isActive-only queries)
BotSchema.index({ isActive: 1, assignedLocations: 1 });

// Export schema for use with DatabaseContext
export { BotSchema };

// Export default model (for backward compatibility)
export const Bot = model<IBot>('Bot', BotSchema);
