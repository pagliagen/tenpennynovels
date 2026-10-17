/**
 * Mapper dei messaggi OFF-GAME: documento REST del backend -> `ChatMessage` del frontend.
 *
 * Il backend restituisce il documento Mongo (con `senderId` popolato come oggetto,
 * `sentAt`, `messageType`), mentre i componenti lavorano con `ChatMessage`
 * (`senderId` stringa, `senderName`, `timestamp`, `actionType`). Senza questa
 * conversione i propri messaggi risultavano "di altri" (`senderId` oggetto !== id) e
 * l'ora "Invalid Date". Modulo senza dipendenze per poterlo verificare da solo.
 *
 * @module lib/api/offGameChatMapper
 */

import type { ChatMessage } from '@/types/offGameChat';

interface PopulatedRef {
  _id: string;
  name?: string;
  avatar?: string;
}

/** Messaggio come lo serializza il backend (GET e POST /game/offgame-chats/:id/messages) */
export interface OffGameMessageDoc {
  _id: string;
  chatId: string;
  senderId: string | PopulatedRef;
  content: string;
  messageType?: string;
  sentAt?: string;
  createdAt?: string;
  replyTo?: string | { _id: string } | null;
  readBy?: unknown[];
}

export function toChatMessage(doc: OffGameMessageDoc): ChatMessage {
  const sender = typeof doc.senderId === 'object' && doc.senderId !== null ? doc.senderId : null;
  const replyTo = typeof doc.replyTo === 'object' && doc.replyTo !== null ? doc.replyTo._id : doc.replyTo;

  return {
    _id: doc._id,
    chatId: doc.chatId,
    senderId: sender ? sender._id : String(doc.senderId),
    senderName: sender?.name,
    senderAvatar: sender?.avatar,
    content: doc.content,
    timestamp: doc.sentAt ?? doc.createdAt ?? '',
    actionType: doc.messageType === 'system' ? 'system' : 'user',
    replyTo: replyTo ?? undefined,
    readBy: (doc.readBy ?? []).map(String),
  };
}
