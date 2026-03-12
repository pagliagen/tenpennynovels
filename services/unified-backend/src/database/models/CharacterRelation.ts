import mongoose, { Schema, model, Document } from 'mongoose';

export interface ICharacterRelationType extends Document {
  // Basic info
  name: string;
  description: string;
  
  // Relationship rules
  requiresMutualApproval: boolean; // Both parties must accept
  isExclusive: boolean; // Can only have one of this type (e.g., spouse)
  allowsSelfProposal: boolean; // Character can propose this relationship
  
  // Reciprocal settings
  hasReciprocalType: boolean; // Creates reciprocal relationship
  reciprocalTypeId?: string; // Different type for the other person (e.g., master/servant)
  
  // Constraints
  maxInstances?: number; // Maximum number of this relationship type per character
  requiredGender?: ('male' | 'female')[]; // Gender restrictions
  requiredSocialClass?: ('working' | 'middle' | 'upper')[]; // Class restrictions
  
  // Victorian context
  socialImplications: string; // What this relationship means socially
  isPublicRelationship: boolean; // Visible to other players
  respectabilityModifier: number; // Effect on social standing (-5 to +5)
  
  // Management
  isActive: boolean; // Can be used in new relationships
  createdBy: Schema.Types.ObjectId;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacterRelation extends Document {
  // Relationship parties
  fromCharacterId: Schema.Types.ObjectId; // Who initiated or holds this relationship
  toCharacterId: Schema.Types.ObjectId; // Target of the relationship
  
  // Relationship details
  relationshipTypeId: Schema.Types.ObjectId;
  relationshipTypeName: string; // Cached for performance
  
  // Status and approval
  status: 'PROPOSED' | 'PENDING_MUTUAL' | 'ESTABLISHED' | 'REJECTED' | 'ENDED' | 'DISPUTED';
  
  // Mutual approval tracking (for relationships requiring it)
  fromCharacterApproved: boolean; // Initiator's approval
  toCharacterApproved: boolean; // Target's approval
  
  // Relationship context
  establishedDate?: Date; // When relationship was officially established
  relationshipNotes?: string; // Private notes about the relationship
  publicDescription?: string; // Public description of the relationship
  
  // Dynamic properties
  currentStrength: number; // 1-10, current strength of relationship
  trustLevel: number; // 1-10, trust between parties
  
  // Relationship history
  proposedAt: Date; // When relationship was first proposed
  proposedBy: Schema.Types.ObjectId; // Character ID who proposed
  lastInteraction?: Date; // Last meaningful interaction
  
  // Status tracking
  isActive: boolean; // Relationship is currently active
  endedAt?: Date; // When relationship ended (if applicable)
  endReason?: string; // Why relationship ended
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacterRelationProposal extends Document {
  // Proposal details
  fromCharacterId: Schema.Types.ObjectId;
  toCharacterId: Schema.Types.ObjectId;
  relationshipTypeId: Schema.Types.ObjectId;
  
  // Proposal context
  proposalMessage?: string; // Optional message with the proposal
  proposalReason?: string; // Why this relationship is being proposed
  
  // Status
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  
  // Response
  response?: {
    accept: boolean;
    responseMessage?: string; // Optional message with response
    conditionalTerms?: string; // Any conditions for acceptance
    respondedBy: Schema.Types.ObjectId; // Character ID who responded
    respondedAt: Date;
  };
  
  // Timing
  proposedAt: Date;
  expiresAt?: Date; // Automatic expiry
  respondedAt?: Date;
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacterRelationAction extends Document {
  // Action details
  actionType: 'propose' | 'accept' | 'reject' | 'modify' | 'end' | 'dispute';
  relationshipId?: Schema.Types.ObjectId; // For actions on existing relationships
  proposalId?: Schema.Types.ObjectId; // For actions on proposals
  
  // Action context
  performedBy: Schema.Types.ObjectId; // Character ID
  affectedCharacter: Schema.Types.ObjectId; // Other character involved
  
  // Action data
  actionData: {
    newRelationshipType?: Schema.Types.ObjectId; // For modifications
    reason?: string; // Reason for action
    message?: string; // Message to other character
    terms?: string; // Special terms or conditions
  };
  
  // Processing
  status: 'pending' | 'processed' | 'failed';
  processedAt?: Date;
  
  // Metadata
  performedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterRelationTypeSchema = new Schema<ICharacterRelationType>({
  // Basic info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Rules
  requiresMutualApproval: {
    type: Boolean,
    default: true
  },
  isExclusive: {
    type: Boolean,
    default: false
  },
  allowsSelfProposal: {
    type: Boolean,
    default: true
  },
  
  // Reciprocal settings
  hasReciprocalType: {
    type: Boolean,
    default: false
  },
  reciprocalTypeId: {
    type: String,
    trim: true
  },
  
  // Constraints
  maxInstances: {
    type: Number,
    min: 1,
    max: 50
  },
  requiredGender: [{
    type: String,
    enum: ['male', 'female']
  }],
  requiredSocialClass: [{
    type: String,
    enum: ['working', 'middle', 'upper']
  }],
  
  // Victorian context
  socialImplications: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isPublicRelationship: {
    type: Boolean,
    default: true
  },
  respectabilityModifier: {
    type: Number,
    min: -5,
    max: 5,
    default: 0
  },
  
  // Management
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'character_relation_types'
});

const CharacterRelationSchema = new Schema<ICharacterRelation>({
  // Parties
  fromCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  toCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',  
    required: true
  },
  
  // Relationship details
  relationshipTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'CharacterRelationType',
    required: true
  },
  relationshipTypeName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['PROPOSED', 'PENDING_MUTUAL', 'ESTABLISHED', 'REJECTED', 'ENDED', 'DISPUTED'],
    default: 'PROPOSED'
  },
  
  // Approval tracking
  fromCharacterApproved: {
    type: Boolean,
    default: false
  },
  toCharacterApproved: {
    type: Boolean,
    default: false
  },
  
  // Context
  establishedDate: Date,
  relationshipNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  publicDescription: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Dynamic properties
  currentStrength: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  trustLevel: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // History
  proposedAt: {
    type: Date,
    required: true
  },
  proposedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  lastInteraction: Date,
  
  // Status tracking
  isActive: {
    type: Boolean,
    default: true
  },
  endedAt: Date,
  endReason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  collection: 'character_relations'
});

const CharacterRelationProposalSchema = new Schema<ICharacterRelationProposal>({
  // Proposal details
  fromCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  toCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  relationshipTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'CharacterRelationType',
    required: true
  },
  
  // Context
  proposalMessage: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  proposalReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  
  // Response
  response: {
    accept: Boolean,
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    conditionalTerms: {
      type: String,
      trim: true,
      maxlength: 500
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Character'
    },
    respondedAt: Date
  },
  
  // Timing
  proposedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,
  respondedAt: Date,
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'character_relation_proposals'
});

