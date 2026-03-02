/**
 * Utility functions for handling social conflicts
 */

import { calculateSuccessDegree, compareSuccessDegrees, SuccessDegree } from './successDegrees';

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
 * Check if a skill pair is valid for social conflict
 */
export function isValidSocialSkillPair(attackerSkill: string, defenderSkill: string): boolean {
  return SOCIAL_SKILL_PAIRS[attackerSkill] === defenderSkill;
}

/**
 * Get the defensive skill for an attacking social skill
 */
export function getDefensiveSkill(attackerSkill: string): string | null {
  return SOCIAL_SKILL_PAIRS[attackerSkill] || null;
}

/**
 * Calculate social conflict result
 * @param attackerSkill Name of attacker's skill
 * @param attackerValue Attacker's skill value
 * @param attackerRoll Attacker's roll result
 * @param defenderSkill Name of defender's skill
 * @param defenderValue Defender's skill value
 * @param defenderRoll Defender's roll result
 * @param isHidden Whether this is a hidden roll (Raggirare)
 * @param lieText Optional text of the lie (for Raggirare)
 * @param attackerName Name of attacker character
 * @returns SocialConflictResult
 */
export function calculateSocialConflict(
  attackerSkill: string,
  attackerValue: number,
  attackerRoll: number,
  defenderSkill: string,
  defenderValue: number,
  defenderRoll: number,
  isHidden: boolean = false,
  lieText?: string,
  attackerName?: string
): SocialConflictResult {
  const attackerDegree = calculateSuccessDegree(attackerRoll, attackerValue).degree;
  const defenderDegree = calculateSuccessDegree(defenderRoll, defenderValue).degree;
  
  const comparison = compareSuccessDegrees(attackerDegree, defenderDegree, attackerRoll, defenderRoll);
  const attackerWins = comparison > 0;
  
  let result: string;
  let messageForAttacker: string | undefined;
  let messageForDefender: string | undefined;
  
  if (isHidden && attackerSkill === 'Raggirare') {
    // Hidden roll: attacker sees generic message
    messageForAttacker = 'Hai effettuato un tiro di Raggirare';
    
    if (attackerWins) {
      result = 'victory';
      messageForDefender = undefined; // Defender doesn't see anything if attacker wins
    } else {
      // Defender wins: calculate degree difference
      const degreeDiff = getDegreeDifference(defenderDegree, attackerDegree);
      
      if (degreeDiff >= 2 || defenderDegree === 'critical') {
        // Defender wins by 2+ degrees or critical: full detection
        result = 'full_detection';
        messageForDefender = `${attackerName || 'Qualcuno'} sta evidentemente cercando di nasconderti qualcosa quando dice "${lieText || 'questo'}"`;
      } else if (degreeDiff >= 1) {
        // Defender wins by 1 degree: suspicion
        result = 'suspicion';
        messageForDefender = `Ti rendi conto che ${attackerName || 'qualcuno'} ti sta nascondendo qualcosa`;
      } else {
        result = 'partial_detection';
        messageForDefender = `Ti rendi conto che ${attackerName || 'qualcuno'} ti sta nascondendo qualcosa`;
      }
    }
  } else {
    // Normal social conflict
    if (attackerWins) {
      result = 'victory';
      messageForAttacker = `Hai vinto lo scontro sociale usando ${attackerSkill}`;
      messageForDefender = `Hai perso lo scontro sociale contro ${attackerSkill}`;
    } else {
      result = 'defeat';
      messageForAttacker = `Hai perso lo scontro sociale usando ${attackerSkill}`;
      messageForDefender = `Hai resistito allo scontro sociale contro ${attackerSkill}`;
    }
  }
  
  return {
    attackerWins,
    attackerRoll,
    defenderRoll,
    attackerSuccessDegree: attackerDegree,
    defenderSuccessDegree: defenderDegree,
    result,
    messageForAttacker,
    messageForDefender
  };
}

/**
 * Get numeric difference between two success degrees
 */
function getDegreeDifference(degree1: SuccessDegree, degree2: SuccessDegree): number {
  const degreeOrder: SuccessDegree[] = ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble'];
  const index1 = degreeOrder.indexOf(degree1);
  const index2 = degreeOrder.indexOf(degree2);
  return Math.abs(index1 - index2);
}

