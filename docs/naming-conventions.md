# Naming Conventions - TenpennyNovels

Questo documento definisce le convenzioni di naming utilizzate nel progetto TenpennyNovels per mantenere consistenza e facilitare la comprensione del codice.

## File e Directory

### File TypeScript
- **PascalCase** per file che esportano classi/interfacce principali: `CharacterController.ts`, `UserManagement.ts`
- **camelCase** per file utility/helper: `apiResponse.ts`, `logger.ts`
- **kebab-case** per file di configurazione: `next.config.js`, `tsconfig.json`

### Directory
- **camelCase** per directory: `src/controllers/`, `src/utils/`
- **kebab-case** per directory con più parole: `character-sheet/`, `on-game-mail/`

## TypeScript

### Interfaces
- **PascalCase** con prefisso `I` per interfacce database: `ICharacter`, `IUser`, `ILocation`
- **PascalCase** senza prefisso per interfacce generali: `ApiResponse`, `PaginationInfo`
- **PascalCase** per type aliases: `CharacterStatus`, `MessageType`

### Classes
- **PascalCase**: `CharacterController`, `UserManagementController`
- Suffisso descrittivo: `Controller`, `Service`, `Middleware`, `Utils`

### Functions
- **camelCase**: `getCharacter()`, `createUser()`, `validateInput()`
- Verbi all'inizio: `get`, `create`, `update`, `delete`, `validate`, `check`

### Variables
- **camelCase**: `characterId`, `userName`, `locationData`
- Nomi descrittivi: `characterApprovalStatus` invece di `status`
- Booleani con prefisso `is`, `has`, `can`: `isActive`, `hasPermission`, `canEdit`

### Constants
- **UPPER_SNAKE_CASE**: `MAX_RETRY_ATTEMPTS`, `DEFAULT_PAGE_SIZE`
- **PascalCase** per enum: `CharacterStatus`, `MessageType`

### Enums
- **PascalCase** per nome enum: `CharacterStatus`, `MessageType`
- **UPPER_SNAKE_CASE** per valori: `PENDING_APPROVAL`, `APPROVED`, `DELETED`

## Database

### Collections
- **camelCase** plurale: `characters`, `users`, `locations`
- Nomi descrittivi: `onGameMessages` invece di `messages`

### Fields
- **camelCase**: `characterId`, `userId`, `createdAt`
- Suffissi standardizzati:
  - `Id` per ObjectId: `characterId`, `userId`
  - `At` per Date: `createdAt`, `updatedAt`
  - `Ids` per array ObjectId: `characterIds`, `locationIds`

### Models
- **PascalCase** singolare: `Character`, `User`, `Location`
- Interface con prefisso `I`: `ICharacter`, `IUser`

## API Endpoints

### Routes
- **camelCase** per resource: `/characters`, `/onGameMessages`
- **RESTful** pattern: `GET /characters`, `POST /characters`, `GET /characters/:id`
- **kebab-case** per route complesse: `/character-sessions`, `/on-game-messages`

### Query Parameters
- **camelCase**: `page`, `pageSize`, `sortBy`, `sortOrder`
- Nomi standardizzati: `page`, `limit` o `pageSize`, `sortBy`, `sortOrder`

## React Components

### Components
- **PascalCase**: `CharacterSheet`, `LocationChat`, `TicketForm`
- Nomi descrittivi che indicano scopo

### Props Interfaces
- **PascalCase** con suffisso `Props`: `CharacterSheetProps`, `LocationChatProps`

### Hooks
- **camelCase** con prefisso `use`: `useCharacter`, `useLocation`, `useAuth`

### CSS Modules
- **camelCase** per classi: `.characterSheet`, `.locationChat`
- File: `[ComponentName].module.scss`

## Backend

### Controllers
- **PascalCase** con suffisso `Controller`: `CharacterController`, `UserManagementController`
- Metodi statici: `static async getCharacter()`

### Services
- **PascalCase** con suffisso `Service`: `EmailService`, `CharacterCreationConfigService`

### Middleware
- **PascalCase** con suffisso `Middleware`: `AuthMiddleware`, `CharacterSessionMiddleware`

### Utils
- **camelCase**: `apiResponse.ts`, `logger.ts`, `crypto.ts`
- Funzioni esportate: `successResponse()`, `errorResponse()`

## Error Codes

### Format
- **UPPER_SNAKE_CASE**: `USER_NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`
- Descrittivi e specifici: `CHARACTER_NOT_APPROVED` invece di `ERROR`

## Environment Variables

### Format
- **UPPER_SNAKE_CASE**: `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`
- Prefisso servizio quando necessario: `AUTH_BACKEND_URL`, `GAME_BACKEND_URL`

## Best Practices

1. **Consistency**: Mantieni consistenza all'interno dello stesso contesto
2. **Descriptive**: Usa nomi descrittivi che spiegano intento
3. **Avoid Abbreviations**: Evita abbreviazioni non standard
4. **Context Matters**: Considera contesto quando scegli naming
5. **Follow Patterns**: Segui pattern esistenti nel codebase

## Esempi

### ✅ BENE
```typescript
// Interface
interface ICharacter extends Document {
  characterName: string;
  userId: ObjectId;
  createdAt: Date;
}

// Function
async function getCharacterById(characterId: string): Promise<Character> {
  // ...
}

// Variable
const characterApprovalStatus: CharacterStatus = 'PENDING_APPROVAL';

// Component
export default function CharacterSheet({ character }: CharacterSheetProps) {
  // ...
}
```

### ❌ MALE
```typescript
// Interface (manca prefisso I per database)
interface Character extends Document {
  name: string; // troppo generico
  uid: ObjectId; // abbreviazione non standard
  created: Date; // manca suffisso At
}

// Function (nome generico)
async function get(id: string) {
  // ...
}

// Variable (troppo generico)
const status = 'PENDING';

// Component (nome generico)
export default function Component({ data }: Props) {
  // ...
}
```

