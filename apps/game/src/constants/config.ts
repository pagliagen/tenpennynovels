/**
 * Application Configuration Constants
 *
 * Centralizes all environment-dependent and app-wide configuration.
 * CRITICAL: All values must have fallbacks for development environments.
 *
 * @module constants/config
 * @since 2.0.0
 */

/**
 * API Configuration
 *
 * Configures HTTP client behavior including base URL, timeouts, and retry logic.
 *
 * @property {string} BASE_URL - API base URL (from env or default localhost:8000)
 * @property {number} TIMEOUT - Request timeout in milliseconds (30 seconds)
 * @property {number} RETRY_ATTEMPTS - Number of retry attempts for failed requests
 * @property {number} RETRY_DELAY - Initial delay between retries in milliseconds
 *
 * @constant
 * @since 2.0.0
 */
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

/**
 * WebSocket Configuration
 *
 * Configures WebSocket connection behavior including URL, reconnection, and ping intervals.
 *
 * @property {string} URL - WebSocket server URL (from env or default ws://localhost:8000)
 * @property {number} RECONNECT_INTERVAL - Time between reconnection attempts in milliseconds
 * @property {number} MAX_RECONNECT_ATTEMPTS - Maximum number of reconnection attempts
 * @property {number} PING_INTERVAL - Interval for keepalive pings in milliseconds
 *
 * @constant
 * @since 2.0.0
 */
export const WS_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
  PING_INTERVAL: 25000,
} as const;

/**
 * Authentication Configuration
 *
 * Configures authentication storage keys and session timeouts.
 *
 * @property {string} TOKEN_KEY - LocalStorage key for JWT access token
 * @property {string} REFRESH_TOKEN_KEY - LocalStorage key for refresh token
 * @property {string} USER_KEY - LocalStorage key for user data
 * @property {number} SESSION_TIMEOUT - Session timeout duration in milliseconds (1 hour)
 *
 * @constant
 * @since 2.0.0
 */
export const AUTH_CONFIG = {
  TOKEN_KEY: 'tpn_auth_token',
  REFRESH_TOKEN_KEY: 'tpn_refresh_token',
  USER_KEY: 'tpn_user',
  SESSION_TIMEOUT: 3600000,
} as const;

/**
 * UI Configuration
 *
 * Configures UI preferences storage and default values.
 *
 * @property {string} THEME_KEY - LocalStorage key for theme preference
 * @property {'victorian'} DEFAULT_THEME - Default theme name
 * @property {string} SIDEBAR_COLLAPSED_KEY - LocalStorage key for sidebar collapsed state
 *
 * @constant
 * @since 2.0.0
 */
export const UI_CONFIG = {
  THEME_KEY: 'tpn_theme',
  DEFAULT_THEME: 'victorian' as const,
  SIDEBAR_COLLAPSED_KEY: 'tpn_sidebar_collapsed',
} as const;

/**
 * Chat Configuration
 *
 * Configures chat behavior including pagination, typing indicators, and message limits.
 *
 * @property {number} MESSAGE_PAGE_SIZE - Number of messages to load per page
 * @property {number} TYPING_INDICATOR_TIMEOUT - Duration typing indicator stays visible (ms)
 * @property {number} TYPING_DEBOUNCE - Debounce delay for typing events (ms)
 * @property {number} MAX_MESSAGE_LENGTH - Maximum characters allowed in a message
 * @property {number} VIRTUAL_LIST_OVERSCAN - Number of items to render outside viewport for virtualization
 *
 * @constant
 * @since 2.0.0
 */
export const CHAT_CONFIG = {
  MESSAGE_PAGE_SIZE: 50,
  TYPING_INDICATOR_TIMEOUT: 3000,
  TYPING_DEBOUNCE: 500,
  MAX_MESSAGE_LENGTH: 5000,
  VIRTUAL_LIST_OVERSCAN: 5,
} as const;

/**
 * Presence Configuration
 *
 * Configures presence tracking behavior including update intervals and timeouts.
 *
 * @property {number} UPDATE_INTERVAL - Interval for presence updates in milliseconds (1 minute)
 * @property {number} IDLE_TIMEOUT - Time before marking user as idle (5 minutes)
 * @property {number} OFFLINE_TIMEOUT - Time before marking user as offline (3 minutes)
 *
 * @constant
 * @since 2.0.0
 */
