import mongoose from 'mongoose';

import { ChatSchema, IChat, IChatModel } from './Chat';

/**
 * Live/backup chat table — see the architecture comment above the mirror
 * hooks in Chat.ts. This is a clone of ChatSchema (same fields, same
 * statics/indexes) plus a TTL index on `timestamp`: MongoDB physically
 * removes each document 3 hours after it was originally posted, regardless
 * of edits (edits update the mirrored row in place but don't touch
 * `timestamp`, so they don't reset the TTL clock).
 *
 * This is the ONLY collection the in-game chat UI reads from
 * (ChatMessageService.getMessages, LocationController via
 * ChatBackup.getLocationHistory). `Chat` (the "chats" collection) is the
 * permanent archive used for master/gestionale log access.
 */
const ChatBackupSchema = ChatSchema.clone();
ChatBackupSchema.set('collection', 'chatbackups');
ChatBackupSchema.index({ timestamp: 1 }, { expireAfterSeconds: 3 * 60 * 60 });

export const ChatBackup = (mongoose.models.ChatBackup ||
  mongoose.model<IChat, IChatModel>('ChatBackup', ChatBackupSchema)) as IChatModel;

export default ChatBackup;
