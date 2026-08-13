import mongoose, { Schema, model, Document, Types } from 'mongoose';

export interface ICorporation extends Document {
  // Basic info
  name: string;
  description: string;
  type: 'guild' | 'professional_association' | 'social_club' | 'government_body' | 'criminal_organization';

  // Membership system
  membershipType: 'manual' | 'automatic' | 'mixed';
  isRecruiting: boolean;
  maxMembers?: number;

  // Requirements for automatic membership
  automaticRequirements?: {
    minimumStats?: { [statName: string]: number };
    minimumSkills?: { [skillName: string]: number };
    requiredItems?: string[];
    requiredOccupations?: string[];
    excludeOccupations?: string[];
    requiredGender?: 'male' | 'female';
    minimumAge?: number;
    maximumAge?: number;
    requiredSocialClass?: ('working' | 'middle' | 'upper')[];
    customConditions?: string[];
  };

  // Manual membership requirements (for display/validation)
  manualRequirements?: {
    minimumStats?: { [statName: string]: number };
    minimumSkills?: { [skillName: string]: number };
    requiredItems?: string[];
    requiredOccupations?: string[];
    requiredGender?: 'male' | 'female';
    minimumAge?: number;
    maximumAge?: number;
    requiredSocialClass?: ('working' | 'middle' | 'upper')[];
    customConditions?: string[];
  };

  // Corporation roles
  roles: {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    canInvite: boolean;
    canApproveRequests: boolean;
    canManageTreasury: boolean;
    canManageShops: boolean;
    canManageLocations: boolean;
    hierarchy: number; // Higher number = higher rank
    isOfficer: boolean;
  }[];

  // Members
  members: {
    characterId: Schema.Types.ObjectId;
    roleId: string;
    joinedAt: Date;
    joinedBy?: Schema.Types.ObjectId; // Who invited/approved
    membershipType: 'automatic' | 'invited' | 'requested';
    lastActiveAt?: Date;
    dues?: {
      amount: number; // monthly dues in pence
      lastPaid?: Date;
      overdue: boolean;
    };
  }[];

  // Treasury and finances
  treasury: {
    balance: number; // in pence
    monthlyIncome: number;
    monthlyExpenses: number;
    transactions: {
      id: string;
      type: 'income' | 'expense' | 'deposit' | 'withdrawal';
      amount: number;
      description: string;
      authorizedBy: Schema.Types.ObjectId;
      processedAt: Date;
      relatedTo?: 'shop_restock' | 'salary' | 'dues' | 'admin_grant' | 'other';
    }[];
    lastUpdated: Date;
  };

  // Corporation properties
  influence: 'local' | 'regional' | 'national' | 'international';
  headquarters?: Schema.Types.ObjectId; // Location ID
  ownedLocations: Schema.Types.ObjectId[]; // Location IDs
  ownedShops: Schema.Types.ObjectId[]; // Shop IDs

  // Settings
  settings: {
    allowPublicRequests: boolean;
    requireApprovalForRequests: boolean;
    allowInvitations: boolean;
    maxPendingRequests: number;
    autoAcceptIfRequirementsMet: boolean;
    publiclyVisible: boolean;
  };

  // Timestamps and management
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface ICorporationMembershipRequest extends Document {
  corporationId: Schema.Types.ObjectId;
  requestingCharacterId: Schema.Types.ObjectId;
  message: string;
  requestedRoleId?: string;

  // Status tracking
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  meetsRequirements: boolean;
  requirementIssues: string[];

  // Review info
  reviewedBy?: Schema.Types.ObjectId;
  reviewedAt?: Date;
  responseMessage?: string;
  assignedRoleId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  requestedAt: Date;
}

export interface ICorporationInvitation extends Document {
  corporationId: Schema.Types.ObjectId;
  targetCharacterId: Schema.Types.ObjectId;
  invitedBy: Schema.Types.ObjectId;
  proposedRoleId: string;
  message?: string;

  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired';

  // Response
  respondedAt?: Date;
  responseMessage?: string;

