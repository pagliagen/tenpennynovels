/**
 * Zod Schemas for API Validation
 *
 * CRITICAL: All API responses must be validated through these schemas.
 *
 * Benefits:
 * - Runtime type safety: validates data shape at runtime
 * - Type inference: TypeScript types automatically inferred from schemas
 * - Validation errors: caught immediately with detailed error messages
 * - Self-documenting: schemas serve as API contract documentation
 *
 * @module types/api/schemas
 * @since 2.0.0
 */

import { z } from 'zod';

/**
 * MongoDB ObjectId Schema
 *
 * Validates 24-character hexadecimal MongoDB ObjectId strings.
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * MongoIdSchema.parse('507f1f77bcf86cd799439011'); // Valid
 * MongoIdSchema.parse('invalid'); // Throws validation error
 * ```
 */
export const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

/**
 * Timestamp Schema
 *
 * Standard timestamp fields present in all database models.
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const timestamps = {
 *   createdAt: '2024-01-01T00:00:00.000Z',
 *   updatedAt: '2024-01-01T00:00:00.000Z'
 * };
 * TimestampSchema.parse(timestamps);
 * ```
 */
export const TimestampSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Pagination Metadata Schema
 *
 * Standard pagination information for paginated API responses.
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const pagination = {
 *   page: 1,
 *   limit: 50,
 *   total: 234,
 *   totalPages: 5
 * };
 * PaginationSchema.parse(pagination);
 * ```
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

/**
 * Paginated Response Schema Factory
 *
 * Creates a schema for paginated API responses with typed data array.
 *
 * @template T - Zod schema type for individual items
 * @param {T} itemSchema - Schema for items in the data array
 * @returns {z.ZodObject} Schema for paginated response
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const PaginatedUsersSchema = PaginatedResponseSchema(UserSchema);
 * type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>;
 * // { data: User[], pagination: Pagination }
 * ```
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });

/**
 * User Schema
 *
 * Represents a registered user account in the system.
 * Users can have multiple characters across different campaigns.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} _id - MongoDB ObjectId
 * @property {string} username - Unique username (3-20 characters)
 * @property {string} email - Email address (must be valid email format)
 * @property {boolean} isEmailVerified - Whether email has been verified
 * @property {'player' | 'moderator' | 'admin'} role - User role for permissions
 * @property {'active' | 'suspended' | 'banned'} status - Account status
 * @property {string | null} lastLoginAt - Last login timestamp (ISO 8601)
 * @property {string} createdAt - Account creation timestamp (ISO 8601)
 * @property {string} updatedAt - Last update timestamp (ISO 8601)
 *
 * @example
 * ```typescript
 * const user: User = {
 *   _id: '507f1f77bcf86cd799439011',
 *   username: 'john_watson',
 *   email: 'john@example.com',
 *   isEmailVerified: true,
 *   role: 'player',
 *   status: 'active',
 *   lastLoginAt: '2024-01-15T10:30:00.000Z',
 *   createdAt: '2024-01-01T00:00:00.000Z',
 *   updatedAt: '2024-01-15T10:30:00.000Z'
 * };
 * ```
 */
