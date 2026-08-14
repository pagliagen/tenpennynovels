import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';

  // Creazione
  createdBy: Schema.Types.ObjectId; // Character ID
  createdByName: string;
  createdAt: Date;

  // Gestione Staff e Reparti
  assignedTo?: Schema.Types.ObjectId; // Admin ID (User ID with admin access)
  assignedToName?: string;
  assignedAt?: Date;

  // Sistema Reparti
  department: 'master' | 'technical' | 'moderation' | 'administration' | 'general';
  departmentHistory?: Array<{
    fromDepartment: string;
    toDepartment: string;
    transferredBy: Schema.Types.ObjectId; // Admin ID
    transferredByName: string;
    transferredAt: Date;
    reason: string;
  }>;

  // Storico Riassegnazioni
  reassignmentHistory?: Array<{
    fromStaff: Schema.Types.ObjectId; // Admin ID
    fromStaffName: string;
    toStaff: Schema.Types.ObjectId; // Admin ID
    toStaffName: string;
    reassignedAt: Date;
    reason?: string;
  }>;

  closedAt?: Date;
  closedBy?: Schema.Types.ObjectId; // Admin ID
  closedByName?: string;

  // Tracking lettura
  lastReadBy: {
    character?: Date;
    staff?: Date;
  };

  // Escalation System
  escalatedAt?: Date;
  escalationLevel?: number; // 0 = normale, 1 = prima escalation, 2 = seconda escalation
  escalationHistory?: Array<{
    fromLevel: number;
    toLevel: number;
    escalatedAt: Date;
    reason: string;
  }>;

  // Metadata
  tags?: string[];
  internalNotes?: string;

  // Category-specific metadata
  categoryMetadata?: {
    targetCharacterId?: Schema.Types.ObjectId; // For character_approval, character_edit, character_sheet_review
    targetLocationId?: Schema.Types.ObjectId;   // For location-related requests
  };

  // Activity tracking (for escalation queries)
  lastActivityAt: Date; // Updated ogni volta che arriva messaggio o cambio status

  // System fields
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>({
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Gestione Personaggi
      'character_sheet_review',
      'character_approval',
      'character_edit', // Modifica personaggio post-approvazione
      'character_access_problem',
      'character_status_change',

      // Mondo di Gioco e Location
      'private_location_access',
      'location_problem',
      'location_event_creation',
      'new_location_request',

      // Sistemi di Comunicazione
      'location_chat_problem',
      'offgame_chat_problem',
      'postal_system_problem',
      'group_chat_request',

      // Corporazioni e Organizzazioni
      'corporation_join_request',
      'corporation_management_problem',
      'new_corporation_request',

      // Trame e Quest
      'quest_proposal', // Proposta trama/quest personalizzata

      // Problemi Tecnici
      'game_bug_report',
      'performance_problem',
      'websocket_problem',
      'general_support',

      // Richieste Administrative
      'information_request',
      'user_report',
      'improvement_suggestion',

      // Moderazione / sanzioni (giocatore apre manualmente se desidera)
      'sanction_appeal'
    ]
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  status: {
    type: String,
    required: true,
    enum: ['open', 'assigned', 'in_progress', 'waiting_user', 'closed', 'reopened'],
    default: 'open',
    index: true
  },

  // Creazione
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  createdByName: {
    type: String,
    required: true,
    maxlength: 100
  },

  // Gestione Staff e Reparti
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Admin user
    index: true
  },
  assignedToName: {
    type: String,
    maxlength: 100
  },
  assignedAt: {
    type: Date
  },

  // Sistema Reparti
  department: {
    type: String,
    required: true,
    enum: ['master', 'technical', 'moderation', 'administration', 'general'],
    default: 'general',
    index: true
  },
  departmentHistory: [{
    fromDepartment: {
      type: String,
      enum: ['master', 'technical', 'moderation', 'administration', 'general'],
      required: true
    },
    toDepartment: {
      type: String,
      enum: ['master', 'technical', 'moderation', 'administration', 'general'],
      required: true
    },
    transferredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    transferredByName: {
      type: String,
      required: true,
      maxlength: 100
    },
    transferredAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    }
  }],

  // Storico Riassegnazioni
  reassignmentHistory: [{
    fromStaff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fromStaffName: {
      type: String,
      required: true,
      maxlength: 100
    },
    toStaff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    toStaffName: {
      type: String,
      required: true,
      maxlength: 100
    },
    reassignedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    reason: {
      type: String,
      maxlength: 500
    }
  }],

  closedAt: {
    type: Date
  },
  closedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  closedByName: {
    type: String,
    maxlength: 100
  },

  // Tracking lettura
  lastReadBy: {
    character: {
      type: Date
    },
    staff: {
      type: Date
    }
  },

  // Escalation System
  escalatedAt: {
    type: Date
  },
  escalationLevel: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  escalationHistory: [{
    fromLevel: {
      type: Number,
      required: true
    },
    toLevel: {
      type: Number,
      required: true
    },
    escalatedAt: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    }
  }],

  // Metadata
  tags: [{
    type: String,
    maxlength: 50,
    trim: true
  }],
  internalNotes: {
    type: String,
    maxlength: 5000
  },

  // Category-specific metadata
  categoryMetadata: {
    targetCharacterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character'
    },
    targetLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location'
    }
  },

  // Activity tracking
  lastActivityAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true // Index per escalation queries
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt
});

