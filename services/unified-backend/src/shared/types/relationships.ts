export interface RelationshipType {
  id: string;
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
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean; // Can be used in new relationships
}

export interface CharacterRelationship {
  id: string;
  
  // Relationship parties
  fromCharacterId: string; // Who initiated or holds this relationship
  toCharacterId: string; // Target of the relationship
  
  // Relationship details
  relationshipTypeId: string;
  relationshipTypeName: string; // Cached for performance
  
  // Status and approval
  status: RelationshipStatus;
  
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
  proposedBy: string; // Character ID who proposed
  lastInteraction?: Date; // Last meaningful interaction
  
  // Status tracking
  isActive: boolean; // Relationship is currently active
  endedAt?: Date; // When relationship ended (if applicable)
  endReason?: string; // Why relationship ended
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export enum RelationshipStatus {
  PROPOSED = 'PROPOSED', // Relationship proposed, awaiting response
  PENDING_MUTUAL = 'PENDING_MUTUAL', // Waiting for mutual approval
  ESTABLISHED = 'ESTABLISHED', // Relationship is active
  REJECTED = 'REJECTED', // Proposal was rejected
  ENDED = 'ENDED', // Relationship has ended
  DISPUTED = 'DISPUTED', // Relationship is in dispute
}

export interface RelationshipProposal {
  id: string;
  
  // Proposal details
  fromCharacterId: string;
  toCharacterId: string;
  relationshipTypeId: string;
  
  // Proposal context
  proposalMessage?: string; // Optional message with the proposal
  proposalReason?: string; // Why this relationship is being proposed
  
  // Status
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  
  // Response
  response?: RelationshipProposalResponse;
  
  // Timing
  proposedAt: Date;
  expiresAt?: Date; // Automatic expiry
  respondedAt?: Date;
  
  // Metadata
  isActive: boolean;
}

export interface RelationshipProposalResponse {
  accept: boolean;
  responseMessage?: string; // Optional message with response
  conditionalTerms?: string; // Any conditions for acceptance
  
  // Response context
  respondedBy: string; // Character ID who responded
  respondedAt: Date;
}

export interface RelationshipQuery {
  characterId: string;
  
  // Query filters
  relationshipTypes?: string[]; // Filter by relationship type IDs
  status?: RelationshipStatus[];
  isEstablished?: boolean; // Only established relationships
  
  // Relationship direction
  includeIncoming: boolean; // Relationships where character is target
  includeOutgoing: boolean; // Relationships where character is initiator
  
  // Sorting and pagination
  sortBy?: 'establishedDate' | 'lastInteraction' | 'relationshipType';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface RelationshipQueryResult {
  relationships: CharacterRelationshipWithDetails[];
  totalCount: number;
  hasMore: boolean;
}

export interface CharacterRelationshipWithDetails extends CharacterRelationship {
  // Enhanced details
  otherCharacter: {
    id: string;
    name: string;
    occupation: string;
    socialClass: string;
  };
  
  relationshipType: RelationshipType;
  
  // Computed properties
  isReciprocal: boolean; // Other character has reciprocal relationship
  reciprocalRelationshipId?: string;
  
  // Interaction summary
  recentInteractions: number; // Count of recent interactions
  relationshipHealth: 'excellent' | 'good' | 'neutral' | 'strained' | 'poor';
}

// Predefined Victorian relationship types
export const VICTORIAN_RELATIONSHIP_TYPES = {
  // Family relationships (require mutual approval)
  SPOUSE: 'spouse',
  SIBLING: 'sibling', 
  PARENT: 'parent',
  CHILD: 'child',
  COUSIN: 'cousin',
  
  // Social relationships (may be unilateral)
  FRIEND: 'friend',
  CLOSE_FRIEND: 'close_friend',
  ACQUAINTANCE: 'acquaintance',
  RIVAL: 'rival',
  ENEMY: 'enemy',
  
  // Professional relationships
  BUSINESS_PARTNER: 'business_partner',
  EMPLOYER: 'employer',
  EMPLOYEE: 'employee',
  MENTOR: 'mentor',
  STUDENT: 'student',
  
  // Victorian-specific relationships
  PATRON: 'patron', // Social/financial sponsor
  PROTEGE: 'protege',
  MASTER: 'master', // Master/servant relationship
  SERVANT: 'servant',
  SUITOR: 'suitor', // Romantic courtship
  COURTED: 'courted',
  
  // Romantic relationships
  ROMANTIC_INTEREST: 'romantic_interest',
  BETROTHED: 'betrothed', // Engaged to be married
  LOVER: 'lover', // Secret romantic relationship
  
  // Social connections
  CLUB_MEMBER: 'club_member', // Fellow club members
  NEIGHBOR: 'neighbor',
  CORRESPONDENT: 'correspondent', // Regular letter exchange
} as const;

export interface RelationshipAction {
  id: string;
  
  // Action details
  actionType: 'propose' | 'accept' | 'reject' | 'modify' | 'end' | 'dispute';
  relationshipId?: string; // For actions on existing relationships
  proposalId?: string; // For actions on proposals
  
  // Action context
  performedBy: string; // Character ID
  affectedCharacter: string; // Other character involved
  
  // Action data
  actionData: {
    newRelationshipType?: string; // For modifications
    reason?: string; // Reason for action
    message?: string; // Message to other character
    terms?: string; // Special terms or conditions
  };
  
  // Processing
  status: 'pending' | 'processed' | 'failed';
  processedAt?: Date;
  
  // Metadata
  performedAt: Date;
}

export interface RelationshipValidation {
  isValid: boolean;
  
  // Validation issues
  errors: string[]; // Blocking issues
  warnings: string[]; // Non-blocking concerns
  
  // Specific validations
  checks: {
    mutualApprovalRequired: boolean;
    exclusivityConflict: boolean; // Would conflict with existing exclusive relationship
    genderRestriction: boolean;
    socialClassRestriction: boolean;
    maxInstancesExceeded: boolean;
    selfProposalAllowed: boolean;
  };
  
  // Recommendations
  suggestions?: string[]; // Alternative relationship types
  
  // Context
  validatedAt: Date;
}

// Events for Redis/WebSocket
export interface RelationshipEvent {
  type: 'relationship_proposed' | 'relationship_accepted' | 'relationship_rejected' | 
        'relationship_ended' | 'relationship_modified' | 'relationship_disputed';
  
  // Event data
  relationshipId?: string;
  proposalId?: string;
  fromCharacterId: string;
  toCharacterId: string;
  relationshipTypeId: string;
  
  // Event context
  reason?: string;
  message?: string;
  
  // Metadata
  timestamp: Date;
  locationId?: string; // Where the event occurred
}