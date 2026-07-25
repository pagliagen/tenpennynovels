import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumCharacterPreference Model
 *
 * Minimal per-character forum preferences. One document per character.
 * Currently only the reply display order ("L'utente può invertire l'ordine
 * di visualizzazione mantenendo la preferenza salvata"); intentionally kept
 * as a small dedicated collection rather than a field bolted onto Character,
 * since it's a forum-module-specific concern.
 */

export type ForumReplyOrder = 'asc' | 'desc';

export interface IForumCharacterPreference extends Document {
  characterId: mongoose.Types.ObjectId;
  replyOrder: ForumReplyOrder;
  updatedAt: Date;
}

const ForumCharacterPreferenceSchema = new Schema<IForumCharacterPreference>({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true, unique: true },
  replyOrder: { type: String, enum: ['asc', 'desc'], default: 'asc' },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'forum_character_preferences',
  timestamps: false
});

export const ForumCharacterPreference = models.ForumCharacterPreference
  || model<IForumCharacterPreference>('ForumCharacterPreference', ForumCharacterPreferenceSchema);
