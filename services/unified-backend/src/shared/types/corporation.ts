import { VictorianCurrency } from './economy';
import { SocialClass } from './socialClass';

export interface Corporation {
  id: string;
  name: string;
  description: string;
  
  // Corporation type
  type: 'guild' | 'company' | 'secret_society' | 'government' | 'religious' | 'criminal';
  
  // Membership system
  membershipType: 'manual' | 'automatic' | 'mixed';
  
  // Corporation settings
  isPublic: boolean; // Can players see this corporation exists
  isRecruiting: boolean; // Accepting new members (for manual corporations)
  
  // Automatic membership rules (for automatic/mixed corporations)
  automaticRules?: CorporationAutomaticRule[];
  
  // Hierarchy
  roles: CorporationRole[];
  
  // Membership
  members: CorporationMember[];
  
  // Corporation treasury and economics
  treasury: CorporationTreasury;
  
  // Victorian context
  foundedYear: number;
  headquarters?: string; // Location ID
  influence: 'local' | 'national' | 'international';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporationRole {
  id: string;
  corporationId: string;
  name: string;
  description: string;
  
  // Hierarchy
  level: number; // Higher number = higher rank
  parentRoleId?: string; // Role hierarchy
  
  // Economic benefits
  dailySalary?: VictorianCurrency; // Daily salary paid from corporation treasury
  
  // Permissions
  permissions: CorporationPermission[];
  
  // Limits
  maxMembers?: number; // null = unlimited
  
  // Requirements
  requirements?: {
    minimumStats?: { [key: string]: number };
    requiredSkills?: { [key: string]: number };
  };
}

export interface CorporationAutomaticRule {
  id: string;
  corporationId: string;
  name: string; // e.g., "Medical Board Requirements"
  
  // Target role for automatic membership
  targetRoleId: string;
  
  // Requirements (ALL must be met)
  requirements: {
    // Stat requirements
    stats?: { [statName: string]: number }; // e.g., { intelligence: 80 }
    
    // Skill requirements  
    skills?: { [skillName: string]: number }; // e.g., { medicine: 80 }
    
    // Required items/equipment
    requiredItems?: string[]; // e.g., ["Medical License", "University Diploma"]
    
    // Other character properties
    socialClass?: SocialClass[]; // Membership requirements
    occupation?: string[]; // e.g., ["Doctor", "Surgeon"]
    
    // Exclusions (if any of these are true, exclude from automatic membership)
    excludeIfHasItems?: string[]; // e.g., ["Criminal Record"]
    excludeIfInCorporations?: string[]; // Corporation IDs
  };
  
  // Rule settings
  isActive: boolean;
  checkFrequency: 'realtime' | 'daily' | 'weekly'; // How often to check eligibility
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporationMember {
  id: string;
  corporationId: string;
  characterId: string;
  
  // Role and status
  roleId: string;
  status: 'active' | 'inactive' | 'suspended' | 'expelled';
  
  // Membership type
  membershipSource: 'manual' | 'automatic' | 'invited';
  automaticRuleId?: string; // If joined via automatic rule
  
  // Membership history
  joinedAt: Date;
  promotedAt?: Date;
  lastActiveAt?: Date;
  
  // For automatic members: can they lose membership?
  canLoseAutomaticMembership: boolean;
  lastEligibilityCheck?: Date;
  
  // Member-specific permissions (overrides role permissions)
  customPermissions?: CorporationPermission[];
}

export interface CorporationPermission {
  action: 'invite_members' | 'remove_members' | 'manage_roles' | 'access_locations' | 
          'manage_locations' | 'view_finances' | 'manage_finances' | 'create_missions' | 
          'approve_missions' | 'access_private_chat' | 'manage_corporation';
  granted: boolean;
  restrictions?: {
    maxLevel?: number; // Can only affect members of lower level
    locationIds?: string[]; // Specific locations only
  };
}

export interface CorporationInvitation {
  id: string;
  corporationId: string;
  invitedCharacterId: string;
  invitedByCharacterId: string;
  
  // Invitation details
  proposedRoleId: string;
  message?: string;
  
  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  
  // Timestamps
  sentAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
}

export interface CorporationMembershipRequest {
  id: string;
  corporationId: string;
  requestingCharacterId: string;
  
  // Request details
  requestedRoleId?: string;        // Preferred role (optional)
  message: string;                 // Why they want to join
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  
  // Response from corporation (when approved/rejected)
  reviewedBy?: string;             // Character ID of reviewer
  responseMessage?: string;        // Response from corporation officers
  assignedRoleId?: string;         // Role assigned (if approved)
  
