export interface CharacterRelationType {
  id: string;
  name: string;
  description: string;
  
  requiresMutualApproval: boolean;
  isExclusive: boolean;
  allowsSelfProposal: boolean;
  
  hasReciprocalType: boolean;
  reciprocalTypeId?: string;
  
  maxInstances?: number;
  requiredGender?: ('male' | 'female')[];
  requiredSocialClass?: ('working' | 'middle' | 'upper')[];
  
  socialImplications: string;
  isPublicRelationship: boolean;
  respectabilityModifier: number; // -5 to +5
  
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CharacterRelation {
  id: string;
  
  fromCharacterId: string;
  toCharacterId: string;
  
  relationshipTypeId: string;
  relationshipTypeName: string;
  
  status: CharacterRelationStatus;
  
  fromCharacterApproved: boolean;
  toCharacterApproved: boolean;
  
  establishedDate?: Date;
  relationshipNotes?: string;
  publicDescription?: string;
  
  currentStrength: number; // 1-10
  trustLevel: number; // 1-10
  
  proposedAt: Date;
  proposedBy: string;
  lastInteraction?: Date;
  
  isActive: boolean;
  endedAt?: Date;
  endReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export enum CharacterRelationStatus {
  PROPOSED = 'PROPOSED',
  PENDING_MUTUAL = 'PENDING_MUTUAL',
  ESTABLISHED = 'ESTABLISHED',
  REJECTED = 'REJECTED',
  ENDED = 'ENDED',
  DISPUTED = 'DISPUTED',
}

export interface CharacterRelationProposal {
  id: string;
  
  fromCharacterId: string;
  toCharacterId: string;
  relationshipTypeId: string;
  
  proposalMessage?: string;
  proposalReason?: string;
  
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  
  response?: CharacterRelationProposalResponse;
  
  proposedAt: Date;
  expiresAt?: Date;
  respondedAt?: Date;
  
  isActive: boolean;
}

export interface CharacterRelationProposalResponse {
  accept: boolean;
  responseMessage?: string;
  conditionalTerms?: string;
  
  respondedBy: string;
  respondedAt: Date;
}

export interface CharacterRelationQuery {
  characterId: string;
  
  relationshipTypes?: string[];
  status?: CharacterRelationStatus[];
  isEstablished?: boolean;
  
  includeIncoming: boolean;
  includeOutgoing: boolean;
  
  sortBy?: 'establishedDate' | 'lastInteraction' | 'relationshipType';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CharacterRelationQueryResult {
  relationships: CharacterRelationWithDetails[];
  totalCount: number;
  hasMore: boolean;
}

export interface CharacterRelationWithDetails extends CharacterRelation {
  otherCharacter: {
    id: string;
    name: string;
    occupation: string;
    socialClass: string;
  };
  
  relationshipType: CharacterRelationType;
  
  isReciprocal: boolean;
  reciprocalRelationshipId?: string;
  
  recentInteractions: number;
  relationshipHealth: 'excellent' | 'good' | 'neutral' | 'strained' | 'poor';
}

export const VICTORIAN_RELATION_TYPES = {
  SPOUSE: 'spouse',
  SIBLING: 'sibling', 
  PARENT: 'parent',
  CHILD: 'child',
  COUSIN: 'cousin',
  
  FRIEND: 'friend',
  CLOSE_FRIEND: 'close_friend',
  ACQUAINTANCE: 'acquaintance',
  RIVAL: 'rival',
  ENEMY: 'enemy',
  
  BUSINESS_PARTNER: 'business_partner',
  EMPLOYER: 'employer',
  EMPLOYEE: 'employee',
  MENTOR: 'mentor',
  STUDENT: 'student',
  
  PATRON: 'patron',
  PROTEGE: 'protege',
  MASTER: 'master',
  SERVANT: 'servant',
  SUITOR: 'suitor',
  COURTED: 'courted',
  
  ROMANTIC_INTEREST: 'romantic_interest',
  BETROTHED: 'betrothed',
  LOVER: 'lover',
  
  CLUB_MEMBER: 'club_member',
  NEIGHBOR: 'neighbor',
  CORRESPONDENT: 'correspondent',
} as const;

export interface CharacterRelationAction {
  id: string;
  
  actionType: 'propose' | 'accept' | 'reject' | 'modify' | 'end' | 'dispute';
  relationshipId?: string;
  proposalId?: string;
  
  performedBy: string;
  affectedCharacter: string;
  
  actionData: {
    newRelationshipType?: string;
    reason?: string;
    message?: string;
    terms?: string;
  };
  
  status: 'pending' | 'processed' | 'failed';
  processedAt?: Date;
  
  performedAt: Date;
}

export interface CharacterRelationValidation {
  isValid: boolean;
  
  errors: string[];
  warnings: string[];
  
  checks: {
    mutualApprovalRequired: boolean;
    exclusivityConflict: boolean;
    genderRestriction: boolean;
    socialClassRestriction: boolean;
    maxInstancesExceeded: boolean;
    selfProposalAllowed: boolean;
  };
  
  suggestions?: string[];
  
  validatedAt: Date;
}

export interface CharacterRelationEvent {
  type: 'relationship_proposed' | 'relationship_accepted' | 'relationship_rejected' | 
        'relationship_ended' | 'relationship_modified' | 'relationship_disputed';
  
  relationshipId?: string;
  proposalId?: string;
  fromCharacterId: string;
  toCharacterId: string;
  relationshipTypeId: string;
  
  reason?: string;
  message?: string;
  
  timestamp: Date;
  locationId?: string;
}
