---
name: Landing App Rules
description: Authentication, character selection, Victorian theme, Fetch API (NOT Axios)
type: app-specific
---

# Landing App Rules (Port 4000)

Landing page e autenticazione. Victorian theme, Fetch API (NOT Axios), react-hook-form + Zod, character selection.

**IMPORTANT**: Landing app usa Fetch API nativo, NON Axios (diverso da altre apps).

---

## Fetch API (NOT Axios)

**Regola**: Landing app usa native Fetch API. NO Axios, NO React Query.

**Perche**: Landing e app minimale. Solo autenticazione + character selection. No bisogno di Axios overhead.

### API Client Implementation

```typescript
// File: lib/api/client.ts
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  DEFAULT_TIMEOUT: 30000,  // 30 seconds
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000,  // 1 second
} as const;

/**
 * Main API request function with retry logic
 *
 * Features:
 * - Exponential backoff retry
 * - Timeout handling
 * - Request deduplication
 * - Error transformation
 *
 * @param endpoint - API endpoint path (e.g., '/auth/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Typed API response
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  // Build request config
  const config: RequestConfig = {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',  // ✅ CRITICAL: Send HTTP-only cookies
    ...options,
  };

  // Check in-flight cache for deduplication
  const cacheKey = requestCache.getCacheKey(endpoint, method, options?.body);
  const cachedPromise = requestCache.get<T>(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  // Run request interceptors
  const interceptedConfig = await interceptorManager.runRequestInterceptors(config);

  // Create new request promise with retry logic
  const requestPromise = apiRequestWithRetry<T>(interceptedConfig);

  // Store in cache
  requestCache.set(cacheKey, requestPromise);

  return requestPromise;
}

// Convenience methods
export const apiGet = <T>(endpoint: string, options?: RequestInit) =>
  apiRequest<T>(endpoint, { ...options, method: 'GET' });

export const apiPost = <T>(endpoint: string, body?: any, options?: RequestInit) =>
  apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiPut = <T>(endpoint: string, body?: any, options?: RequestInit) =>
  apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T>(endpoint: string, options?: RequestInit) =>
  apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
```

### ❌ SBAGLIATO: Using Axios in landing app

```typescript
// ❌ BAD: Don't import Axios in landing app
import axios from 'axios';

const response = await axios.post('/auth/login', credentials);
```

### ✅ CORRETTO: Using Fetch API

```typescript
// ✅ GOOD: Use apiRequest wrapper
import { apiPost } from '@/lib/api/client';

const response = await apiPost<LoginResponse>('/auth/login', credentials);
```

**File di Riferimento**:
- `/apps/landing/src/lib/api/client.ts`

---

## Victorian Theme Styling

**Regola**: Landing app ha theme Victorian specifico. Fonts, colors, ornaments.

### Victorian Color Palette

```scss
// File: styles/globals.scss
:root {
  /* Victorian Color Palette */
  --color-victorian-burgundy: #8b0000;
  --color-victorian-gold: #d4af37;
  --color-victorian-cream: #fffdd0;
  --color-victorian-forest: #228b22;
  --color-victorian-navy: #000080;
  --color-victorian-charcoal: #36454f;

  /* Typography */
  --font-display: 'Thrifted Attire', serif;
  --font-heading: 'Les Mysteres de Paris', serif;
  --font-body: 'Garamond', serif;

  /* Spacing (Victorian proportions) */
  --spacing-ornament: 2rem;
  --spacing-section: 4rem;
}
```

### Victorian Components

```scss
// Victorian Card with Ornamental Border
.victorianCard {
  background: var(--color-victorian-cream);
  border: 2px solid var(--color-victorian-gold);
  border-radius: 0;  // No rounded corners (Victorian aesthetic)
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;

  // Ornamental corners
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-victorian-gold);
  }

  &::before {
    top: -2px;
    left: -2px;
    border-right: none;
    border-bottom: none;
  }

  &::after {
    bottom: -2px;
    right: -2px;
    border-left: none;
    border-top: none;
  }
}

// Victorian Button
.victorianButton {
  background: var(--color-victorian-burgundy);
  color: var(--color-victorian-cream);
  border: 2px solid var(--color-victorian-gold);
  padding: 0.75rem 2rem;
  font-family: var(--font-display);
  font-size: 1.125rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-victorian-gold);
    color: var(--color-victorian-charcoal);
    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
  }

  &:disabled {
    background: var(--color-victorian-charcoal);
    border-color: var(--color-victorian-charcoal);
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// Victorian Divider
.victorianDivider {
  width: 100%;
  height: 2px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-victorian-gold) 50%,
    transparent
  );
  margin: var(--spacing-section) 0;
  position: relative;

  &::after {
    content: '❖';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--color-victorian-cream);
    padding: 0 1rem;
    color: var(--color-victorian-gold);
    font-size: 1.5rem;
  }
}
```

