export function formatResponse(text: string): string {
  let formatted = text.trim();
  formatted = formatted.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Remove any "As [character name]," preamble that smaller models sometimes add
  formatted = formatted.replace(/^(Come|As|In qualità di)\s+[^,]+,\s*/i, '');

  return formatted;
}
