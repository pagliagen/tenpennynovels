import { Location, Character } from '@database/models';
import { logger } from '../logger';

export interface AccessibleLocation {
  _id: string;
  slug: string;
  name: string;
  description: string;
  district?: string;
  parentLocation?: string;
  imageUrl?: string;

  // Settings object
  settings: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private: boolean;
  };

  locationLevel: 'root' | 'district' | 'location';
  sortOrder: number;

  // Physical positions within location (for chat tags)
  positions?: string[];

  // Backward compatibility
  hasShop: boolean;
  hasChat: boolean;
  isPrivate: boolean;

  // Optional fields
  occupants: any[];
  children?: AccessibleLocation[];
}

export interface GlobalPresence {
  characterId: string;
  characterName: string;
  characterSurname: string | null;
  locationId: string;
  locationName: string;
  locationSlug: string;
  isCurrentCharacter: boolean;
  avatar: string | null;
}

export class LocationService {
  /**
   * Check if a character has access to a specific location
   */
  private static async checkLocationAccess(location: any, character: any): Promise<boolean> {
    // Handle missing settings (legacy locations)
    if (!location.settings) {
      return true; // Legacy locations are considered public and visible
    }

    // Public locations
    if (!location.settings.private && location.settings.visible) return true;

    // Private locations
    if (location.settings.private) {
      if (location.access?.ownerType === 'character' && location.access?.ownerId?.toString() === character.id) return true;
      
      // Check character-specific access
      if (location.access?.characterAccess) {
        const access = location.access.characterAccess.find((a: any) => a.characterId.toString() === character.id);
        if (access) {
          // Check if access is expired
          if (access.duration === 'temporary' && access.expiresAt && new Date() > access.expiresAt) {
            return false;
          }
          return access.permissions.includes('view');
        }
      }

      // Corporation membership - feature not yet implemented
    }

    return false;
  }

  /**
   * Get all accessible locations for a character with occupants data
   */
  static async getAccessibleLocations(characterId: string): Promise<AccessibleLocation[]> {
    try {
      // Get character
      const character = await Character.findById(characterId);
      if (!character) {
        throw new Error('Personaggio non trovato');
      }


      // Get all visible locations - handle both boolean and missing settings
      // EXCLUDE root locations (like London) - they are not directly accessible
      const allLocations = await Location.find({
        $and: [
          {
            $or: [
              { 'settings.visible': true },
              { 'settings.visible': { $exists: false } } // Legacy compatibility
            ]
          },
          { 'locationLevel': { $ne: 'root' } } // Exclude root locations (London)
        ]
      }).sort({ sortOrder: 1 });
      const accessibleLocations: AccessibleLocation[] = [];

      for (const location of allLocations) {
        const hasAccess = await LocationService.checkLocationAccess(location, character);
        if (hasAccess) {
          accessibleLocations.push({
            _id: location._id.toString(),
            slug: location.slug,
            name: location.name,
            description: location.description,
            district: location.district,
            parentLocation: location.parentLocation?.toString(),
            imageUrl: location.imageUrl,

            // Settings object (CRITICAL - frontend expects this)
            settings: {
              visible: location.settings?.visible ?? true,
              chat: location.settings?.chat ?? true,
              shop: location.settings?.shop ?? false,
              private: location.settings?.private ?? false
            },

            locationLevel: location.locationLevel,
            sortOrder: location.sortOrder,

            // Physical positions within location (for chat tags)
            positions: location.positions || [],

            // Backward compatibility (computed from settings)
            hasShop: location.settings?.shop || false,
            hasChat: location.settings?.chat || false,
            isPrivate: location.settings?.private || false,

            // Empty array for now (real-time data loaded separately)
            occupants: []
          });
        }
      }

      logger.debug('Retrieved accessible locations', {
        characterId,
        totalLocations: allLocations.length,
        accessibleCount: accessibleLocations.length
      });

      return accessibleLocations;

    } catch (error: any) {
      logger.error('Error getting accessible locations:', error);
      throw error;
    }
  }

