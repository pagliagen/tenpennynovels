# Authentication System - TenpennyNovels

## Overview

TenpennyNovels implementa un sistema di autenticazione dual-token avanzato con separazione tra ruoli USER (amministrativi) e CHARACTER (gameplay), utilizzando JWT e cookie cross-domain per accesso seamless tra le 6 applicazioni frontend.

## 🏗️ Dual-Token Architecture

### Token Structure
```typescript
interface AuthTokenPayload {
  userId: string;
  username: string;
  email: string;
  canAccessAdminPanel: boolean;
  userRoles: string[];        // ['user', 'gestore']
  type: 'auth';
  iat: number;
  exp: number;
}

interface CharacterTokenPayload {
  characterId: string;
  characterName: string;
  userId: string;
  gameplayRoles: string[];    // ['personaggio', 'master', 'moderatore', 'amministratore']
  currentLocation?: string;
  type: 'character';
  iat: number;
  exp: number;
}
```

### Cookie Configuration
```typescript
const cookieConfig = {
  domain: process.env.NODE_ENV === 'production' 
    ? '.tenpennynovels.com' 
    : '.localhost',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
};

// Dual cookie setup
res.cookie('auth_token', authJWT, cookieConfig);
res.cookie('character_context', characterJWT, cookieConfig);
```

## 🔄 Authentication Flow

### 1. Registration & Verification Flow
```
User Registration:
User → Landing App → API Gateway → Auth Backend → Database
                                               → Email Verification
                                               → Redis Event (user:registered)

Email Verification:
Email Link → Auth Backend → Account Activation → Login Redirect
```

### 2. Login & Character Selection Flow
```
Login Flow:
User → Landing App → API Gateway → Auth Backend → JWT Generation
                                               → Set auth_token Cookie
                                               → Character Selection Redirect

Character Selection:
Character Choice → Game Backend → Character Context JWT → character_context Cookie
                                                      → Redis Event (character:activated)
                                                      → Game App Redirect
```

### 3. Cross-Application Navigation
```
App Navigation:
Any App → Cookie Validation → Role Check → Access Granted/Denied
       → Auto-refresh if needed
       → Character context validation (if required)
```

## 🚪 Character State Management

### Character States & Access Control
```typescript
enum CharacterState {
  DRAFT = 'DRAFT',                    // Character creation in progress
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Awaiting staff review
  APPROVED = 'APPROVED',              // Full game access
  DELETED = 'DELETED'                 // No access (soft delete)
}

// Access control logic
const getCharacterAccessLevel = (state: CharacterState) => {
  switch (state) {
    case 'DRAFT':
      return { 
        canAccessWizard: true, 
        canAccessGame: false, 
        canAccessManagement: false 
      };
    case 'PENDING_APPROVAL':
      return { 
        canAccessWizard: false, 
        canAccessGame: false, 
        canAccessManagement: false 
      };
    case 'APPROVED':
      return { 
        canAccessWizard: false, 
        canAccessGame: true, 
        canAccessManagement: false 
      };
    case 'DELETED':
      return { 
        canAccessWizard: false, 
        canAccessGame: false, 
        canAccessManagement: false 
      };
  }
};
```

## 🏢 Application Access Matrix

| Application | Base Access | USER Roles Required | CHARACTER Roles | Admin Gate |
|-------------|-------------|---------------------|-----------------|------------|
| **Landing** | Public | - | - | - |
| **Game** | `auth_token` + `character_context` | - | All approved characters | - |
| **Documents** | `auth_token` | - | - | - |
| **Forum** | `auth_token` | - | Role-based sections | - |
| **Management** | `auth_token` + `canAccessAdminPanel=true` | `gestore` | - | ✅ |
| **Tickets** | `auth_token` + `character_context` | - | `master`, `moderatore`, `amministratore` | - |

## 🔐 Middleware & Security

