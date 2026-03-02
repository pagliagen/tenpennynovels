/**
 * Re-export auth utilities for easier imports
 * Centralizes token generation functions for use across modules and tests
 *
 * This solves the problem of tests importing from wrong paths
 * (e.g., game/middleware/auth which doesn't export these functions)
 */

import { CryptoUtils } from '@modules/auth/utils/crypto';

// Re-export the class
export { CryptoUtils };

// Convenience exports for tests and other modules
export const generateAuthToken = CryptoUtils.generateAuthToken.bind(CryptoUtils);
export const generateCharacterContextToken = CryptoUtils.generateCharacterContextToken.bind(CryptoUtils);
export const verifyAuthToken = CryptoUtils.verifyAuthToken.bind(CryptoUtils);
export const verifyCharacterContextToken = CryptoUtils.verifyCharacterContextToken.bind(CryptoUtils);