  /**
   * Build hierarchical location tree from flat accessible locations list
   */
  static buildLocationTree(locations: AccessibleLocation[]): AccessibleLocation[] {
    const locationMap = new Map<string, AccessibleLocation>();
    const rootLocations: AccessibleLocation[] = [];

    // Create map for quick lookup
    locations.forEach(location => {
      locationMap.set(location._id, { ...location, children: [] });
    });

    // Build hierarchy
    locations.forEach(location => {
      const locationNode = locationMap.get(location._id)!;
      
      if (location.parentLocation && locationMap.has(location.parentLocation)) {
        // Add to parent's children
        const parent = locationMap.get(location.parentLocation)!;
        if (!parent.children) parent.children = [];
        parent.children.push(locationNode);
      } else {
        // Root level location
        rootLocations.push(locationNode);
      }
    });

    // Sort children by sortOrder
    const sortChildren = (nodes: AccessibleLocation[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(rootLocations);

    logger.debug('Built location tree', {
      totalLocations: locations.length,
      rootLocations: rootLocations.length
    });

    return rootLocations;
  }

  /**
   * Get global presence data (ALL recently active characters and their locations)
   * Shows all characters, even those in private locations (as "STANZA PRIVATA")
   * Only shows characters who have pinged in the last 30 seconds
   */
  static async getGlobalPresence(characterId: string): Promise<GlobalPresence[]> {
    try {
      // Get accessible locations for privacy filtering
      const accessibleLocations = await LocationService.getAccessibleLocations(characterId);
      const accessibleLocationIds = accessibleLocations.map(loc => loc._id);
      const globalPresence: GlobalPresence[] = [];

      // Activity timeout: 5 minutes (more generous for init data)
      const activityTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds
      const cutoffTime = new Date(Date.now() - activityTimeout);

      // Query ONLY recently active characters (use index scan, performance gain ~200×)
      // FIX: Removed `isInLocation` bug - characters with stale lastActive are now correctly excluded
      const recentCharacters = await Character.find({
        lastActive: { $gte: cutoffTime }
      }).select('id name surname currentLocation lastActive avatar');

      logger.debug(`[getGlobalPresence] Query returned ${recentCharacters.length} recently active characters`);

      // Check each character for inclusion in presence list
      for (const character of recentCharacters) {
        const isCurrentCharacter = character.id === characterId;

        let locationId: string;
        let locationName: string;
        let locationSlug: string;

        if (!character.currentLocation) {
          // Character has no location set (null) - this represents London/root state
          locationId = ''; // Empty string represents London in client-side logic
          locationName = 'London';
          locationSlug = '';
        } else {
          // Character has a specific location
          locationId = character.currentLocation.toString();

          if (accessibleLocationIds.includes(locationId)) {
            // User can see this location
            const location = accessibleLocations.find(loc => loc._id === locationId);
            locationName = location?.name || 'Unknown Location';
            locationSlug = location?.slug || '';
          } else {
            // User cannot see this location - show as private
            locationName = 'STANZA PRIVATA';
            locationSlug = '';
          }
        }

        globalPresence.push({
          characterId: character.id,
          characterName: character.name,
          characterSurname: character.surname || null,
          locationId: locationId,
          locationName: locationName,
          locationSlug: locationSlug,
          isCurrentCharacter: character.id === characterId,
          avatar: character.avatar || null
        });
      }

      logger.info('Retrieved global presence', {
        characterId,
        totalActiveCharacters: globalPresence.length,
        activityTimeoutMinutes: activityTimeout / (60 * 1000),
        totalCharactersChecked: recentCharacters.length,
        globalPresenceResult: globalPresence.map(gp => ({
          characterId: gp.characterId,
          characterName: gp.characterName,
          locationName: gp.locationName,
          isCurrentCharacter: gp.isCurrentCharacter
        }))
      });

      return globalPresence;

    } catch (error: any) {
      logger.error('Error getting global presence:', error);
      throw error;
    }
  }

  /**
   * Get combined location and presence data (used by /game/init)
   */
  static async getLocationAndPresenceData(characterId: string): Promise<{
    locations: AccessibleLocation[];
    globalPresence: GlobalPresence[];
  }> {
    try {
      // Run both operations in parallel for better performance
      const [locations, globalPresence] = await Promise.all([
        LocationService.getAccessibleLocations(characterId),
        LocationService.getGlobalPresence(characterId)
      ]);

      return {
        locations,
        globalPresence
      };

    } catch (error: any) {
      logger.error('Error getting location and presence data:', error);
      throw error;
    }
  }

  /**
   * Get location tree (hierarchical structure) for navigation
   */
  static async getLocationTree(characterId: string): Promise<AccessibleLocation[]> {
    try {
      const locations = await LocationService.getAccessibleLocations(characterId);
      return LocationService.buildLocationTree(locations);

    } catch (error: any) {
      logger.error('Error getting location tree:', error);
      throw error;
    }
  }
}