const CharacterRelationActionSchema = new Schema<ICharacterRelationAction>({
  // Action details
  actionType: {
    type: String,
    enum: ['propose', 'accept', 'reject', 'modify', 'end', 'dispute'],
    required: true
  },
  relationshipId: {
    type: Schema.Types.ObjectId,
    ref: 'CharacterRelation'
  },
  proposalId: {
    type: Schema.Types.ObjectId,
    ref: 'CharacterRelationProposal'
  },
  
  // Context
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  affectedCharacter: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  
  // Action data
  actionData: {
    newRelationshipType: {
      type: Schema.Types.ObjectId,
      ref: 'CharacterRelationType'
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    terms: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Processing
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending'
  },
  processedAt: Date,
  
  // Metadata
  performedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'character_relation_actions'
});

// Indexes
CharacterRelationTypeSchema.index({ isActive: 1 });

CharacterRelationSchema.index({ fromCharacterId: 1, toCharacterId: 1 });
CharacterRelationSchema.index({ fromCharacterId: 1, status: 1 });
CharacterRelationSchema.index({ toCharacterId: 1, status: 1 });
CharacterRelationSchema.index({ relationshipTypeId: 1 });
CharacterRelationSchema.index({ status: 1, isActive: 1 });

CharacterRelationProposalSchema.index({ fromCharacterId: 1, status: 1 });
CharacterRelationProposalSchema.index({ toCharacterId: 1, status: 1 });
CharacterRelationProposalSchema.index({ status: 1, expiresAt: 1 });

CharacterRelationActionSchema.index({ performedBy: 1, performedAt: -1 });
CharacterRelationActionSchema.index({ affectedCharacter: 1, performedAt: -1 });
CharacterRelationActionSchema.index({ status: 1 });

// Compound indexes for queries
CharacterRelationSchema.index({ fromCharacterId: 1, relationshipTypeId: 1, isActive: 1 });
CharacterRelationSchema.index({ toCharacterId: 1, relationshipTypeId: 1, isActive: 1 });

// Methods
CharacterRelationTypeSchema.methods.checkConstraints = function(character: any, targetCharacter: any, existingRelationships: any[] = []) {
  const issues: string[] = [];
  
  if (this.requiredGender && this.requiredGender.length > 0) {
    if (!this.requiredGender.includes(targetCharacter.gender)) {
      issues.push(`Gender requirement not met (requires ${this.requiredGender.join(' or ')}))`);
    }
  }
  
  if (this.requiredSocialClass && this.requiredSocialClass.length > 0) {
    if (!this.requiredSocialClass.includes(targetCharacter.socialClass)) {
      issues.push(`Social class requirement not met (requires ${this.requiredSocialClass.join(' or ')}))`);
    }
  }
  
  if (this.maxInstances) {
    const currentCount = existingRelationships.filter((r: any) => 
      r.relationshipTypeId.equals(this._id) && r.isActive
    ).length;
    
    if (currentCount >= this.maxInstances) {
      issues.push(`Maximum instances exceeded (${currentCount}/${this.maxInstances}))`);
    }
  }
  
  if (this.isExclusive) {
    const conflictingRelationships = existingRelationships.filter((r: any) => 
      r.relationshipTypeId.equals(this._id) && r.isActive
    );
    
    if (conflictingRelationships.length > 0) {
      issues.push('Exclusive relationship type already exists');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

CharacterRelationSchema.methods.updateApprovalStatus = function() {
  if (this.fromCharacterApproved && this.toCharacterApproved) {
    this.status = 'ESTABLISHED';
    this.establishedDate = new Date();
  } else if (this.status === 'PROPOSED') {
    this.status = 'PENDING_MUTUAL';
  }
};

CharacterRelationSchema.methods.endRelationship = function(reason: string, endedBy?: Schema.Types.ObjectId) {
  this.status = 'ENDED';
  this.isActive = false;
  this.endedAt = new Date();
  this.endReason = reason;
  
  if (endedBy) {
    this.endReason = `${reason} (ended by ${endedBy})`;
  }
};

CharacterRelationProposalSchema.methods.accept = function(respondingCharacterId: Schema.Types.ObjectId, responseMessage?: string) {
  this.status = 'accepted';
  this.response = {
    accept: true,
    responseMessage,
    respondedBy: respondingCharacterId,
    respondedAt: new Date()
  };
  this.respondedAt = new Date();
  this.isActive = false;
};

CharacterRelationProposalSchema.methods.reject = function(respondingCharacterId: Schema.Types.ObjectId, responseMessage?: string) {
  this.status = 'rejected';
  this.response = {
    accept: false,
    responseMessage,
    respondedBy: respondingCharacterId,
    respondedAt: new Date()
  };
  this.respondedAt = new Date();
  this.isActive = false;
};

// Pre-save middleware to handle expiration
CharacterRelationProposalSchema.pre('save', async function() {
  if (!this.expiresAt && this.isNew) {
    this.expiresAt = new Date(this.proposedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (this.expiresAt && new Date() > this.expiresAt && this.status === 'pending') {
    this.status = 'expired';
    this.isActive = false;
  }
});

export const CharacterRelationType = mongoose.models.CharacterRelationType || model<ICharacterRelationType>('CharacterRelationType', CharacterRelationTypeSchema);
export const CharacterRelation = mongoose.models.CharacterRelation || model<ICharacterRelation>('CharacterRelation', CharacterRelationSchema);
export const CharacterRelationProposal = mongoose.models.CharacterRelationProposal || model<ICharacterRelationProposal>('CharacterRelationProposal', CharacterRelationProposalSchema);
export const CharacterRelationAction = mongoose.models.CharacterRelationAction || model<ICharacterRelationAction>('CharacterRelationAction', CharacterRelationActionSchema);
