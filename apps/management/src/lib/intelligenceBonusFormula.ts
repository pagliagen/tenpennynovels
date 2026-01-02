/**
 * Formula Parser for Management Frontend
 *
 * Supports formulas like:
 * - Intelligence Bonus: INT/2, INTx2, INT+10, INT-5, constant:25
 * - Total Points: constant:200, formula:EDUx4, formula:EDUx2+INTx2, formula:EDUx4+200
 *   (Supports all Call of Cthulhu stats: EDU, INT, STR, DEX, CON, SIZ, APP, POW)
 */

/**
 * Parse and calculate intelligence bonus from formula
 * @param formula - Formula to calculate (e.g., "INT/2", "INTx2", "INT+10", "constant:25")
 * @param intelligenceValue - Intelligence stat value
 * @returns Calculated INT bonus (floored)
 */
export function calculateIntelligenceBonus(formula: string, intelligenceValue: number): number {
  if (!formula) return Math.floor(intelligenceValue / 2); // Default: INT/2

  // Constant formula: "constant:25"
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', '')) || 0;
    return Math.floor(value);
  }

  // Replace "x" with "*" for multiplication (user-friendly)
  let processedFormula = formula.replace(/x/gi, '*');

  // Replace "INT" with actual value
  processedFormula = processedFormula.replace(/INT/gi, intelligenceValue.toString());

  try {
    // Validate: Only allow numbers, +, -, *, /, (, ), ., spaces
    if (!/^[\d+\-*/().\s]+$/.test(processedFormula)) {
      console.error('Invalid formula characters detected:', formula);
      return Math.floor(intelligenceValue / 2); // Fallback
    }

    // Evaluate mathematical expression
    const result = eval(processedFormula);
    return Math.floor(result);
  } catch (error: any) {
    console.error('Error evaluating intelligence bonus formula:', formula, error);
    return Math.floor(intelligenceValue / 2); // Fallback to INT/2
  }
}

/**
 * Validate intelligence bonus formula
 * @param formula - Formula to validate
 * @returns Validation result with error message if invalid
 */
export function validateIntelligenceBonusFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: 'Formula vuota' };
  }

  // Check constant formula
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', ''));
    if (isNaN(value)) {
      return { valid: false, error: 'Costante non valida' };
    }
    return { valid: true };
  }

  // Check INT formula
  if (!formula.includes('INT')) {
    return { valid: false, error: 'Formula deve contenere "INT"' };
  }

  // Replace x with * and INT with 50 for test
  let testFormula = formula.replace(/x/gi, '*').replace(/INT/gi, '50');

  // Check for valid characters only
  if (!/^[\d+\-*/().\s]+$/.test(testFormula)) {
    return { valid: false, error: 'Caratteri non validi (solo +, -, x, /, (, ) permessi)' };
  }

  // Try to evaluate with test value
  try {
    eval(testFormula);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Formula non valida' };
  }
}

/**
 * Parse and calculate total skill points from formula
 * @param formula - Formula to calculate (e.g., "constant:200", "formula:EDUx4", "formula:EDUx2+INTx2")
 * @param stats - Character stats object with all characteristics
 * @returns Calculated total points (floored)
 */
export function calculateTotalPoints(
  formula: string,
  stats: { EDU?: number; INT?: number; STR?: number; DEX?: number; CON?: number; SIZ?: number; APP?: number; POW?: number }
): number {
  if (!formula) return 200; // Default: constant:200

  // Constant formula: "constant:200"
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', '')) || 200;
    return Math.floor(value);
  }

  // Formula-based: "formula:EDUx4", "formula:EDUx2+INTx2", "formula:EDUx4+200"
  if (formula.startsWith('formula:')) {
    const formulaStr = formula.replace('formula:', '');

    // First, replace all stat variables with actual values
    // Call of Cthulhu stats: STR, DEX, INT, CON, SIZ, APP, POW, EDU
    // IMPORTANT: Do this BEFORE replacing "x" to avoid breaking DEX (dexterity)
    let processedFormula = formulaStr;
    processedFormula = processedFormula.replace(/EDU/gi, (stats.EDU || 20).toString());
    processedFormula = processedFormula.replace(/INT/gi, (stats.INT || 50).toString());
    processedFormula = processedFormula.replace(/STR/gi, (stats.STR || 50).toString());
    processedFormula = processedFormula.replace(/DEX/gi, (stats.DEX || 50).toString());
    processedFormula = processedFormula.replace(/CON/gi, (stats.CON || 50).toString());
    processedFormula = processedFormula.replace(/SIZ/gi, (stats.SIZ || 50).toString());
    processedFormula = processedFormula.replace(/APP/gi, (stats.APP || 50).toString());
    processedFormula = processedFormula.replace(/POW/gi, (stats.POW || 50).toString());

    // Then replace "x" with "*" for multiplication (user-friendly)
    processedFormula = processedFormula.replace(/x/gi, '*');

    try {
      // Validate: Only allow numbers, +, -, *, /, (, ), ., spaces
      if (!/^[\d+\-*/().\s]+$/.test(processedFormula)) {
        console.error('Invalid formula characters detected:', formula);
        return 200; // Fallback
      }

      // Evaluate mathematical expression
      const result = eval(processedFormula);
      return Math.floor(result);
    } catch (error: any) {
      console.error('Error evaluating total points formula:', formula, error);
      return 200; // Fallback to constant:200
    }
  }

  return 200; // Default fallback
}

