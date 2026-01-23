# /api-standard-response

Guida per usare il formato API standardizzato di TenpennyNovels.

## Formato Standardizzato

Tutte le API devono usare questo formato di risposta:

```typescript
interface ApiResponse<T = any> {
  result: boolean;           // true/false (NON 'success')
  data?: T;                  // Single record data (per GET /:id, POST, PATCH)
  list?: T[];                // Array for list responses (per GET list)
  pagination?: PaginationInfo; // Pagination info (solo per list)
  message?: string;          // Optional message per POST/PATCH/DELETE
  error?: string;            // Error message se result = false
  code?: string;             // Error code (es. 'USER_NOT_FOUND')
  details?: ErrorDetails;    // Additional error details
  timestamp: string;         // Sempre presente (ISO 8601)
  requestId?: string;        // Optional per request tracing
}
```

## Helper Functions

Usa sempre helper da `utils/apiResponse.ts`:

### Success Response (Single Record)
```typescript
import { successResponse, getRequestId } from '../utils/apiResponse';

res.json(successResponse(data, message, getRequestId(req)));
```

### List Response (con Paginazione)
```typescript
import { listResponse, getRequestId } from '../utils/apiResponse';

const pagination: PaginationInfo = {
  page: 1,
  pageSize: 20,
  total: 100,
  totalPages: 5,
  hasNext: true,
  hasPrev: false
};

res.json(listResponse(items, pagination, message, getRequestId(req)));
```

### Error Response
```typescript
import { errorResponse, getRequestId } from '../utils/apiResponse';

res.status(400).json(errorResponse(
  'Error message',
  'ERROR_CODE',
  { additionalDetails: '...' }, // Opzionale
  400, // Status code
  getRequestId(req)
));
```

### Create Response (POST)
```typescript
import { createResponse, getRequestId } from '../utils/apiResponse';

res.status(201).json(createResponse(newRecord, 'Record created successfully', getRequestId(req)));
```

### Update Response (PATCH)
```typescript
import { updateResponse, getRequestId } from '../utils/apiResponse';

res.json(updateResponse(updatedRecord, 'Record updated successfully', getRequestId(req)));
```

### Delete Response (DELETE)
```typescript
import { deleteResponse, getRequestId } from '../utils/apiResponse';

res.json(deleteResponse('Record deleted successfully', getRequestId(req)));
```

## Esempi di Utilizzo

### GET List
```typescript
static async getItems(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    const total = await Item.countDocuments(filters);
    const items = await Item.find(filters)
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    
    const pagination: PaginationInfo = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1
    };
    
    res.json(listResponse(items, pagination, undefined, getRequestId(req)));
  } catch (error) {
    // Error handling
  }
}
```

### GET Single
```typescript
static async getItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      res.status(404).json(errorResponse(
        'Item not found',
        'ITEM_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
      return;
    }
    
    res.json(successResponse(item, undefined, getRequestId(req)));
  } catch (error) {
    // Error handling
  }
}
```

## Frontend Usage

Nel frontend, usa sempre `data.result`, `data.list`, `data.data`:

```typescript
const response = await apiRequest('/game/items');
if (response.result) {
  const items = response.list || []; // Usa list, NON data.items
  const pagination = response.pagination || {};
} else {
  console.error(response.error);
}
```

## Checklist

Quando crei/modifichi API:
- [ ] Usa helper functions da `utils/apiResponse.ts`
- [ ] Usa `result` (non `success`)
- [ ] List responses usano `list` (non `data.items`)
- [ ] Single responses usano `data`
- [ ] Error responses includono `code` e `error`
- [ ] Timestamp sempre presente
- [ ] RequestId incluso quando disponibile

## Note importanti

- **NO backward compatibility**: Solo nuovo formato (`result`, `list`, `data`)
- **Type safety**: Usa sempre TypeScript interfaces
- **Consistency**: Segui sempre questo formato, mai formati legacy

