// Management Backend Type Definitions

import { SocialClass } from '@shared/types/socialClass';
import type { PaginationInfo } from '@shared/types/responses';
export type { PaginationInfo } from '@shared/types/responses';

/**
 * Error details type for API responses
 */
export interface ErrorDetails {
  [key: string]: unknown;
  field?: string;
  expectedType?: string;
  receivedValue?: unknown;
  receivedType?: string;
  validationErrors?: Array<{ field: string; message: string; value?: unknown }>;
  affectedFields?: string[];
  duplicateField?: string;
  duplicateValue?: unknown;
  existingUserId?: string;
  providedId?: string;
  expectedFormat?: string;
  allowedFields?: string[];
  receivedFields?: string[];
  allowedValues?: string[];
  providedDuration?: string;
  invalidScopes?: string[];
  validScopes?: string[];
  availableScopes?: string[];
  searchedUserId?: string;
  requestedUserId?: string;
  searchPerformed?: boolean;
  errorType?: string;
  retryable?: boolean;
  operation?: string;
  userId?: string;
  mongoErrorCode?: number;
  indexName?: string;
}

/**
 * Standardized API Response interface (BASE)
 */
export interface ApiResponse<T = unknown> {
  result: boolean;           // Standard: true/false
  success?: boolean;         // Optional: backward compat (mirrors result)
  data?: T;                  // Single record data or metadata object
  list?: T[];                // Array for list responses
  pagination?: PaginationInfo; // Pagination info for list responses
  message?: string;          // Optional message for POST/PATCH/DELETE
  error?: string;            // Error message if result = false
  code?: string;             // Error code (e.g., 'USER_NOT_FOUND')
  details?: ErrorDetails;    // Additional error details (typed instead of any)
  timestamp: string;         // Always present
  requestId?: string;        // Optional for request tracing
}

/**
 * List Response - REQUIRED format for ALL /admin/* list endpoints
 *
 * CRITICAL: list and pagination MUST be at root level, NOT wrapped in data object
 *
 * Example:
 * {
 *   result: true,
 *   list: [...],
 *   pagination: {...},
 *   timestamp: "..."
 * }
 */
