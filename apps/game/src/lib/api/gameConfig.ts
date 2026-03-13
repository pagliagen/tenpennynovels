/**
 * Game Config API Service
 *
 * Fetches public game configuration from the backend
 * (combat tables, system constants, etc.).
 *
 * @module lib/api/gameConfig
 * @since 2.0.0
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const GAME_API_URL = `${API_BASE_URL}/game`;

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
    const response = await axios.get(`${GAME_API_URL}/config/combat`, {
      withCredentials: true,
    });
    return response.data.data;
  },
};