export const UserSchema = z.object({
  _id: MongoIdSchema,
  username: z.string().min(3).max(20),
  email: z.string().email(),
  isEmailVerified: z.boolean(),
  role: z.enum(['player', 'moderator', 'admin']),
  status: z.enum(['active', 'suspended', 'banned']),
  canAccessAdminPanel: z.boolean().optional(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * User type inferred from UserSchema
 *
 * @since 2.0.0
 */
export type User = z.infer<typeof UserSchema>;

/**
 * Auth Response Schema
 *
 * Response returned after successful login or registration.
 * Contains JWT tokens and user data.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} token - JWT access token (short-lived)
 * @property {string} [refreshToken] - JWT refresh token (long-lived, optional)
 * @property {User} user - User account data
 *
 * @example
 * ```typescript
 * const response: AuthResponse = {
 *   token: 'eyJhbGciOiJIUzI1NiIs...',
 *   refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
 *   user: { ...userData }
 * };
 * ```
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  user: UserSchema,
});

/**
 * AuthResponse type inferred from AuthResponseSchema
 *
 * @since 2.0.0
 */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Character Stats Schema
 *
 * Six core attributes for character abilities (D&D-inspired).
 * Each stat ranges from 1 to 20.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {number} strength - Physical power (1-20)
 * @property {number} dexterity - Agility and reflexes (1-20)
 * @property {number} constitution - Endurance and health (1-20)
 * @property {number} intelligence - Reasoning and memory (1-20)
 * @property {number} wisdom - Awareness and insight (1-20)
 * @property {number} charisma - Force of personality (1-20)
 *
 * @example
 * ```typescript
 * const stats: CharacterStats = {
 *   strength: 14,
 *   dexterity: 12,
 *   constitution: 16,
 *   intelligence: 10,
 *   wisdom: 8,
 *   charisma: 15
 * };
 * ```
 */
export const CharacterStatsSchema = z.object({
  strength: z.number().int().min(1).max(20),
  dexterity: z.number().int().min(1).max(20),
  constitution: z.number().int().min(1).max(20),
  intelligence: z.number().int().min(1).max(20),
  wisdom: z.number().int().min(1).max(20),
  charisma: z.number().int().min(1).max(20),
});

/**
 * Character Schema
 *
 * Represents a player character in a Victorian-era roleplay campaign.
 * Characters are tied to a specific user and campaign.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} _id - MongoDB ObjectId
 * @property {string} userId - Owner's user ID
 * @property {string} campaignId - Campaign this character belongs to
 * @property {string} name - Character name (2-50 characters)
 * @property {string | null} title - Optional title (e.g., "Lord", "Doctor")
 * @property {number} age - Character age (1-120)
 * @property {'male' | 'female' | 'other'} gender - Character gender
 * @property {string} occupation - Character's profession
 * @property {'lower' | 'middle' | 'upper' | 'nobility'} socialClass - Victorian social class
 * @property {string} appearance - Physical description (max 1000 chars)
 * @property {string} personality - Personality traits (max 1000 chars)
 * @property {string} background - Character backstory (max 2000 chars)
 * @property {CharacterStats} stats - Character attributes
 * @property {string | null} avatar - Character avatar image URL (optional)
 * @property {'active' | 'inactive' | 'deceased' | 'pending'} status - Character status
 * @property {boolean} isOnline - Whether player is currently online
 * @property {string | null} lastSeenAt - Last activity timestamp
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 *
 * @example
 * ```typescript
 * const character: Character = {
 *   _id: '507f1f77bcf86cd799439011',
 *   userId: '507f1f77bcf86cd799439012',
 *   campaignId: '507f1f77bcf86cd799439013',
 *   name: 'Sherlock Holmes',
 *   title: 'Mr.',
 *   age: 34,
 *   gender: 'male',
 *   occupation: 'Consulting Detective',
 *   socialClass: 'upper',
 *   appearance: 'Tall, lean man with piercing grey eyes...',
 *   personality: 'Brilliant, observant, somewhat arrogant...',
 *   background: 'Born in 1854, educated at Cambridge...',
 *   stats: { strength: 12, dexterity: 14, ... },
 *   avatar: '/uploads/avatars/sherlock.jpg',
 *   status: 'active',
 *   isOnline: true,
 *   lastSeenAt: '2024-01-15T14:30:00.000Z',
 *   createdAt: '2024-01-01T00:00:00.000Z',
 *   updatedAt: '2024-01-15T14:30:00.000Z'
 * };
 * ```
 */
export const CharacterSchema = z.object({
  _id: MongoIdSchema,
  userId: MongoIdSchema,
  campaignId: MongoIdSchema,
  name: z.string().min(2).max(50),
  title: z.string().max(100).nullable(),
  age: z.number().int().positive().max(120),
  gender: z.enum(['male', 'female', 'other']),
  occupation: z.string(),
  socialClass: z.enum(['lower', 'middle', 'upper', 'nobility']),
  appearance: z.string().max(1000),
  personality: z.string().max(1000),
  background: z.string().max(2000),
  stats: CharacterStatsSchema,
  avatar: z.string().max(500).nullable().optional(),
  // CRITICAL: Status values MUST match backend Character model
  // Backend enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DELETED']
  // DO NOT use: 'active', 'inactive', 'deceased', 'pending' (not supported by backend)
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DELETED']),
  isOnline: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
  playerStatus: z.enum(['draft', 'pending', 'approved']).optional(),
  isGestore: z.boolean().optional(),
  gameplayRoles: z.array(z.enum(['player', 'master', 'moderatore'])).optional(),
  characterRoles: z.array(z.string()).optional(),
  characterPermissions: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Character type inferred from CharacterSchema
 *
 * @since 2.0.0
 */
export type Character = z.infer<typeof CharacterSchema>;

/**
 * CharacterStats type inferred from CharacterStatsSchema
 *
 * @since 2.0.0
 */
export type CharacterStats = z.infer<typeof CharacterStatsSchema>;

/**
 * Moon Phase Schema
 *
 * Represents the 8 phases of the lunar cycle.
 * Calculated from real-time astronomical data.
 *
 * @constant
 * @since 2.0.0
 */
export const MoonPhaseSchema = z.enum([
  'new',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent'
]);

/**
 * Weather Condition Schema
 *
 * Represents weather conditions in Victorian London.
 * Mapped from Open-Meteo API weather codes.
 *
 * @constant
 * @since 2.0.0
 */
export const WeatherConditionSchema = z.enum(['clear', 'fog', 'rain', 'cloudy']);

/**
 * Environment Schema
 *
 * Real-time weather and moon phase data for London.
 * Data is fetched from Open-Meteo API and cached for 30 minutes.
 * All users see identical environment data.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {WeatherCondition} condition - Current weather condition
 * @property {number} temperature - Temperature in Celsius (with modifiers)
 * @property {MoonPhase} moonPhase - Current moon phase
 * @property {number} moonIllumination - Moon illumination percentage (0-1)
 * @property {string} lastUpdated - ISO timestamp of when data was cached
 *
 * @example
 * ```typescript
 * const environment: Environment = {
 *   condition: 'fog',
 *   temperature: 5,
 *   moonPhase: 'waning_crescent',
 *   moonIllumination: 0.3,
 *   lastUpdated: '2026-02-25T08:00:00.000Z'
 * };
 * ```
 */
export const EnvironmentSchema = z.object({
  condition: WeatherConditionSchema,
  temperature: z.number(),
  moonPhase: MoonPhaseSchema,
  moonIllumination: z.number().min(0).max(1),
  lastUpdated: z.string().datetime()
});

/**
 * MoonPhase type inferred from MoonPhaseSchema
 *
 * @since 2.0.0
 */
export type MoonPhase = z.infer<typeof MoonPhaseSchema>;

/**
 * WeatherCondition type inferred from WeatherConditionSchema
 *
 * @since 2.0.0
 */
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

/**
 * Environment type inferred from EnvironmentSchema
 *
 * @since 2.0.0
 */
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Location Schema
 *
 * Represents a physical location in the game world (Victorian London).
 * Characters can enter/leave locations to interact with others.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} _id - MongoDB ObjectId
 * @property {string} campaignId - Campaign this location belongs to
 * @property {string} name - Location name (2-100 characters)
 * @property {string} description - Location description (max 2000 chars)
 * @property {'indoor' | 'outdoor' | 'public' | 'private' | 'secret'} type - Location type
 * @property {string | null} district - London district (e.g., "Westminster")
 * @property {string | null} address - Street address
 * @property {number | null} capacity - Maximum occupants (null = unlimited)
 * @property {string[]} occupants - Array of character IDs currently present
 * @property {boolean} isLocked - Whether location requires keys to enter
 * @property {string[]} requiredKeys - Item IDs that unlock this location
 * @property {string | null} imageUrl - Location image URL
 * @property {{x: number, y: number} | null} coordinates - Map coordinates
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */
export const LocationSchema = z.object({
  _id: MongoIdSchema,
  campaignId: MongoIdSchema,
  name: z.string().min(2).max(100),
  description: z.string().max(2000),
  type: z.enum(['indoor', 'outdoor', 'public', 'private', 'secret']),
  district: z.string().max(100).nullable(),
  address: z.string().max(200).nullable(),
  capacity: z.number().int().positive().nullable(),
  occupants: z.array(MongoIdSchema),
  isLocked: z.boolean(),
  requiredKeys: z.array(MongoIdSchema).default([]),
  imageUrl: z.string().url().nullable(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Location type inferred from LocationSchema
 *
 * @since 2.0.0
 */
export type Location = z.infer<typeof LocationSchema>;

/**
 * Message Schema
 *
 * Represents a message in the game (location chat, private messages, postal system).
 * Supports read receipts and narrative mode for storytelling.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} _id - MongoDB ObjectId
 * @property {'location' | 'private' | 'system' | 'postal'} type - Message type
 * @property {string} senderId - Sender character ID
 * @property {string} senderName - Sender character name
 * @property {string | null} recipientId - Recipient character ID (for private/postal)
 * @property {string | null} recipientName - Recipient character name
 * @property {string | null} locationId - Location ID (for location messages)
 * @property {string} campaignId - Campaign ID
 * @property {string} content - Message content (1-5000 characters)
 * @property {boolean} isNarrative - Whether message is narrative (third-person)
 * @property {boolean} isPaid - Whether message required payment (postal system)
 * @property {string[]} readBy - Character IDs who have read the message
 * @property {Record<string, string>} [readAt] - Timestamps when each character read
 * @property {string} createdAt - Message sent timestamp
 * @property {string} updatedAt - Last update timestamp
 */
export const MessageSchema = z.object({
  _id: MongoIdSchema,
  type: z.enum(['location', 'private', 'system', 'postal']),
  senderId: MongoIdSchema,
  senderName: z.string(),
  recipientId: MongoIdSchema.nullable(),
  recipientName: z.string().nullable(),
  locationId: MongoIdSchema.nullable(),
  campaignId: MongoIdSchema,
  content: z.string().min(1).max(5000),
  isNarrative: z.boolean(),
  isPaid: z.boolean().default(false),
  readBy: z.array(MongoIdSchema).default([]),
  readAt: z.record(MongoIdSchema, z.string().datetime()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Message type inferred from MessageSchema
 *
 * @since 2.0.0
 */
export type Message = z.infer<typeof MessageSchema>;

/**
 * Presence Schema
 *
 * Represents a character's online presence and current location.
 * Used for the global presence list.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} characterId - Character ID
 * @property {string} characterName - Character name
 * @property {'online' | 'idle' | 'offline'} status - Online status
 * @property {{id: string, name: string} | null} currentLocation - Current location (if any)
 * @property {string} lastSeenAt - Last activity timestamp
 */
export const PresenceSchema = z.object({
  characterId: MongoIdSchema,
  characterName: z.string(),
  status: z.enum(['online', 'idle', 'offline']),
  currentLocation: z
    .object({
      id: MongoIdSchema,
      name: z.string(),
    })
    .nullable(),
  lastSeenAt: z.string().datetime(),
});

/**
 * Presence type inferred from PresenceSchema
 *
 * @since 2.0.0
 */
export type Presence = z.infer<typeof PresenceSchema>;

/**
 * Typing Indicator Schema
 *
 * Real-time typing indicator for location chats.
 * Automatically cleared after 3 seconds of inactivity.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} characterId - Typing character ID
 * @property {string} characterName - Typing character name
 * @property {string} locationId - Location where typing is occurring
 * @property {boolean} isTyping - Whether character is currently typing
 */
export const TypingIndicatorSchema = z.object({
  characterId: MongoIdSchema,
  characterName: z.string(),
  locationId: MongoIdSchema,
  isTyping: z.boolean(),
});

/**
 * TypingIndicator type inferred from TypingIndicatorSchema
 *
 * @since 2.0.0
 */
export type TypingIndicator = z.infer<typeof TypingIndicatorSchema>;

/**
 * Market Item Schema
 *
 * Represents an item for sale in the market.
 * Future expansion planned for inventory, crafting, etc.
 *
 * @constant
 * @since 2.0.0
 *
 * @property {string} _id - MongoDB ObjectId
 * @property {string} sellerId - Seller character ID
 * @property {string} sellerName - Seller character name
 * @property {string} name - Item name (2-100 characters)
 * @property {string} description - Item description (max 1000 chars)
 * @property {number} price - Price in game currency (positive integer)
 * @property {number} quantity - Available quantity (positive integer)
 * @property {string} category - Item category
 * @property {string | null} imageUrl - Item image URL
 * @property {string} createdAt - Listing creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */
export const MarketItemSchema = z.object({
  _id: MongoIdSchema,
  sellerId: MongoIdSchema,
  sellerName: z.string(),
  name: z.string().min(2).max(100),
  description: z.string().max(1000),
  price: z.number().int().positive(),
  quantity: z.number().int().positive(),
  category: z.string(),
  imageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * MarketItem type inferred from MarketItemSchema
 *
 * @since 2.0.0
 */
export type MarketItem = z.infer<typeof MarketItemSchema>;

/**
 * API Response Wrapper Schema Factory
 *
 * Creates a schema for standardized API responses.
 * All API endpoints should use this wrapper format.
 *
 * @template T - Zod schema type for response data
 * @param {T} dataSchema - Schema for the data payload
 * @returns {z.ZodObject} Schema for API response
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const UserResponseSchema = ApiResponseSchema(UserSchema);
 * type UserResponse = z.infer<typeof UserResponseSchema>;
 * // { success: boolean, data: User, message?: string }
 * ```
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
  });

/**
 * Validation Helper (Strict)
 *
 * Validates data against a Zod schema and throws if validation fails.
 * Use this when you want to fail fast on invalid data.
 *
 * @template T - Type of the validated data
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @returns {T} Validated and typed data
 * @throws {z.ZodError} If validation fails
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * try {
 *   const user = validate(UserSchema, apiResponse.data);
 *   console.log(user.username); // Fully typed
 * } catch (error) {
 *   console.error('Validation failed:', error);
 * }
 * ```
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe Validation Helper (Non-Throwing)
 *
 * Validates data against a Zod schema without throwing exceptions.
 * Returns a discriminated union for safe error handling.
 *
 * @template T - Type of the validated data
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @returns {{success: true, data: T} | {success: false, error: z.ZodError}} Validation result
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const result = validateSafe(UserSchema, apiResponse.data);
 * if (result.success) {
 *   console.log(result.data.username); // Fully typed
 * } else {
 *   console.error('Validation errors:', result.error.errors);
 * }
 * ```
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
