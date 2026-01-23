import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiResponse } from '../types/game';
import { BackgroundQuestion } from '../../../database/models/BackgroundQuestion';

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
        success: false,
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

    body('apparentAge')
      .isInt({ min: 16, max: 80 })
      .withMessage('Età apparente deve essere tra 16 e 80 anni'),

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

    body('guidedBackground.beliefSystem')
      .notEmpty()
      .withMessage('Sistema di credenze è richiesto')
      .isIn(['razionalista', 'spiritualista', 'occultista', 'agnostico', 'religioso'])
      .withMessage('Sistema di credenze non valido'),

    body('guidedBackground.phobias')
      .optional()
      .isArray()
      .withMessage('Fobie deve essere un array'),

    body('guidedBackground.phobias.*')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Ogni fobia non può superare 200 caratteri')
      .trim(),

    body('guidedBackground.pastTraumas')
      .optional()
      .isArray()
      .withMessage('Traumi passati deve essere un array'),

    body('guidedBackground.pastTraumas.*')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Ogni trauma non può superare 500 caratteri')
      .trim(),

    body('guidedBackground.significantBonds')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Legami significativi non può superare 1000 caratteri')
      .trim(),

    body('guidedBackground.secrets')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Segreti non può superare 1000 caratteri')
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

    body('guidedBackground.beliefSystem')
      .optional()
      .isIn(['razionalista', 'spiritualista', 'occultista', 'agnostico', 'religioso'])
      .withMessage('Sistema di credenze non valido'),

    body('guidedBackground.phobias')
      .optional()
      .isArray()
      .withMessage('Fobie deve essere un array'),

    body('guidedBackground.phobias.*')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Ogni fobia non può superare 200 caratteri')
      .trim(),

    body('guidedBackground.pastTraumas')
      .optional()
      .isArray()
      .withMessage('Traumi passati deve essere un array'),

    body('guidedBackground.pastTraumas.*')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Ogni trauma non può superare 500 caratteri')
      .trim(),

    body('guidedBackground.significantBonds')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Legami significativi non può superare 1000 caratteri')
      .trim(),

    body('guidedBackground.secrets')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Segreti non può superare 1000 caratteri')
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
   * Custom validation for guided background completeness
   */
  static validateGuidedBackgroundCompleteness(req: Request, res: Response, next: NextFunction) {
    const { guidedBackground } = req.body;
    
    if (guidedBackground) {
      const errors = [];

      // Verifica che il belief system sia valido
      if (!guidedBackground.beliefSystem || 
          !['razionalista', 'spiritualista', 'occultista', 'agnostico', 'religioso'].includes(guidedBackground.beliefSystem)) {
        errors.push('Sistema di credenze mancante o non valido');
      }

      // Verifica limiti array
      if (guidedBackground.phobias && guidedBackground.phobias.length > 10) {
        errors.push('Massimo 10 fobie permesse');
      }

      if (guidedBackground.pastTraumas && guidedBackground.pastTraumas.length > 10) {
        errors.push('Massimo 10 traumi passati permessi');
      }

      if (errors.length > 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Background validation failed',
          code: 'BACKGROUND_VALIDATION_ERROR',
          details: { guidedBackground: errors.join(', ') },
          timestamp: new Date().toISOString()
        };

        return res.status(400).json(response);
      }
    }

    next();
  }

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
   * Validate background questionnaire completion for character submission
   */
  static async validateBackgroundCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const characterId = req.params.characterId;
      const userId = req.user!.userId;

      // Trova il personaggio
      const Character = require('../../../database/models').Character;
      const character = await Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $ne: 'DELETED' }
      });

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        return res.status(404).json(response);
      }

      // Ottieni le domande obbligatorie
      const requiredQuestions = await BackgroundQuestion.find({ 
        isActive: true, 
        isRequired: true 
      }).select('questionId');

      const requiredQuestionIds = requiredQuestions.map(q => q.questionId);

      // Controlla se il personaggio ha risposto a tutte le domande obbligatorie
      const completionCheck = await character.checkBackgroundCompletion(requiredQuestionIds);

      if (!completionCheck.completed) {
        const response: ApiResponse = {
          success: false,
          error: 'Background questionnaire incomplete',
          code: 'BACKGROUND_INCOMPLETE',
          details: {
            missingQuestions: completionCheck.missing,
            requiredCount: requiredQuestionIds.length,
            answeredCount: requiredQuestionIds.length - completionCheck.missing.length
          },
          timestamp: new Date().toISOString()
        };
        return res.status(400).json(response);
      }

      // Se tutto è a posto, continua
      next();

    } catch (error: any) {
      console.error('Background completion validation error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to validate background completion',
        code: 'BACKGROUND_VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      return res.status(500).json(response);
    }
  }
}