export interface ApiListResponse<T> {
  result: true;
  list: T[];
  pagination: PaginationInfo;
  message?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Single Record Response - format for GET by ID, POST, PATCH
 *
 * Example:
 * {
 *   result: true,
 *   data: {...},
 *   timestamp: "..."
 * }
 */
export interface ApiSingleResponse<T> {
  result: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Error Response
 */
export interface ApiErrorResponse {
  result: false;
  error: string;
  code?: string;
  details?: ErrorDetails;
  timestamp: string;
  requestId?: string;
}

// Admin Authentication Types
export interface AdminUser {
  id: string;
  userId: string;
  username: string;
  email: string;
  characterId?: string;
  canAccessAdminPanel: boolean;
}


// Character Approval Types
export interface PendingCharacter {
  id: string;
  name: string;
  playerUsername: string;
  playerEmail: string;
  submittedAt: string;
  occupation: string;
  socialClass: SocialClass;
  age: number;
  gender: 'male' | 'female';
  stats: CharacterStats;
  skills: Record<string, number>;
  background: string;
  description: string;
  equipment: string[];
  aiGenerated: boolean;
  reviewPriority: 'high' | 'normal' | 'low';
}

// All Characters List Type (for management table)
export interface Character {
  _id: string;               // Changed from 'id' for consistency
  characterName: string;
  characterSurname?: string;
  userId: string;
  username: string;
  email?: string;
  occupation: string;
  socialClass: SocialClass;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  gameplayRoles: string[];
  stats?: CharacterStats; // Optional stats for detailed views
  skills?: Record<string, number>; // Character skills
  equipment?: string[]; // Character equipment
}

export interface CharacterStats {
  // Frontend expects short field names
  str: number;        // strength
  dex: number;        // dexterity  
  int: number;        // intelligence
  con: number;        // constitution
  app: number;        // appearance/charm
  pow: number;        // power
  siz: number;        // size
  edu: number;        // education
  social_status?: number;
}

export interface CharacterReview {
  action: 'approve' | 'reject' | 'request_changes';
  note: string;
  feedback?: {
    stats?: string;
    skills?: string;
    background?: string;
  };
  priority?: 'high' | 'normal' | 'low';
}

export interface ValidationChecks {
  statsValid: boolean;
  skillsValid: boolean;
  backgroundAppropriate: boolean;
  nameUnique: boolean;
  equipmentValid: boolean;
  issuesFound: string[];
}

// User Management Types
export interface AdminUserProfile {
  _id: string;               // Changed from 'id' for consistency
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  canAccessAdminPanel: boolean;
  // Granular permission system
  userRoles?: ('user')[];
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];
  accountStatus: AccountStatus;
  multipleCharactersAllowed?: boolean;
  characters: UserCharacter[];
  activity: UserActivity;
  registrationInfo: RegistrationInfo;
}

export interface AccountStatus {
  isActive: boolean;
  isEmailVerified: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  bannedUntil?: string;
  bannedBy?: string;
  bannedByName?: string;
}

export interface UserCharacter {
  id: string;
  name: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  occupation: string;
  socialClass: SocialClass;
  createdAt: string;
  lastActive?: string;
}

export interface UserActivity {
  lastLoginAt: string;
  loginCount: number;
  messagesSent: number;
  documentsCreated: number;
  moderationActions: number;
}

export interface RegistrationInfo {
  registeredAt: string;
  registrationSource: string;
  ipAddress: string;
  referrer?: string;
}

export interface UserBan {
  duration: 'temporary' | 'permanent';
  bannedUntil?: string;
  reason: string;
  publicReason: string;
  banScope: 'full' | 'chat_only' | 'game_only';
  notifyUser: boolean;
  evidence?: string[];
}

// Location Management Types
export interface LocationManagement {
  id: string;
  name: string;
  district: string;
  description: string;
  settings: LocationSettings;
  statistics: LocationStatistics;
  management: LocationManagementInfo;
}

export interface LocationSettings {
  visible: boolean;
  chat: boolean;
  shop: boolean;
  private: boolean;
}

export interface LocationStatistics {
  totalVisits: number;
  uniqueVisitors: number;
  currentOccupants: number;
  averageStayTime: string;
  messagesExchanged: number;
}

export interface LocationManagementInfo {
  createdBy: string;
  lastModified: string;
  modifiedBy: string;
}

export interface LocationSettingsUpdate {
  visible?: boolean;
  chat?: boolean;
  shop?: boolean;
  private?: boolean;
  bot_enabled?: boolean;
  description?: string;
  maxOccupants?: number;
  accessRules?: LocationAccessRules;
  reason: string;
}

export interface LocationAccessRules {
  requiredLevel?: number;
  bannedCharacters?: string[];
  allowedCorporations?: string[];
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  allowedUsers: string[];
  estimatedCompletion?: string;
}

// Ticket Management Types
export interface TicketManagement {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  department: 'master' | 'technical' | 'moderation' | 'administration' | 'general';
  
  // Creator information
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  
  // Assignment information
  assignedTo?: {
    id: string;
    name: string;
  };
  assignedAt?: string;
  
  // Status tracking
  closedAt?: string;
  closedBy?: {
    id: string;
    name: string;
  };
  
  // Escalation
  escalatedAt?: string;
  escalationLevel?: number;
  
  // Read tracking
  lastReadBy: {
    character?: string;
    staff?: string;
  };
  