---

## Authentication Forms (react-hook-form + Zod)

**Regola**: Use react-hook-form con Zod validation per tutti i form. Server validation e final authority.

### Login Form

```typescript
// File: components/auth/LoginForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthService } from '@/services/AuthService';

const loginSchema = z.object({
  username: z.string().min(1, 'Username obbligatorio'),
  password: z.string().min(1, 'Password obbligatoria'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await AuthService.login(data);

      if (response.success) {
        // ✅ GOOD: Redirect to character selection
        router.push('/character-selection');
      } else {
        // Server-side validation error
        setError('root', {
          type: 'manual',
          message: response.error || 'Errore durante il login',
        });
      }
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: 'Errore di connessione. Riprova più tardi.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.victorianForm}>
      <div className={styles.formGroup}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          {...register('username')}
          className={`${styles.victorianInput} ${errors.username ? styles.error : ''}`}
        />
        {errors.username && (
          <span className={styles.errorMessage}>{errors.username.message}</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className={`${styles.victorianInput} ${errors.password ? styles.error : ''}`}
        />
        {errors.password && (
          <span className={styles.errorMessage}>{errors.password.message}</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" {...register('rememberMe')} />
          Ricordami
        </label>
      </div>

      {errors.root && (
        <div className={styles.errorBanner}>{errors.root.message}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={styles.victorianButton}
      >
        {isSubmitting ? 'Accesso...' : 'Accedi'}
      </button>
    </form>
  );
}
```

### Register Form with Password Strength

```typescript
// File: components/auth/RegisterForm.tsx
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username deve essere almeno 3 caratteri')
    .max(20, 'Username deve essere massimo 20 caratteri')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username può contenere solo lettere, numeri e underscore'),
  email: z.string().email('Email non valida'),
  password: z
    .string()
    .min(8, 'Password deve essere almeno 8 caratteri')
    .regex(/[A-Z]/, 'Password deve contenere almeno una lettera maiuscola')
    .regex(/[a-z]/, 'Password deve contenere almeno una lettera minuscola')
    .regex(/[0-9]/, 'Password deve contenere almeno un numero')
    .regex(/[^A-Za-z0-9]/, 'Password deve contenere almeno un carattere speciale'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Devi accettare i termini e condizioni',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Le password non coincidono',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [passwordStrength, setPasswordStrength] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    setPasswordStrength(Math.min(strength, 5));
  }, [password]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const response = await AuthService.register(data);

      if (response.success) {
        router.push('/login?registered=true');
      } else {
        setError('root', {
          type: 'manual',
          message: response.error || 'Errore durante la registrazione',
        });
      }
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: 'Errore di connessione. Riprova più tardi.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.victorianForm}>
      {/* Username field */}
      <div className={styles.formGroup}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          {...register('username')}
          className={`${styles.victorianInput} ${errors.username ? styles.error : ''}`}
        />
        {errors.username && (
          <span className={styles.errorMessage}>{errors.username.message}</span>
        )}
      </div>

      {/* Email field */}
      <div className={styles.formGroup}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className={`${styles.victorianInput} ${errors.email ? styles.error : ''}`}
        />
        {errors.email && (
          <span className={styles.errorMessage}>{errors.email.message}</span>
        )}
      </div>

      {/* Password field with strength meter */}
      <div className={styles.formGroup}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className={`${styles.victorianInput} ${errors.password ? styles.error : ''}`}
        />
        <PasswordStrengthMeter strength={passwordStrength} />
        {errors.password && (
          <span className={styles.errorMessage}>{errors.password.message}</span>
        )}
      </div>

      {/* Confirm password field */}
      <div className={styles.formGroup}>
        <label htmlFor="confirmPassword">Conferma Password</label>
        <input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          className={`${styles.victorianInput} ${errors.confirmPassword ? styles.error : ''}`}
        />
        {errors.confirmPassword && (
          <span className={styles.errorMessage}>{errors.confirmPassword.message}</span>
        )}
      </div>

      {/* Terms acceptance */}
      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" {...register('acceptTerms')} />
          Accetto i termini e condizioni
        </label>
        {errors.acceptTerms && (
          <span className={styles.errorMessage}>{errors.acceptTerms.message}</span>
        )}
      </div>

      {errors.root && (
        <div className={styles.errorBanner}>{errors.root.message}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={styles.victorianButton}
      >
        {isSubmitting ? 'Registrazione...' : 'Registrati'}
      </button>
    </form>
  );
}
```