  // Expiration
  expiresAt: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CorporationSchema = new Schema<ICorporation>({
  // Basic info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  type: {
    type: String,
    required: true,
    enum: ['guild', 'professional_association', 'social_club', 'government_body', 'criminal_organization']
  },

  // Membership system
  membershipType: {
    type: String,
    required: true,
    enum: ['manual', 'automatic', 'mixed']
  },
  isRecruiting: {
    type: Boolean,
    default: true
  },
  maxMembers: {
    type: Number,
    min: 1,
    max: 1000
  },

  // Requirements
  automaticRequirements: {
    minimumStats: { type: Map, of: Number },
    minimumSkills: { type: Map, of: Number },
    requiredItems: [String],
    requiredOccupations: [String],
    excludeOccupations: [String],
    requiredGender: { type: String, enum: ['male', 'female'] },
    minimumAge: Number,
    maximumAge: Number,
    requiredSocialClass: [{ type: String, enum: ['working', 'middle', 'upper'] }],
    customConditions: [String]
  },

  manualRequirements: {
    minimumStats: { type: Map, of: Number },
    minimumSkills: { type: Map, of: Number },
    requiredItems: [String],
    requiredOccupations: [String],
    requiredGender: { type: String, enum: ['male', 'female'] },
    minimumAge: Number,
    maximumAge: Number,
    requiredSocialClass: [{ type: String, enum: ['working', 'middle', 'upper'] }],
    customConditions: [String]
  },

  // Roles
  roles: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    permissions: [String],
    canInvite: { type: Boolean, default: false },
    canApproveRequests: { type: Boolean, default: false },
    canManageTreasury: { type: Boolean, default: false },
    canManageShops: { type: Boolean, default: false },
    canManageLocations: { type: Boolean, default: false },
    hierarchy: { type: Number, required: true, min: 1 },
    isOfficer: { type: Boolean, default: false }
  }],

  // Members
  members: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    roleId: { type: String, required: true },
    joinedAt: { type: Date, required: true },
    joinedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Character'
    },
    membershipType: {
      type: String,
      enum: ['automatic', 'invited', 'requested'],
      required: true
    },
    lastActiveAt: Date,
    dues: {
      amount: { type: Number, min: 0 },
      lastPaid: Date,
      overdue: { type: Boolean, default: false }
    }
  }],

  // Treasury
  treasury: {
    balance: { type: Number, default: 0 },
    monthlyIncome: { type: Number, default: 0 },
    monthlyExpenses: { type: Number, default: 0 },
    transactions: [{
      id: { type: String, required: true },
      type: {
        type: String,
        enum: ['income', 'expense', 'deposit', 'withdrawal'],
        required: true
      },
      amount: { type: Number, required: true },
      description: { type: String, required: true },
      authorizedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      processedAt: { type: Date, required: true },
      relatedTo: {
        type: String,
        enum: ['shop_restock', 'salary', 'dues', 'admin_grant', 'other']
      }
    }],
    lastUpdated: { type: Date, default: Date.now }
  },

  // Properties
  influence: {
    type: String,
    enum: ['local', 'regional', 'national', 'international'],
    default: 'local'
  },
  headquarters: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  ownedLocations: [{
    type: Schema.Types.ObjectId,
    ref: 'Location'
  }],
  ownedShops: [{
    type: Schema.Types.ObjectId,
    ref: 'Shop'
  }],

  // Settings
  settings: {
    allowPublicRequests: { type: Boolean, default: true },
    requireApprovalForRequests: { type: Boolean, default: true },
    allowInvitations: { type: Boolean, default: true },
    maxPendingRequests: { type: Number, default: 50 },
    autoAcceptIfRequirementsMet: { type: Boolean, default: false },
    publiclyVisible: { type: Boolean, default: true }
  },

  // Management
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastActivityAt: Date
}, {
  timestamps: true,
  collection: 'corporations'
});

const MembershipRequestSchema = new Schema<ICorporationMembershipRequest>({
  corporationId: {
    type: Schema.Types.ObjectId,
    ref: 'Corporation',
    required: true
  },
  requestingCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  requestedRoleId: String,

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  meetsRequirements: {
    type: Boolean,
    required: true
  },
  requirementIssues: [String],

  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  reviewedAt: Date,
  responseMessage: String,
  assignedRoleId: String,

  requestedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'corporation_membership_requests'
});

const InvitationSchema = new Schema<ICorporationInvitation>({
  corporationId: {
    type: Schema.Types.ObjectId,
    ref: 'Corporation',
    required: true
  },
  targetCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  proposedRoleId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending'
  },

  respondedAt: Date,
  responseMessage: String,

  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
}, {
  timestamps: true,
  collection: 'corporation_invitations'
});

// Indexes
// name already has unique constraint
CorporationSchema.index({ type: 1, isRecruiting: 1 });
CorporationSchema.index({ membershipType: 1 });
CorporationSchema.index({ 'members.characterId': 1 });
CorporationSchema.index({ 'settings.publiclyVisible': 1, isRecruiting: 1 });

MembershipRequestSchema.index({ corporationId: 1, status: 1 });
MembershipRequestSchema.index({ requestingCharacterId: 1, status: 1 });
MembershipRequestSchema.index({ status: 1, requestedAt: 1 });

InvitationSchema.index({ corporationId: 1, status: 1 });
InvitationSchema.index({ targetCharacterId: 1, status: 1 });
InvitationSchema.index({ expiresAt: 1 });