  // Metadata
  tags?: string[];
  internalNotes?: string;
  messageCount?: number;
}

export interface TicketAssignment {
  ticketId: string;
  assignedTo: string;
  assignedToName: string;
  reason?: string;
}

export interface TicketReassignment {
  ticketId: string;
  fromStaff: string;
  fromStaffName: string;
  toStaff: string;
  toStaffName: string;
  reason?: string;
}

export interface TicketTransfer {
  ticketId: string;
  fromDepartment: string;
  toDepartment: string;
  reason: string;
}

export interface TicketClosure {
  ticketId: string;
  resolution?: string;
  notifyUser?: boolean;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: string;
  isInternal: boolean;
}

export interface TicketPriorityUpdate {
  ticketId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
}

export interface TicketInternalNote {
  ticketId: string;
  note: string;
}

export interface TicketStats {
  overview: {
    totalTickets: number;
    openTickets: number;
    assignedTickets: number;
    closedTickets: number;
    avgResolutionTime: string;
  };
  byDepartment: Record<string, {
    total: number;
    open: number;
    assigned: number;
    closed: number;
  }>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  staffPerformance: Array<{
    staffId: string;
    staffName: string;
    totalHandled: number;
    avgResolutionTime: string;
    currentAssigned: number;
  }>;
  escalationStats: {
    totalEscalated: number;
    byLevel: Record<number, number>;
  };
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  department?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  escalated?: boolean;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  timestamp: string;
  adminUser: {
    id: string;
    username: string;
    userRoles: string[];
    characterRoles: string[];
  };
  action: string;
  category: AuditCategory;
  target: AuditTarget;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'normal' | 'high' | 'critical';
}

export type AuditCategory = 
  | 'character_management'
  | 'user_management' 
  | 'location_management'
  | 'economy_management'
  | 'system_configuration'
  | 'ticket_management';

export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
}

// Pagination Types - imported from @shared/types/responses

// Statistics Summary Types
export interface ReviewStats {
  period: 'day' | 'week' | 'month' | 'year';
  stats: {
    totalReviewed: number;
    approved: number;
    rejected: number;
    changesRequested: number;
    approvalRate: number;
    avgReviewTime: string;
    byReviewer: ReviewerStats[];
    byCategory: Record<string, number>;
    commonRejectionReasons: Array<{
      reason: string;
      count: number;
    }>;
  };
}

export interface ReviewerStats {
  reviewerId: string;
  reviewerName: string;
  totalReviewed: number;
  approved: number;
  rejected: number;
  changesRequested: number;
  avgReviewTime: string;
}

export interface UserSummary {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  byUserRole: Record<string, number>;
  byCharacterRole: Record<string, number>;
}

export interface LocationActivity {
  visits: {
    totalVisits: number;
    uniqueVisitors: number;
    averageStayTime: string;
    peakHours: string[];
  };
  communication: {
    messagesExchanged: number;
    averageMessagesPerVisit: number;
    activeConversations: number;
    npcsActivated: number;
  };
  visitors: Array<{
    characterId: string;
    characterName: string;
    visitCount: number;
    totalTimeSpent: string;
    messagesPosted: number;
    lastVisit: string;
  }>;
  timeline: Array<{
    date: string;
    visits: number;
    messages: number;
    uniqueVisitors: number;
  }>;
}

// Document Management Types
export type DocumentType = 'ambientazione' | 'regolamento';
export type DocumentVisibility = 'pubblico' | 'ristretto' | 'spento';
export type DocumentStatus = 'draft' | 'published' | 'archived' | 'deleted';

export interface DocumentGroup {
  id: string;
  name: string;
  description?: string;
  type: DocumentType;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  groupId: string;
  group?: DocumentGroup;
  type: DocumentType;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  order: number;
  slug?: string;
  summary?: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastEditedBy?: string;
  version: number;
}

export interface CreateDocumentData {
  title: string;
  content: string;
  groupId: string;
  type: DocumentType;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  summary?: string;
  tags?: string[];
  order?: number;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  groupId?: string;
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
  summary?: string;
  tags?: string[];
  order?: number;
}

export interface CreateDocumentGroupData {
  name: string;
  description?: string;
  type: DocumentType;
  order?: number;
  isActive?: boolean;
}

export interface UpdateDocumentGroupData {
  name?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

export interface DocumentGroupWithDocuments extends DocumentGroup {
  documents: Document[];
}