/**
 * Utility functions for handling social conflicts (Frontend)
 */

import { SuccessDegree } from './successDegrees';

export interface SocialConflictResult {
  attackerWins: boolean;
  attackerRoll: number;
  defenderRoll: number;
  attackerSuccessDegree: SuccessDegree;
  defenderSuccessDegree: SuccessDegree;
  result: string;
  messageForAttacker?: string;
  messageForDefender?: string;
}

/**
 * Social skill pairs (attacker vs defender)
 */
export const SOCIAL_SKILL_PAIRS: Record<string, string> = {
  'Ammaliare': 'Autocontrollo',
  'Persuadere': 'Tempra',
  'Intimidire': 'Autocontrollo',
  'Oratoria': 'Tempra',
  'Raggirare': 'Empatia',
  'Empatia': 'Raggirare'
};

/**
 * Get the defensive skill for an attacking social skill
 */
export function getDefensiveSkill(attackerSkill: string): string | null {
  return SOCIAL_SKILL_PAIRS[attackerSkill] || null;
}

/**
 * Check if a skill pair is valid for social conflict
 */
export function isValidSocialSkillPair(attackerSkill: string, defenderSkill: string): boolean {
  return SOCIAL_SKILL_PAIRS[attackerSkill] === defenderSkill;
}

