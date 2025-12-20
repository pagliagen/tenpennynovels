export interface Location {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null; // null for root
  children: Location[];
  
  // Location type
  type: 'root' | 'city' | 'district' | 'location';
  
  // Location control switches
  switches: {
    visible: boolean;     // Location appears in navigation
    chat: boolean;        // Chat functionality available
    shop: boolean;        // Commerce/trading functionality
    private: boolean;     // Access control system activated
  };
  
  // Private location settings (when switches.private = true)
  privateSettings?: {
    type: 'character_owned' | 'corporation' | 'custom';
    ownerId?: string;     // Character ID for character-owned locations
    corporationId?: string; // Corporation ID for corporation locations
    permissions: LocationPermission[];
  };
  
  // General settings
  maxOccupancy?: number; // null = unlimited
  
  // Victorian atmosphere
  atmosphere: string; // Rich description for immersion
  timeOfDay?: 'day' | 'night' | 'both'; // When accessible
  
  // NPC Bot assignments
  assignedNPCs: string[]; // NPC Bot IDs assigned to this location
  activeNPCId?: string; // Currently active NPC ID (only one can be active at a time)
  
  // Turn-based chat settings
  turnBasedChat: boolean; // Enable turn-based conversation mode
  turnSettings?: {
    maxTurnTime: number; // Seconds per turn
    allowNPCTurns: boolean; // NPCs can take turns
    turnOrder: 'free' | 'sequential' | 'structured'; // How turns are managed
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationPermission {
  id: string;
  locationId: string;
  
  // Permission target
  targetType: 'character' | 'corporation' | 'role';
  targetId: string; // Character ID, Corporation ID, or Role name
  
  // Permission details
  permissionType: 'view_only' | 'chat_access' | 'full_access';
  
  // Duration
  durationType: 'permanent' | 'limited';
  expiresAt?: Date; // For limited permissions
  
  // Grant details
  grantedBy: string; // Character ID who granted permission
  grantedAt: Date;
  
  // Status
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: string; // Character ID who revoked permission
}

export interface LocationAccessCheck {
  characterId: string;
  locationId: string;
  requestedAccess: 'view' | 'enter' | 'chat' | 'shop';
  hasAccess: boolean;
  reason?: string; // Reason for denial
}

export interface CorporationLocationRule {
  corporationId: string;
  locationId: string;
  minimumRole: string; // Minimum role required
  allowedRoles: string[]; // Specific roles allowed
  restrictions?: {
    timeRestrictions?: string; // e.g., "business_hours_only"
    maxSimultaneousAccess?: number;
  };
}

export interface LocationTree {
  london: Location & {
    districts: (Location & {
      locations: Location[];
    })[];
  };
}

// Example London structure
export const LONDON_DISTRICTS = [
  'Westminster',
  'Whitechapel', 
  'Mayfair',
  'Southwark',
  'Camden',
  'Greenwich',
  'Kensington',
  'Bloomsbury'
] as const;

export type LondonDistrict = typeof LONDON_DISTRICTS[number];

export interface LocationPath {
  city: string;
  district: string;
  location: string;
}

export interface LocationOccupancy {
  locationId: string;
  currentOccupants: {
    characterId: string;
    characterName: string;
    joinedAt: Date;
  }[];
  maxOccupancy?: number;
}