/**
 * Validate total points formula
 * @param formula - Formula to validate
 * @returns Validation result with error message if invalid
 */
export function validateTotalPointsFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: true }; // Empty is valid, will use default
  }

  // Check constant formula
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', ''));
    if (isNaN(value)) {
      return { valid: false, error: 'Costante non valida' };
    }
    return { valid: true };
  }

  // Check formula-based
  if (formula.startsWith('formula:')) {
    const formulaStr = formula.replace('formula:', '');

    // Must contain at least one stat variable (without word boundaries to support "EDUx2" format)
    const hasStatVar = /(EDU|INT|STR|DEX|CON|SIZ|APP|POW)/i.test(formulaStr);
    if (!hasStatVar) {
      return { valid: false, error: 'Formula deve contenere almeno una caratteristica (EDU, INT, STR, DEX, CON, SIZ, APP, POW)' };
    }

    // First replace all stat variables with test values for validation
    // IMPORTANT: Do this BEFORE replacing "x" to avoid breaking DEX (dexterity)
    let testFormula = formulaStr;
    testFormula = testFormula.replace(/EDU/gi, '20');
    testFormula = testFormula.replace(/INT/gi, '50');
    testFormula = testFormula.replace(/STR/gi, '50');
    testFormula = testFormula.replace(/DEX/gi, '50');
    testFormula = testFormula.replace(/CON/gi, '50');
    testFormula = testFormula.replace(/SIZ/gi, '50');
    testFormula = testFormula.replace(/APP/gi, '50');
    testFormula = testFormula.replace(/POW/gi, '50');

    // Then replace x with * for validation
    testFormula = testFormula.replace(/x/gi, '*');

    // Check for valid characters only
    if (!/^[\d+\-*/().\s]+$/.test(testFormula)) {
      return { valid: false, error: 'Caratteri non validi (solo +, -, x, /, (, ) permessi)' };
    }

    // Try to evaluate with test values
    try {
      eval(testFormula);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Formula non valida' };
    }
  }

  return { valid: false, error: 'Formula deve iniziare con "constant:" o "formula:"' };
}

// ====== DERIVED STATS CALCULATION (NEW SYSTEM) ======

/**
 * Character stats type matching database model
 */
export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  size: number;
  intelligence: number;
  education: number;
  power: number;
  charm: number;
}

/**
 * Derived stats result type
 */
export interface DerivedStats {
  ideaRoll: number;
  luckRoll: number;
  knowledge: number;
  hitPoints: number;
  sanityPoints: number;
  magicPoints: number;
  movementRate: number;
  damageBonus: string;
  build: number;
}

/**
 * Damage bonus table entry
 */
export interface DamageBonusEntry {
  maxTotal: number;
  bonus: string;
  build: number;
}

/**
 * Mapping of UPPERCASE abbreviations to database field names
 */
const STAT_MAP: Record<string, keyof CharacterStats> = {
  STR: 'strength',
  DEX: 'dexterity',
  CON: 'constitution',
  SIZ: 'size',
  INT: 'intelligence',
  EDU: 'education',
  POW: 'power',
  APP: 'charm'
};

/**
 * Preprocess formula: replace abbreviations and math functions
 * @param formula - Formula string with abbreviations (e.g., "FLOOR((CON + SIZ) / 10)")
 * @param stats - Character stats object
 * @returns Processed formula ready for eval
 */
