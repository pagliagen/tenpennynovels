/**
 * OnGame Mail System Types
 *
 * TypeScript interfaces for the Victorian postal system.
 *
 * @module types/mail
 * @since 2.0.0
 */

/**
 * Message Type Keys
 *
 * Union of all available message type identifiers.
 *
 * @since 2.0.0
 */
export type MessageTypeKey =
  | 'note'
  | 'telegram'
  | 'letter'
  | 'express_letter'
  | 'postcard'
  | 'invitation'
  | 'official_document'
  | 'diary';

/**
 * Message Type Configuration
 *
 * Configuration for a single message type (from backend).
 *
 * @interface MessageTypeConfig
 * @since 2.0.0
 */
export interface MessageTypeConfig {
  /** Display name shown to user */
  displayName: string;

  /** Description/tooltip text */
  description: string;

  /** Delivery mode (realtime, scheduled_fixed, daily_batch, etc.) */
  deliveryMode: string;

  /** Delivery method constraint */
  deliveryMethod: 'to_person' | 'to_residence' | 'both_options' | 'self_only';

  /** Whether recipient's residence must be known */
  requiresResidenceKnowledge: boolean;

  /** Base postage cost in pence */
  postageRequired: number;

  /** Express delivery cost multiplier (optional) */
  expressCostMultiplier?: number;

  /** Maximum content length */
  maxLength: number;

  /** Whether message is sealed (content hidden until read) */
  requiresSealing: boolean;

  /** Whether recipient can reply */
  allowsReply: boolean;

  /** Whether multiple recipients allowed */
  allowMultipleRecipients: boolean;

  /** Maximum number of recipients */
  maxRecipients: number;

  /** Icon identifier (emoji or image path) */
  icon: string;

  /** Preview visibility in inbox */
  visibilityInPreview: 'none' | 'subject_only' | 'first_line';
}

/**
 * OnGame Thread (Conversation)
 *
 * Single conversation thread in the inbox list.
 *
 * @interface OnGameThread
 * @since 2.0.0
 */
export interface OnGameThread {
  /** Partner character ID */
  partnerId: string;

  /** Partner character name */
  partnerName: string;

  /** Partner avatar URL */
  partnerAvatar?: string;

  /** Last message in thread */
  lastMessage: {
    /** Message ID */
    _id: string;

    /** Message type key */
    messageType: string;

    /** Message subject */
    subject: string;

    /** Message content (may be sealed placeholder) */
    content: string;

    /** Sent timestamp (ISO string) */
    sentAt: string;

    /** Whether current character sent this message */
    isSentByMe: boolean;

    /** Message type icon */
    icon: string;
  };

  /** Unread message count for this thread */
  unreadCount: number;
}

/**
 * OnGame Thread Message
 *
 * Single message within a conversation thread.
 *
 * @interface OnGameThreadMessage
 * @since 2.0.0
 */
export interface OnGameThreadMessage {
  /** Message ID */
  _id: string;

  /** Message type key */
  messageType: string;

  /** Message subject */
  subject: string;

  /** Message content (may be sealed placeholder) */
  content: string;

  /** Sent timestamp (ISO string) */
  sentAt: string;

  /** Delivered timestamp (ISO string, optional if not yet delivered) */
  deliveredAt?: string;

  /** Scheduled delivery timestamp (ISO string, optional) */
  scheduledDelivery?: string;

  /** Whether current character sent this message */
  isSentByMe: boolean;

  /** Message type icon */
  icon: string;

  /** Postage charged (in pence) */
  postageCharged: number;
}

/**
 * OnGame Partner
 *
 * Partner character info in thread view.
 *
 * @interface OnGamePartner
 * @since 2.0.0
 */
export interface OnGamePartner {
  /** Character ID */
  _id: string;

  /** Character name */
  name: string;

  /** Character avatar URL */
  avatar?: string;
}

/**
 * Public Character (for recipient selector)
 *
 * Minimal character info from public list.
 *
 * @interface PublicCharacter
 * @since 2.0.0
 */
export interface PublicCharacter {
  /** Character ID */
  _id: string;

  /** Character name */
  name: string;

  /** Character avatar URL */
  avatar?: string;
}

/**
 * Wallet Info
 *
 * Character's wallet balance for postage affordability check.
 *
 * @interface WalletInfo
 * @since 2.0.0
 */
export interface WalletInfo {
  /** Cash amount (pence) */
  cash: number;

  /** Deposit amount (pence) */
  deposit: number;

  /** Total available (pence) */
  total: number;
}

/**
 * Send Message Payload
 *
 * Payload for POST /game/ongame-messages
 *
 * @interface SendMessagePayload
 * @since 2.0.0
 */
export interface SendMessagePayload {
  /** Message type key */
  messageType: string;

  /** Recipient character IDs */
  to: string[];

  /** Message subject */
  subject: string;

  /** Message content */
  content: string;

  /** Delivery target */
  deliveryTarget: {
    type: 'character' | 'residence';
  };

  /** Whether express delivery requested */
  isExpress: boolean;
}
