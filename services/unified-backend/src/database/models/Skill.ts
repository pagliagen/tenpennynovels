import { Schema, model, models, Document } from 'mongoose';

export interface ISkill extends Document {
  name: string;
  baseValue: string | number; // Flexible: number, "VALUE:XX", or "FORMULA:CHAR"
  category: 'general' | 'combat' | 'knowledge' | 'social' | 'technical' | 'special' | 'criminal' | 'physical' | 'artistic' | 'financial' | 'occult';
  description: string;
  visible: boolean;
  defaultSkill: boolean;  // True se è una skill base per tutti i personaggi
  sortOrder: number;
  // NEW: Support for placeholder skills (e.g., "Lingua")
  isPlaceholder: boolean; // True for skills like "Lingua" that become dynamic skills
  placeholderType?: string; // Type of placeholder: "lingua", "arte", etc.
  predefinedValues?: string[]; // Lista valori predefiniti per placeholder skills (es: Francese, Tedesco...)
  // NEW: Academic skills that cannot be rolled without points
  canRollWithoutPoints: boolean; // False for academic skills with 00 base value
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<ISkill>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  baseValue: {
    type: Schema.Types.Mixed, // Supports both Number and String
    required: true,
    validate: {
      validator: function(v: any) {
        // Accept numbers
        if (typeof v === 'number') {
          return v >= 0 && v <= 100;
        }
        // Accept VALUE:XX format
        if (typeof v === 'string' && v.startsWith('VALUE:')) {
          const num = parseInt(v.replace('VALUE:', ''));
          return !isNaN(num) && num >= 0 && num <= 100;
        }
        // Accept FORMULA:CHAR format
        if (typeof v === 'string' && v.startsWith('FORMULA:')) {
          const char = v.replace('FORMULA:', '');
          return ['STR', 'DEX', 'INT', 'CON', 'APP', 'POW', 'SIZ', 'EDU'].includes(char);
        }
        return false;
      },
      message: 'baseValue must be a number (0-100), "VALUE:XX", or "FORMULA:CHAR"'
    },
    default: 0
  },
  category: {
    type: String,
    enum: ['general', 'combat', 'knowledge', 'social', 'technical', 'special', 'criminal', 'physical', 'artistic', 'financial', 'occult'],
    required: true,
    default: 'general'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  defaultSkill: {
    type: Boolean,
    default: true  // Default: tutte le skills sono di base
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  // NEW: Placeholder skill support
  isPlaceholder: {
    type: Boolean,
    default: false
  },
  placeholderType: {
    type: String,
    required: false,
    trim: true
  },
  predefinedValues: {
    type: [String],
    required: false,
    default: [],
    validate: {
      validator: function(this: any, v: any) {
        // Solo se isPlaceholder = true
        if (!this.isPlaceholder && v && v.length > 0) {
          return false; // Non permettere predefinedValues se non è placeholder
        }
        // No duplicati
        if (v && new Set(v).size !== v.length) {
          return false;
        }
        return true;
      },
      message: 'predefinedValues può essere usato solo per placeholder skills e non deve contenere duplicati'
    }
  },
  // NEW: Academic skill rolling restriction
  canRollWithoutPoints: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'skills'
});

// Indexes per performance
skillSchema.index({ visible: 1, sortOrder: 1 });
skillSchema.index({ category: 1, sortOrder: 1 });

// Virtual per l'ID come stringa
skillSchema.virtual('id').get(function(this: ISkill) {
  return this._id.toString();
});

// Assicurati che i virtual siano inclusi nel JSON
skillSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete (ret as any)._id;
    delete (ret as any).__v;
    return ret;
  }
});

export const Skill = models.Skill || model<ISkill>('Skill', skillSchema);