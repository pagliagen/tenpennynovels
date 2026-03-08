import mongoose, { Schema, Document } from 'mongoose';

export interface IActiveEmotion {
  emotion: string;
  intensity: number;
  trigger: string;
  createdAt: Date;
}

export interface IBot extends Document {
  name: string;
  gender?: 'male' | 'female';
  publicDescription?: string;
  personality: {
    traits: string[];
    speech_style: string;
    background: string;
    coreValues?: string[];
  };
  systemPrompt: string;
  activeEmotions: IActiveEmotion[];
  currentMood: { type: string; since: Date };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ActiveEmotionSchema = new Schema<IActiveEmotion>({
  emotion: { type: String, required: true },
  intensity: { type: Number, required: true, min: 0, max: 1 },
  trigger: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const BotSchema = new Schema<IBot>({
  name: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'] },
  publicDescription: { type: String },
  personality: {
    traits: [String],
    speech_style: { type: String, default: '' },
    background: { type: String, default: '' },
    coreValues: [String],
  },
  systemPrompt: { type: String, required: true },
  activeEmotions: { type: [ActiveEmotionSchema], default: [] },
  currentMood: {
    type: { type: String, default: 'neutro' },
    since: { type: Date, default: Date.now },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Bot = mongoose.model<IBot>('Bot', BotSchema);
