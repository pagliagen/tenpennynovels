import { Schema, model, Document } from 'mongoose';

export interface ICharacterSnapshot extends Document {
  characterId: string; // ID originale dal DB principale
  name: string;
  surname?: string;
  age: number;
  gender: string;
  appearance: {
    height?: string;
    eyeColor?: string;
    hairColor?: string;
    physicalDescription?: string;
  };
  background: {
    briefHistory?: string;
    personality?: string;
    significantEvents?: string[];
  };
  occupation?: string;
  socialClass?: string;
  mainStats: {
    // solo stats principali
    strength?: number;
    intelligence?: number;
    charm?: number;
  };
  mainSkills: { [skillName: string]: number }; // solo top skills
  lastSyncedAt: Date;
}

const CharacterSnapshotSchema = new Schema<ICharacterSnapshot>({
  characterId: {
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
    maxlength: 100
  },
  age: {
    type: Number,
    min: 16,
    max: 100
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  appearance: {
    height: {
      type: String,
      maxlength: 20
    },
    eyeColor: {
      type: String,
      maxlength: 50
    },
    hairColor: {
      type: String,
      maxlength: 50
    },
    physicalDescription: {
      type: String,
      maxlength: 2000
    }
  },
  background: {
    briefHistory: {
      type: String,
      maxlength: 5000
    },
    personality: {
      type: String,
      maxlength: 2000
    },
    significantEvents: [{
      type: String,
      maxlength: 500
    }]
  },
  occupation: {
    type: String,
    maxlength: 100
  },
  socialClass: {
    type: String,
    maxlength: 50
  },
  mainStats: {
    strength: {
      type: Number,
      min: 0,
      max: 100
    },
    intelligence: {
      type: Number,
      min: 0,
      max: 100
    },
    charm: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  mainSkills: {
    type: Map,
    of: Number
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false,
  collection: 'character_snapshots'
});

// Indexes
// Note: characterId already indexed via unique: true
// Note: lastSyncedAt already indexed via index: true in field definition

// Export schema for use with DatabaseContext
export { CharacterSnapshotSchema };

// Export default model (for backward compatibility)
export const CharacterSnapshot = model<ICharacterSnapshot>('CharacterSnapshot', CharacterSnapshotSchema);
