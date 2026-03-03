import { Schema, model, Document, Model, Types } from 'mongoose';

/**
 * AUDIT LOG MODEL
 *
 * Complete audit logging system for tracking ALL administrative actions
 * Tracks: WHO, WHEN, WHERE, WHY, WHAT, ON WHOM, WITH WHAT RESULT
 *
 * Compliance: GDPR-compliant with TTL index (365 days retention)
 * Performance: 9 indexes for fast queries on common filters
 */

// Actor information (who performed the action)
export interface IAuditLogActor {
  userId: Types.ObjectId;
  username: string;
  characterName?: string;
  userRoles: string[];
  characterRoles: string[];
}

// Target information (what was affected)
export interface IAuditLogTarget {
  type: string;  // 'user', 'character', 'location', 'item', 'skill', 'document', etc.
  id: string;
  name: string;
}

// Main audit log interface
export interface IAuditLog extends Document {
  timestamp: Date;              // Quando
  actor: IAuditLogActor;        // Chi
  action: string;               // Cosa (dot notation: 'user.ban', 'character.approve')
  actionDescription: string;    // Human readable description
  category: string;             // Category: 'user_management', 'character_management', etc.
  target?: IAuditLogTarget;     // Su chi/cosa
  success: boolean;             // Risultato dell'operazione
  errorMessage?: string;        // Messaggio di errore se success=false
  details?: any;                // Dettagli aggiuntivi (old/new values, reason, etc.)
  ipAddress: string;            // Dove (IP address)
  userAgent: string;            // Device/browser info
  severity: 'low' | 'medium' | 'high' | 'critical';  // Severity level
  duration?: number;            // Performance tracking (milliseconds)
}

// Mongoose schema
const AuditLogSchema = new Schema<IAuditLog>(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true  // Index 1: timestamp (for time-based queries)
    },
    actor: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  // Index 2: actor.userId (for per-admin queries)
      },
      username: {
        type: String,
        required: true
      },
      characterName: {
        type: String
      },
      userRoles: {
        type: [String],
        default: []
      },
      characterRoles: {
        type: [String],
        default: []
      }
    },
    action: {
      type: String,
      required: true,
      index: true  // Index 3: action (for filtering by action type)
    },
    actionDescription: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      index: true  // Index 4: category (for filtering by category)
    },
    target: {
      type: {
        type: String,
        required: false
      },
      id: {
        type: String,
        required: false,
        index: true  // Index 5: target.id (for filtering by target)
      },
      name: {
        type: String,
        required: false
      }
    },
    success: {
      type: Boolean,
      required: true,
      default: true,
      index: true  // Index 6: success (for filtering successes/failures)
    },
    errorMessage: {
      type: String
    },
    details: {
      type: Schema.Types.Mixed  // Flexible storage for additional context
    },
    ipAddress: {
      type: String,
      required: true,
      index: true  // Index 7: ipAddress (for security audits)
    },
    userAgent: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true  // Index 8: severity (for filtering by severity)
    },
    duration: {
      type: Number  // Milliseconds
    }
  },
  {
    timestamps: false,  // Using custom timestamp field
    collection: 'audit_logs'
  }
);

// Index 9: TTL index for GDPR compliance (365 days retention)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Compound indexes for common query patterns
AuditLogSchema.index({ category: 1, timestamp: -1 });  // Category + time
AuditLogSchema.index({ 'actor.userId': 1, timestamp: -1 });  // Admin + time
AuditLogSchema.index({ severity: 1, timestamp: -1 });  // Severity + time
AuditLogSchema.index({ success: 1, timestamp: -1 });  // Success/failure + time

// Instance methods
AuditLogSchema.methods = {
  /**
   * Get formatted log entry for display
   */
  toDisplay(): any {
    return {
      id: this._id.toString(),
      timestamp: this.timestamp,
      actor: {
        userId: this.actor.userId.toString(),
        username: this.actor.username,
        characterName: this.actor.characterName,
        userRoles: this.actor.userRoles,
        characterRoles: this.actor.characterRoles
      },
      action: this.action,
      actionDescription: this.actionDescription,
      category: this.category,
      target: this.target ? {
        type: this.target.type,
        id: this.target.id,
        name: this.target.name
      } : undefined,
      success: this.success,
      errorMessage: this.errorMessage,
      details: this.details,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      severity: this.severity,
      duration: this.duration
    };
  }
};

// Static methods
AuditLogSchema.statics = {
  /**
   * Create audit log entry with automatic severity calculation
   */
  async logAction(data: {
    actor: IAuditLogActor;
    action: string;
    actionDescription: string;
    category: string;
    target?: IAuditLogTarget;
    success: boolean;
    errorMessage?: string;
    details?: any;
    ipAddress: string;
    userAgent: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    duration?: number;
  }): Promise<IAuditLog> {
    // Auto-calculate severity if not provided
    const severity = data.severity || calculateSeverity(data.action);

    return await this.create({
      timestamp: new Date(),
      actor: data.actor,
      action: data.action,
      actionDescription: data.actionDescription,
      category: data.category,
      target: data.target,
      success: data.success,
      errorMessage: data.errorMessage,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      severity,
      duration: data.duration
    });
  },

  /**
   * Query audit logs with filters
   */
  async queryLogs(filters: {
    category?: string;
    adminUserId?: string;
    severity?: string;
    success?: boolean;
    action?: string;
    targetId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: IAuditLog[]; totalCount: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (filters.category) query.category = filters.category;
    if (filters.adminUserId) query['actor.userId'] = filters.adminUserId;
    if (filters.severity) query.severity = filters.severity;
    if (filters.success !== undefined) query.success = filters.success;
    if (filters.action) query.action = { $regex: filters.action, $options: 'i' };
    if (filters.targetId) query['target.id'] = filters.targetId;

    if (filters.dateFrom || filters.dateTo) {
      query.timestamp = {};
      if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
      if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
    }

    // Execute query with pagination
    const [logs, totalCount] = await Promise.all([
      this.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.countDocuments(query)
    ]);

    return {
      logs: logs as IAuditLog[],
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    };
  }
};

// Helper function: Calculate severity based on action
function calculateSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
  // CRITICAL: Destructive actions, permanent changes
  const criticalActions = [
    'user.delete',
    'character.delete',
    'location.delete',
    'document.delete',
    'skill.delete',
    'item.delete',
    'system.config.update'
  ];

  // HIGH: Security-sensitive, impactful operations
  const highActions = [
    'user.ban',
    'user.unban',
    'user.role.grant',
    'user.role.revoke',
    'user.change_permissions',
    'user.bulk_ban',
    'user.bulk_unban',
    'character.approve',
    'character.reject',
    'character.role.grant',
    'character.role.revoke',
    'character.permission.grant',
    'character.permission.revoke',
    'character.bulk_approve',
    'character.bulk_reject',
    'system.maintenance_mode',
    'system.broadcast'
  ];

  // MEDIUM: Moderate impact operations
  const mediumActions = [
    'user.deactivate',
    'user.update',
    'character.update',
    'location.update',
    'document.update',
    'skill.update',
    'item.update'
  ];

  // Check exact match first
  if (criticalActions.includes(action)) return 'critical';
  if (highActions.includes(action)) return 'high';
  if (mediumActions.includes(action)) return 'medium';

  // Fallback: LOW for all other actions
  return 'low';
}

// Export model
export const AuditLog: Model<IAuditLog> = model<IAuditLog>('AuditLog', AuditLogSchema);
