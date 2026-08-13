import { Router } from 'express';
import { RegistrationController } from '../controllers/RegistrationController';
import { AuthController } from '../controllers/AuthController';
import { PasswordController } from '../controllers/PasswordController';
import { ProfileController } from '../controllers/ProfileController';
import { SecurityController } from '../controllers/SecurityController';
import { AuthMiddleware } from '../middleware/auth';
import { RateLimitMiddleware } from '../middleware/rateLimit';
import { ValidationMiddleware } from '../middleware/validation';

const router = Router();

// Registration routes
router.post('/register',
  RateLimitMiddleware.registrationLimit(),
  ValidationMiddleware.validateRegistration,
  RegistrationController.register
);

router.post('/register/check-availability',
  RateLimitMiddleware.availabilityCheckLimit(),
  ValidationMiddleware.validateAvailabilityCheck,
  RegistrationController.checkAvailability
);

router.get('/check-username',
  RateLimitMiddleware.availabilityCheckLimit(),
  RegistrationController.checkUsername
);

router.get('/check-email',
  RateLimitMiddleware.availabilityCheckLimit(),
  RegistrationController.checkEmail
);

router.get('/verify-email/:token',
  RegistrationController.verifyEmail
);

router.post('/resend-verification',
  RateLimitMiddleware.emailVerificationLimit(),
  ValidationMiddleware.validateResendVerification,
  RegistrationController.resendVerification
);

// Authentication routes  
router.post('/login',
  RateLimitMiddleware.loginLimit(),
  RateLimitMiddleware.failedLoginLimit(),
  ValidationMiddleware.validateLogin,
  AuthController.login
);

router.post('/select-character',
  AuthMiddleware.authenticateUser(),
  ValidationMiddleware.validateCharacterSelection,
  AuthController.selectCharacter
);

router.post('/create-character',
  AuthMiddleware.authenticateUser(),
  AuthController.createCharacter
);

router.post('/refresh',
  AuthMiddleware.authenticateUser(),
  AuthController.refresh
);

router.get('/session',
  AuthMiddleware.authenticateUser(false),
  AuthMiddleware.authenticateCharacter(false), // Read character_context cookie if present
  AuthController.getSession
);

router.get('/effective-permissions',
  AuthMiddleware.authenticateUser(),
  AuthController.getEffectivePermissions
);

router.post('/logout',
  AuthMiddleware.authenticateUser(false),
  AuthController.logout
);

router.post('/logout-all',
  AuthMiddleware.authenticateUser(),
  AuthController.logoutAll
);

// Password management routes
router.post('/forgot-password',
  RateLimitMiddleware.passwordResetLimit(),
  ValidationMiddleware.validateIdentifier,
  PasswordController.forgotPassword
);

router.get('/reset-password/:token',
  PasswordController.verifyResetToken
);

router.post('/reset-password/:token',
  RateLimitMiddleware.passwordResetTokenLimit(),
  ValidationMiddleware.validatePasswordReset,
  PasswordController.resetPassword
);

router.post('/change-password',
  AuthMiddleware.authenticateUser(),
  RateLimitMiddleware.securityOperationsLimit(),
  ValidationMiddleware.validatePasswordChange,
  PasswordController.changePassword
);

// Profile management routes
router.get('/profile',
  AuthMiddleware.authenticateUser(),
  ProfileController.getProfile
);

router.put('/profile',
  AuthMiddleware.authenticateUser(),
  RateLimitMiddleware.profileUpdateLimit(),
  ValidationMiddleware.validateProfileUpdate,
  ProfileController.updateProfile
);

// GDPR routes
router.get('/profile/export',
  AuthMiddleware.authenticateUser(),
  RateLimitMiddleware.securityOperationsLimit(),
  ProfileController.exportData
);

router.post('/profile/request-deletion',
  AuthMiddleware.authenticateUser(),
  RateLimitMiddleware.securityOperationsLimit(),
  ProfileController.requestAccountDeletion
);

router.post('/delete-account/:token',
  RateLimitMiddleware.securityOperationsLimit(),
  ProfileController.confirmAccountDeletion
);

// Security routes
router.get('/security/sessions',
  AuthMiddleware.authenticateUser(),
  SecurityController.getSessions
);

router.delete('/security/sessions/:sessionId',
  AuthMiddleware.authenticateUser(),
  SecurityController.terminateSession
);

router.get('/security/login-history',
  AuthMiddleware.authenticateUser(),
  SecurityController.getLoginHistory
);

router.get('/security/alerts',
  AuthMiddleware.authenticateUser(),
  SecurityController.getSecurityAlerts
);

router.post('/security/report-suspicious',
  AuthMiddleware.authenticateUser(),
  ValidationMiddleware.validateSuspiciousReport,
  SecurityController.reportSuspicious
);

router.post('/security/acknowledge-alert/:alertId',
  AuthMiddleware.authenticateUser(),
  SecurityController.acknowledgeAlert
);

export default router;