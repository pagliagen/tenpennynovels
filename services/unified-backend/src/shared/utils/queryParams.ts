/**
 * Type-safe query parameter helpers
 *
 * Express allows duplicate query params which become arrays:
 * Example: GET /api?id=1&id=2 → req.query.id = ["1", "2"]
 *
 * These helpers safely extract values with proper typing.
 */

/**
 * Extract string from query param (takes first if array)
 */
export function getString(
  value: string | string[] | undefined,
  defaultValue = ''
): string {
  if (Array.isArray(value)) return value[0] || defaultValue;
  return value || defaultValue;
}

/**
 * Extract number from query param (parses first if array)
 */
export function getNumber(
  value: string | string[] | undefined,
  defaultValue = 0
): number {
  const str = getString(value);
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Extract string array from query param
 */
export function getStringArray(
  value: string | string[] | undefined
): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

/**
 * Extract boolean from query param
 */
export function getBoolean(
  value: string | string[] | undefined,
  defaultValue = false
): boolean {
  const str = getString(value).toLowerCase();
  if (str === 'true' || str === '1') return true;
  if (str === 'false' || str === '0') return false;
  return defaultValue;
}

/**
 * Extract optional string (undefined if not present)
 */
export function getOptionalString(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Extract optional number (undefined if not present or invalid)
 */
export function getOptionalNumber(
  value: string | string[] | undefined
): number | undefined {
  const str = getOptionalString(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}