  // Requirements check
  meetsRequirements: boolean;      // Does character meet basic requirements
  requirementDetails?: {
    missingStats?: { [statName: string]: { required: number; current: number } };
    missingSkills?: { [skillName: string]: { required: number; current: number } };
    missingItems?: string[];
    other?: string[];
  };
  
  // Timestamps
  requestedAt: Date;
  reviewedAt?: Date;
  expiresAt?: Date;                // Optional expiration for pending requests
}

export interface CorporationMembershipApplication {
  requestId: string;
  corporationId: string;
  corporationName: string;
  applicant: {
    characterId: string;
    characterName: string;
    occupation: string;
    socialClass: SocialClass;
  };
  message: string;
  requestedAt: Date;
  meetsRequirements: boolean;
  requirementIssues?: string[];
}

export interface CorporationTreasury {
  corporationId: string;
  
  // Current funds
  balance: VictorianCurrency;
  
  // Financial tracking
  dailyExpenses: VictorianCurrency;  // Total daily salaries
  monthlyRevenue: VictorianCurrency; // Average monthly income
  
  // Treasury status
  isInDebt: boolean;
  debtAmount?: VictorianCurrency;
  
  // Automatic payments
  salaryPaymentDay: number; // Day of month when salaries are paid (1-31)
  lastSalaryPayment: Date;
  
  // Financial limits
  salaryReserve: VictorianCurrency; // Minimum funds to keep for salaries
  
  // Metadata
  lastUpdated: Date;
}

export interface CorporationFinancialTransaction {
  id: string;
  corporationId: string;
  
  // Transaction type
  type: 'salary_payment' | 'shop_revenue' | 'membership_dues' | 'donation' | 
        'fine_payment' | 'investment_return' | 'administrative_cost' | 'other';
  
  // Transaction details
  amount: VictorianCurrency;
  direction: 'income' | 'expense';
  
  // Context
  description: string;
  relatedCharacterId?: string; // For salaries, dues, etc.
  relatedShopId?: string;      // For shop revenue
  
  // Approval and processing
  approvedBy?: string;         // Leadership member who approved
  processedAt: Date;
  
  // Balance tracking
  balanceBefore: VictorianCurrency;
  balanceAfter: VictorianCurrency;
  
  // Metadata
  createdAt: Date;
}

export interface CorporationRevenueSource {
  id: string;
  corporationId: string;
  
  // Revenue source type
  type: 'corporation_shop' | 'membership_dues' | 'services' | 'investments' | 'donations';
  
  // Source details
  name: string;
  description: string;
  
  // Revenue settings
  expectedMonthlyRevenue: VictorianCurrency;
  isActive: boolean;
  
  // For shops
  shopId?: string;
  locationId?: string;
  
  // For dues
  membershipDue?: {
    amount: VictorianCurrency;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    applicableRoles: string[]; // Role IDs that must pay dues
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporationBudget {
  corporationId: string;
  
  // Budget period
  periodStart: Date;
  periodEnd: Date;
  
  // Budget allocations
  salaryBudget: VictorianCurrency;
  operationalBudget: VictorianCurrency;  // For general expenses
  expansionBudget: VictorianCurrency;    // For growth initiatives
  emergencyReserve: VictorianCurrency;   // Emergency fund
  
  // Actual spending (calculated)
  actualSalarySpent: VictorianCurrency;
  actualOperationalSpent: VictorianCurrency;
  actualExpansionSpent: VictorianCurrency;
  
  // Budget status
  isOverBudget: boolean;
  budgetVariance: VictorianCurrency; // Positive = under budget, negative = over budget
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface CorporationActivity {
  id: string;
  corporationId: string;
  
  // Activity details
  type: 'member_joined' | 'member_left' | 'member_promoted' | 'member_demoted' | 
        'location_acquired' | 'mission_completed' | 'finance_transaction' |
        'salary_paid' | 'revenue_generated' | 'shop_opened' | 'budget_created';
  
  description: string;
  
  // Related entities
  actorCharacterId?: string; // Who performed the action
  targetCharacterId?: string; // Who was affected
  locationId?: string;
  financialAmount?: VictorianCurrency; // For financial activities
  
  // Metadata
  timestamp: Date;
  isPublic: boolean; // Visible to all members or just leadership
}