import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumTopicPermissionOverride Model
 *
 * Per-character, per-topic overrides for the 4 player-facing granular
 * permissions (view/openThread/reply/attachImages). One document per
 * (topicId, characterId) pair - NOT one per permission, since all 4 are
 * always evaluated together for the same character+topic and the expected
 * volume is low (staff exceptions, not the common case).
 *
 * 'moderare'/'amministrare' are NOT covered here: those stay governed by the
 * existing admin permission system (gameplayRoles/isGestore/adminPermissions),
 * see hasAdminPermission in config/permissions/admin.ts.
 */

export type ForumPermissionDecision = 'allow' | 'deny';

export interface ForumTopicPermissionOverrides {
  view?: ForumPermissionDecision;
  openThread?: ForumPermissionDecision;
  reply?: ForumPermissionDecision;
  attachImages?: ForumPermissionDecision;
}

export interface IForumTopicPermissionOverride extends Document {
  topicId: mongoose.Types.ObjectId;
  characterId: mongoose.Types.ObjectId;
  overrides: ForumTopicPermissionOverrides;
  grantedBy: mongoose.Types.ObjectId;
  grantedByCharacterName: string;
  grantedAt: Date;
  reason?: string;
}

const ForumTopicPermissionOverrideSchema = new Schema<IForumTopicPermissionOverride>({
  topicId: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  overrides: {
    view: { type: String, enum: ['allow', 'deny'] },
    openThread: { type: String, enum: ['allow', 'deny'] },
    reply: { type: String, enum: ['allow', 'deny'] },
    attachImages: { type: String, enum: ['allow', 'deny'] }
  },
  // Set from AdminAuthMiddleware.getAuditInfo(req).adminId, which is the acting
  // admin's User _id (not a Character) - this is an admin-panel audit field,
  // not gameplay data, so it intentionally refs User here.
  grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  grantedByCharacterName: { type: String, required: true },
  grantedAt: { type: Date, default: Date.now },
  reason: { type: String, maxlength: 500 }
}, {
  collection: 'forum_topic_permission_overrides',
  timestamps: false
});

ForumTopicPermissionOverrideSchema.index({ topicId: 1, characterId: 1 }, { unique: true });

export const ForumTopicPermissionOverride = models.ForumTopicPermissionOverride
  || model<IForumTopicPermissionOverride>('ForumTopicPermissionOverride', ForumTopicPermissionOverrideSchema);