function preprocessDerivedFormula(formula: string, stats: CharacterStats): string {
  let processed = formula;

  // 1. Replace abbreviations with actual stat values
  for (const [abbr, field] of Object.entries(STAT_MAP)) {
    const value = stats[field] || 50;
    processed = processed.replace(new RegExp(`\\b${abbr}\\b`, 'g'), value.toString());
  }

  // 2. Replace math functions with JavaScript equivalents
  processed = processed.replace(/FLOOR\s*\(/gi, 'Math.floor(');
  processed = processed.replace(/CEIL\s*\(/gi, 'Math.ceil(');
  processed = processed.replace(/ROUND\s*\(/gi, 'Math.round(');
  processed = processed.replace(/ABS\s*\(/gi, 'Math.abs(');
  processed = processed.replace(/MIN\s*\(/gi, 'Math.min(');
  processed = processed.replace(/MAX\s*\(/gi, 'Math.max(');

  // 3. Replace user-friendly operators
  processed = processed.replace(/x/gi, '*');

  return processed;
}

/**
 * Calculate derived stat from formula
 * @param formula - Formula to calculate (e.g., "FLOOR((CON + SIZ) / 10)", "POW", "constant:8")
 * @param stats - Character stats object
 * @returns Calculated value (floored)
 */
export function calculateDerivedStat(formula: string, stats: CharacterStats): number {
  if (!formula) return 0;

  // Handle constant formulas
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', '')) || 0;
    return Math.floor(value);
  }

  try {
    let processed = preprocessDerivedFormula(formula, stats);

    // Validate: only allow safe characters (including letters for Math.floor, Math.ceil, etc.)
    if (!/^[\da-zA-Z+\-*/().,<>=!&|\s]+$/.test(processed)) {
      console.error('Invalid formula characters detected in derived stat', {
        original: formula,
        processed
      });
      return 0;
    }

    const result = eval(processed);
    return typeof result === 'number' ? Math.floor(result) : 0;
  } catch (error: any) {
    console.error('Error evaluating derived stat formula', {
      formula,
      error: error.message
    });
    return 0;
  }
}

/**
 * Validate derived formula syntax
 * @param formula - Formula to validate
 * @returns Validation result with error message if invalid
 */
export function validateDerivedFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: 'Formula vuota' };
  }

  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', ''));
    if (isNaN(value)) {
      return { valid: false, error: 'Costante non valida' };
    }
    return { valid: true };
  }

  const hasStatVar = Object.keys(STAT_MAP).some(abbr => formula.includes(abbr));
  if (!hasStatVar) {
    return {
      valid: false,
      error: 'Formula deve contenere almeno una caratteristica (STR, DEX, CON, SIZ, INT, EDU, POW, APP)'
    };
  }

  const testStats: CharacterStats = {
    strength: 50, dexterity: 50, constitution: 50, size: 50,
    intelligence: 50, education: 50, power: 50, charm: 50
  };

  try {
    const processed = preprocessDerivedFormula(formula, testStats);
    if (!/^[\da-zA-Z+\-*/().,<>=!&|\s]+$/.test(processed)) {
      return {
        valid: false,
        error: 'Caratteri non validi (solo +, -, *, /, <, >, =, &, |, (, ) e funzioni matematiche permessi)'
      };
    }
    eval(processed);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Formula non valida o errore di sintassi' };
  }
}

/**
 * Calculate damage bonus and build from table
 * @param stats - Character stats object
 * @param table - Damage bonus table from config
 * @returns Damage bonus string and build number
 */
export function calculateDamageBonusTable(
  stats: CharacterStats,
  table: DamageBonusEntry[]
): { bonus: string; build: number } {
  const total = stats.strength + stats.size;

  for (const entry of table) {
    if (total <= entry.maxTotal) {
      return {
        bonus: entry.bonus,
        build: entry.build
      };
    }
  }

  const lastEntry = table[table.length - 1];
  return {
    bonus: lastEntry.bonus,
    build: lastEntry.build
  };
}

/**
 * Calculate all derived stats at once using config
 * @param stats - Character stats object
 * @param config - Character creation config with formulas
 * @returns All calculated derived stats
 */
export function calculateAllDerivedStats(
  stats: CharacterStats,
  config: any // Config type from management context
): DerivedStats {
  const formulas = config?.formulas?.derived || {};
  const damageTable = config?.formulas?.damageBonus || [];

  const damageData = calculateDamageBonusTable(stats, damageTable);

  return {
    ideaRoll: formulas.ideaRoll ? calculateDerivedStat(formulas.ideaRoll, stats) : stats.intelligence,
    luckRoll: formulas.luck ? calculateDerivedStat(formulas.luck, stats) : stats.power,
    knowledge: formulas.knowledge ? calculateDerivedStat(formulas.knowledge, stats) : stats.education,
    hitPoints: formulas.hitPoints
      ? calculateDerivedStat(formulas.hitPoints, stats)
      : Math.floor((stats.constitution + stats.size) / 10),
    sanityPoints: formulas.sanityPoints
      ? calculateDerivedStat(formulas.sanityPoints, stats)
      : stats.power,
    magicPoints: formulas.magicPoints
      ? calculateDerivedStat(formulas.magicPoints, stats)
      : Math.floor(stats.power / 5),
    movementRate: formulas.movementRate ? calculateDerivedStat(formulas.movementRate, stats) : 8,
    damageBonus: damageData.bonus,
    build: damageData.build
  };
}
