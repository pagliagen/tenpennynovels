// TenpennyNovels Shared Types
// Common TypeScript types used across all applications

// ===== USER & AUTHENTICATION =====

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
  canAccessAdminPanel: boolean;
  // New granular permission system
  userRoles?: ('user' | 'gestore')[];
  characterRoles?: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions?: string[];
  createdAt: Date;
  lastLoginAt?: Date;
  characters: Character[];
}
 
export interface AuthTokens {
  authToken: string;
  characterContextToken?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  agreeToTerms: boolean;
  subscribeNewsletter?: boolean;
  referralCode?: string;
}

// ===== CHARACTER SYSTEM =====

export interface Character {
  id: string;
  name: string;
  userId: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  occupation: string;
  socialClass: 'working' | 'middle' | 'upper';
  gender: 'male' | 'female';
  age: number;
  currentLocationId: string;
  gameplayRoles: GameplayRole[];
  stats: CallOfCthulhuStats;
  skills: VictorianSkills;
  background: string;
  description: string;
  equipment: string[];
  money: CharacterMoney;
  connections: string[];
  personality: string;
  motivations: string[];
  fears: string[];
  secrets: string[];
  sanity: SanityData;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedReason?: string;
  lastActiveAt?: Date;
}

export interface CallOfCthulhuStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  appearance: number;
  power: number;
  size: number;
  education: number;
  social_status?: number;
}

export interface VictorianSkills {
  [skillName: string]: number;
}

export interface CharacterMoney {
  cash: number;      // Money carried
  deposit: number;   // Money in bank
}

export interface SanityData {
  current: number;
  maximum: number;
  indefiniteInsanity: boolean;
  phobias: string[];
  manias: string[];
}

export type GameplayRole = 'personaggio' | 'master' | 'moderatore' | 'gestore';

export interface CharacterCreationRequest {
  description: string;
  preferences?: CharacterPreferences;
  aiAssisted?: boolean;
}

export interface CharacterPreferences {
  gender?: 'male' | 'female';
  socialClass?: 'working' | 'middle' | 'upper';
  occupation?: string;
  ageRange?: 'young' | 'adult' | 'mature' | 'elderly';
  personality?: string;
  background?: string;
}

// ===== LOCATION SYSTEM =====

