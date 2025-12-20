import { Request, Response } from 'express';
import { User } from '../../../../packages/database/models';
import { ApiResponse } from '../../../../packages/shared/types';
import { logger, logSecurity } from '../utils/logger';
import { redis } from '../config/redis';
import { CryptoUtils } from '../utils/crypto'; 
import { SecurityAlert } from '../types/auth';

export class SecurityController {
  /**
   * GET /auth/security/sessions
   * Get active sessions for the user
   */
  static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // TODO: Implement proper session storage in Redis
      // For now, return mock data based on current session
      const currentSession = {
        id: CryptoUtils.generateSessionId(),
        deviceInfo: {
          browser: 'Chrome 120',
          os: 'Windows 11',
          deviceType: 'desktop' as const
        },
        location: {
          ipAddress: req.ip,
          country: 'Italy',
          city: 'Rome'
        },
        activity: {
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString() // 18 hours from now
        },
        isCurrent: true
      };

      const response: ApiResponse = {
        success: true,
        data: {
          sessions: [currentSession],
          summary: {
            totalSessions: 1,
            activeSessions: 1,
            suspiciousActivity: false
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Get sessions error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le sessioni',
        code: 'SESSIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * DELETE /auth/security/sessions/:sessionId
   * Terminate specific session
   */
  static async terminateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      // TODO: Implement proper session termination
      // For now, prevent terminating current session
      if (sessionId === 'current') {
        const response: ApiResponse = {
          success: false,
          error: 'Non puoi terminare la sessione corrente',
          code: 'CANNOT_TERMINATE_CURRENT_SESSION',
          details: {
            useLogout: true
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      logSecurity('session_terminated', {
        userId,
        sessionId,
        terminatedBy: 'user',
        ipAddress: req.ip
      });

      // Publish Redis event
      await redis.publish('auth:session_terminated', {
        userId,
        sessionId,
        reason: 'user_terminated',
        terminatedAt: new Date().toISOString()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Session terminated successfully',
        data: {
          sessionId,
          terminatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Terminate session error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile terminare la sessione',
        code: 'SESSION_TERMINATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /auth/security/login-history
   * Get login history for the user
   */
  static async getLoginHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 20;
      const days = parseInt(req.query.days as string) || 30;

      // TODO: Implement proper login history storage
      // For now, return mock data
      const loginHistory = [
        {
          timestamp: new Date().toISOString(),
          status: 'success' as const,
          deviceInfo: {
            browser: 'Chrome 120',
            os: 'Windows 11'
          },
          location: {
            ipAddress: req.ip,
            country: 'Italy',
            city: 'Rome'
          }
        },
        {
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          status: 'failed' as const,
          reason: 'invalid_password',
          deviceInfo: {
            browser: 'Chrome 120',
            os: 'Windows 11'
          },
          location: {
            ipAddress: req.ip,
            country: 'Italy',
            city: 'Rome'
          }
        }
      ];

      const response: ApiResponse = {
        success: true,
        data: {
          loginHistory,
          summary: {
            totalLogins: 45,
            successfulLogins: 43,
            failedAttempts: 2,
            suspiciousAttempts: 0,
            newLocations: 0
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Get login history error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare lo storico dei login',
        code: 'LOGIN_HISTORY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /auth/security/alerts
   * Get security alerts for the user
   */
  static async getSecurityAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // TODO: Implement proper security alerts storage
      // For now, return mock data
      const alerts: SecurityAlert[] = [
        {
          id: 'alert_123',
          userId,
          type: 'new_device_login',
          severity: 'medium',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
          message: 'New device login detected',
          details: {
            device: 'iPhone 15 Pro',
            location: 'Milan, Italy',
            ipAddress: '192.168.2.100'
          },
          action: 'verify_device',
          acknowledged: false
        },
        {
          id: 'alert_456',
          userId,
          type: 'failed_login_attempts',
          severity: 'low',
          timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000),
          message: 'Multiple failed login attempts',
          details: {
            attempts: 3,
            ipAddress: '203.0.113.195',
            location: 'Unknown'
          },
          action: 'change_password_recommended',
          acknowledged: true
        }
      ];

      const response: ApiResponse = {
        success: true,
        data: { alerts },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Get security alerts error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare gli avvisi di sicurezza',
        code: 'SECURITY_ALERTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/security/report-suspicious
   * Report suspicious activity
   */
  static async reportSuspicious(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { type, description, details } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const reportId = CryptoUtils.generateShortHash(`${userId}-${Date.now()}`);
      const ticketNumber = `SEC-${new Date().getFullYear()}-${reportId.toUpperCase()}`;

      logSecurity('suspicious_activity_reported', {
        userId,
        username: user.username,
        reportId,
        type,
        description,
        details,
        ipAddress: req.ip
      });

      // Publish Redis event
      await redis.publish('auth:suspicious_activity', {
        userId,
        activityType: 'user_report',
        details: {
          reportId,
          type,
          description,
          reportedDetails: details
        },
        timestamp: new Date().toISOString()
      });

      const response: ApiResponse = {
        success: true,
        data: {
          report: {
            id: reportId,
            type,
            status: 'investigating',
            reportedAt: new Date().toISOString(),
            ticketNumber
          },
          immediateActions: {
            passwordChangeRecommended: true,
            allSessionsTerminated: false,
            accountSecured: true
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Report suspicious error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile segnalare attività sospetta',
        code: 'REPORT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /auth/security/acknowledge-alert/:alertId
   * Acknowledge a security alert
   */
  static async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const userId = req.user!.userId;

      // TODO: Implement proper alert acknowledgment
      logSecurity('alert_acknowledged', {
        userId,
        alertId,
        acknowledgedAt: new Date().toISOString(),
        ipAddress: req.ip
      });

      const response: ApiResponse = {
        success: true,
        message: 'Alert acknowledged successfully',
        data: {
          alertId,
          acknowledgedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Acknowledge alert error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile confermare l\'avviso',
        code: 'ACKNOWLEDGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}