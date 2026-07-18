/**
 * Configuration loader with Zod validation
 */

import { TableConfig, TableConfigSchema } from './schemas';
import { logger } from '@/lib/logger';

/**
 * Load and validate table configuration from JSON
 */
export async function loadTableConfig(tableName: string): Promise<TableConfig> {
  try {
    // Fetch JSON config
    const response = await fetch(`/config/tables/${tableName}.json`);

    if (!response.ok) {
      throw new Error(`Failed to load config for table "${tableName}": ${response.statusText}`);
    }

    const data = await response.json();

    // Validate with Zod
    const validationResult = TableConfigSchema.safeParse(data);

    if (!validationResult.success) {
      logger.error(`Invalid table config for "${tableName}":`, { value: validationResult.error.format() });
      throw new Error(`Invalid configuration for table "${tableName}"`);
    }

    return validationResult.data;
  } catch (error) {
    logger.error(`Error loading table config for "${tableName}":`, { error });
    throw error;
  }
}

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue(user, 'activity.lastLoginAt')
 */
export function getNestedValue<T = unknown>(
  obj: object,
  path: string
): T | undefined {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown) as T | undefined;
}

/**
 * Set nested value in object using dot notation
 * Example: setNestedValue(user, 'activity.lastLoginAt', new Date())
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return obj;

  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key] as Record<string, unknown>;
  }, obj);

  target[lastKey] = value;

  return obj;
}

/**
 * Interpolate template string with data
 * Example: interpolateTemplate('Edit User: {username}', { username: 'john' }) => 'Edit User: john'
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = getNestedValue(data, key.trim());
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Resolve conditional value
 * Example: resolveConditionalValue({ type: 'conditional', field: 'isActive', trueValue: 'Active', falseValue: 'Inactive' }, user)
 */
export function resolveConditionalValue(
  config: {
    type?: string;
    field?: string;
    trueValue?: string;
    falseValue?: string;
  },
  data: Record<string, unknown>
): string | undefined {
  if (config.type === 'conditional' && config.field) {
    const value = getNestedValue(data, config.field);
    return value ? (config.trueValue || String(value)) : (config.falseValue || '');
  }

  return undefined;
}
