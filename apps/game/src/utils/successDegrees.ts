/**
 * Utility functions for calculating success degrees in BRP system (Frontend)
 */

export type SuccessDegree = 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

export interface SuccessDegreeResult {
  degree: SuccessDegree;
  result: number;
  target: number;
}

/**
 * Calculate success degree for a d100 roll
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
  const extremeThreshold = Math.floor(targetValue * 0.25);
  const hardThreshold = Math.floor(targetValue * 0.50);
  
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
 * Get display text for success degree
 */
export function getSuccessDegreeLabel(degree: SuccessDegree): string {
  const labels: Record<SuccessDegree, string> = {
    critical: 'Successo Critico',
    extreme: 'Successo Estremo',
    hard: 'Successo Arduo',
    normal: 'Successo Normale',
    failure: 'Fallimento',
    fumble: 'Fallimento Critico'
  };
  return labels[degree];
}

/**
 * Get CSS class for success degree
 */
export function getSuccessDegreeClass(degree: SuccessDegree): string {
  const classes: Record<SuccessDegree, string> = {
    critical: 'success-critical',
    extreme: 'success-extreme',
    hard: 'success-hard',
    normal: 'success-normal',
    failure: 'failure',
    fumble: 'failure-critical'
  };
  return classes[degree];
}