### Password Strength Meter

```typescript
interface PasswordStrengthMeterProps {
  strength: number;  // 0-5
}

function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  const labels = ['Molto debole', 'Debole', 'Discreta', 'Buona', 'Forte', 'Molto forte'];
  const colors = ['#d32f2f', '#f57c00', '#fbc02d', '#7cb342', '#388e3c', '#1b5e20'];

  return (
    <div className={styles.strengthMeter}>
      <div className={styles.strengthBar}>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={styles.strengthSegment}
            style={{
              backgroundColor: level < strength ? colors[strength] : '#e0e0e0',
            }}
          />
        ))}
      </div>
      <span className={styles.strengthLabel} style={{ color: colors[strength] }}>
        {labels[strength]}
      </span>
    </div>
  );
}
```

---

## Services Pattern

**Regola**: Use service layer per API calls. NO direct fetch() in components.

**Perche**: Separation of concerns. Service layer centralizes API logic, error handling, retry.

### AuthService

```typescript
// File: services/AuthService.ts
import { apiPost, apiGet } from '@/lib/api/client';
import type { ApiResponse, User } from '@/types';

export const AuthService = {
  /**
   * Login user
   *
   * @param credentials - Username and password
   * @returns API response with user data
   */
  async login(credentials: {
    username: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<ApiResponse<{ user: User }>> {
    return await apiPost<{ user: User }>('/auth/login', credentials);
  },

  /**
   * Register new user
   *
   * @param data - Registration form data
   * @returns API response
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
  }): Promise<ApiResponse<void>> {
    return await apiPost<void>('/auth/register', data);
  },

  /**
   * Logout user
   *
   * @returns API response
   */
  async logout(): Promise<ApiResponse<void>> {
    return await apiPost<void>('/auth/logout');
  },

  /**
   * Get current session
   *
   * @returns API response with user data
   */
  async getSession(): Promise<ApiResponse<{ user: User }>> {
    return await apiGet<{ user: User }>('/auth/session');
  },

  /**
   * Request password reset
   *
   * @param email - User email
   * @returns API response
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return await apiPost<void>('/auth/password-reset/request', { email });
  },

  /**
   * Reset password with token
   *
   * @param token - Reset token from email
   * @param newPassword - New password
   * @returns API response
   */
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return await apiPost<void>('/auth/password-reset/confirm', {
      token,
      newPassword,
    });
  },
};
```

### CharacterService

```typescript
// File: services/CharacterService.ts
import { apiGet, apiPost } from '@/lib/api/client';
import type { ApiResponse, Character } from '@/types';

export const CharacterService = {
  /**
   * Get user's characters
   *
   * @returns API response with character list
   */
  async list(): Promise<ApiResponse<{ characters: Character[] }>> {
    return await apiGet<{ characters: Character[] }>('/auth/characters');
  },

  /**
   * Select character for gameplay
   *
   * Creates new session and returns sessionId (UUID)
   *
   * @param characterId - Character ID to select
   * @returns API response with sessionId
   */
  async select(characterId: string): Promise<ApiResponse<{ sessionId: string }>> {
    return await apiPost<{ sessionId: string }>('/auth/characters/select', {
      characterId,
    });
  },

  /**
   * Create new character
   *
   * @param data - Character creation data
   * @returns API response with new character
   */
  async create(data: {
    name: string;
    surname: string;
    age: number;
    gender: string;
    description: string;
  }): Promise<ApiResponse<{ character: Character }>> {
    return await apiPost<{ character: Character }>('/characters', data);
  },
};
```

