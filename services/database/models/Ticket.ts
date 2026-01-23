import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ITicket extends Document {
  _id: ObjectId;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  
  // Creazione
  createdBy: ObjectId; // Character ID
  createdByName: string;
  createdAt: Date;
  
  // Gestione Staff e Reparti
  assignedTo?: ObjectId; // Admin ID (User ID with admin access)
  assignedToName?: string;
  assignedAt?: Date;
  
  // Sistema Reparti
  department: 'master' | 'technical' | 'moderation' | 'administration' | 'general';
  departmentHistory?: Array<{
    fromDepartment: string;
    toDepartment: string;
    transferredBy: ObjectId; // Admin ID
    transferredByName: string;
    transferredAt: Date;
    reason: string;
  }>;
  
  // Storico Riassegnazioni
  reassignmentHistory?: Array<{
    fromStaff: ObjectId; // Admin ID
    fromStaffName: string;
    toStaff: ObjectId; // Admin ID
    toStaffName: string;
    reassignedAt: Date;
    reason?: string;
  }>;
  
  closedAt?: Date;
  closedBy?: ObjectId; // Admin ID
  
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
      
      // Problemi Tecnici
      'game_bug_report',
      'performance_problem', 
      'websocket_problem',
      'general_support',
      
      // Richieste Administrative
      'information_request',
      'user_report',
      'improvement_suggestion'
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
TicketSchema.pre('save', function(next) {
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
      'location_problem': 'medium',
      'private_location_access': 'medium',
      
      // BASSA (5-7 giorni escalation) - tutti gli altri
    };
    
    this.priority = categoryPriorityMap[this.category] || 'low';
  }
  next();
});

// Pre-save middleware to set department based on category
TicketSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('category')) {
    // Mapping categoria → reparto automatico
    const categoryDepartmentMap: Record<string, string> = {
      // Reparto ADMINISTRATION
      'character_sheet_review': 'administration',
      'character_approval': 'administration',
      'character_access_problem': 'administration',
      'character_status_change': 'administration',
      
      // Reparto MASTER
      'private_location_access': 'master',
      'location_event_creation': 'master',
      'new_location_request': 'master',
      'corporation_join_request': 'master',
      'corporation_management_problem': 'master',
      'new_corporation_request': 'master',
      
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
  next();
});

// Static methods for common queries
TicketSchema.statics.findByCharacter = function(characterId: ObjectId, status?: string) {
  const query: any = { createdBy: characterId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

TicketSchema.statics.findByAssignedStaff = function(staffId: ObjectId, status?: string) {
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

export const Ticket = mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema);