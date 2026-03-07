/**
 * Application Configuration
 *
 * Centralized configuration constants for Documents app.
 *
 * @module constants/config
 * @since 1.0.0
 */

/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000, // 1 second
} as const;

/**
 * App URLs
 */
export const APP_URLS = {
  LANDING: process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000',
  GAME: process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:4001',
  DOCUMENTS: 'http://localhost:4002', // Current app
  MANAGEMENT: process.env.NEXT_PUBLIC_MANAGEMENT_URL || 'http://localhost:4004',
} as const;

/**
 * Feature Flags
 */
export const FEATURES = {
  ENABLE_SEARCH: true,
  ENABLE_FAVORITES: true,
  ENABLE_SEMANTIC_SEARCH: true,
  ENABLE_DEBUG_PANEL: process.env.NODE_ENV === 'development',
} as const;

/**
 * TanStack Query Configuration
 */
export const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes (gcTime in v5)
  RETRY: 2,
  RETRY_DELAY: 1000,
  REFETCH_ON_WINDOW_FOCUS: false,
  REFETCH_ON_RECONNECT: true,
} as const;

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  DOCUMENTS_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  DOCUMENT_DETAIL_STALE_TIME: 10 * 60 * 1000, // 10 minutes
  SEARCH_STALE_TIME: 2 * 60 * 1000, // 2 minutes
  FAVORITES_STALE_TIME: 1 * 60 * 1000, // 1 minute
} as const;

/**
 * ISR Configuration
 */
export const ISR_CONFIG = {
  REVALIDATE_TIME: 3600, // 1 hour
  FALLBACK_MODE: 'blocking' as const,
} as const;