**File di Riferimento**:
- `/apps/landing/src/services/AuthService.ts`
- `/apps/landing/src/services/CharacterService.ts`

---

## Character Selection Flow

**Regola**: After login, user selects character. Backend creates session, returns sessionId. Frontend redirects to game app with sessionId.

### Character Selection Page

```typescript
// File: pages/character-selection.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { CharacterService } from '@/services/CharacterService';

export default function CharacterSelectionPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch characters on mount
  useEffect(() => {
    async function fetchCharacters() {
      try {
        const response = await CharacterService.list();

        if (response.success && response.data) {
          setCharacters(response.data.characters);
        } else {
          setError(response.error || 'Errore nel caricamento dei personaggi');
        }
      } catch (err) {
        setError('Errore di connessione');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCharacters();
  }, []);

  const handleSelectCharacter = async (characterId: string) => {
    try {
      const response = await CharacterService.select(characterId);

      if (response.success && response.data) {
        const { sessionId } = response.data;

        // ✅ GOOD: Redirect to game app with sessionId in query param
        const gameUrl = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:4001';
        window.location.href = `${gameUrl}?sessionId=${sessionId}`;
      } else {
        setError(response.error || 'Errore nella selezione del personaggio');
      }
    } catch (err) {
      setError('Errore di connessione');
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className={styles.characterSelection}>
      <h1>Seleziona Personaggio</h1>

      <div className={styles.characterGrid}>
        {characters.map((character) => (
          <CharacterCard
            key={character._id}
            character={character}
            onSelect={() => handleSelectCharacter(character._id)}
          />
        ))}
      </div>

      <button
        onClick={() => router.push('/character-creation')}
        className={styles.victorianButton}
      >
        Crea Nuovo Personaggio
      </button>
    </div>
  );
}
```

### Character Card Component

```typescript
interface CharacterCardProps {
  character: Character;
  onSelect: () => void;
}

function CharacterCard({ character, onSelect }: CharacterCardProps) {
  return (
    <div className={styles.characterCard}>
      <div className={styles.characterAvatar}>
        <img
          src={character.avatar || '/images/default-avatar.png'}
          alt={character.name}
        />
      </div>

      <div className={styles.characterInfo}>
        <h3>{character.name} {character.surname}</h3>
        <p className={styles.characterMeta}>
          {character.age} anni • {character.gender}
        </p>
        <p className={styles.characterDescription}>
          {character.description}
        </p>
      </div>

      <button
        onClick={onSelect}
        className={styles.victorianButton}
      >
        Seleziona
      </button>
    </div>
  );
}
```

---

## Error Handling

**Regola**: Use structured error types from `lib/api/errors.ts`. Show user-friendly messages.

### Error Types

```typescript
// File: lib/api/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(`API Error: ${code}`);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isRetryableError(error: any): boolean {
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  if (error instanceof ApiError) {
    // Retry on 5xx, 408, 429
    return [500, 502, 503, 504, 408, 429].includes(error.statusCode);
  }

  return false;
}
```

### Error Display Component

```typescript
// File: components/ErrorMessage.tsx
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className={styles.errorMessage}>
      <div className={styles.errorIcon}>⚠️</div>
      <p className={styles.errorText}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={styles.victorianButton}>
          Riprova
        </button>
      )}
    </div>
  );
}
```

---

## No State Management Library

**Regola**: Landing app usa SOLO `useState` + `useEffect`. NO Zustand, NO Redux, NO Context API.

**Perche**: Landing e app minimale. No bisogno di global state. Auth state e gestito da backend (HTTP-only cookies).

### ❌ SBAGLIATO: Creating auth context in landing

```typescript
// ❌ BAD: Don't create auth context
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  // ...
}
```

### ✅ CORRETTO: Local component state only

```typescript
// ✅ GOOD: Use local state in components
function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Component logic
}
```

---

## Logging: nessun `@/lib/logger` in questa app

**Eccezione**: a differenza di game e management, landing NON ha un wrapper `@/lib/logger`. `console.*` è ammesso in questa app — preferire `console.error` nei soli error path (login/register/session), evitare `console.log` di debug lasciato in codice committato.

---

## Cross-References

- **Shared Frontend**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/shared-frontend.md`
- **Game App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/game-app.md`
- **Management App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/management-app.md`
