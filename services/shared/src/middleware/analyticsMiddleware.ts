// =============================================================================
// Analytics Middleware - Tracking automatico delle richieste
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UAParser } from 'ua-parser-js';
import { AnalyticsService } from '../services/AnalyticsService';
import { GeoLocationService } from '../services/GeoLocationService';

// Extend Express Request to include analytics data
declare global {
  namespace Express {
    interface Request {
      analytics?: {
        sessionId: string;
        startTime: number;
        userInfo?: {
          userId: string;
          username: string;
        };
        browserInfo: {
          browser: string;
          browserVersion: string;
          device: string;
          os: string;
        };
        geoInfo?: {
          country: string;
          city: string;
        };
      };
    }
  }
}

export class AnalyticsMiddleware {
  /**
   * Initialize analytics tracking for each request
   */
  static initializeTracking() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Generate session ID or reuse existing one
        const sessionId = req.headers['x-session-id'] as string || 
                         req.cookies?.session_id || 
                         uuidv4();

        // Parse user agent
        const ua = new UAParser(req.headers['user-agent']);
        const browser = ua.getBrowser();
        const device = ua.getDevice();
        const os = ua.getOS();

        // Extract client IP
        const clientIp = req.ip || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress || 
                        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                        'unknown';

        // Initialize analytics data
        req.analytics = {
          sessionId,
          startTime: Date.now(),
          browserInfo: {
            browser: browser.name || 'Unknown',
            browserVersion: browser.version || 'Unknown',
            device: device.type || 'desktop',
            os: os.name || 'Unknown'
          }
        };

        // Set session cookie if not present
        if (!req.cookies?.session_id) {
          res.cookie('session_id', sessionId, {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          });
        }

        // Geolocalizzazione: reale se abilitata, altrimenti mock
        const useRealGeoLocation = process.env.GEOLOCATION_ENABLED === 'true';
        
        try {
          let geoData;
          
          if (useRealGeoLocation) {
            geoData = await GeoLocationService.getCityFromIP(clientIp);
          } else {
            // Usa mock data per sviluppo
            const mockLocation = await GeoLocationService.getCityFromIP('mock');
            geoData = mockLocation;
          }
          
          req.analytics.geoInfo = {
            country: geoData.country,
            city: geoData.city
          };
        } catch (error) {
          console.error('Geolocation error:', error);
          // Fallback di sicurezza
          req.analytics.geoInfo = {
            country: 'Italia',
            city: 'Milano'
          };
        }

