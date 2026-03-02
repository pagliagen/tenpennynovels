import mongoose, { Document, Schema } from 'mongoose';

/**
 * TicketNotification Model
 * Notifiche in-app per ticket system (character & staff)
 * Features:
 * - TTL index (auto-delete dopo 90 giorni)
 * - Support broadcast a ruoli (es: tutti i master, tutti gli admin)
 * - Tracking isRead + readAt
 * - Denormalized ticket info per quick display
 */

export type TicketNotificationType =
  | 'ticket:new'                // Staff: nuovo ticket creato
  | 'ticket:replied'            // Character/Staff: risposta su ticket
  | 'ticket:assigned'           // Character/Staff: ticket assegnato
  | 'ticket:escalated'          // Character: ticket escalato
  | 'ticket:escalated_high'     // Staff (admins): ticket escalation >= 5
  | 'ticket:closed'             // Character: ticket chiuso
  | 'ticket:reopened'           // Character/Staff: ticket riaperto
  | 'ticket:bulk_assigned';     // Staff: bulk assignment

export interface ITicketNotification extends Document {
  recipientType: 'character' | 'staff' | 'role';
  recipientId?: mongoose.Types.ObjectId;        // Character o Staff (userId)
  recipientRole?: string;                       // Per broadcast: 'master', 'moderatore', 'amministratore'
  type: TicketNotificationType;
  title: string;
  message: string;
  ticketId: mongoose.Types.ObjectId;
  ticketNumber?: string;                        // Denormalized per quick display
  ticketPriority?: string;                      // Denormalized
  ticketCategory?: string;                      // Denormalized
  triggeredBy?: {
    type: 'character' | 'staff' | 'system';
    id?: mongoose.Types.ObjectId;
    name?: string;
  };
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  actionUrl: string;                            // Deep link: '/admin/tickets/:id' or '/game/tickets/:id'
}

const TicketNotificationSchema = new Schema<ITicketNotification>({
  recipientType: {
    type: String,
    enum: ['character', 'staff', 'role'],
    required: [true, 'Recipient type is required']
  },
  recipientId: {
    type: Schema.Types.ObjectId,
    required: function(this: ITicketNotification) {
      return this.recipientType !== 'role';     // Required solo se non è broadcast a role
    }
  },
  recipientRole: {
    type: String,
    enum: ['master', 'moderatore', 'amministratore', 'gestore'],
    required: function(this: ITicketNotification) {
      return this.recipientType === 'role';     // Required solo se broadcast a role
    }
  },
  type: {
    type: String,
    enum: [
      'ticket:new',
      'ticket:replied',
      'ticket:assigned',
      'ticket:escalated',
      'ticket:escalated_high',
      'ticket:closed',
      'ticket:reopened',
      'ticket:bulk_assigned'
    ],
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  ticketId: {
    type: Schema.Types.ObjectId,
    ref: 'Ticket',
    required: [true, 'Ticket ID is required']
  },
  ticketNumber: {
    type: String,
    trim: true
  },
  ticketPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical']
  },
  ticketCategory: {
    type: String
  },
  triggeredBy: {
    type: {
      type: String,
      enum: ['character', 'staff', 'system']
    },
    id: Schema.Types.ObjectId,
    name: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  actionUrl: {
    type: String,
    required: [true, 'Action URL is required']
  }
}, {
  collection: 'ticket_notifications',
  timestamps: false  // Using manual createdAt
});

// ============ INDEXES ============

// TTL Index: auto-delete notifications after 90 days
TicketNotificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000,  // 90 days = 90 * 24 * 60 * 60
    name: 'ttl_90_days'
  }
);

// Query index: get notifications per recipient (character o staff)
// Sort by isRead (unread first) then createdAt (newest first)
TicketNotificationSchema.index({
  recipientId: 1,
  recipientType: 1,
  isRead: 1,
  createdAt: -1
}, {
  name: 'recipient_read_created'
});

// Query index: get notifications per role (broadcast)
TicketNotificationSchema.index({
  recipientRole: 1,
  isRead: 1,
  createdAt: -1
}, {
  name: 'role_read_created'
});

