import { Error as MongooseError } from 'mongoose';
import { ErrorCode, createError } from './errorCodes';

interface ValidatorErrorProperties {
  minlength?: number;
  maxlength?: number;
  min?: number;
  max?: number;
  enumValues?: string[];
}

// ✅ Traduzione errori Mongoose in italiano
export function translateMongooseError(error: MongooseError.ValidationError): {
  message: string;
  code: ErrorCode;
  details: Record<string, string>;
} {
  const details: Record<string, string> = {};

  Object.keys(error.errors).forEach(field => {
    const err = error.errors[field];

    switch (err.kind) {
      case 'required':
        details[field] = `Il campo ${field} è obbligatorio`;
        break;
      case 'minlength':
        details[field] = `Il campo ${field} deve essere di almeno ${(err as { properties: ValidatorErrorProperties }).properties.minlength} caratteri`;
        break;
      case 'maxlength':
        details[field] = `Il campo ${field} non può superare ${(err as { properties: ValidatorErrorProperties }).properties.maxlength} caratteri`;
        break;
      case 'min':
        details[field] = `Il valore di ${field} deve essere almeno ${(err as { properties: ValidatorErrorProperties }).properties.min}`;
        break;
      case 'max':
        details[field] = `Il valore di ${field} non può superare ${(err as { properties: ValidatorErrorProperties }).properties.max}`;
        break;
      case 'enum':
        details[field] = `Il valore di ${field} non è valido. Valori accettati: ${(err as { properties: ValidatorErrorProperties }).properties.enumValues?.join(', ')}`;
        break;
      case 'unique':
        details[field] = `Il valore di ${field} è già in uso`;
        break;
      default:
        details[field] = err.message;
    }
  });

  return {
    message: 'Errore di validazione',
    code: ErrorCode.VALIDATION_ERROR,
    details
  };
}

// ✅ Traduzione errori MongoDB duplicate key
export function translateDuplicateKeyError(error: any): {
  message: string;
  code: ErrorCode;
  details: Record<string, any>;
} {
  const field = Object.keys(error.keyPattern)[0];
  const value = error.keyValue[field];

  // Messaggi specifici per campi comuni
  let message = `Il valore di ${field} è già in uso`;
  let code = ErrorCode.RESOURCE_ALREADY_EXISTS;

  if (field === 'username') {
    message = 'Nome utente già in uso';
    code = ErrorCode.USERNAME_TAKEN;
  } else if (field === 'email') {
    message = 'Email già registrata';
    code = ErrorCode.EMAIL_TAKEN;
  }

  return {
    message,
    code,
    details: {
      field,
      value
    }
  };
}

// ✅ Traduzione errori Mongoose CastError (ObjectId invalido)
export function translateCastError(error: any): {
  message: string;
  code: ErrorCode;
  details: Record<string, any>;
} {
  return {
    message: 'ID non valido',
    code: ErrorCode.INVALID_FORMAT,
    details: {
      field: error.path,
      value: error.value,
      expectedType: error.kind
    }
  };
}

// ✅ Validazione password strength
export function validatePasswordStrength(password: string): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (password.length < 8) {
    violations.push('La password deve essere di almeno 8 caratteri');
  }

  if (!/[A-Z]/.test(password)) {
    violations.push('La password deve contenere almeno una lettera maiuscola');
  }

  if (!/[a-z]/.test(password)) {
    violations.push('La password deve contenere almeno una lettera minuscola');
  }

  if (!/[0-9]/.test(password)) {
    violations.push('La password deve contenere almeno un numero');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    violations.push('La password deve contenere almeno un carattere speciale');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// ✅ Validazione email format
export function validateEmail(email: string): boolean {
  // Segmento dominio senza "." per evitare backtracking super-lineare (S8786)
  const emailRegex = /^[^\s@]+@[^\s.@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ✅ Validazione username format
export function validateUsername(username: string): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (username.length < 3) {
    violations.push('Il nome utente deve essere di almeno 3 caratteri');
  }

  if (username.length > 20) {
    violations.push('Il nome utente non può superare 20 caratteri');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    violations.push('Il nome utente può contenere solo lettere, numeri, underscore e trattini');
  }

  if (/^[0-9]/.test(username)) {
    violations.push('Il nome utente non può iniziare con un numero');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// ✅ Sanitize user input (rimuove HTML, trim whitespace)
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<[^<>]*>/g, '') // Remove HTML tags (classe senza "<" per evitare backtracking, S8786)
    .replace(/[<>]/g, '');   // Remove angle brackets
}

// ✅ Validate ObjectId format
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Escape di caratteri speciali regex per un uso sicuro in $regex MongoDB.
 * Previene ReDoS e NoSQL injection quando si usa input utente in pattern regex.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Middleware Express per validare ObjectId nei parametri della route.
 * Restituisce 400 se l'ID non e un ObjectId MongoDB valido.
 *
 * @param paramName - nome del parametro route (default: 'id')
 *
 * @example
 * router.get('/:id', validateObjectId(), MyController.getById);
 * router.get('/:characterId', validateObjectId('characterId'), MyController.getByCharacterId);
 */
export function validateObjectId(paramName: string = 'id') {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void => {
    const id = req.params[paramName] as string | undefined;
    if (!id || typeof id !== 'string' || !isValidObjectId(id)) {
      res.status(400).json({
        result: false,
        error: `ID non valido per il parametro '${paramName}'`,
        code: 'INVALID_OBJECT_ID',
        timestamp: new Date().toISOString()
      });
      return;
    }
    next();
  };
}
