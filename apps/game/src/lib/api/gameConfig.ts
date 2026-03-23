/**
 * Game Config API Service
 *
 * Fetches public game configuration from the backend
 * (combat tables, system constants, etc.).
 *
 * @module lib/api/gameConfig
 * @since 2.0.0
 */

import { api } from './client';

export interface DamageBonusEntry {
  min: number;
  max: number;
  bonus: string;
}

export interface CombatConfig {
  combat_damage_bonus_table: DamageBonusEntry[] | null;
  combat_unarmed_base_damage: string | null;
}

export const gameConfigApi = {
  /**
   * Get combat system configuration (bonus damage table, unarmed damage).
   * Public endpoint — no authentication required.
   */
  async getCombatConfig(): Promise<CombatConfig> {
    const response = await api.get<{ data: CombatConfig }>('/game/config/combat');
    return response.data;
  },
};
