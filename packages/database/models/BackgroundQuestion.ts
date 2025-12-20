import mongoose, { Schema, model, Document } from 'mongoose';

export interface IBackgroundQuestion extends Document {
  // Identificativo della domanda
  questionId: string; // identificatore univoco della domanda
  
  // Contenuto della domanda
  questionText: string; // testo della domanda
  placeholder: string; // placeholder per il textarea
  helpText?: string; // testo di aiuto/spiegazione (opzionale)
  
  // Categorizzazione
  category: 'phobias' | 'traumas' | 'beliefs' | 'bonds' | 'secrets' | 'personality' | 'history';
  
  // Ordinamento e visibilità
  order: number; // ordine di visualizzazione
  isRequired: boolean; // se la risposta è obbligatoria
  isActive: boolean; // se la domanda è attiva
  
  // Controlli di visibilità delle risposte
  responseVisibility: 'public' | 'master_only' | 'owner_only';
  
  // Limiti di caratteri
  minLength?: number;
  maxLength: number;
  
  // Metadata
  createdBy: Schema.Types.ObjectId; // staff che ha creato la domanda
  createdAt: Date;
  updatedAt: Date;
  version: number; // per tracciare modifiche alle domande
}

const BackgroundQuestionSchema = new Schema<IBackgroundQuestion>({
  questionId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  
  questionText: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  
  placeholder: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  helpText: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  category: {
    type: String,
    required: true,
    enum: ['phobias', 'traumas', 'beliefs', 'bonds', 'secrets', 'personality', 'history']
  },
  
  order: {
    type: Number,
    required: true,
    min: 1
  },
  
  isRequired: {
    type: Boolean,
    default: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  responseVisibility: {
    type: String,
    required: true,
    enum: ['public', 'master_only', 'owner_only'],
    default: 'public'
  },
  
  minLength: {
    type: Number,
    min: 0,
    max: 1000
  },
  
  maxLength: {
    type: Number,
    required: true,
    min: 50,
    max: 2000,
    default: 500
  },
  
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  collection: 'background_questions'
});

// Indexes (questionId already has unique constraint)
BackgroundQuestionSchema.index({ category: 1, order: 1 });
BackgroundQuestionSchema.index({ isActive: 1, order: 1 });

// Metodi del modello
BackgroundQuestionSchema.statics.getActiveQuestions = function() {
  return this.find({ isActive: true }).sort({ order: 1 });
};

BackgroundQuestionSchema.statics.getQuestionsByCategory = function(category: string) {
  return this.find({ 
    category: category, 
    isActive: true 
  }).sort({ order: 1 });
};

// Pre-save middleware per version tracking
BackgroundQuestionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

export const BackgroundQuestion = mongoose.models.BackgroundQuestion || model<IBackgroundQuestion>('BackgroundQuestion', BackgroundQuestionSchema);