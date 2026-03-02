/**
 * API Type Schemas
 *
 * Simplified schemas for Documents app.
 * Only includes types needed for authentication.
 *
 * @module types/api/schemas
 * @since 1.0.0
 */

import { z } from 'zod';

/**
 * MongoDB ObjectId Schema
 *
 * Validates 24-character hexadecimal MongoDB ObjectId strings.
 *
 * @constant
 * @since 1.0.0
 */
export const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

/**
 * User Schema
 *
 * Represents a registered user account.
 *
 * @constant
 * @since 1.0.0
 */
export const UserSchema = z.object({
  _id: MongoIdSchema,
  username: z.string().min(3).max(20),
  email: z.string().email(),
  isEmailVerified: z.boolean(),
  role: z.enum(['player', 'moderator', 'admin']),
  status: z.enum(['active', 'suspended', 'banned']),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * User type inferred from UserSchema
 *
 * @since 1.0.0
 */
export type User = z.infer<typeof UserSchema>;

/**
 * Character Stats Schema
 *
 * Six core attributes for character abilities.
 *
 * @constant
 * @since 1.0.0
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
 * Represents a player character.
 * NOTE: Not used in documents app, but required by authStore.
 *
 * @constant
 * @since 1.0.0
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
  currentLocation: MongoIdSchema.nullable(),
  status: z.enum(['active', 'inactive', 'deceased', 'pending']),
  isOnline: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Character type inferred from CharacterSchema
 *
 * @since 1.0.0
 */
export type Character = z.infer<typeof CharacterSchema>;

/**
 * CharacterStats type inferred from CharacterStatsSchema
 *
 * @since 1.0.0
 */
export type CharacterStats = z.infer<typeof CharacterStatsSchema>;

/**
 * Auth Response Schema
 *
 * Response returned after successful login or registration.
 *
 * @constant
 * @since 1.0.0
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  user: UserSchema,
});

/**
 * AuthResponse type inferred from AuthResponseSchema
 *
 * @since 1.0.0
 */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
