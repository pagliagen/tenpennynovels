import mongoose, { Schema, model, Document } from 'mongoose';

export interface ICharacterSession extends Document {
  // Character and user info
  characterId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  
  // Session info
  sessionId: string; // Unique session identifier
  tokenHash: string; // Hash of the character_context JWT token
  
  // Device info
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceName?: string;
    browser?: string;
    os?: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
  };
  
  // Session lifecycle
  isActive: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  
  // Invalidation info
  invalidatedAt?: Date;
  invalidatedBy?: 'user_logout' | 'new_device_login' | 'expired' | 'manual';
  invalidatedFromIp?: string;
}

const CharacterSessionSchema = new Schema<ICharacterSession>({
  // Character and user info
  characterId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Character'
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  
  // Session info
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  
  // Device info
  deviceInfo: {
    userAgent: { type: String, required: true },
    ipAddress: { type: String, required: true },
    deviceName: String,
    browser: String,
    os: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      required: true
    }
  },
  
  // Session lifecycle
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  
  // Invalidation info
  invalidatedAt: Date,
  invalidatedBy: {
    type: String,
    enum: ['user_logout', 'new_device_login', 'expired', 'manual']
  },
  invalidatedFromIp: String
}, {
  timestamps: true,
  collection: 'character_sessions'
});

// Compound indexes
CharacterSessionSchema.index({ userId: 1, isActive: 1 });
CharacterSessionSchema.index({ tokenHash: 1, isActive: 1 });
CharacterSessionSchema.index({ expiresAt: 1 }); // For cleanup
CharacterSessionSchema.index({ lastActiveAt: 1 }); // For activity tracking

// Ensure only one active session per character (also covers characterId + isActive)
CharacterSessionSchema.index(
  { characterId: 1, isActive: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { isActive: true } 
  }
);

// Methods
CharacterSessionSchema.methods.invalidate = function(reason: string, fromIp?: string) {
  this.isActive = false;
  this.invalidatedAt = new Date();
  this.invalidatedBy = reason;
  if (fromIp) {
    this.invalidatedFromIp = fromIp;
  }
  return this.save();
};

CharacterSessionSchema.methods.updateActivity = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

CharacterSessionSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

// Static methods
CharacterSessionSchema.statics.invalidateCharacterSessions = async function(characterId: string, reason: string = 'new_device_login', fromIp?: string) {
  return this.updateMany(
    { 
      characterId, 
      isActive: true 
    },
    {
      isActive: false,
      invalidatedAt: new Date(),
      invalidatedBy: reason,
      invalidatedFromIp: fromIp
    }
  );
};

CharacterSessionSchema.statics.cleanupExpiredSessions = async function() {
  const now = new Date();
  return this.updateMany(
    {
      isActive: true,
      expiresAt: { $lt: now }
    },
    {
      isActive: false,
      invalidatedAt: now,
      invalidatedBy: 'expired'
    }
  );
};

CharacterSessionSchema.statics.getActiveSessionForCharacter = async function(characterId: string) {
  return this.findOne({
    characterId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

CharacterSessionSchema.statics.getUserActiveSessions = async function(userId: string) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('characterId', 'name');
};

export const CharacterSession = mongoose.models.CharacterSession || model<ICharacterSession>('CharacterSession', CharacterSessionSchema);