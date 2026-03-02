// ✅ Codici Errore Standardizzati
export enum ErrorCode {
  // Authentication Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Registration Errors
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_USERNAME = 'INVALID_USERNAME',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',

  // Character Errors
  CHARACTER_NOT_FOUND = 'CHARACTER_NOT_FOUND',
  CHARACTER_DELETED = 'CHARACTER_DELETED',
  CHARACTER_NOT_APPROVED = 'CHARACTER_NOT_APPROVED',
  CHARACTER_ALREADY_EXISTS = 'CHARACTER_ALREADY_EXISTS',
  MULTIPLE_CHARACTERS_NOT_ALLOWED = 'MULTIPLE_CHARACTERS_NOT_ALLOWED',
  CHARACTER_LIMIT_REACHED = 'CHARACTER_LIMIT_REACHED',

  // Location Errors
  LOCATION_NOT_FOUND = 'LOCATION_NOT_FOUND',
  LOCATION_ACCESS_DENIED = 'LOCATION_ACCESS_DENIED',
  ALREADY_IN_LOCATION = 'ALREADY_IN_LOCATION',
  NOT_IN_LOCATION = 'NOT_IN_LOCATION',

  // Password Reset Errors
  RESET_TOKEN_INVALID = 'RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED = 'RESET_TOKEN_EXPIRED',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  SAME_PASSWORD = 'SAME_PASSWORD',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // Permission Errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // System Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMAIL_SEND_ERROR = 'EMAIL_SEND_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Resource Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Document/Ticket/Forum Errors
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  FORUM_POST_NOT_FOUND = 'FORUM_POST_NOT_FOUND',
  COMMENT_NOT_FOUND = 'COMMENT_NOT_FOUND',

  // Economy Errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED'
}

// ✅ Messaggi Errore in ITALIANO
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.USER_NOT_FOUND]: 'Utente non trovato',
  [ErrorCode.INVALID_PASSWORD]: 'Password non corretta',
  [ErrorCode.EMAIL_NOT_VERIFIED]: 'Email non verificata. Controlla la tua casella di posta.',
  [ErrorCode.ACCOUNT_BANNED]: 'Account bannato permanentemente',
  [ErrorCode.ACCOUNT_SUSPENDED]: 'Account sospeso',
  [ErrorCode.TOKEN_EXPIRED]: 'Token scaduto',
  [ErrorCode.TOKEN_INVALID]: 'Token non valido',
  [ErrorCode.UNAUTHORIZED]: 'Accesso non autorizzato',
  [ErrorCode.SESSION_EXPIRED]: 'Sessione scaduta. Effettua nuovamente il login.',
  [ErrorCode.SESSION_NOT_FOUND]: 'Sessione non trovata',
  [ErrorCode.INVALID_CREDENTIALS]: 'Credenziali non valide',

  // Registration
  [ErrorCode.USERNAME_TAKEN]: 'Nome utente già in uso',
  [ErrorCode.EMAIL_TAKEN]: 'Email già registrata',
  [ErrorCode.WEAK_PASSWORD]: 'Password troppo debole',
  [ErrorCode.INVALID_EMAIL]: 'Formato email non valido',
  [ErrorCode.INVALID_USERNAME]: 'Nome utente non valido',
  [ErrorCode.REGISTRATION_FAILED]: 'Registrazione fallita. Riprova più tardi.',

  // Character
  [ErrorCode.CHARACTER_NOT_FOUND]: 'Personaggio non trovato',
  [ErrorCode.CHARACTER_DELETED]: 'Personaggio eliminato',
  [ErrorCode.CHARACTER_NOT_APPROVED]: 'Personaggio non ancora approvato',
  [ErrorCode.CHARACTER_ALREADY_EXISTS]: 'Hai già un personaggio con questo nome',
  [ErrorCode.MULTIPLE_CHARACTERS_NOT_ALLOWED]: 'Non puoi creare più di un personaggio',
  [ErrorCode.CHARACTER_LIMIT_REACHED]: 'Hai raggiunto il limite massimo di personaggi',

  // Location
  [ErrorCode.LOCATION_NOT_FOUND]: 'Location non trovata',
  [ErrorCode.LOCATION_ACCESS_DENIED]: 'Accesso alla location negato',
  [ErrorCode.ALREADY_IN_LOCATION]: 'Sei già in questa location',
  [ErrorCode.NOT_IN_LOCATION]: 'Non sei in una location',

  // Password Reset
  [ErrorCode.RESET_TOKEN_INVALID]: 'Token di reset non valido',
  [ErrorCode.RESET_TOKEN_EXPIRED]: 'Token di reset scaduto',
  [ErrorCode.PASSWORD_RESET_FAILED]: 'Reset password fallito. Riprova.',
  [ErrorCode.SAME_PASSWORD]: 'La nuova password deve essere diversa dalla precedente',

  // Validation
  [ErrorCode.VALIDATION_ERROR]: 'Errore di validazione',
  [ErrorCode.MISSING_FIELD]: 'Campo obbligatorio mancante',
  [ErrorCode.INVALID_FORMAT]: 'Formato non valido',
  [ErrorCode.INVALID_VALUE]: 'Valore non valido',
  [ErrorCode.INVALID_OPERATION]: 'Operazione non valida',

  // Permission
  [ErrorCode.ACCESS_DENIED]: 'Accesso negato',
  [ErrorCode.PERMISSION_DENIED]: 'Permesso negato',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Permessi insufficienti per questa operazione',

  // System
  [ErrorCode.DATABASE_ERROR]: 'Errore del database',
  [ErrorCode.EMAIL_SEND_ERROR]: 'Impossibile inviare email',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Troppe richieste. Riprova più tardi.',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Errore interno del server',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Servizio temporaneamente non disponibile',

  // Resource
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Risorsa non trovata',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Risorsa già esistente',
  [ErrorCode.RESOURCE_CONFLICT]: 'Conflitto con risorsa esistente',

  // Document/Ticket/Forum
  [ErrorCode.DOCUMENT_NOT_FOUND]: 'Documento non trovato',
  [ErrorCode.TICKET_NOT_FOUND]: 'Ticket non trovato',
  [ErrorCode.FORUM_POST_NOT_FOUND]: 'Post del forum non trovato',
  [ErrorCode.COMMENT_NOT_FOUND]: 'Commento non trovato',

  // Economy
  [ErrorCode.INSUFFICIENT_FUNDS]: 'Fondi insufficienti',
  [ErrorCode.INVALID_TRANSACTION]: 'Transazione non valida',
  [ErrorCode.TRANSACTION_FAILED]: 'Transazione fallita'
};

// ✅ Helper per creare errori tipizzati
export function createError(
  code: ErrorCode,
  details?: Record<string, any>
): { message: string; code: ErrorCode; details?: Record<string, any> } {
  return {
    message: ERROR_MESSAGES[code],
    code,
    details
  };
}

// ✅ Helper per ottenere il messaggio di un errore
export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || 'Errore sconosciuto';
}