export interface Location {
  id: string;
  name: string;
  description: string;
  parentLocationId?: string;
  visible: boolean;
  chat: boolean;
  shop: boolean;
  private: boolean;
  ownerId?: string;        // For private character-owned locations
  corporationId?: string;  // For corporation-owned locations
  occupants: LocationOccupant[];
  items: LocationItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationOccupant {
  characterId: string;
  characterName: string;
  enteredAt: Date;
  lastActiveAt: Date;
}

export interface LocationItem {
  id: string;
  name: string;
  description: string;
  price?: number;
  prerequisites?: ItemPrerequisites;
  adminOnly: boolean;
}

export interface ItemPrerequisites {
  stats?: Partial<CallOfCthulhuStats>;
  skills?: Record<string, number>;
  occupation?: string[];
  corporation?: string[];
}

// ===== CORPORATION SYSTEM =====

export interface Corporation {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automatic' | 'mixed';
  membershipRules?: MembershipRule[];
  hierarchy: CorporationRole[];
  treasury: number;
  locations: string[];    // Location IDs owned by corporation
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRule {
  type: 'stat' | 'skill' | 'item' | 'occupation';
  requirement: string;
  operator: '>=' | '<=' | '=' | 'has';
  value: number | string;
}

export interface CorporationRole {
  id: string;
  name: string;
  level: number;          // Higher = more authority
  permissions: string[];
  salary?: number;        // Daily salary from corporation treasury
}

export interface CorporationMember {
  characterId: string;
  characterName: string;
  roleId: string;
  joinedAt: Date;
  approved: boolean;
  approvedBy?: string;
}

// ===== MESSAGING SYSTEM =====

export interface Message {
  id: string;
  type: 'letter' | 'telegram' | 'postcard' | 'invitation' | 'official';
  fromCharacterId: string;
  fromCharacterName: string;
  toCharacterIds: string[];
  toCharacterNames: string[];
  subject?: string;
  content: string;
  deliveryDate: Date;     // Victorian postal delivery simulation
  delivered: boolean;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  type: 'chat' | 'ooc' | 'master' | 'system' | 'dice';
  fromCharacterId?: string;
  fromCharacterName?: string;
  locationId: string;
  content: string;
  diceResult?: DiceResult;
  timestamp: Date;
  masterMessage?: boolean;
  moderatorMessage?: boolean;
}

export interface DiceResult {
  formula: string;
  result: number;
  details: string;
  success?: boolean;
  critical?: boolean;
  fumble?: boolean;
  targetNumber?: number;
}

// ===== ECONOMY SYSTEM =====

export interface Transaction {
  id: string;
  type: 'purchase' | 'sale' | 'transfer' | 'salary' | 'grant';
  fromCharacterId?: string;
  toCharacterId?: string;
  fromCharacterName?: string;
  toCharacterName?: string;
  amount: number;
  description: string;
  itemId?: string;
  itemName?: string;
  locationId?: string;
  corporationId?: string;
  timestamp: Date;
  processedBy?: string;   // Admin who processed it
}

export interface EconomyStats {
  totalMoney: number;
  totalCash: number;
  totalDeposits: number;
  dailyTransactions: number;
  topRichestCharacters: Array<{
    characterId: string;
    characterName: string;
    totalMoney: number;
  }>;
  corporationTreasuries: Array<{
    corporationId: string;
    corporationName: string;
    treasury: number;
  }>;
}

// ===== DOCUMENTS SYSTEM =====

export interface Document {
  id: string;
  title: string;
  content: string;        // Markdown content
  authorId: string;
  authorName: string;
  category: string;
  tags: string[];
  visibility: 'public' | 'authenticated' | 'role_restricted';
  allowedRoles?: string[];
  allowedCharacters?: string[];
  editable: boolean;
  versionHistory: DocumentVersion[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface DocumentVersion {
  id: string;
  content: string;
  changes: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  parentCategoryId?: string;
  permissions: {
    canView: string[];      // Roles that can view documents in this category
    canCreate: string[];    // Roles that can create documents in this category
    canEdit: string[];      // Roles that can edit documents in this category
  };
}

// ===== FORUM SYSTEM =====

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  position: number;
  visibility: 'public' | 'authenticated' | 'role_restricted';
  allowedRoles?: string[];
  canPost: string[];      // Roles that can create new topics
  canReply: string[];     // Roles that can reply to topics
  moderators: string[];   // User IDs who can moderate this category
  topicCount: number;
  postCount: number;
  lastActivity?: {
    topicId: string;
    topicTitle: string;
    authorName: string;
    timestamp: Date;
  };
}

export interface ForumTopic {
  id: string;
  categoryId: string;
  title: string;
  authorId: string;
  authorName: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  views: number;
  postCount: number;
  lastActivity: {
    postId: string;
    authorName: string;
    timestamp: Date;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumPost {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  content: string;        // Markdown content
  position: number;       // Position in topic (1-based)
  edited: boolean;
  editedAt?: Date;
  editedBy?: string;
  createdAt: Date;
}

// ===== NPC SYSTEM =====

export interface NPCProfile {
  id: string;
  name: string;
  description: string;
  occupation?: string;
  locationId: string;
  personality: string;
  background: string;
  appearance: string;
  motivations: string[];
  secrets: string[];
  relationships: Record<string, NPCRelationship>;
  activationRules: NPCActivationRule[];
  lastActiveAt?: Date;
  conversationCount: number;
}

export interface NPCRelationship {
  characterId: string;
  characterName: string;
  relationshipType: string;
  trustLevel: number;     // -100 to 100
  notes: string;
  lastInteractionAt: Date;
}

export interface NPCActivationRule {
  type: 'time' | 'topic' | 'character' | 'event';
  condition: string;
  priority: number;       // Higher = more likely to activate
}

export interface NPCInteraction {
  id: string;
  npcId: string;
  npcName: string;
  characterId: string;
  characterName: string;
  locationId: string;
  message: string;
  response: string;
  emotionalTone: string;
  memoryUpdates: string[];
  timestamp: Date;
}

// ===== API RESPONSE TYPES =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===== WEBSOCKET EVENTS =====

export interface WebSocketEvent<T = any> {
  type: string;
  data: T;
  timestamp: Date;
  userId?: string;
  characterId?: string;
  locationId?: string;
}

export interface ChatEvent {
  type: 'chat' | 'ooc' | 'dice' | 'system';
  message: ChatMessage;
}

export interface LocationEvent {
  type: 'enter' | 'leave' | 'occupants_update';
  locationId: string;
  character?: {
    id: string;
    name: string;
  };
  occupants?: LocationOccupant[];
}

export interface NotificationEvent {
  type: 'message' | 'approval' | 'system';
  title: string;
  content: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high';
}

// ===== FORM VALIDATION =====

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormErrors {
  [field: string]: string | undefined;
}

// ===== SEARCH & FILTERING =====

export interface SearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

// ===== AUDIT & LOGGING =====

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  userName: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface SystemStats {
  users: {
    total: number;
    online: number;
    newToday: number;
  };
  characters: {
    total: number;
    approved: number;
    pendingApproval: number;
  };
  locations: {
    total: number;
    withOccupants: number;
  };
  messages: {
    chatMessagesToday: number;
    inGameMessagesToday: number;
  };
  economy: EconomyStats;
}