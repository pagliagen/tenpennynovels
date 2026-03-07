/**
 * API Type Schemas
 *
 * Schemas for the Documents app.
 *
 * @module types/api/schemas
 * @since 1.0.0
 */

import { z } from 'zod';

export const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

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

export type User = z.infer<typeof UserSchema>;
