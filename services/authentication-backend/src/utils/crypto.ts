import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthTokenPayload, CharacterContextPayload } from '../../../../packages/shared/types';
import { logger } from '../utils/logger';
import { validationConfig } from '../config/validation';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// Helper function to get JWT_SECRET with validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

// Helper function to get JWT_REFRESH_SECRET with validation
function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return secret;
}

export class CryptoUtils {
  // Password hashing
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, BCRYPT_ROUNDS);
    } catch (error: any) {
      logger.error('Error hashing password:', error);
      throw new Error('Password hashing failed');
    }
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error: any) {
      logger.error('Error comparing password:', error);
      return false;
    }
  }

  // JWT Token generation and verification
  static generateAuthToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>, expiresIn = '24h'): string {
    try {
      const jwtSecret = getJwtSecret();
      console.log(`🔍 [AUTH-BACKEND] Generating auth token with JWT_SECRET: ${jwtSecret.substring(0, 10)}...`);
      return (jwt.sign as any)(payload, jwtSecret, {
        expiresIn,
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-users'
      });
    } catch (error: any) {
      logger.error('Error generating auth token:', error);
      throw new Error('Token generation failed');
    }
  }

  static generateCharacterContextToken(payload: Omit<CharacterContextPayload, 'iat' | 'exp'>, expiresIn = '24h'): string {
    try {
      const jwtSecret = getJwtSecret();
      return (jwt.sign as any)(payload, jwtSecret, {
        expiresIn,
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-game'
      });
    } catch (error: any) {
      logger.error('Error generating character context token:', error);
      throw new Error('Character token generation failed');
    }
  }

  static verifyAuthToken(token: string): AuthTokenPayload {
    try {
      const jwtSecret = getJwtSecret();
      return (jwt.verify as any)(token, jwtSecret, {
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-users'
      }) as AuthTokenPayload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else {
        logger.error('Error verifying auth token:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  static verifyCharacterContextToken(token: string): CharacterContextPayload {
    try {
      const jwtSecret = getJwtSecret();
      return (jwt.verify as any)(token, jwtSecret, {
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-game'
      }) as CharacterContextPayload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid character token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Character token expired');
      } else {
        logger.error('Error verifying character context token:', error);
        throw new Error('Character token verification failed');
      }
    }
  }

  // Refresh token generation and verification
  static generateRefreshToken(userId: string, sessionId: string): string {
    try {
      const refreshSecret = getJwtRefreshSecret();
      return (jwt.sign as any)(
        { userId, sessionId, type: 'refresh' },
        refreshSecret,
        {
          expiresIn: '7d',
          issuer: 'tenpennynovels-auth'
        }
      );
    } catch (error: any) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Refresh token generation failed');
    }
  }

  static verifyRefreshToken(token: string): { userId: string; sessionId: string; type: string } {
    try {
      const refreshSecret = getJwtRefreshSecret();
      const payload = (jwt.verify as any)(token, refreshSecret, {
        issuer: 'tenpennynovels-auth'
      }) as any;
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }
      
      return payload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else {
        logger.error('Error verifying refresh token:', error);
        throw new Error('Refresh token verification failed');
      }
    }
  }

  // Random token generation for email verification, password reset, etc.
  static generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateUrlSafeToken(length = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  // Session ID generation
  static generateSessionId(): string {
    return crypto.randomUUID();
  }

  // Email masking for privacy
  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart.charAt(0)}***@${domain}`;
    }
    const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  // Hash generation for unique identifiers (non-cryptographic)
  static generateShortHash(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
  }

  // HMAC generation for webhook signatures
  static generateHmacSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  static verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Rate limiting key generation
  static generateRateLimitKey(type: string, identifier: string): string {
    return `ratelimit:${type}:${identifier}`;
  }

  // Password strength validation
  static validatePasswordStrength(password: string): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];
    const config = validationConfig.password;

    // Minimum length check (always enforced)
    if (password.length < config.minLength) {
      violations.push(`Password must be at least ${config.minLength} characters long`);
    }

    // Optional: Uppercase letter check
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }

    // Optional: Lowercase letter check
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }

    // Optional: Number check
    if (config.requireNumber && !/\d/.test(password)) {
      violations.push('Password must contain at least one number');
    }

    // Optional: Special character check
    if (config.requireSpecialChar && !config.specialCharPattern.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Optional: Common passwords check
    if (config.checkCommonPasswords) {
      const commonPasswords = [
        'password', '123456', '123456789', 'qwerty', 'abc123',
        'password123', 'admin', 'letmein', 'welcome', '123123'
      ];

      if (commonPasswords.includes(password.toLowerCase())) {
        violations.push('Password is too common');
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}