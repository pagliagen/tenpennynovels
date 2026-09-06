import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Character } from '@core/character/models/Character';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';

const MAX_TEXT = 5000;
const MAX_SHORT = 100;
const MAX_NAME = 50;

const optionalUrl = (field: string) =>
  body(field)
    .optional({ checkFalsy: true })
    .custom((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error(`${field} deve essere un URL valido`);
      }
    });

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
   * PUT /characters/:id — salvataggio progressivo dal wizard.
   *
   * Tutti i campi sono opzionali (il wizard salva anche stati parziali).
   * Unico scopo: cap anti-DDOS (max 5000 char per i testi) e validazione
   * di formato per i campi strutturati (URL, numeri).
   * Le regole di business (min char, completezza background) sono gestite
   * da validateBackgroundCompletion (submit) e characterCreationUtils.
   */
  static validateCharacterUpdate = [
    body('firstName')
      .optional()
      .isLength({ min: 2, max: MAX_NAME })
      .withMessage(`Nome deve essere tra 2 e ${MAX_NAME} caratteri`)
      .trim(),

    body('apparentAge')
      .optional({ checkFalsy: true })
      .isInt({ min: 0, max: 150 })
      .withMessage('Età apparente deve essere un numero intero'),

    body('nationality')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_SHORT })
      .withMessage(`Nazionalità non può superare ${MAX_SHORT} caratteri`)
      .trim(),

    body('prestavolto')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_SHORT })
      .withMessage(`Prestavolto non può superare ${MAX_SHORT} caratteri`)
      .trim(),

    body('height')
      .optional({ checkFalsy: true })
      .isLength({ max: 20 })
      .trim()
      .custom((value) => {
        if (!value) return true;
        const num = Number.parseFloat(value);
        if (Number.isNaN(num) || num < 50 || num > 300) {
          throw new Error('Altezza non valida (atteso: 50–300 cm)');
        }
        return true;
      }),

    body('weight')
      .optional({ checkFalsy: true })
      .isLength({ max: 20 })
      .trim()
      .custom((value) => {
        if (!value) return true;
        const num = Number.parseFloat(value);
        if (Number.isNaN(num) || num < 10 || num > 500) {
          throw new Error('Peso non valido (atteso: 10–500 kg)');
        }
        return true;
      }),

    // Campi testo libero: solo cap anti-DDOS
    body('physicalDescription')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Descrizione fisica non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('publicDescription')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Descrizione pubblica non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('privateDescription')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Descrizione privata non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    // Background: campi testo libero, solo cap
    body('background.briefHistory')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Storia in breve non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.personality')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Personalità non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.goalsAndMotivations')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Obiettivi e motivazioni non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.significantEvents')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Fatti salienti non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.importantRelationships')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Relazioni importanti non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.ideology')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Ideologia non può superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.significantPlaces')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Luoghi significativi non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.fearsAndPhobias')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Paure e fobie non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    body('background.secrets')
      .optional({ checkFalsy: true })
      .isLength({ max: MAX_TEXT })
      .withMessage(`Segreti non possono superare ${MAX_TEXT} caratteri`)
      .trim(),

    // Campi URL
    optionalUrl('avatar'),
    optionalUrl('profileImage'),
    optionalUrl('audioTheme'),

    CharacterValidationMiddleware.handleValidationErrors
  ];

  /**
   * POST /characters/:id/submit — validazione completezza pre-invio.
   *
   * Legge il personaggio dal DB e verifica che i campi obbligatori
   * per la sottomissione siano presenti e rispettino i minimi.
   */
  static async validateBackgroundCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const characterId = req.params.characterId;
      const userId = req.user!.userId;

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

      const errors: string[] = [];

      if (!character.background) {
        errors.push('Background strutturato mancante');
      } else {
        if (!character.background.briefHistory || character.background.briefHistory.length < 50) {
          errors.push('Storia in breve mancante o troppo breve (minimo 50 caratteri)');
        }
        if (!character.background.personality || character.background.personality.length < 50) {
          errors.push('Personalità mancante o troppo breve (minimo 50 caratteri)');
        }
      }

      if (errors.length > 0) {
        const response: ApiResponse = {
          result: false,
          error: 'Background incompleto',
          code: 'BACKGROUND_INCOMPLETE',
          details: { errors, missingFields: errors.length },
          timestamp: new Date().toISOString()
        };
        return res.status(400).json(response);
      }

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
