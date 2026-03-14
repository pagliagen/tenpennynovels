# API Response Standards - Admin Module

## Overview

Questo documento definisce gli standard **OBBLIGATORI** per le risposte API di tutti gli endpoint `/admin/*`.

**CRITICAL**: Tutti i nuovi endpoint DEVONO seguire questi standard. Le deviazioni causano inconsistenze frontend e bug difficili da debuggare.

---

## Response Types

### 1. List Response (GET /admin/users, GET /admin/characters, ecc.)

**Formato Obbligatorio**:
```typescript
{
  result: true,
  success: true,
  list: T[],                // ⚠️ SEMPRE al root level, MAI dentro 'data'
  pagination: {
    page: number,
    totalPages: number,
    totalItems: number,
    pageSize: number,
    hasNextPage: boolean,
    hasPrevPage: boolean
  },
  message?: string,        // Opzionale
  timestamp: string,       // ISO 8601
  requestId?: string       // Per request tracing
}
```

**Tipo TypeScript**: `ApiListResponse<T>`

**Helper Function**: `listResponse(list, pagination, message?, requestId?)`

**Esempio**:
```typescript
import { listResponse, getRequestId } from '../utils/apiResponse';

// ✅ CORRETTO
const users = await User.find().limit(25);
const pagination = {
  page: 1,
  totalPages: 5,
  totalItems: 120,
  pageSize: 25,
  hasNextPage: true,
  hasPrevPage: false
};
res.json(listResponse(users, pagination, undefined, getRequestId(req)));

// ❌ SBAGLIATO - NON usare successResponse per liste
res.json(successResponse({ list: users, pagination }, getRequestId(req)));
// ^ Questo wrappa in 'data' object creando un formato inconsistente
```

---

### 2. Single Record Response (GET /admin/users/:id, POST /admin/users, PATCH /admin/users/:id)

**Formato Obbligatorio**:
```typescript
{
  result: true,
  success: true,
  data: T,                 // ⚠️ Singolo record dentro 'data' object
  message?: string,        // Es: "Utente creato con successo"
  timestamp: string,
  requestId?: string
}
```

**Tipo TypeScript**: `ApiSingleResponse<T>`

**Helper Function**: `successResponse(data, message?, requestId?)`

**Esempio**:
```typescript
import { successResponse, getRequestId } from '../utils/apiResponse';

// ✅ CORRETTO
const user = await User.findById(userId);
res.json(successResponse(user, undefined, getRequestId(req)));
```

---

### 3. Error Response (Tutti gli endpoint in caso di errore)

**Formato Obbligatorio**:
```typescript
{
  result: false,
  success: false,
  error: string,           // Messaggio leggibile
  code?: string,           // Es: "USER_NOT_FOUND", "VALIDATION_ERROR"
  details?: ErrorDetails,  // Dettagli aggiuntivi (field, expectedType, ecc.)
  timestamp: string,
  requestId?: string
}
```

**Tipo TypeScript**: `ApiErrorResponse`

**Helper Function**: `errorResponse(error, code?, details?, statusCode?, requestId?)`

**Esempio**:
```typescript
import { errorResponse, getRequestId } from '../utils/apiResponse';

// ✅ CORRETTO
if (!user) {
  return res.status(404).json(errorResponse(
    'Utente non trovato',
    'USER_NOT_FOUND',
    { userId },
    404,
    getRequestId(req)
  ));
}
```

---

### 4. Delete Response (DELETE endpoints)

**Formato Obbligatorio**:
```typescript
{
  result: true,
  success: true,
  message: string,         // Es: "Utente eliminato con successo"
  timestamp: string,
  requestId?: string
}
```

**Helper Function**: `deleteResponse(message?, requestId?)`

---

## Common Patterns

### Lista Vuota (No Results)

**CRITICAL**: Anche con 0 risultati, usare SEMPRE `listResponse()`:

```typescript
// ✅ CORRETTO
if (users.length === 0) {
  const emptyPagination = {
    page,
    totalPages: 0,
    totalItems: 0,
    pageSize,
    hasNextPage: false,
    hasPrevPage: false
  };
  return res.json(listResponse([], emptyPagination, undefined, getRequestId(req)));
}

// ❌ SBAGLIATO - Non usare successResponse
  return res.json(successResponse({ list: [], pagination: {...} }, getRequestId(req)));
```

### Early Returns in List Endpoints

Quando si fa early return in un list endpoint (es: validazione fallita prima di query DB), usare SEMPRE `listResponse()`:

```typescript
// ✅ CORRETTO
if (userIds.length === 0) {
  return res.json(listResponse([], emptyPagination, undefined, getRequestId(req)));
}

// ❌ SBAGLIATO
if (userIds.length === 0) {
  return res.json(successResponse({ list: [], pagination: {...} }));
}
```

---

## Checklist per Nuovi Endpoint

- [ ] **List endpoint**: Usa `listResponse()` per ritornare `list` e `pagination` al root level
- [ ] **Single record endpoint**: Usa `successResponse()` per ritornare `data` object
- [ ] **Error handling**: Usa `errorResponse()` con status code appropriato
- [ ] **TypeScript**: Funzione tipizzata con `ApiListResponse<T>`, `ApiSingleResponse<T>`, o `ApiErrorResponse`
- [ ] **Early returns**: Rispettano lo stesso formato del flusso normale
- [ ] **Empty results**: Liste vuote usano `listResponse([], emptyPagination)`
- [ ] **Request ID**: Sempre incluso con `getRequestId(req)`

---

## Import Statement Template

```typescript
import {
  listResponse,
  successResponse,
  errorResponse,
  deleteResponse,
  getRequestId
} from '../utils/apiResponse';
import type {
  ApiListResponse,
  ApiSingleResponse,
  ApiErrorResponse,
  PaginationInfo
} from '../types/management';
```

---

## Esempi Completi

### List Endpoint

```typescript
async getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, pageSize = 25 } = req.query;

    const totalUsers = await User.countDocuments();
    const users = await User.find()
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const pagination: PaginationInfo = {
      page: Number(page),
      totalPages: Math.ceil(totalUsers / pageSize),
      totalItems: totalUsers,
      pageSize: Number(pageSize),
      hasNextPage: page < Math.ceil(totalUsers / pageSize),
      hasPrevPage: page > 1
    };

    res.json(listResponse(users, pagination, undefined, getRequestId(req)));
  } catch (error) {
    res.status(500).json(errorResponse(
      'Failed to fetch users',
      'FETCH_ERROR',
      { error: error.message },
      500,
      getRequestId(req)
    ));
  }
}
```

### Single Record Endpoint

```typescript
async getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errorResponse(
        'User not found',
        'USER_NOT_FOUND',
        { userId },
        404,
        getRequestId(req)
      ));
    }

    res.json(successResponse(user, undefined, getRequestId(req)));
  } catch (error) {
    res.status(500).json(errorResponse(
      'Failed to fetch user',
      'FETCH_ERROR',
      { error: error.message },
      500,
      getRequestId(req)
    ));
  }
}
```

---

## Perché Questi Standard?

1. **Consistency**: Frontend può fare parse uniforme delle risposte
2. **Type Safety**: TypeScript catching errori a compile time
3. **Debugging**: Request ID permette tracing end-to-end
4. **Developer Experience**: Chiaro a colpo d'occhio quale tipo di risposta aspettarsi
5. **Maintainability**: Modifiche future si propagano automaticamente via helper functions

---

**Last Updated**: 2026-03-03
**Version**: 1.0.0
**Maintainer**: Backend Team