// Methods
CorporationSchema.methods.addMember = function(characterId: Schema.Types.ObjectId, roleId: string, joinedBy?: Schema.Types.ObjectId, membershipType = 'requested') {
  // Remove if already a member
  this.members = this.members.filter((m: any) => !m.characterId.equals(characterId));

  // Add new membership
  this.members.push({
    characterId,
    roleId,
    joinedAt: new Date(),
    joinedBy,
    membershipType,
    lastActiveAt: new Date()
  });

  this.lastActivityAt = new Date();
};

CorporationSchema.methods.removeMember = function(characterId: Schema.Types.ObjectId) {
  this.members = this.members.filter((m: any) => !m.characterId.equals(characterId));
  this.lastActivityAt = new Date();
};

CorporationSchema.methods.getMember = function(characterId: Schema.Types.ObjectId) {
  return this.members.find((m: any) => m.characterId.equals(characterId));
};

CorporationSchema.methods.getMemberRole = function(characterId: Schema.Types.ObjectId) {
  const member = this.getMember(characterId);
  if (!member) return null;
  return this.roles.find((r: any) => r.id === member.roleId);
};

CorporationSchema.methods.canMemberPerformAction = function(characterId: Schema.Types.ObjectId, action: string) {
  const role = this.getMemberRole(characterId);
  if (!role) return false;

  const actionMap = {
    'invite': 'canInvite',
    'approve_requests': 'canApproveRequests',
    'manage_treasury': 'canManageTreasury',
    'manage_shops': 'canManageShops',
    'manage_locations': 'canManageLocations'
  };

  return role[actionMap[action as keyof typeof actionMap]] || false;
};

CorporationSchema.methods.checkRequirements = function(character: any): { meetsRequirements: boolean; issues: string[] } {
  const issues: string[] = [];
  const requirements = this.membershipType === 'automatic' ? this.automaticRequirements : this.manualRequirements;

  if (!requirements) {
    return { meetsRequirements: true, issues: [] };
  }

  // Check stats
  if (requirements.minimumStats) {
    for (const [stat, minValue] of requirements.minimumStats) {
      if (character.stats[stat] < minValue) {
        issues.push(`${stat} too low (has ${character.stats[stat]}, requires ${minValue})`);
      }
    }
  }

  // Check skills
  if (requirements.minimumSkills) {
    for (const [skill, minValue] of requirements.minimumSkills) {
      const characterSkill = character.skills.get(skill) || 0;
      if (characterSkill < minValue) {
        issues.push(`${skill} skill too low (has ${characterSkill}, requires ${minValue})`);
      }
    }
  }

  // Check social class
  if (requirements.requiredSocialClass && !requirements.requiredSocialClass.includes(character.socialClass)) {
    issues.push(`Social class requirement not met (requires ${requirements.requiredSocialClass.join(' or ')})`);
  }

  // Check gender
  if (requirements.requiredGender && character.gender !== requirements.requiredGender) {
    issues.push(`Gender requirement not met (requires ${requirements.requiredGender})`);
  }

  // Check age
  if (requirements.minimumAge && character.age < requirements.minimumAge) {
    issues.push(`Age too low (requires minimum ${requirements.minimumAge})`);
  }

  if (requirements.maximumAge && character.age > requirements.maximumAge) {
    issues.push(`Age too high (maximum ${requirements.maximumAge})`);
  }

  // Check occupation
  if (requirements.requiredOccupations && !requirements.requiredOccupations.includes(character.occupation)) {
    issues.push(`Occupation requirement not met (requires ${requirements.requiredOccupations.join(' or ')})`);
  }

  if (requirements.excludeOccupations && requirements.excludeOccupations.includes(character.occupation)) {
    issues.push(`Occupation not allowed (${character.occupation} is excluded)`);
  }

  return {
    meetsRequirements: issues.length === 0,
    issues
  };
};

CorporationSchema.methods.addTransaction = function(type: string, amount: number, description: string, authorizedBy: Schema.Types.ObjectId, relatedTo?: string) {
  const transaction = {
    id: new Types.ObjectId().toString(),
    type,
    amount,
    description,
    authorizedBy,
    processedAt: new Date(),
    relatedTo
  };

  this.treasury.transactions.push(transaction);

  if (type === 'income' || type === 'deposit') {
    this.treasury.balance += amount;
  } else {
    this.treasury.balance -= amount;
  }

  this.treasury.lastUpdated = new Date();
  this.lastActivityAt = new Date();

  return transaction;
};

export const Corporation = mongoose.models.Corporation || model<ICorporation>('Corporation', CorporationSchema);
export const CorporationMembershipRequest = mongoose.models.CorporationMembershipRequest || model<ICorporationMembershipRequest>('CorporationMembershipRequest', MembershipRequestSchema);
export const CorporationInvitation = mongoose.models.CorporationInvitation || model<ICorporationInvitation>('CorporationInvitation', InvitationSchema);
