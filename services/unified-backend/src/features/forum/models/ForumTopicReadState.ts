import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumTopicReadState Model
 *
 * Tracks, per character per topic, the last time the character visited that
 * bacheca - compared against ForumTopic.lastPostAt to compute the "unread"
 * badge (thread/bacheca has new content) requested by the spec. Deliberately
 * topic-level, not per-discussion: a per-discussion read-state collection
 * would explode in cardinality (character × discussion) for a feature that's
 * fundamentally about "does this bacheca have anything new for me".
 */

export interface IForumTopicReadState extends Document {
  characterId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  lastVisitedAt: Date;
}

const ForumTopicReadStateSchema = new Schema<IForumTopicReadState>({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  topicId: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
  lastVisitedAt: { type: Date, default: Date.now }
}, {
  collection: 'forum_topic_read_states',
  timestamps: false
});

ForumTopicReadStateSchema.index({ characterId: 1, topicId: 1 }, { unique: true });

export const ForumTopicReadState = models.ForumTopicReadState
  || model<IForumTopicReadState>('ForumTopicReadState', ForumTopicReadStateSchema);
