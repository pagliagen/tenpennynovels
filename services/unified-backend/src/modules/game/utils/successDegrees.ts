/**
 * Utility functions for calculating success degrees in BRP system
 */

export type SuccessDegree = 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

export interface SuccessDegreeResult {
  degree: SuccessDegree;
  result: number;
  target: number;
}

/**
 * Calculate success degree for a d100 roll
 * @param rollResult The result of the dice roll (1-100)
 * @param targetValue The target value (skill/stat value)
 * @returns SuccessDegreeResult with degree and details
 */
export function calculateSuccessDegree(rollResult: number, targetValue: number): SuccessDegreeResult {
  // Critical success (01) or critical failure (100)
  if (rollResult === 1) {
    return {
      degree: 'critical',
      result: rollResult,
      target: targetValue
    };
  }
  
  if (rollResult === 100) {
    return {
      degree: 'fumble',
      result: rollResult,
      target: targetValue
    };
  }
  
  // Check if it's a success or failure
  if (rollResult > targetValue) {
    return {
      degree: 'failure',
      result: rollResult,
      target: targetValue
    };
  }
  
  // Calculate success degrees
  const extremeThreshold = Math.floor(targetValue * 0.20); // 1/5 (Call of Cthulhu standard)
  const hardThreshold = Math.floor(targetValue * 0.50); // 1/2
  
  if (rollResult <= extremeThreshold) {
    return {
      degree: 'extreme',
      result: rollResult,
      target: targetValue
    };
  }
  
  if (rollResult <= hardThreshold) {
    return {
      degree: 'hard',
      result: rollResult,
      target: targetValue
    };
  }
  
  return {
    degree: 'normal',
    result: rollResult,
    target: targetValue
  };
}

/**
 * Compare two success degrees to determine winner in opposed rolls
 * @param degree1 First success degree
 * @param degree2 Second success degree
 * @param result1 First roll result (for tie-breaking)
 * @param result2 Second roll result (for tie-breaking)
 * @returns 1 if first wins, -1 if second wins, 0 if tie
 */
export function compareSuccessDegrees(
  degree1: SuccessDegree,
  degree2: SuccessDegree,
  result1: number,
  result2: number
): number {
  // Critical beats everything except another critical
  if (degree1 === 'critical' && degree2 !== 'critical') return 1;
  if (degree2 === 'critical' && degree1 !== 'critical') return -1;
  
  // Failure beats nothing (except other failures)
  if (degree1 === 'failure' || degree1 === 'fumble') {
    if (degree2 === 'failure' || degree2 === 'fumble') {
      // Both failures: lower result wins (closer to success)
      return result1 < result2 ? 1 : result1 > result2 ? -1 : 0;
    }
    return -1; // First is failure, second is success
  }
  
  if (degree2 === 'failure' || degree2 === 'fumble') {
    return 1; // Second is failure, first is success
  }
  
  // Both are successes, compare degrees
  const degreeOrder: SuccessDegree[] = ['critical', 'extreme', 'hard', 'normal'];
  const index1 = degreeOrder.indexOf(degree1);
  const index2 = degreeOrder.indexOf(degree2);
  
  if (index1 < index2) return 1; // First has better degree
  if (index1 > index2) return -1; // Second has better degree
  
  // Same degree: lower result wins
  return result1 < result2 ? 1 : result1 > result2 ? -1 : 0;
}

/**
 * Get display text for success degree
 */
export function getSuccessDegreeLabel(degree: SuccessDegree): string {
  const labels: Record<SuccessDegree, string> = {
    critical: 'Successo Critico',
    extreme: 'Successo Estremo',
    hard: 'Successo Difficile',
    normal: 'Successo',
    failure: 'Fallimento',
    fumble: 'Fallimento Critico'
  };
  return labels[degree];
}

