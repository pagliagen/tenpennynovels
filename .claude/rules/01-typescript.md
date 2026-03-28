---
name: TypeScript Standards
description: TypeScript configuration and patterns across all projects
type: standard
---

# 01 - TypeScript Standards

Standard TypeScript per tutti i progetti (frontend e backend).

---

## Strict Mode Configuration

**Regola**: Strict mode SEMPRE abilitato in tutti i progetti.

### tsconfig.json Standard:

```json
{
  "compilerOptions": {
    "target": "ES2020",                      // Modern JS features
    "module": "ESNext",                      // ES modules
    "lib": ["ES2020"],
    "strict": true,                          // ✅ CRITICAL
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,        // ✅ Prevent undefined access
    "noUnusedLocals": true,                  // ✅ Catch unused vars
    "noUnusedParameters": true,              // ✅ Catch unused params
    "noFallthroughCasesInSwitch": true,      // ✅ Prevent switch fallthrough
    "moduleResolution": "bundler"            // Modern resolution
  }
}
```

### Additional Flags per Project Type:

**Frontend (Next.js)**:
```json
{
  "compilerOptions": {
    "jsx": "preserve",                       // Next.js handles JSX
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/store/*": ["./src/store/*"],
      "@/types/*": ["./src/types/*"],
      "@/constants/*": ["./src/constants/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next", "out"]
}
```

