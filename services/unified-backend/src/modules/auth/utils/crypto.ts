import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthTokenPayload, CharacterContextPayload } from '@shared/types';
import { logger } from '../utils/logger';
import { validationConfig } from '@config/runtime/validation';

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
      throw new Error('Hashing password fallito');
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
      return jwt.sign(payload as object, jwtSecret, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-users'
      });
    } catch (error: any) {
      logger.error('Error generating auth token:', error);
      throw new Error('Generazione token fallita');
    }
  }

  static generateCharacterContextToken(payload: Omit<CharacterContextPayload, 'iat' | 'exp'>, expiresIn = '24h'): string {
    try {
      const jwtSecret = getJwtSecret();
      return jwt.sign(payload as object, jwtSecret, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-game'
      });
    } catch (error: any) {
      logger.error('Error generating character context token:', error);
      throw new Error('Generazione token personaggio fallita');
    }
  }

  static verifyAuthToken(token: string): AuthTokenPayload {
    try {
      const jwtSecret = getJwtSecret();
      return jwt.verify(token, jwtSecret, {
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-users'
      }) as AuthTokenPayload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Token non valido');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token scaduto');
      } else {
        logger.error('Error verifying auth token:', error);
        throw new Error('Verifica token fallita');
      }
    }
  }

  static verifyCharacterContextToken(token: string): CharacterContextPayload {
    try {
      const jwtSecret = getJwtSecret();
      return jwt.verify(token, jwtSecret, {
        issuer: 'tenpennynovels-auth',
        audience: 'tenpennynovels-game'
      }) as CharacterContextPayload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Token personaggio non valido');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token personaggio scaduto');
      } else {
        logger.error('Error verifying character context token:', error);
        throw new Error('Verifica token personaggio fallita');
      }
    }
  }

  // Refresh token generation and verification
  static generateRefreshToken(userId: string, sessionId: string): string {
    try {
      const refreshSecret = getJwtRefreshSecret();
      return jwt.sign(
        { userId, sessionId, type: 'refresh' } as object,
        refreshSecret,
        {
          expiresIn: '7d',
          issuer: 'tenpennynovels-auth'
        }
      );
    } catch (error: any) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Generazione refresh token fallita');
    }
  }

  static verifyRefreshToken(token: string): { userId: string; sessionId: string; type: string } {
    try {
      const refreshSecret = getJwtRefreshSecret();
      const payload = jwt.verify(token, refreshSecret, {
        issuer: 'tenpennynovels-auth'
      }) as { userId: string; sessionId: string; type: string };
      
      if (payload.type !== 'refresh') {
        throw new Error('Tipo refresh token non valido');
      }
      
      return payload;
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Refresh token non valido');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token scaduto');
      } else {
        logger.error('Error verifying refresh token:', error);
        throw new Error('Verifica refresh token fallita');
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
      violations.push(`La password deve essere di almeno ${config.minLength} caratteri`);
    }

    // Optional: Uppercase letter check
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('La password deve contenere almeno una lettera maiuscola');
    }

    // Optional: Lowercase letter check
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('La password deve contenere almeno una lettera minuscola');
    }

    // Optional: Number check
    if (config.requireNumber && !/\d/.test(password)) {
      violations.push('La password deve contenere almeno un numero');
    }

    // Optional: Special character check
    if (config.requireSpecialChar && !config.specialCharPattern.test(password)) {
      violations.push('La password deve contenere almeno un carattere speciale');
    }

    // Optional: Common passwords check
    if (config.checkCommonPasswords) {
      const commonPasswords = [
        'password', '123456', '123456789', 'qwerty', 'abc123',
        'password123', 'admin', 'letmein', 'welcome', '123123'
      ];

      if (commonPasswords.includes(password.toLowerCase())) {
        violations.push('La password è troppo comune');
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}