// Indexes for efficient queries
TicketSchema.index({ createdBy: 1, status: 1 }); // For user's tickets
TicketSchema.index({ assignedTo: 1, status: 1 }); // For staff's assigned tickets
TicketSchema.index({ department: 1, status: 1 }); // For department tickets
TicketSchema.index({ category: 1, createdAt: -1 }); // For category filtering
TicketSchema.index({ status: 1, priority: -1, createdAt: -1 }); // For priority sorting
TicketSchema.index({ escalatedAt: 1 }, {
  partialFilterExpression: { escalatedAt: { $exists: true } }
}); // For escalated tickets only
TicketSchema.index({ createdAt: -1 }); // For chronological ordering
TicketSchema.index({ lastActivityAt: 1, status: 1 }); // For escalation queries (find stale tickets)

// Compound index for staff dashboard queries
TicketSchema.index({
  department: 1,
  assignedTo: 1,
  status: 1,
  priority: -1,
  createdAt: -1
});

// Text index for search functionality
TicketSchema.index({
  title: 'text',
  internalNotes: 'text'
}, {
  weights: {
    title: 10,
    internalNotes: 1
  },
  name: 'ticket_text_search'
});

// Pre-save middleware to set automatic priority based on category
TicketSchema.pre('save', async function() {
  if (this.isNew || this.isModified('category')) {
    // Mapping categoria → priorità automatica
    const categoryPriorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      // CRITICA (6h escalation)
      'game_bug_report': 'critical',
      'performance_problem': 'critical',
      'websocket_problem': 'critical',

      // ALTA (24h escalation)
      'character_access_problem': 'high',
      'location_chat_problem': 'high',
      'offgame_chat_problem': 'high',
      'postal_system_problem': 'high',
      'user_report': 'high',

      // MEDIA (48h escalation)
      'character_approval': 'medium',
      'character_sheet_review': 'medium',
      'character_edit': 'medium',
      'location_problem': 'medium',
      'private_location_access': 'medium',

      // BASSA (5-7 giorni escalation)
      'quest_proposal': 'low',

      // Tutti gli altri: low
    };

    this.priority = categoryPriorityMap[this.category] || 'low';
  }
});