### Authentication Middleware
```typescript
// Base authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false,
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN' 
    });
  }
};

// Character context middleware
export const requireCharacter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.character_context;
    if (!token) {
      return res.status(403).json({ 
        success: false,
        error: 'Character context required',
        code: 'CHARACTER_REQUIRED' 
      });
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as CharacterTokenPayload;
    
    // Validate character still exists and is accessible
    const character = await Character.findById(payload.characterId);
    if (!character || character.state === 'DELETED') {
      return res.status(403).json({ 
        success: false,
        error: 'Character not available',
        code: 'CHARACTER_UNAVAILABLE' 
      });
    }
    
    req.character = payload;
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false,
      error: 'Invalid character context',
      code: 'INVALID_CHARACTER_CONTEXT' 
    });
  }
};

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.character) {
      return res.status(403).json({ 
        success: false,
        error: 'Character context required for role validation',
        code: 'CHARACTER_REQUIRED' 
      });
    }
    
    const hasRole = roles.some(role => req.character!.gameplayRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRoles: req.character!.gameplayRoles
      });
    }
    
    next();
  };
};

// Admin panel access control
export const requireAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.canAccessAdminPanel) {
    return res.status(403).json({ 
      success: false,
      error: 'Administrative access required',
      code: 'ADMIN_ACCESS_REQUIRED' 
    });
  }
  next();
};
```

### Advanced Security Middleware
```typescript
// Rate limiting for authentication endpoints
import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Audit logging middleware
export const auditAuth = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(data: any) {
      // Log authentication events
      logger.info('Authentication audit', {
        action,
        userId: req.user?.userId,
        characterId: req.character?.characterId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: data.success,
        timestamp: new Date().toISOString()
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};
```

## 🔌 API Endpoints

### Authentication Backend (Port 3000)
```typescript
// User authentication
POST   /auth/register              // User registration with email verification
POST   /auth/login                 // Login with credentials
POST   /auth/logout                // Logout and token invalidation
POST   /auth/refresh               // JWT token refresh
POST   /auth/forgot-password       // Password reset request
POST   /auth/reset-password        // Password reset with token
POST   /auth/resend-verification   // Resend verification email
GET    /auth/verify-email/:token   // Email verification
GET    /auth/profile               // User profile retrieval
PUT    /auth/profile               // User profile update
DELETE /auth/account               // Account deletion

// Character context management
POST   /auth/character/select      // Select active character
GET    /auth/character/available   // Get available characters for user
POST   /auth/character/switch      // Switch active character
DELETE /auth/character/context     // Clear character context

// Admin authentication
POST   /auth/admin/login           // Admin-specific login
GET    /auth/admin/permissions     // Get admin permissions
PUT    /auth/admin/elevate         // Temporary permission elevation
```

## 🌐 Frontend Integration

