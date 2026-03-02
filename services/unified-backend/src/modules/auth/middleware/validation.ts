import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiResponse, ValidationError } from '@shared/types';
import { CryptoUtils } from '../utils/crypto';
import { validationConfig } from '@config/runtime/validation';

export class ValidationMiddleware {
  /**
   * Handle validation results and return errors if any
   */
  static handleValidationErrors(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const validationErrors: ValidationError[] = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }));

      const response: ApiResponse = {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
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
   * Registration validation rules
   */
  static validateRegistration = [
    body('username')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .notEmpty()
      .withMessage('Username is required'),

    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(validationConfig.normalizeEmail)
      .notEmpty()
      .withMessage('Email is required'),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .custom((password) => {
        const validation = CryptoUtils.validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(validation.violations.join(', '));
        }
        return true;
      }),

    body('displayName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Display name must be less than 50 characters')
      .trim(),

    body('agreeToTerms')
      .isBoolean()
      .withMessage('Agreement to terms must be a boolean')
      .custom((value) => {
        if (value !== true) {
          throw new Error('You must agree to the terms and conditions');
        }
        return true;
      }),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Login validation rules
   */
  static validateLogin = [
    body('username')
      .notEmpty()
      .withMessage('Username or email is required')
      .trim(),

    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean'),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Character selection validation
   */
  static validateCharacterSelection = [
    body('characterId')
      .notEmpty()
      .withMessage('Character ID is required')
      .isMongoId()
      .withMessage('Character ID must be a valid MongoDB ObjectId'),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Email validation
   */
  static validateEmail = [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(validationConfig.normalizeEmail)
      .notEmpty()
      .withMessage('Email is required'),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Password change validation
   */
  static validatePasswordChange = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),

    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .custom((password) => {
        const validation = CryptoUtils.validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(validation.violations.join(', '));
        }
        return true;
      }),

    body('confirmNewPassword')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      }),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Password reset validation
   */
  static validatePasswordReset = [
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .custom((password) => {
        const validation = CryptoUtils.validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(validation.violations.join(', '));
        }
        return true;
      }),

    body('confirmPassword')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      }),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Profile update validation
   */
  static validateProfileUpdate = [
    body('displayName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Display name must be less than 50 characters')
      .trim(),

    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),

    body('preferences.emailNotifications')
      .optional()
      .isBoolean()
      .withMessage('Email notifications preference must be a boolean'),

    body('preferences.marketingEmails')
      .optional()
      .isBoolean()
      .withMessage('Marketing emails preference must be a boolean'),

    body('preferences.theme')
      .optional()
      .isIn(['victorian_dark', 'victorian_light'])
      .withMessage('Theme must be either victorian_dark or victorian_light'),

    body('preferences.language')
      .optional()
      .isIn(['en', 'it'])
      .withMessage('Language must be either en or it'),

    body('preferences.timezone')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Timezone must be less than 50 characters'),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Availability check validation
   */
  static validateAvailabilityCheck = [
    body('username')
      .optional()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),

    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(validationConfig.normalizeEmail),

    // At least one field must be provided
    body()
      .custom((value, { req }) => {
        if (!req.body.username && !req.body.email) {
          throw new Error('Either username or email must be provided');
        }
        return true;
      }),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Username or email identifier validation (for forgot password)
   */
  static validateIdentifier = [
    body('identifier')
      .notEmpty()
      .withMessage('Username or email is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Identifier must be between 3 and 50 characters')
      .custom((value) => {
        // Check if it's either a valid email OR a valid username
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isUsername = /^[a-zA-Z0-9_]+$/.test(value);
        
        if (!isEmail && !isUsername) {
          throw new Error('Must be a valid email address or username (letters, numbers, underscores only)');
        }
        return true;
      })
      .trim(),
    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Suspicious report validation
   */
  static validateSuspiciousReport = [
    body('type')
      .notEmpty()
      .withMessage('Report type is required')
      .isIn(['unauthorized_access_attempt', 'suspicious_activity', 'phishing_attempt', 'account_compromise'])
      .withMessage('Invalid report type'),

    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters')
      .trim(),

    body('details')
      .optional()
      .isObject()
      .withMessage('Details must be an object'),

    ValidationMiddleware.handleValidationErrors
  ];

  /**
   * Resend verification validation (accepts username or email)
   */
  static validateResendVerification = [
    body('username')
      .notEmpty()
      .withMessage('Username or email is required')
      .trim(),

    ValidationMiddleware.handleValidationErrors
  ];
}