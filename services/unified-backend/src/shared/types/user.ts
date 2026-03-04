/**
 * Unified User Interfaces
 * Consolidates AuthUser, AdminUser, AdminUserProfile variants
 */

/**
 * Base user interface for authentication and basic user info
 * Replaces: AuthUser, AdminUser
 */
export interface BaseUser {
  userId: string;
  username: string;
  email: string;
  canAccessAdminPanel: boolean;
  // Granular permission system
  userRoles: ('user')[];
  characterRoles: ('personaggio' | 'master' | 'moderatore' | 'amministratore')[];
  characterPermissions: string[];
}

/**
 * Extended user profile for management interfaces
 * Replaces: AdminUserProfile
 */
export interface UserProfile extends BaseUser {
  id: string;  // Alias for userId for API consistency
  displayName?: string;
  avatar?: string;
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
  bannedUntil?: string;
  bannedBy?: string;
}

export interface UserCharacter {
  id: string;
  name: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  occupation: string;
  socialClass: string;
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

/**
 * User ban interface
 */
export interface UserBan {
  duration: 'temporary' | 'permanent';
  bannedUntil?: string;
  reason: string;
  publicReason: string;
  banScope: 'full' | 'chat_only' | 'game_only';
  notifyUser: boolean;
  evidence?: string[];
}

/**
 * Helper to convert BaseUser to UserProfile
 */
export const baseUserToProfile = (user: BaseUser, additional: Omit<UserProfile, keyof BaseUser>): UserProfile => ({
  ...user,
  ...additional
});