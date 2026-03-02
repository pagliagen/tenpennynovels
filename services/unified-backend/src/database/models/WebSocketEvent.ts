import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WebSocket Event Model - SPRINT 4
 *
 * Stores WebSocket events for replay functionality after reconnection.
 * Events are automatically deleted after TTL expiration (default 24h).
 */

export interface IWebSocketEvent extends Document {
  eventId: number;
  eventType: string;
  payload: any;
  characterId?: string;
  locationId?: string;
  chatId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IWebSocketEventModel extends Model<IWebSocketEvent> {
  /**
   * Save a new WebSocket event with auto-incrementing eventId
   */
  saveEvent(
    eventType: string,
    payload: any,
    options: {
      characterId?: string;
      locationId?: string;
      chatId?: string;
      ttlHours?: number;
    }
  ): Promise<IWebSocketEvent>;

  /**
   * Get all events since a specific eventId for a character
   */
  getEventsSince(
    lastEventId: number,
    characterId: string,
    limit: number
  ): Promise<IWebSocketEvent[]>;
}

const WebSocketEventSchema = new Schema<IWebSocketEvent, IWebSocketEventModel>(
  {
    eventId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true
    },
    characterId: {
      type: String,
      index: true
    },
    locationId: {
      type: String,
      index: true
    },
    chatId: {
      type: String,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
      // Note: TTL index defined separately below with expireAfterSeconds
    }
  },
  {
    collection: 'websocket_events'
  }
);

// TTL index for automatic deletion after expiration
WebSocketEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient getEventsSince queries
WebSocketEventSchema.index({ characterId: 1, eventId: 1 });

/**
 * Save a new WebSocket event with auto-incrementing eventId
 */
WebSocketEventSchema.statics.saveEvent = async function(
  eventType: string,
  payload: any,
  options: {
    characterId?: string;
    locationId?: string;
    chatId?: string;
    ttlHours?: number;
  } = {}
): Promise<IWebSocketEvent> {
  // Get next eventId (auto-increment pattern)
  const lastEvent = await this.findOne().sort({ eventId: -1 }).select('eventId').exec();
  const nextEventId = lastEvent ? lastEvent.eventId + 1 : 1;

  // Calculate expiration time
  const ttlHours = options.ttlHours || 24;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  // Create and save event
  const event = new this({
    eventId: nextEventId,
    eventType,
    payload,
    characterId: options.characterId,
    locationId: options.locationId,
    chatId: options.chatId,
    expiresAt
  });

  await event.save();
  return event;
};

/**
 * Get all events since a specific eventId for a character
 *
 * Used for event replay after reconnection.
 * Returns events in chronological order (oldest first).
 */
WebSocketEventSchema.statics.getEventsSince = async function(
  lastEventId: number,
  characterId: string,
  limit: number = 100
): Promise<IWebSocketEvent[]> {
  const events = await this.find({
    eventId: { $gt: lastEventId },
    $or: [
      { characterId }, // Character-specific events
      { characterId: { $exists: false } } // Global events
    ]
  })
    .sort({ eventId: 1 }) // Chronological order
    .limit(limit)
    .select('eventId eventType payload createdAt')
    .exec();

  return events;
};

export const WebSocketEvent = mongoose.models.WebSocketEvent ||
  mongoose.model<IWebSocketEvent, IWebSocketEventModel>('WebSocketEvent', WebSocketEventSchema);
