/**
 * Input Validation Utilities
 *
 * Protects against injection, DoS, and malformed data.
 * Provides runtime type guards for events.
 */

import { config, DocumentType } from '../config';
import type {
  DocumentEmbeddingEvent,
  ChatEmbeddingEvent,
} from '../types/events';

// MongoDB ObjectId validation
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export function validateObjectId(id: string, fieldName: string = 'ID'): void {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${fieldName}: must be 24-char hex string (MongoDB ObjectId)`);
  }
}

// Text length validation (DoS prevention)
export function validateTextLength(text: string, fieldName: string = 'text'): void {
  if (!text || typeof text !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be non-empty string`);
  }

  if (text.length > config.validation.maxTextLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${config.validation.maxTextLength} characters`
    );
  }
}

// Document type validation
export function validateDocumentType(type: string): DocumentType {
  const allowed = config.validation.allowedDocumentTypes;
  if (!allowed.includes(type as DocumentType)) {
    throw new Error(`Invalid document type: must be one of ${allowed.join(', ')}`);
  }
  return type as DocumentType;
}

// Search params validation (DoS prevention)
export function validateSearchParams(params: {
  limit?: number;
  minScore?: number;
  type?: string;
}): { limit: number; minScore: number; type?: DocumentType } {
  const limit = params.limit ?? 10;
  const minScore = params.minScore ?? 0.4;

  // Validate limit range (DoS prevention)
  if (!Number.isInteger(limit) || limit < 1 || limit > config.validation.maxSearchLimit) {
    throw new Error(
      `Invalid limit: must be integer between 1 and ${config.validation.maxSearchLimit}`
    );
  }

  // Validate score range
  if (
    typeof minScore !== 'number' ||
    minScore < config.validation.minSearchScore ||
    minScore > config.validation.maxSearchScore
  ) {
    throw new Error(
      `Invalid minScore: must be number between ${config.validation.minSearchScore} and ${config.validation.maxSearchScore}`
    );
  }

  // Validate type if provided
  const type = params.type ? validateDocumentType(params.type) : undefined;

  return { limit, minScore, type };
}

// Event validation (runtime type guards)
export function validateDocumentEvent(event: DocumentEmbeddingEvent): void {
  validateObjectId(event.documentId, 'documentId');
  validateTextLength(event.title, 'title');
  validateTextLength(event.content, 'content');
  validateDocumentType(event.type);

  // Validate contentDelta if provided
  if (event.contentDelta) {
    if (typeof event.contentDelta !== 'object' || event.contentDelta === null) {
      throw new Error('contentDelta must be a valid TipTap Delta object');
    }
  }
}

export function validateChatEvent(event: ChatEmbeddingEvent): void {
  validateObjectId(event.chatId, 'chatId');
  validateObjectId(event.characterId, 'characterId');
  validateObjectId(event.locationId, 'locationId');
  validateTextLength(event.content, 'content');

  if (!event.characterName || typeof event.characterName !== 'string') {
    throw new Error('characterName must be non-empty string');
  }
}