### React Authentication Hook
```typescript
// hooks/useAuth.ts
interface AuthContextType {
  user: AuthTokenPayload | null;
  character: CharacterTokenPayload | null;
  isAuthenticated: boolean;
  hasCharacterContext: boolean;
  canAccessAdmin: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<void>;
  switchCharacter: (characterId: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthTokenPayload | null>(null);
  const [character, setCharacter] = useState<CharacterTokenPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize authentication state from cookies
    initializeAuth();
    
    // Set up automatic token refresh
    const refreshInterval = setInterval(refreshTokens, 20 * 60 * 1000); // 20 minutes
    
    return () => clearInterval(refreshInterval);
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check for existing auth cookies
      const authToken = getCookie('auth_token');
      const characterToken = getCookie('character_context');
      
      if (authToken) {
        try {
          const authPayload = jwt.decode(authToken) as AuthTokenPayload;
          if (authPayload.exp * 1000 > Date.now()) {
            setUser(authPayload);
          } else {
            // Token expired, try refresh
            await refreshTokens();
          }
        } catch (error) {
          console.error('Invalid auth token:', error);
          clearAuthState();
        }
      }
      
      if (characterToken) {
        try {
          const characterPayload = jwt.decode(characterToken) as CharacterTokenPayload;
          if (characterPayload.exp * 1000 > Date.now()) {
            setCharacter(characterPayload);
          }
        } catch (error) {
          console.error('Invalid character token:', error);
          clearCharacterContext();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    const { user: userPayload } = await response.json();
    setUser(userPayload);
  };

  const selectCharacter = async (characterId: string) => {
    const response = await fetch('/api/auth/character/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Character selection failed');
    }
    
    const { character: characterPayload } = await response.json();
    setCharacter(characterPayload);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      clearAuthState();
      window.location.href = '/';
    }
  };

  const refreshTokens = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const { user: userPayload, character: characterPayload } = await response.json();
        setUser(userPayload);
        if (characterPayload) {
          setCharacter(characterPayload);
        }
      } else {
        // Refresh failed, clear state
        clearAuthState();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuthState();
    }
  };

  const clearAuthState = () => {
    setUser(null);
    setCharacter(null);
  };

  const clearCharacterContext = () => {
    setCharacter(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      character,
      isAuthenticated: !!user,
      hasCharacterContext: !!character,
      canAccessAdmin: user?.canAccessAdminPanel || false,
      isLoading,
      login,
      logout,
      selectCharacter,
      switchCharacter: selectCharacter,
      refreshTokens
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Protected Route Component
```typescript
// components/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  requireAuth?: boolean;
  requireCharacter?: boolean;
  requireAdminAccess?: boolean;
  allowedRoles?: string[];
  allowedStates?: CharacterState[];
  fallbackUrl?: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requireAuth = false,
  requireCharacter = false,
  requireAdminAccess = false,
  allowedRoles = [],
  allowedStates = ['APPROVED'],
  fallbackUrl,
  children
}) => {
  const { 
    user, 
    character, 
    isAuthenticated, 
    hasCharacterContext, 
    canAccessAdmin,
    isLoading 
  } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to={fallbackUrl || "/login"} replace />;
  }

  if (requireCharacter && !hasCharacterContext) {
    return <Navigate to="/character-select" replace />;
  }

  if (requireAdminAccess && !canAccessAdmin) {
    return <AccessDenied message="Administrative access required" />;
  }

  if (allowedRoles.length > 0 && character) {
    const hasAllowedRole = allowedRoles.some(role => 
      character.gameplayRoles.includes(role)
    );
    if (!hasAllowedRole) {
      return <AccessDenied message="Insufficient role permissions" />;
    }
  }

  // Additional character state validation could be added here
  // if (allowedStates.length > 0 && character) {
  //   const characterData = await getCharacterData(character.characterId);
  //   if (!allowedStates.includes(characterData.state)) {
  //     return <AccessDenied message="Character not in valid state" />;
  //   }
  // }

  return <>{children}</>;
};
```

## 💾 Session Management

### Redis Session Storage
```typescript
// Session management utilities
export class SessionManager {
  private redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async createUserSession(userId: string, userData: any): Promise<void> {
    const sessionKey = `session:user:${userId}`;
    const sessionData = {
      userId,
      loginTime: new Date().toISOString(),
      ...userData
    };
    
    await this.redis.setex(sessionKey, 86400, JSON.stringify(sessionData)); // 24 hours
  }

  async setActiveCharacter(userId: string, characterId: string): Promise<void> {
    const contextKey = `character:active:${userId}`;
    await this.redis.setex(contextKey, 86400, characterId);
    
    // Publish character activation event
    await this.redis.publish('character:activated', JSON.stringify({
      userId,
      characterId,
      timestamp: new Date().toISOString()
    }));
  }

  async getActiveCharacter(userId: string): Promise<string | null> {
    const contextKey = `character:active:${userId}`;
    return await this.redis.get(contextKey);
  }