**Backend (Express)**:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"],
      "@database/*": ["src/database/*"],
      "@config/*": ["src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## Path Aliases

### Frontend Aliases (apps/*):

```typescript
// ✅ CORRECT imports
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api/client';
import { useGameStateStore } from '@/store/gameStateStore';
import type { Character } from '@/types/api/character';

// ❌ WRONG - relative paths
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../../components/ui/Button';
```

### Backend Aliases (services/*):

```typescript
// ✅ CORRECT imports
import { logger } from '@shared/utils/logger';
import { AuthMiddleware } from '@modules/auth/middleware/auth';
import { User } from '@database/models/User';
import { appConfig } from '@config/runtime/appConfig';

// ❌ WRONG - relative paths
import { logger } from '../../../shared/utils/logger';
import { AuthMiddleware } from '../../auth/middleware/auth';
```

---

## Zod Runtime Validation

**Regola**: Tutti gli API responses devono essere validati con Zod schemas.

**Perché**:
- Runtime safety (catch API contract violations)
- Type inference (no manual type definitions)
- Clear error messages
- Self-documenting code

### Pattern Standard:

```typescript
// types/api/schemas.ts
import { z } from 'zod';

// 1. Define schema
export const UserSchema = z.object({
  _id: z.string().regex(/^[0-9a-fA-F]{24}$/),  // MongoDB ObjectId
  username: z.string().min(3).max(20),
  email: z.string().email(),
  role: z.enum(['user', 'moderator', 'admin']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// 2. Infer type
export type User = z.infer<typeof UserSchema>;

// 3. Validate response
import { UserSchema } from '@/types/api/schemas';

export async function fetchUser(userId: string): Promise<User> {
  const response = await apiClient.get(`/users/${userId}`);

  // Runtime validation
  const result = UserSchema.safeParse(response.data.data);

  if (!result.success) {
    logger.error('API response validation failed', {
      endpoint: `/users/${userId}`,
      errors: result.error.errors
    });
    throw new ApiError('VALIDATION_ERROR', result.error.message);
  }

  return result.data;  // Type-safe!
}
```

### Zod Helpers:

```typescript
// Optional fields
export const UserProfileSchema = z.object({
  bio: z.string().optional(),
  avatar: z.string().url().optional(),
  location: z.string().optional()
});

// Nullable fields
export const CharacterSchema = z.object({
  currentLocation: z.string().nullable(),  // Can be null
  occupation: z.string().nullable()
});

// Arrays
export const LocationListSchema = z.array(LocationSchema);

// Nested objects
export const CharacterWithUserSchema = z.object({
  _id: z.string(),
  name: z.string(),
  user: UserSchema  // Nested validation
});

// Discriminated unions
export const MessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('standard'), text: z.string() }),
  z.object({ type: z.literal('action'), text: z.string(), action: z.string() }),
  z.object({ type: z.literal('dice_roll'), result: z.number(), rolls: z.array(z.number()) })
]);

// Transforms
export const DateSchema = z.string().datetime().transform(str => new Date(str));

// Refinements (custom validation)
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');
```

### Form Validation (Frontend):

```typescript
// With react-hook-form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const createCharacterSchema = z.object({
  name: z.string().min(3).max(30),
  occupation: z.string(),
  background: z.string().optional()
});

type CreateCharacterForm = z.infer<typeof createCharacterSchema>;

function CreateCharacterModal() {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateCharacterForm>({
    resolver: zodResolver(createCharacterSchema)
  });

  const onSubmit = async (data: CreateCharacterForm) => {
    await createCharacter(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      {/* ... */}
    </form>
  );
}
```

---

## No `any` Types

**Regola**: Evitare `any` types. Se inevitabile, documentare perché.

### ❌ WRONG:
```typescript
// NO justification
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// Loses type safety
const result: any = await apiCall();
console.log(result.someField);  // No autocomplete, no error checking
```

### ✅ CORRECT:
```typescript
// Use unknown for truly unknown types
function processData(data: unknown): number[] {
  if (!Array.isArray(data)) {
    throw new Error('Data must be array');
  }

  return data.map(item => {
    if (typeof item !== 'object' || !('value' in item)) {
      throw new Error('Invalid item format');
    }
    return item.value as number;
  });
}

// Use generics
function fetchData<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
  // Type-safe fetch with validation
}

// Use proper types
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const result: ApiResponse<User> = await apiCall();
console.log(result.data.username);  // ✅ Type-safe!

// If truly necessary, document why
// @ts-expect-error - Legacy API returns inconsistent types, migration planned
const legacyData: any = await legacyApiCall();
```

---

## Interface vs Type

### Use `interface` for:

```typescript
// Object shapes (can be extended)
interface User {
  _id: string;
  username: string;
  email: string;
}

// Extending
interface AdminUser extends User {
  permissions: string[];
}

// Declaration merging (rare, but useful for augmentation)
interface Window {
  customProperty: string;
}
```

### Use `type` for:

```typescript
// Unions
type Status = 'active' | 'inactive' | 'banned';

// Intersections
type AdminUser = User & { permissions: string[] };

// Mapped types
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Function types
type EventHandler = (event: Event) => void;

// Tuples
type Point = [number, number];
```

### General Rule:

- **Interfaces**: For object shapes that might be extended
- **Types**: For everything else (unions, tuples, utilities)

---

## Import Organization

**Regola**: Consistent import order.

```typescript
// 1. React and framework imports
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// 2. External libraries (alphabetical)
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Internal absolute imports (@/* aliases)
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api/client';

// 4. Types (separate group)
import type { Character } from '@/types/api/character';
import type { ApiResponse } from '@/types/api/common';

// 5. Relative imports (avoid if possible)
import { helper } from './utils';

// 6. Styles (last)
import styles from './Component.module.scss';
```

---

## Unused Parameters

**Pattern**: Prefix with `_` quando parametro è richiesto ma non usato.

```typescript
// ✅ CORRECT - _ prefix prevents lint error
function MyComponent({ title, _subtitle, content }: Props) {
  // subtitle required by interface but not used in this component
  return <div>{title}: {content}</div>;
}

// Express middleware
app.use((req, res, _next) => {
  // next not used, but required by Express signature
  res.json({ ok: true });
});

// React Query
useMutation({
  mutationFn: sendMessage,
  onSuccess: (_data, _variables, _context) => {
    // Don't need data/variables/context, but signature requires them
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }
});
```

---

## Generic Types Best Practices

```typescript
// ✅ CORRECT - Descriptive generic names
function fetchData<TData, TError = Error>(
  endpoint: string
): Promise<ApiResponse<TData>> {
  // TData clearly indicates data type
  // TError has default but can be overridden
}

// ✅ CORRECT - Constrained generics
function processItems<T extends { id: string }>(items: T[]): T[] {
  // T must have id property
  return items.filter(item => item.id !== '');
}

// ✅ CORRECT - Multiple generic constraints
function merge<T extends object, U extends object>(
  obj1: T,
  obj2: U
): T & U {
  return { ...obj1, ...obj2 };
}

// ❌ WRONG - Single-letter generics without context
function fetchData<T>(endpoint: string): Promise<T> {
  // What is T? Data? Error? Response?
}
```

---

## Type Guards

```typescript
// User-defined type guards
function isCharacter(value: unknown): value is Character {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'name' in value &&
    'userId' in value
  );
}

// Usage
function processData(data: unknown) {
  if (isCharacter(data)) {
    // TypeScript knows data is Character here
    console.log(data.name);  // ✅ Type-safe
  }
}

// Assertion functions
function assertIsCharacter(value: unknown): asserts value is Character {
  if (!isCharacter(value)) {
    throw new Error('Not a valid character');
  }
}

// Usage
function processCharacter(data: unknown) {
  assertIsCharacter(data);
  // TypeScript knows data is Character after this line
  console.log(data.name);  // ✅ Type-safe
}
```

---

## Cross-References

- **Path aliases configuration**: Vedi tsconfig.json in ogni project
- **Zod schemas**: Vedi `apps/*/src/types/api/schemas.ts`
- **API validation**: Vedi [apps/shared-frontend.md](./apps/shared-frontend.md)
- **Backend types**: Vedi [services/shared-backend.md](./services/shared-backend.md)