// Pre-save middleware to set department based on category
TicketSchema.pre('save', async function() {
  if (this.isNew || this.isModified('category')) {
    // Mapping categoria → reparto automatico
    const categoryDepartmentMap: Record<string, string> = {
      // Reparto ADMINISTRATION
      'character_sheet_review': 'administration',
      'character_approval': 'administration',
      'character_edit': 'administration',
      'character_access_problem': 'administration',
      'character_status_change': 'administration',

      // Reparto MASTER
      'private_location_access': 'master',
      'location_event_creation': 'master',
      'new_location_request': 'master',
      'corporation_join_request': 'master',
      'corporation_management_problem': 'master',
      'new_corporation_request': 'master',
      'quest_proposal': 'master',

      // Reparto TECHNICAL
      'location_problem': 'technical',
      'location_chat_problem': 'technical',
      'offgame_chat_problem': 'technical',
      'postal_system_problem': 'technical',
      'game_bug_report': 'technical',
      'performance_problem': 'technical',
      'websocket_problem': 'technical',

      // Reparto MODERATION
      'user_report': 'moderation',

      // Reparto GENERAL (catch-all)
      'group_chat_request': 'general',
      'general_support': 'general',
      'information_request': 'general',
      'improvement_suggestion': 'general'
    };

    this.department = (categoryDepartmentMap[this.category] || 'general') as 'master' | 'technical' | 'moderation' | 'administration' | 'general';
  }
});

// Static methods for common queries
TicketSchema.statics.findByCharacter = function(characterId: Schema.Types.ObjectId, status?: string) {
  const query: any = { createdBy: characterId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

TicketSchema.statics.findByAssignedStaff = function(staffId: Schema.Types.ObjectId, status?: string) {
  const query: any = { assignedTo: staffId };
  if (status) query.status = status;
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

TicketSchema.statics.findByDepartment = function(department: string, status?: string) {
  const query: any = { department };
  if (status) query.status = status;
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

TicketSchema.statics.findUnassigned = function(department?: string) {
  const query: any = {
    assignedTo: null,
    status: { $in: ['open', 'reopened'] }
  };
  if (department) query.department = department;
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

TicketSchema.statics.findEscalated = function() {
  return this.find({
    escalatedAt: { $exists: true },
    status: { $ne: 'closed' }
  }).sort({ escalationLevel: -1, escalatedAt: 1 });
};

// Instance methods
/**
 * Escalate ticket to next level
 * @param reason Reason for escalation
 */
TicketSchema.methods.escalate = async function(reason: string): Promise<void> {
  const oldLevel = this.escalationLevel || 0;
  this.escalationLevel = Math.min(oldLevel + 1, 10);  // Max level 10
  this.escalatedAt = new Date();

  if (!this.escalationHistory) {
    this.escalationHistory = [];
  }

  this.escalationHistory.push({
    fromLevel: oldLevel,
    toLevel: this.escalationLevel,
    escalatedAt: new Date(),
    reason
  });

  await this.save();
};

/**
 * Assign ticket to staff member
 * @param staffId Staff user ID
 * @param staffName Staff username
 */
TicketSchema.methods.assignTo = async function(staffId: Schema.Types.ObjectId, staffName: string): Promise<void> {
  const oldAssignedTo = this.assignedTo;
  const oldAssignedToName = this.assignedToName;

  this.assignedTo = staffId;
  this.assignedToName = staffName;
  this.assignedAt = new Date();
  this.status = 'assigned';

  // Add to reassignment history if this is a reassignment
  if (oldAssignedTo) {
    if (!this.reassignmentHistory) {
      this.reassignmentHistory = [];
    }

    this.reassignmentHistory.push({
      fromStaff: oldAssignedTo,
      fromStaffName: oldAssignedToName,
      toStaff: staffId,
      toStaffName: staffName,
      reassignedAt: new Date(),
      reason: 'Reassigned to another staff member'
    });
  }

  await this.save();
};

/**
 * Release ticket (back to unassigned queue)
 */
TicketSchema.methods.release = async function(): Promise<void> {
  this.assignedTo = undefined;
  this.assignedToName = undefined;
  this.status = 'open';
  await this.save();
};

export const Ticket = mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema);
