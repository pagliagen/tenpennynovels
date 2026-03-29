/**
 * DeterministicRefiner — Post-generation cleanup (ZERO LLM calls).
 *
 * Replaces the old ResponseRefiner that used 1-2 LLM calls for self-critique.
 * All format checks are now deterministic. Content quality rules (character
 * consistency, emotional coherence, etc.) are enforced via the system prompt
 * in PromptBuilder instead of a separate LLM evaluation pass.
 */

import { applyFormatRules } from './ResponseFormatter';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('DeterministicRefiner');

export interface RefineOutput {
  response: string;
  wasRefined: boolean;
  issues: string[];
}

export function deterministicRefine(
  response: string,
  hasNarrativeStyle: boolean,
): RefineOutput {
  const issues: string[] = [];

  // Step 1: Format rules (newlines, brackets, preambles, whitespace)
  let current = applyFormatRules(response);
  const formatChanged = current !== response;
  if (formatChanged) issues.push('format_rules_applied');

  // Step 2: Length validation
  if (hasNarrativeStyle) {
    if (current.length < 350) {
      issues.push(`too_short:${current.length}`);
      logger.warn(`[Refiner] Response too short (${current.length} chars) for narrative style`);
    }
    if (current.length > 800) {
      issues.push(`too_long:${current.length}`);
      // Truncate at last sentence boundary before 700 chars
      const truncated = truncateAtSentence(current, 700);
      if (truncated !== current) {
        current = truncated;
        logger.info(`[Refiner] Truncated from ${response.length} to ${current.length} chars`);
      }
    }
  }

  // Step 3: Bracket validation — remove any remaining [*action*] patterns
  const bracketActions = current.match(/\[\*[^*]*\*\]/g);
  if (bracketActions) {
    issues.push('bracket_actions_found');
    current = current.replace(/\[\*([^*]*)\*\]/g, '*$1*');
  }

  // Step 4: Empty response guard
  if (current.trim().length === 0) {
    issues.push('empty_response');
    logger.error('[Refiner] Empty response after processing');
  }

  return {
    response: current,
    wasRefined: issues.length > 0,
    issues,
  };
}

function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Find last sentence-ending punctuation before maxChars
  const truncated = text.substring(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
    truncated.lastIndexOf('*'), // End of action block
  );

  if (lastPeriod > maxChars * 0.5) {
    return text.substring(0, lastPeriod + 1).trim();
  }

  // Fallback: cut at last space
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? text.substring(0, lastSpace).trim() : truncated.trim();
}
