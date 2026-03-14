import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';

export class CharacterValidationMiddleware {
  /**
   * Handle validation results and return errors if any
   */
  static handleValidationErrors(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const validationErrors = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }));

      const response: ApiResponse = {
        result: false,
        error: 'Validation failed',
        code: 'CHARACTER_VALIDATION_ERROR',
        details: validationErrors.reduce((acc, err) => {
          acc[err.field] = err.message;
          return acc;
        }, {} as Record<string, string>),
        timestamp: new Date().toISOString()
      };

      return res.status(400).json(response);
    }

    next();
  }

  /**
   * Character creation validation
   */
  static validateCharacterCreation = [
    body('name')
      .notEmpty()
      .withMessage('Nome è richiesto')
      .isLength({ min: 2, max: 50 })
      .withMessage('Nome deve essere tra 2 e 50 caratteri')
      .trim(),

    body('birthplace')
      .notEmpty()
      .withMessage('Luogo di nascita è richiesto')
      .isLength({ min: 2, max: 100 })
      .withMessage('Luogo di nascita deve essere tra 2 e 100 caratteri')
      .trim(),

    body('currentOccupation')
      .notEmpty()
      .withMessage('Occupazione attuale è richiesta')
      .isLength({ min: 2, max: 100 })
      .withMessage('Occupazione attuale deve essere tra 2 e 100 caratteri')
      .trim(),

    body('apparentAge')
      .isInt({ min: 16, max: 80 })
      .withMessage('Età apparente deve essere tra 16 e 80 anni'),

    body('height')
      .notEmpty()
      .withMessage('Altezza è obbligatoria')
      .isLength({ max: 20 })
      .withMessage('Altezza non può superare 20 caratteri')
      .trim()
      .custom((value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 100 || num > 250) {
          throw new Error('Altezza deve essere tra 100 e 250 cm');
        }
        return true;
      }),

    body('weight')
      .notEmpty()
      .withMessage('Peso è obbligatorio')
      .isLength({ max: 20 })
      .withMessage('Peso non può superare 20 caratteri')
      .trim()
      .custom((value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 30 || num > 200) {
          throw new Error('Peso deve essere tra 30 e 200 kg');
        }
        return true;
      }),

    body('physicalDescription')
      .notEmpty()
      .withMessage('Descrizione fisica è richiesta')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Descrizione fisica deve essere tra 10 e 1000 caratteri')
      .trim(),

    body('nationality')
      .notEmpty()
      .withMessage('Nazionalità è richiesta')
      .isLength({ max: 50 })
      .withMessage('Nazionalità non può superare 50 caratteri')
      .trim(),

    body('publicDescription')
      .notEmpty()
      .withMessage('Descrizione pubblica è richiesta')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Descrizione pubblica deve essere tra 10 e 1000 caratteri')
      .trim(),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Character update validation
   */
  static validateCharacterUpdate = [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Nome deve essere tra 2 e 50 caratteri')
      .trim(),

    body('apparentAge')
      .optional()
      .isInt({ min: 16, max: 80 })
      .withMessage('Età apparente deve essere tra 16 e 80 anni'),

    body('physicalDescription')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Descrizione fisica deve essere tra 10 e 1000 caratteri')
      .trim(),

    body('nationality')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Nazionalità non può superare 50 caratteri')
      .trim(),

    body('publicDescription')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Descrizione pubblica deve essere tra 10 e 1000 caratteri')
      .trim(),

    body('avatar')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') {
          return true; // Allow empty values
        }
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error('Avatar deve essere un URL valido');
        }
      }),

    body('profileImage')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') {
          return true; // Allow empty values
        }
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error('Immagine di profilo deve essere un URL valido');
        }
      }),

    body('audioTheme')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') {
          return true; // Allow empty values
        }
        // Check if it's a valid URL (including YouTube URLs)
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error('Audio tema deve essere un URL valido');
        }
      }),

    body('prestavolto')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Prestavolto non può superare 100 caratteri')
      .trim(),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Validation for character submission
   */
  static validateCharacterSubmission = [
    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Validation for background questionnaire responses
   */
  static validateBackgroundResponses = [
    body('responses')
      .isArray()
      .withMessage('Responses must be an array'),

    body('responses.*.questionId')
      .notEmpty()
      .withMessage('Question ID is required')
      .trim(),

    body('responses.*.response')
      .notEmpty()
      .withMessage('Response is required')
      .trim(),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Validate new background format (9 structured fields)
   *
   * Validates the background object with fields:
   * - briefHistory* (min 100 chars)
   * - personality* (min 50 chars)
   * - goalsAndMotivations* (min 50 chars)
   * - significantEvents, importantRelationships, ideology, significantPlaces, fearsAndPhobias, secrets (optional)
   *
   * Also validates basicInfo fields:
   * - publicDescription* (min 50 chars)
   * - privateDescription* (min 50 chars)
   * - physicalDescription (optional)
   */
  static validateNewBackgroundFormat = [
    // BasicInfo required fields
    body('publicDescription')
      .notEmpty()
      .withMessage('Descrizione pubblica è richiesta')
      .isLength({ min: 50, max: 4000 })
      .withMessage('Descrizione pubblica deve essere tra 50 e 4000 caratteri')
      .trim(),

    body('privateDescription')
      .notEmpty()
      .withMessage('Descrizione privata è richiesta')
      .isLength({ min: 50, max: 4000 })
      .withMessage('Descrizione privata deve essere tra 50 e 4000 caratteri')
      .trim(),

    body('physicalDescription')
      .optional()
      .isLength({ max: 4000 })
      .withMessage('Descrizione fisica non può superare 4000 caratteri')
      .trim(),

    // Background required fields
    body('background.briefHistory')
      .notEmpty()
      .withMessage('Storia in breve è richiesta')
      .isLength({ min: 100, max: 4000 })
      .withMessage('Storia in breve deve essere tra 100 e 4000 caratteri')
      .trim(),

    body('background.personality')
      .notEmpty()
      .withMessage('Personalità è richiesta')
      .isLength({ min: 50, max: 2500 })
      .withMessage('Personalità deve essere tra 50 e 2500 caratteri')
      .trim(),

    body('background.goalsAndMotivations')
      .notEmpty()
      .withMessage('Obiettivi e motivazioni sono richiesti')
      .isLength({ min: 50, max: 2500 })
      .withMessage('Obiettivi e motivazioni devono essere tra 50 e 2500 caratteri')
      .trim(),

    // Background optional fields
    body('background.significantEvents')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Fatti salienti non possono superare 2500 caratteri')
      .trim(),

    body('background.importantRelationships')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Relazioni importanti non possono superare 2500 caratteri')
      .trim(),

    body('background.ideology')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Ideologia non può superare 2500 caratteri')
      .trim(),

    body('background.significantPlaces')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Luoghi significativi non possono superare 2500 caratteri')
      .trim(),

    body('background.fearsAndPhobias')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Paure e fobie non possono superare 2500 caratteri')
      .trim(),

    body('background.secrets')
      .optional()
      .isLength({ max: 2500 })
      .withMessage('Segreti non possono superare 2500 caratteri')
      .trim(),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Victorian era appropriate content validation
   */
  static validateVictorianContent = [
    body('physicalDescription')
      .optional()
      .custom((value) => {
        // Lista di parole/concetti non appropriati per l'era vittoriana
        const modernTerms = ['computer', 'internet', 'cellphone', 'wifi', 'bluetooth'];
        const valueToCheck = value.toLowerCase();
        
        for (const term of modernTerms) {
          if (valueToCheck.includes(term)) {
            throw new Error(`Termine non appropriato per l'ambientazione vittoriana: ${term}`);
          }
        }
        
        return true;
      }),

    body('publicDescription')
      .optional()
      .custom((value) => {
        const modernTerms = ['computer', 'internet', 'cellphone', 'wifi', 'bluetooth'];
        const valueToCheck = value.toLowerCase();
        
        for (const term of modernTerms) {
          if (valueToCheck.includes(term)) {
            throw new Error(`Termine non appropriato per l'ambientazione vittoriana: ${term}`);
          }
        }
        
        return true;
      }),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * Validate background completion for character submission
   *
   * Checks that the character has complete background information in the new format:
   * - publicDescription (min 50 chars)
   * - privateDescription (min 50 chars)
   * - background.briefHistory (min 100 chars)
   * - background.personality (min 50 chars)
   * - background.goalsAndMotivations (min 50 chars)
   */
  static async validateBackgroundCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const characterId = req.params.characterId;
      const userId = req.user!.userId;

      // Find character
      const Character = require('../../../database/models').Character;
      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

      if (!character) {
        const response: ApiResponse = {
          result: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        return res.status(404).json(response);
      }

      // Validate required background fields
      const errors: string[] = [];

      // Check basicInfo fields
      if (!character.publicDescription || character.publicDescription.length < 50) {
        errors.push('Descrizione pubblica mancante o troppo breve (minimo 50 caratteri)');
      }

      if (!character.privateDescription || character.privateDescription.length < 50) {
        errors.push('Descrizione privata mancante o troppo breve (minimo 50 caratteri)');
      }

      // Check background object fields
      if (!character.background) {
        errors.push('Background strutturato mancante');
      } else {
        if (!character.background.briefHistory || character.background.briefHistory.length < 100) {
          errors.push('Storia in breve mancante o troppo breve (minimo 100 caratteri)');
        }

        if (!character.background.personality || character.background.personality.length < 50) {
          errors.push('Personalità mancante o troppo breve (minimo 50 caratteri)');
        }

        if (!character.background.goalsAndMotivations || character.background.goalsAndMotivations.length < 50) {
          errors.push('Obiettivi e motivazioni mancanti o troppo brevi (minimo 50 caratteri)');
        }
      }

      if (errors.length > 0) {
        const response: ApiResponse = {
          result: false,
          error: 'Background incomplete',
          code: 'BACKGROUND_INCOMPLETE',
          details: {
            errors,
            missingFields: errors.length
          },
          timestamp: new Date().toISOString()
        };
        return res.status(400).json(response);
      }

      // All checks passed
      next();

    } catch (error: any) {
      logger.error('Background completion validation error:', error);

      const response: ApiResponse = {
        result: false,
        error: 'Failed to validate background completion',
        code: 'BACKGROUND_VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      };

      return res.status(500).json(response);
    }
  }
}