export const PRESENCE_CONFIG = {
  UPDATE_INTERVAL: 60000,
  IDLE_TIMEOUT: 300000,
  OFFLINE_TIMEOUT: 180000,
} as const;

/**
 * Performance Configuration
 *
 * Configures performance optimization settings for images, lazy loading, and debouncing.
 *
 * @property {number} IMAGE_QUALITY - Image compression quality (0-100)
 * @property {number[]} IMAGE_SIZES - Responsive image breakpoints in pixels
 * @property {string} LAZY_LOAD_THRESHOLD - Distance from viewport to trigger lazy load
 * @property {number} DEBOUNCE_SEARCH - Debounce delay for search inputs (ms)
 * @property {number} THROTTLE_SCROLL - Throttle delay for scroll events (ms)
 *
 * @constant
 * @since 2.0.0
 */
export const PERF_CONFIG = {
  IMAGE_QUALITY: 80,
  IMAGE_SIZES: [640, 750, 828, 1080, 1200],
  LAZY_LOAD_THRESHOLD: '200px',
  DEBOUNCE_SEARCH: 300,
  THROTTLE_SCROLL: 100,
} as const;

/**
 * TanStack Query Configuration
 *
 * Configures React Query default behavior for caching and refetching.
 *
 * @property {number} STALE_TIME - Time before data is considered stale (5 minutes)
 * @property {number} CACHE_TIME - Time to keep unused data in cache (10 minutes)
 * @property {number} RETRY - Number of retry attempts for failed queries
 * @property {boolean} REFETCH_ON_WINDOW_FOCUS - Whether to refetch on window focus
 * @property {boolean} REFETCH_ON_RECONNECT - Whether to refetch on network reconnect
 *
 * @constant
 * @since 2.0.0
 */
export const QUERY_CONFIG = {
  STALE_TIME: 300000,
  CACHE_TIME: 600000,
  RETRY: 1,
  REFETCH_ON_WINDOW_FOCUS: true,
  REFETCH_ON_RECONNECT: true,
} as const;

/**
 * Application Routes
 *
 * Defines all application route paths with type-safe dynamic route builders.
 *
 * @property {string} HOME - Home page route
 * @property {string} LOGIN - Login page route
 * @property {string} REGISTER - Registration page route
 * @property {string} CHARACTER_SELECT - Character selection page route
 * @property {string} CHARACTER_CREATE - Character creation page route
 * @property {Function} LOCATION - Location page route builder
 * @property {string} CHAT - Chat page route
 * @property {string} MARKET - Market page route
 * @property {string} SETTINGS - Settings page route
 * @property {Function} PROFILE - Character profile page route builder
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // Static routes
 * router.push(ROUTES.HOME);
 * router.push(ROUTES.LOGIN);
 *
 * // Dynamic routes
 * router.push(ROUTES.LOCATION('507f1f77bcf86cd799439011'));
 * router.push(ROUTES.PROFILE(character._id));
 * ```
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CHARACTER_SELECT: '/characters',
  CHARACTER_CREATE: '/characters/create',
  LOCATION: (id: string) => `/locations/${id}`,
  CHAT: '/chat',
  MARKET: '/market',
  SETTINGS: '/settings',
  PROFILE: (id: string) => `/characters/${id}`,
} as const;

/**
 * Feature Flags
 *
 * Controls feature availability across the application.
 * Used for gradual rollout and A/B testing.
 *
 * @property {boolean} ENABLE_2FA - Two-factor authentication (not yet implemented)
 * @property {boolean} ENABLE_VOICE_CHAT - Voice chat feature (future)
 * @property {boolean} ENABLE_VIDEO_CHAT - Video chat feature (future)
 * @property {boolean} ENABLE_RICH_TEXT_EDITOR - Rich text editor for messages
 * @property {boolean} ENABLE_IMAGE_UPLOAD - Image upload in messages
 * @property {boolean} ENABLE_FILE_ATTACHMENTS - File attachments in messages (future)
 *
 * @constant
 * @since 2.0.0
 */
export const FEATURES = {
  ENABLE_2FA: false,
  ENABLE_VOICE_CHAT: false,
  ENABLE_VIDEO_CHAT: false,
  ENABLE_RICH_TEXT_EDITOR: true,
  ENABLE_IMAGE_UPLOAD: true,
  ENABLE_FILE_ATTACHMENTS: false,
} as const;