        next();
      } catch (error) {
        console.error('Analytics initialization error:', error);
        next();
      }
    };
  }

  /**
   * Track page views (for frontend applications)
   */
  static trackPageView() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.analytics && req.method === 'GET') {
          // Only track GET requests that are likely page views
          const isPageView = !req.path.includes('/api/') && 
                           !req.path.includes('/static/') &&
                           !req.path.includes('/_next/');

          if (isPageView) {
            await AnalyticsService.trackPageView({
              sessionId: req.analytics.sessionId,
              userId: req.analytics.userInfo?.userId,
              path: req.path,
              title: `Page: ${req.path}`,
              referrer: req.headers.referer,
              browser: req.analytics.browserInfo.browser,
              browserVersion: req.analytics.browserInfo.browserVersion,
              device: req.analytics.browserInfo.device,
              os: req.analytics.browserInfo.os,
              ipAddress: req.ip || 'unknown',
              country: req.analytics.geoInfo?.country,
              city: req.analytics.geoInfo?.city
            });
          }
        }
        next();
      } catch (error) {
        console.error('Page view tracking error:', error);
        next();
      }
    };
  }

  /**
   * Track API calls and user actions
   */
  static trackUserAction() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Store original end function
        const originalEnd = res.end;

        // Override end function to capture response data
        res.end = function(chunk?: any, encoding?: any): Response<any, Record<string, any>> {
          try {
            if (req.analytics && req.analytics.userInfo && req.path.includes('/api/')) {
              const duration = Date.now() - req.analytics.startTime;
              const success = res.statusCode < 400;
              
              // Determine action and section from path
              const pathParts = req.path.split('/').filter(p => p);
              const section = pathParts[1] || 'unknown'; // e.g., 'admin', 'game'
              const action = `${req.method.toLowerCase()}_${pathParts.slice(2).join('_')}`;

              AnalyticsService.trackUserAction({
                sessionId: req.analytics.sessionId,
                userId: req.analytics.userInfo.userId,
                username: req.analytics.userInfo.username,
                action,
                section,
                details: {
                  path: req.path,
                  method: req.method,
                  statusCode: res.statusCode,
                  requestBody: req.body,
                  query: req.query
                },
                success,
                error: success ? undefined : `HTTP ${res.statusCode}`,
                duration,
                ipAddress: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
              }).catch(err => {
                console.error('Error tracking user action:', err);
              });
            }
          } catch (error) {
            console.error('Action tracking error:', error);
          }

          // Call original end function and return result
          return originalEnd.call(this, chunk, encoding);
        };

        next();
      } catch (error) {
        console.error('Action tracking setup error:', error);
        next();
      }
    };
  }

  /**
   * Set user information from authentication
   */
  static setUserInfo(userId: string, username: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.analytics) {
          req.analytics.userInfo = { userId, username };

          // Track or update session
          AnalyticsService.trackUserSession({
            sessionId: req.analytics.sessionId,
            userId,
            username,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            browser: req.analytics.browserInfo.browser,
            browserVersion: req.analytics.browserInfo.browserVersion,
            device: req.analytics.browserInfo.device,
            os: req.analytics.browserInfo.os,
            country: req.analytics.geoInfo?.country,
            city: req.analytics.geoInfo?.city
          }).catch(err => {
            console.error('Error tracking user session:', err);
          });
        }
        next();
      } catch (error) {
        console.error('User info setting error:', error);
        next();
      }
    };
  }

  /**
   * Track system metrics
   */
  static trackSystemMetrics(service: 'auth' | 'game' | 'management' | 'gateway') {
    return () => {
      setInterval(async () => {
        try {
          const metrics = await this.getSystemMetrics(service);
          await AnalyticsService.trackSystemMetrics(metrics);
        } catch (error) {
          console.error('System metrics tracking error:', error);
        }
      }, 60000); // Every minute
    };
  }

  /**
   * Get current system metrics
   */
  private static async getSystemMetrics(service: string) {
    // In a real implementation, you would gather actual system metrics
    // This is mock data for demonstration
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkIn: Math.random() * 1000,
      networkOut: Math.random() * 1000,
      activeConnections: Math.floor(Math.random() * 100),
      redisConnections: Math.floor(Math.random() * 10),
      mongoConnections: Math.floor(Math.random() * 10),
      responseTime: Math.random() * 1000,
      errorRate: Math.random() * 5,
      uptime: process.uptime(),
      service: service as 'auth' | 'game' | 'management' | 'gateway'
    };
  }

  /**
   * End session tracking (called on logout or session expiry)
   */
  static endSession() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.analytics) {
          await AnalyticsService.endUserSession(req.analytics.sessionId);
        }
        next();
      } catch (error) {
        console.error('Session end tracking error:', error);
        next();
      }
    };
  }

  /**
   * Track custom events
   */
  static trackEvent(eventType: string, eventData: any) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.analytics && req.analytics.userInfo) {
          await AnalyticsService.trackUserAction({
            sessionId: req.analytics.sessionId,
            userId: req.analytics.userInfo.userId,
            username: req.analytics.userInfo.username,
            action: eventType,
            section: 'custom_events',
            details: eventData,
            success: true,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
          });
        }
        next();
      } catch (error) {
        console.error('Custom event tracking error:', error);
        next();
      }
    };
  }
}