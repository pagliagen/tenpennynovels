import { Schema, model, Document, Types } from 'mongoose';

export interface IBotRelationship extends Document {
  botId: Types.ObjectId;
  characterId: string; // ID del personaggio giocante
  characterName: string;
  sentiment: number; // -100 a 100 (negativo/positivo)
  trustLevel: number; // 0-100
  familiarity: number; // 0-100 (quanto si conoscono)
  lastInteraction: Date;
  interactionCount: number;
  significantEvents: Array<{
    description: string;
    sentimentChange: number;
    timestamp: Date;
  }>;
  notes: string; // note interne del bot sul personaggio

  // NUOVO: Archetipo relazionale
  relationshipArchetype?: {
    type: 'protetto' | 'rivale' | 'tentazione' | 'minaccia' | 'alleato' | 'specchio';
    description: string;
    established: Date;
    canEvolve: boolean;
  };

  // NUOVO: Affidabilità come fonte
  sourceCredibility: {
    reliability: number;     // -3 a +3, default 0
    basedOn: string;        // Perché è affidabile/non affidabile
  };

  // NUOVO: Tensioni latenti
  latentTensions: Array<{
    subject: string;        // Di cosa si sospetta
    source: string;         // Chi ha detto cosa
    severity: number;       // 0-10
    state: 'dormant' | 'active' | 'confirmed' | 'dismissed';
    createdAt: Date;
    notes?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const BotRelationshipSchema = new Schema<IBotRelationship>({
  botId: {
    type: Schema.Types.ObjectId,
    ref: 'Bot',
    required: true
  },
  characterId: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true,
    maxlength: 100
  },
  sentiment: {
    type: Number,
    min: -100,
    max: 100,
    default: 0
  },
  trustLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  familiarity: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  interactionCount: {
    type: Number,
    default: 0,
    min: 0
  },
  significantEvents: [{
    description: {
      type: String,
      maxlength: 1000
    },
    sentimentChange: {
      type: Number,
      min: -50,
      max: 50
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    maxlength: 2000
  },
  // Archetipo relazionale
  relationshipArchetype: {
    type: {
      type: String,
      enum: ['protetto', 'rivale', 'tentazione', 'minaccia', 'alleato', 'specchio'],
      required: false
    },
    description: {
      type: String,
      maxlength: 500
    },
    established: {
      type: Date
    },
    canEvolve: {
      type: Boolean,
      default: true
    }
  },
  // Affidabilità come fonte
  sourceCredibility: {
    reliability: {
      type: Number,
      min: -3,
      max: 3,
      default: 0
    },
    basedOn: {
      type: String,
      maxlength: 500,
      default: 'Nessuna interazione ancora'
    }
  },
  // Tensioni latenti
  latentTensions: [{
    subject: {
      type: String,
      required: true,
      maxlength: 500
    },
    source: {
      type: String,
      required: true,
      maxlength: 200
    },
    severity: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    state: {
      type: String,
      enum: ['dormant', 'active', 'confirmed', 'dismissed'],
      required: true,
      default: 'active'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: 500
    }
  }]
}, {
  timestamps: true,
  collection: 'bot_relationships'
});

// Compound indexes
// Note: botId and characterId are NOT indexed individually
// These compound indexes cover all query patterns efficiently
BotRelationshipSchema.index({ botId: 1, characterId: 1 }, { unique: true });
BotRelationshipSchema.index({ botId: 1, lastInteraction: -1 });

// Export schema for use with DatabaseContext
export { BotRelationshipSchema };

// Export default model (for backward compatibility)
export const BotRelationship = model<IBotRelationship>('BotRelationship', BotRelationshipSchema);
