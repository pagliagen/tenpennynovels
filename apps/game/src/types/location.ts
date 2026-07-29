/**
 * Location Types
 *
 * Frontend types for the locations/map system.
 * Based on backend ILocation interface but simplified for frontend needs.
 *
 * @module types/location
 * @since 2.0.0
 */

/**
 * Location Settings (control switches)
 */
export interface LocationSettings {
  visible: boolean;    // Location appears in navigation
  chat: boolean;       // Chat functionality available
  shop: boolean;       // Commerce/trading functionality
  private: boolean;    // Access control system activated
}

/**
 * Location Occupant (real-time presence)
 */
export interface LocationOccupant {
  characterId: string;
  characterName: string;
  enteredAt: string;
  lastSeen: string;
  isActive: boolean;
  currentTag?: string; // Position tag (e.g., "Tavolo", "Bancone del Bar")
}

/**
 * Location Statistics
 */
export interface LocationStatistics {
  totalVisits: number;
  uniqueVisitors: number;
  averageStayTime: number; // in minutes
  messagesExchanged: number;
  lastActivityAt?: string;
  peakHours: string[];
}

/**
 * Accessible Location (frontend representation)
 *
 * This is the main location type used throughout the frontend.
 * Includes only data accessible to the current character.
 */
export interface AccessibleLocation {
  // Basic info
  _id: string;
  name: string;
  slug: string;
  description: string;
  district: string;
  parentLocation?: string;
  imageUrl?: string;
  image?: string; // Filename statico in /artifacts/locations/, fallback quando imageUrl non è definito
  descriptionImages?: string[]; // URL immagini mostrate accanto alla descrizione nel popup info location

  // Settings (may not be returned by backend)
  settings?: LocationSettings;

  // Hierarchy
  locationLevel: 'root' | 'district' | 'location';
  sortOrder: number;

  // Real-time data
  occupants: LocationOccupant[];
  occupantCount?: number; // Computed field for quick access

  // Statistics (may not be returned by backend)
  statistics?: LocationStatistics;

  // Features
  hasChat: boolean;    // Computed from settings.chat
  hasShop: boolean;    // Computed from settings.shop
  isPrivate: boolean;  // Computed from settings.private

  // Physical positions within location (for chat position tags + location info popup)
  positions?: Array<{ name: string; description?: string; image?: string }>;

  // Tree structure (computed on frontend)
  children?: AccessibleLocation[];
  depth?: number; // Tree depth for styling/indentation

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Location Tree Node (for recursive rendering)
 *
 * Extended version of AccessibleLocation with tree-specific metadata.
 */
export interface LocationTreeNode extends AccessibleLocation {
  children: LocationTreeNode[];
  depth: number;
  isExpanded?: boolean;
  isSelected?: boolean;
  hasChildren: boolean;
}

/**
 * Map Coordinates for Districts
 */
export interface DistrictCoordinates {
  polygon: string; // SVG polygon points (percentage-based)
  center: { x: number; y: number }; // Tooltip position
}

/**
 * Location API Response Types
 */
export interface LocationsResponse {
  locations: AccessibleLocation[];
  totalCount: number;
}

export interface LocationTreeResponse {
  tree: AccessibleLocation[];
}

export interface LocationDetailResponse {
  location: AccessibleLocation;
}

/**
 * Root Location (London) — excluded from AccessibleLocation lists since it's
 * not enterable as a normal location, but still needed by the topbar as the
 * default "no currentLocation" state.
 */
export interface RootLocation {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  positions?: Array<{ name: string; description?: string; image?: string }>;
  descriptionImages?: string[];
}

export interface RootLocationResponse {
  rootLocation: RootLocation;
}