// Query index: get notifications per ticket (audit trail)
TicketNotificationSchema.index({
  ticketId: 1,
  createdAt: -1
}, {
  name: 'ticket_notifications'
});

// ============ STATIC METHODS ============

/**
 * Get unread count per recipient
 * @param recipientType 'character' | 'staff' | 'role'
 * @param recipientId ObjectId (opzionale per role broadcast)
 * @param recipientRole string (opzionale per character/staff)
 */
TicketNotificationSchema.statics.getUnreadCount = async function(
  recipientType: string,
  recipientId?: mongoose.Types.ObjectId,
  recipientRole?: string
): Promise<number> {
  const filter: any = { recipientType, isRead: false };

  if (recipientType === 'role') {
    if (!recipientRole) throw new Error('recipientRole required for role type');
    filter.recipientRole = recipientRole;
  } else {
    if (!recipientId) throw new Error('recipientId required for character/staff type');
    filter.recipientId = recipientId;
  }

  return await this.countDocuments(filter);
};

/**
 * Mark all notifications as read per recipient
 * @param recipientType 'character' | 'staff' | 'role'
 * @param recipientId ObjectId (opzionale per role)
 * @param recipientRole string (opzionale per character/staff)
 * @returns Number of notifications marked as read
 */
TicketNotificationSchema.statics.markAllAsRead = async function(
  recipientType: string,
  recipientId?: mongoose.Types.ObjectId,
  recipientRole?: string
): Promise<number> {
  const filter: any = { recipientType, isRead: false };

  if (recipientType === 'role') {
    if (!recipientRole) throw new Error('recipientRole required for role type');
    filter.recipientRole = recipientRole;
  } else {
    if (!recipientId) throw new Error('recipientId required for character/staff type');
    filter.recipientId = recipientId;
  }

  const result = await this.updateMany(
    filter,
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );

  return result.modifiedCount;
};

/**
 * Get recent notifications per recipient (con paginazione)
 * @param recipientType 'character' | 'staff' | 'role'
 * @param recipientId ObjectId (opzionale per role)
 * @param options { unreadOnly, limit, offset, recipientRole }
 */
TicketNotificationSchema.statics.getRecentForRecipient = async function(
  recipientType: string,
  recipientId?: mongoose.Types.ObjectId,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    recipientRole?: string;
  } = {}
): Promise<ITicketNotification[]> {
  const filter: any = { recipientType };

  if (recipientType === 'role') {
    if (!options.recipientRole) throw new Error('recipientRole required in options for role type');
    filter.recipientRole = options.recipientRole;
  } else {
    if (!recipientId) throw new Error('recipientId required for character/staff type');
    filter.recipientId = recipientId;
  }

  if (options.unreadOnly) {
    filter.isRead = false;
  }

  const limit = options.limit || 20;
  const offset = options.offset || 0;

  return await this.find(filter)
    .sort({ isRead: 1, createdAt: -1 })  // Unread first, then newest
    .skip(offset)
    .limit(limit)
    .lean();
};

/**
 * Get total count per recipient (per pagination)
 */
TicketNotificationSchema.statics.getTotalCount = async function(
  recipientType: string,
  recipientId?: mongoose.Types.ObjectId,
  options: {
    unreadOnly?: boolean;
    recipientRole?: string;
  } = {}
): Promise<number> {
  const filter: any = { recipientType };

  if (recipientType === 'role') {
    if (!options.recipientRole) throw new Error('recipientRole required in options for role type');
    filter.recipientRole = options.recipientRole;
  } else {
    if (!recipientId) throw new Error('recipientId required for character/staff type');
    filter.recipientId = recipientId;
  }

  if (options.unreadOnly) {
    filter.isRead = false;
  }

  return await this.countDocuments(filter);
};

// ============ INSTANCE METHODS ============

/**
 * Mark single notification as read
 */
TicketNotificationSchema.methods.markAsRead = async function(): Promise<void> {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

// ============ EXPORT ============

export const TicketNotification = mongoose.model<ITicketNotification>('TicketNotification', TicketNotificationSchema);
