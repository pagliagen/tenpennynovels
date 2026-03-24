export function formatResponse(text: string): string {
  return applyFormatRules(text);
}

/**
 * Applies deterministic format corrections that don't require an LLM:
 * - Collapses newlines to a single space (enforces single-line output)
 * - Normalizes repeated whitespace
 * - Removes "Come [name]," / "As [name]," preambles added by small models
 */
export function applyFormatRules(text: string): string {
  let result = text.trim();
  // Collapse newlines to single space (enforce single-line)
  result = result.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Strip preambles added by small models ("Come X,", "As X,", "In qualità di X,")
  result = result.replace(/^(Come|As|In qualità di)\s+[^,]+,\s*/i, '');
  // Fix bracket-wrapped asterisk actions: [*azione*] → *azione*
  result = result.replace(/\[\*([^*]*)\*\]/g, '*$1*');
  result = result.replace(/\[(\*[^\]]*)\]/g, '$1');
  // Remove orphan opening/closing square brackets around action blocks
  result = result.replace(/\[(\*)/g, '$1').replace(/(\*)\]/g, '$1');
  // Normalize repeated asterisks: ** → single space then *
  result = result.replace(/\*\s*\*/g, '* *');
  // Remove "Nome: " prefix that some models add before acting
  result = result.replace(/^[A-ZÀ-Ü][a-zà-ü]+\s+[A-ZÀ-Ü][a-zà-ü]+:\s*/, '');
  return result;
}
