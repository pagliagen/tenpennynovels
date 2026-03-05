import mongoose, { Schema, model, Document } from 'mongoose';
import { softDeletePlugin, SoftDeleteFields, SoftDeleteMethods } from '../plugins/softDeletePlugin';

export interface IUser extends Document, SoftDeleteFields, SoftDeleteMethods {
  // Basic user info
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;

  // Password & security
  passwordHash: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  userRoles: ('user')[];

  // Account status
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: Date; // When the ban was applied
  bannedUntil?: Date; // When the ban expires (for temporary bans)
  bannedBy?: Schema.Types.ObjectId;
  bannedByName?: string; // Character name of admin who performed the ban
  banScope?: 'full' | 'chat_only' | 'game_only';

  // Character management
  multipleCharactersAllowed: boolean;

  // User preferences
  preferences: {
    emailNotifications: boolean;
    marketingEmails: boolean;
    theme: string;
    language: string;
    timezone: string;
  };

  // Activity tracking
  lastLoginAt?: Date;
  loginCount: number;
  passwordChangedAt?: Date;

  // Registration info
  registrationSource: string;
  referralCode?: string;
  ipAddress?: string;

  // GDPR fields (NOTE: GDPR deletedAt is different from soft delete deletedAt)
  accountStatus: 'active' | 'deleted' | 'anonymized';
  anonymizedAt?: Date;
  anonymizationReason?: string; // 'user_request' | 'admin_action'
  accountDeletionToken?: string;
  accountDeletionTokenExpires?: Date;
  accountDeletionRequestedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  // Basic user info
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    trim: true
  },
  
  // Password & security
  passwordHash: {
    type: String,
    required: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  userRoles: [{
    type: String,
    enum: ['user'],
    default: 'user'
  }],

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  bannedAt: Date, // When the ban was applied
  bannedUntil: Date, // When the ban expires
  bannedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  bannedByName: String, // Character name of admin who performed the ban
  banScope: {
    type: String,
    enum: ['full', 'chat_only', 'game_only']
  },
  
  // Character management
  multipleCharactersAllowed: {
    type: Boolean,
    default: false
  },
  
  // User preferences
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false },
    theme: { type: String, default: 'victorian_dark' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Europe/London' }
  },
  
  // Activity tracking
  lastLoginAt: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  passwordChangedAt: Date,
  
  // Registration info
  registrationSource: {
    type: String,
    default: 'web'
  },
  referralCode: String,
  ipAddress: String,

  // GDPR fields
  accountStatus: {
    type: String,
    enum: ['active', 'deleted', 'anonymized'],
    default: 'active'
  },
  deletedAt: Date,
  anonymizedAt: Date,
  anonymizationReason: String,
  accountDeletionToken: String,
  accountDeletionTokenExpires: Date,
  accountDeletionRequestedAt: Date
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes (username and email already have unique indexes)
UserSchema.index({ isActive: 1, isBanned: 1 });
UserSchema.index({ userRoles: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });
// GDPR indexes
UserSchema.index({ accountStatus: 1, deletedAt: 1 });

// Virtual for character count (populated separately)
UserSchema.virtual('characterCount', {
  ref: 'Character',
  localField: '_id',
  foreignField: 'userId',
  count: true
});

// Methods
UserSchema.methods.toSafeObject = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.ipAddress;
  return user;
};

UserSchema.methods.hasUserRole = function(role: string): boolean {
  return this.userRoles.includes(role);
};

// Apply soft delete plugin
UserSchema.plugin(softDeletePlugin, {
  uniqueKeys: ['username', 'email'],
  deletedByField: 'User'
});

export const User = mongoose.models.User || model<IUser>('User', UserSchema);