  async clearUserSession(userId: string): Promise<void> {
    const sessionKey = `session:user:${userId}`;
    const contextKey = `character:active:${userId}`;
    
    await Promise.all([
      this.redis.del(sessionKey),
      this.redis.del(contextKey)
    ]);
  }

  async getUserSessions(): Promise<string[]> {
    return await this.redis.keys('session:user:*');
  }

  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.getUserSessions();
    let cleaned = 0;
    
    for (const sessionKey of sessions) {
      const ttl = await this.redis.ttl(sessionKey);
      if (ttl === -1) { // No expiration set
        await this.redis.expire(sessionKey, 86400); // Set 24h expiration
      } else if (ttl === -2) { // Key doesn't exist
        cleaned++;
      }
    }
    
    return cleaned;
  }
}
```

## 🔒 Security Implementation

### Password Security
```typescript
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

export class PasswordManager {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  static async hashPassword(password: string): Promise<string> {
    this.validatePassword(password);
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static validatePassword(password: string): void {
    if (password.length < this.MIN_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }
    
    if (password.length > this.MAX_LENGTH) {
      throw new Error(`Password must not exceed ${this.MAX_LENGTH} characters`);
    }
    
    // Additional password strength requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length;
    
    if (strength < 3) {
      throw new Error('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters');
    }
  }

  static generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  static generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }
}
```

### Input Validation & Sanitization
```typescript
import Joi from 'joi';
import DOMPurify from 'dompurify';

// Validation schemas
export const authValidationSchemas = {
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(128).required(),
    rememberMe: Joi.boolean().default(false)
  }),

  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.any().valid(Joi.ref('password')).required(),
    agreedToTerms: Joi.boolean().truthy().required()
  }),

  passwordReset: Joi.object({
    email: Joi.string().email().required()
  }),

  passwordUpdate: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmNewPassword: Joi.any().valid(Joi.ref('newPassword')).required()
  })
};

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input).trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};
```

## 🚨 Error Handling & Logging

### Authentication Error Types
```typescript
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  CHARACTER_NOT_FOUND: 'CHARACTER_NOT_FOUND',
  CHARACTER_NOT_APPROVED: 'CHARACTER_NOT_APPROVED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;
```

### Audit Logging
```typescript
export class AuthAuditLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  logAuthEvent(event: {
    action: string;
    userId?: string;
    characterId?: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    details?: any;
  }): void {
    this.logger.info('Authentication Event', {
      ...event,
      timestamp: new Date().toISOString(),
      category: 'authentication'
    });
  }

  logSecurityEvent(event: {
    type: 'login_attempt' | 'permission_denied' | 'token_refresh' | 'logout';
    userId?: string;
    success: boolean;
    reason?: string;
    ip?: string;
    details?: any;
  }): void {
    this.logger.warn('Security Event', {
      ...event,
      timestamp: new Date().toISOString(),
      category: 'security'
    });
  }
}
```

## ⚙️ Configuration & Environment

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-min-32-characters
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Cookie Configuration  
COOKIE_DOMAIN=.localhost                    # Development
# COOKIE_DOMAIN=.tenpennynovels.com        # Production
COOKIE_SECURE=false                         # Development
# COOKIE_SECURE=true                       # Production
COOKIE_SAME_SITE=lax

# Authentication Backend
AUTH_PORT=3000
AUTH_RATE_LIMIT_MAX=5
AUTH_RATE_LIMIT_WINDOW_MS=900000           # 15 minutes

# Email Configuration
EMAIL_MOCK=true                            # Development
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_MAX_AGE=86400000                   # 24 hours in milliseconds
REDIS_SESSION_PREFIX=sess:

# Security Settings
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_LENGTH=128
PASSWORD_REQUIRE_MIXED_CASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true

# Account Settings
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_EXPIRES=24h
PASSWORD_RESET_EXPIRES=1h
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15m
```

This authentication system provides comprehensive security, seamless cross-application access, and proper separation between user administration and character gameplay contexts for the TenpennyNovels Victorian RPG platform.