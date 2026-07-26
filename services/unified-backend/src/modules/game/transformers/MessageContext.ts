/**
 * Message Context - Request-Scoped Cache
 *
 * Prevents N+1 queries by caching Character, Skill, and Item documents
 * within a single request. Similar to DataLoader pattern but simpler.
 *
 * Usage:
 * ```
 * const context = new MessageContext();
 * await context.preloadSkills(['skill1', 'skill2']); // Batch load
 * const skill = await context.getSkill('skill1'); // Returns cached
 * ```
 *
 * @module transformers/MessageContext
 * @since 2.2.0
 */

import { Character, Skill, Item } from '@database/models';
import { logger } from '@shared/utils/logger';

/**
 * Request-scoped cache to avoid N+1 queries
 */
export class MessageContext {
  private characters: Map<string, any> = new Map();
  private skills: Map<string, any> = new Map();
  private items: Map<string, any> = new Map();

  /** Whether the character requesting these messages is a master — editHistory is master-only. */
  public readonly isViewerMaster: boolean;

  constructor(isViewerMaster: boolean = false) {
    this.isViewerMaster = isViewerMaster;
  }

  /**
   * Get character by ID (cached)
   */
  async getCharacter(id: string): Promise<any | null> {
    if (this.characters.has(id)) {
      return this.characters.get(id)!;
    }

    try {
      const character = await Character.findById(id).lean();
      if (character) {
        this.characters.set(id, character);
      }
      return character;
    } catch (error) {
      logger.warn(`[MessageContext] Failed to fetch character: ${id}`, error);
      return null;
    }
  }

  /**
   * Get skill by ID (cached)
   */
  async getSkill(id: string): Promise<any | null> {
    if (this.skills.has(id)) {
      return this.skills.get(id)!;
    }

    try {
      const skill = await Skill.findById(id).lean();
      if (skill) {
        this.skills.set(id, skill);
      }
      return skill;
    } catch (error) {
      logger.warn(`[MessageContext] Failed to fetch skill: ${id}`, error);
      return null;
    }
  }

  /**
   * Get item by ID (cached)
   */
  async getItem(id: string): Promise<any | null> {
    if (this.items.has(id)) {
      return this.items.get(id)!;
    }

    try {
      const item = await Item.findById(id).lean();
      if (item) {
        this.items.set(id, item);
      }
      return item;
    } catch (error) {
      logger.warn(`[MessageContext] Failed to fetch item: ${id}`, error);
      return null;
    }
  }

  /**
   * Batch preload characters
   * Call this BEFORE transforming messages to avoid N+1
   *
   * @param ids - Array of character IDs to preload
   */
  async preloadCharacters(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const missingIds = uniqueIds.filter((id) => !this.characters.has(id));

    if (missingIds.length === 0) return;

    try {
      const characters = await Character.find({ _id: { $in: missingIds } }).lean();
      for (const char of characters) {
        this.characters.set(char._id.toString(), char);
      }

      logger.debug(`[MessageContext] Preloaded ${characters.length} characters`);
    } catch (error) {
      logger.error('[MessageContext] Failed to preload characters', error);
    }
  }

  /**
   * Batch preload skills
   *
   * @param ids - Array of skill IDs to preload
   */
  async preloadSkills(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const missingIds = uniqueIds.filter((id) => !this.skills.has(id));

    if (missingIds.length === 0) return;

    try {
      const skills = await Skill.find({ _id: { $in: missingIds } }).lean();
      for (const skill of skills) {
        this.skills.set(skill._id.toString(), skill);
      }

      logger.debug(`[MessageContext] Preloaded ${skills.length} skills`);
    } catch (error) {
      logger.error('[MessageContext] Failed to preload skills', error);
    }
  }

  /**
   * Batch preload items
   *
   * @param ids - Array of item IDs to preload
   */
  async preloadItems(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const missingIds = uniqueIds.filter((id) => !this.items.has(id));

    if (missingIds.length === 0) return;

    try {
      const items = await Item.find({ _id: { $in: missingIds } }).lean();
      for (const item of items) {
        this.items.set(item._id.toString(), item);
      }

      logger.debug(`[MessageContext] Preloaded ${items.length} items`);
    } catch (error) {
      logger.error('[MessageContext] Failed to preload items', error);
    }
  }

  /**
   * Get cache statistics (for testing/debugging)
   */
  getStats(): {
    characters: number;
    skills: number;
    items: number;
  } {
    return {
      characters: this.characters.size,
      skills: this.skills.size,
      items: this.items.size,
    };
  }

  /**
   * Clear all caches (for testing)
   */
  clear(): void {
    this.characters.clear();
    this.skills.clear();
    this.items.clear();
  }
}
