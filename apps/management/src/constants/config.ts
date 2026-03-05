/**
 * Application configuration constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  WEBSOCKET_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
  LANDING_URL: process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000 // 1 second base delay (exponential backoff)
} as const;

// App Configuration
export const APP_CONFIG = {
  NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TenpennyNovels Management',
  VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
} as const;

// TanStack Query Configuration
export const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  RETRY: 3,
  REFETCH_ON_WINDOW_FOCUS: false
} as const;

// LocalStorage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  UI_PREFERENCES: 'ui_preferences',
  COLUMN_VISIBILITY_PREFIX: 'column_visibility_',
  VERSION: 'storage_version'
} as const;

// Storage Version (for migrations)
export const STORAGE_VERSION = '2.0.0';
