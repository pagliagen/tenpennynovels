/**
 * Weapon Service
 *
 * Centralized weapon resolution for combat system.
 * Uses Redis caching to avoid N+1 queries during combat.
 *
 * Priority order:
 * 1. CharacterInventory.isEquipped flag (preferred)
 * 2. Character.equipment array (legacy fallback)
 * 3. Unarmed combat (no weapon found)
 */

import { Character } from '@core/character/models/Character';
import { CharacterInventory, Item } from '@features/oggetti/api';
import { redis } from '@config/runtime/redis';
import { logger } from '../logger';

interface WeaponStats {
  damageFormula: string;
  weaponType: string;
  skill: string;
  applyBonusDamage: boolean;
  halfBonusDamage: boolean;
}

export class WeaponService {
  private static CACHE_TTL = 300; // 5 minutes

  /**
   * Get equipped weapon stats for character
   * Returns null if no weapon equipped (unarmed combat)
   */
  static async getEquippedWeapon(characterId: string): Promise<WeaponStats | null> {
    try {
      // 1. Check Redis cache first
      const cacheKey = `weapon:equipped:${characterId}`;
      const cached = await redis.getClient().get(cacheKey);

      if (cached) {
        // Handle cached null (no weapon)
        if (cached === 'null') return null;
        return JSON.parse(cached);
      }

      // 2. Try CharacterInventory (preferred - has isEquipped flag)
      const inventory = await CharacterInventory.findOne({ characterId }).lean();

      if (inventory) {
        const equippedWeapon = inventory.items.find((item: any) => item.isEquipped);

        if (equippedWeapon) {
          const weapon = await Item.findById(equippedWeapon.itemId)
            .select('weaponStats category')
            .lean();

          if (weapon?.weaponStats && weapon.category === 'weapons') {
            const stats: WeaponStats = {
              damageFormula: weapon.weaponStats.damageFormula,
              weaponType: weapon.weaponStats.weaponType,
              skill: weapon.weaponStats.skill,
              applyBonusDamage: weapon.weaponStats.applyBonusDamage,
              halfBonusDamage: weapon.weaponStats.halfBonusDamage
            };

            // Cache for 5 minutes
            await redis.getClient().setEx(cacheKey, this.CACHE_TTL, JSON.stringify(stats));
            return stats;
          }
        }
      }

      // 3. Fallback: Character.equipment array (legacy support)
      const character = await Character.findById(characterId)
        .select('equipment')
        .lean();

      if (character?.equipment && character.equipment.length > 0) {
        // Find first weapon in equipment
        const weapons = await Item.find({
          _id: { $in: character.equipment },
          category: 'weapons'
        })
          .select('weaponStats')
          .lean();

        if (weapons.length > 0 && weapons[0].weaponStats) {
          const stats: WeaponStats = {
            damageFormula: weapons[0].weaponStats.damageFormula,
            weaponType: weapons[0].weaponStats.weaponType,
            skill: weapons[0].weaponStats.skill,
            applyBonusDamage: weapons[0].weaponStats.applyBonusDamage,
            halfBonusDamage: weapons[0].weaponStats.halfBonusDamage
          };

          await redis.getClient().setEx(cacheKey, this.CACHE_TTL, JSON.stringify(stats));
          return stats;
        }
      }

      // 4. No weapon found - cache null result to avoid repeated queries
      await redis.getClient().setEx(cacheKey, this.CACHE_TTL, 'null');
      return null;

    } catch (error) {
      logger.error('[WeaponService] Error getting equipped weapon:', error);
      return null; // Graceful degradation - return null on error
    }
  }

  /**
   * Invalidate weapon cache when character equips/unequips
   * Call this from inventory management endpoints
   */
  static async invalidateCache(characterId: string): Promise<void> {
    try {
      await redis.getClient().del(`weapon:equipped:${characterId}`);
      logger.debug(`[WeaponService] Cache invalidated for character ${characterId}`);
    } catch (error) {
      logger.error('[WeaponService] Failed to invalidate weapon cache:', error);
      // Non-critical error - don't throw
    }
  }
}
