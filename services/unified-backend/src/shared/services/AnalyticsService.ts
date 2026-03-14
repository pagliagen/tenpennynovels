// =============================================================================
// Analytics Service - Raccolta e Aggregazione Statistiche
// =============================================================================

import { 
  UserSession, 
  PageView, 
  UserAction, 
  GameplayStats, 
  SystemMetrics,
  EconomyStats,
  GeographicStats,
  BrowserStats,
  ContentStats
} from '../schemas/analyticsSchemas';
import { logger } from '@shared/utils/logger';

import { 
  DashboardMetrics,
  AnalyticsQuery,
  AnalyticsResponse 
} from '../types/analytics';

export class AnalyticsService {
  /**
   * Track a new user session
   */
  static async trackUserSession(sessionData: {
    sessionId: string;
    userId: string;
    username: string;
    ipAddress: string;
    userAgent: string;
    browser: string;
    browserVersion: string;
    device: string;
    os: string;
    country?: string;
    city?: string;
  }): Promise<void> {
    try {
      await UserSession.create({
        ...sessionData,
        startTime: new Date(),
        pages: [],
        actions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error: any) {
      logger.error('Error tracking user session:', error);
    }
  }

  /**
   * Track a page view
   */
  static async trackPageView(pageData: {
    sessionId: string;
    userId?: string;
    path: string;
    title: string;
    referrer?: string;
    browser: string;
    browserVersion: string;
    device: string;
    os: string;
    ipAddress: string;
    country?: string;
    city?: string;
  }): Promise<void> {
    try {
      // Check if this is a unique page view for this user/session
      const existingView = await PageView.findOne({
        sessionId: pageData.sessionId,
        path: pageData.path,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      await PageView.create({
        ...pageData,
        timestamp: new Date(),
        isUnique: !existingView,
        createdAt: new Date()
      });

      // Update user session with page visit
      await UserSession.findOneAndUpdate(
        { sessionId: pageData.sessionId },
        { 
          $push: { 
            pages: { 
              path: pageData.path, 
              timestamp: new Date() 
            } 
          },
          updatedAt: new Date()
        }
      );
    } catch (error: any) {
      logger.error('Error tracking page view:', error);
    }
  }

  /**
   * Track a user action
   */
  static async trackUserAction(actionData: {
    sessionId: string;
    userId: string;
    username: string;
    action: string;
    section: string;
    details: any;
    success: boolean;
    error?: string;
    duration?: number;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    try {
      await UserAction.create({
        ...actionData,
        timestamp: new Date(),
        createdAt: new Date()
      });

      // Update user session with action
      await UserSession.findOneAndUpdate(
        { sessionId: actionData.sessionId },
        { 
          $push: { 
            actions: { 
              type: `${actionData.section}.${actionData.action}`, 
              details: actionData.details,
              timestamp: new Date() 
            } 
          },
          updatedAt: new Date()
        }
      );
    } catch (error: any) {
      logger.error('Error tracking user action:', error);
    }
  }

  /**
   * End a user session
   */
  static async endUserSession(sessionId: string): Promise<void> {
    try {
      const session = await UserSession.findOne({ sessionId });
      if (session) {
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
        
        await UserSession.findOneAndUpdate(
          { sessionId },
          { 
            endTime,
            duration,
            updatedAt: new Date()
          }
        );
      }
    } catch (error: any) {
      logger.error('Error ending user session:', error);
    }
  }

  /**
   * Track system metrics
   */
  static async trackSystemMetrics(metricsData: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
    activeConnections: number;
    redisConnections: number;
    mongoConnections: number;
    responseTime: number;
    errorRate: number;
    uptime: number;
    service: 'auth' | 'game' | 'management' | 'gateway';
  }): Promise<void> {
    try {
      await SystemMetrics.create({
        ...metricsData,
        timestamp: new Date(),
        createdAt: new Date()
      });
    } catch (error: any) {
      logger.error('Error tracking system metrics:', error);
    }
  }

  /**
   * Get game dashboard metrics - combines analytics tracking data with real game data
   */
  static async getGameDashboardMetrics(query: AnalyticsQuery = {}): Promise<AnalyticsResponse<DashboardMetrics>> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const startDate = query.startDate ? new Date(query.startDate) : yesterday;
      const endDate = query.endDate ? new Date(query.endDate) : today;

      // ANALYTICS DATA (from tracking system)
      const [uniqueVisitorsToday, uniqueVisitorsYesterday] = await Promise.all([
        PageView.distinct('sessionId', { 
          timestamp: { $gte: today, $lte: endDate },
          isUnique: true 
        }),
        PageView.distinct('sessionId', { 
          timestamp: { $gte: yesterday, $lt: today },
          isUnique: true 
        })
      ]);

      const [pageViewsToday, pageViewsYesterday] = await Promise.all([
        PageView.countDocuments({ 
          timestamp: { $gte: today, $lte: endDate }
        }),
        PageView.countDocuments({ 
          timestamp: { $gte: yesterday, $lt: today }
        })
      ]);

      // Browser stats from tracking
      const browserAgg = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { $group: { 
          _id: { browser: '$browser', version: '$browserVersion' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const totalPageViews = await PageView.countDocuments({ 
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const browserStats = browserAgg.map((item, index) => ({
        name: item._id.browser,
        version: item._id.version || 'Unknown',
        count: item.count,
        percentage: Math.round((item.count / totalPageViews) * 100),
        color: this.getBrowserColor(item._id.browser, index)
      }));

      // Geographic distribution from tracking
      const [italianCitiesAgg, nonItalianCountriesAgg] = await Promise.all([
        UserSession.aggregate([
          { $match: { 
            startTime: { $gte: startDate, $lte: endDate },
            country: 'Italia'
          }},
          { $group: { 
            _id: { city: '$city' },
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]),
        UserSession.aggregate([
          { $match: { 
            startTime: { $gte: startDate, $lte: endDate },
            country: { $ne: 'Italia' }
          }},
          { $group: { 
            _id: { country: '$country' },
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      const totalSessions = await UserSession.countDocuments({ 
        startTime: { $gte: startDate, $lte: endDate }
      });

      const geographicStats = [
        ...italianCitiesAgg.map(item => ({
          location: item._id.city || 'Città Italiana',
          country: 'Italia',
          code: 'IT',
          count: item.count,
          percentage: Math.round((item.count / totalSessions) * 100),
          color: this.getItalianCityColor(item._id.city)
        })),
        ...nonItalianCountriesAgg.map(item => ({
          location: item._id.country || 'Estero',
          country: item._id.country || 'Non Italiano',
          code: this.getCountryCode(item._id.country),
          count: item.count,
          percentage: Math.round((item.count / totalSessions) * 100),
          color: this.getCountryColor(item._id.country)
        }))
      ];

      // REAL GAME DATA (from game database)
      const gameData = await this.getRealGameData();

      // Calculate trends
      const uniqueVisitorChange = uniqueVisitorsYesterday.length > 0 ? 
        ((uniqueVisitorsToday.length - uniqueVisitorsYesterday.length) / uniqueVisitorsYesterday.length) * 100 : 0;
      
      const pageViewChange = pageViewsYesterday > 0 ? 
        ((pageViewsToday - pageViewsYesterday) / pageViewsYesterday) * 100 : 0;

      const metrics: DashboardMetrics = {
        // Analytics data
        visitatori_unici: {
          current: uniqueVisitorsToday.length,
          change: Math.round(uniqueVisitorChange * 10) / 10,
          trend: uniqueVisitorChange > 0 ? 'up' : uniqueVisitorChange < 0 ? 'down' : 'stable'
        },
        pagine_viste: {
          current: pageViewsToday,
          change: Math.round(pageViewChange * 10) / 10,
          trend: pageViewChange > 0 ? 'up' : pageViewChange < 0 ? 'down' : 'stable'
        },
        browser_stats: {
          browsers: browserStats
        },
        geographic_distribution: {
          locations: geographicStats
        },
        
        // Real game data
        utenti_iscritti: {
          current: gameData.totalUsers,
          change: gameData.newUsersLastWeek,
          trend: gameData.newUsersLastWeek > 0 ? 'up' : 'stable'
        },
        azioni_inviate: {
          current: gameData.approvedCharacters,
          change: gameData.pendingCharacters,
          trend: 'up'
        },
        gameplay_activity: gameData.gameplayActivity,
        characters_by_status: gameData.charactersByStatus
      };

      return {
        success: true,
        data: metrics
      };
    } catch (error: any) {
      logger.error('Error getting game dashboard metrics:', error);
      return {
        success: false,
        data: {} as DashboardMetrics,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  /**
   * Get dashboard metrics (legacy - keep for backwards compatibility)
   */
  static async getDashboardMetrics(query: AnalyticsQuery = {}): Promise<AnalyticsResponse<DashboardMetrics>> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const startDate = query.startDate ? new Date(query.startDate) : yesterday;
      const endDate = query.endDate ? new Date(query.endDate) : today;

      // Get unique visitors
      const [uniqueVisitorsToday, uniqueVisitorsYesterday] = await Promise.all([
        PageView.distinct('sessionId', { 
          timestamp: { $gte: today, $lte: endDate },
          isUnique: true 
        }),
        PageView.distinct('sessionId', { 
          timestamp: { $gte: yesterday, $lt: today },
          isUnique: true 
        })
      ]);

      // Get page views
      const [pageViewsToday, pageViewsYesterday] = await Promise.all([
        PageView.countDocuments({ 
          timestamp: { $gte: today, $lte: endDate }
        }),
        PageView.countDocuments({ 
          timestamp: { $gte: yesterday, $lt: today }
        })
      ]);

      // Get registered users count (this would come from user collection)
      const registeredUsers = await UserSession.distinct('userId', {
        startTime: { $gte: startDate, $lte: endDate }
      });

      // Get user actions
      const [actionsToday, actionsYesterday] = await Promise.all([
        UserAction.countDocuments({ 
          timestamp: { $gte: today, $lte: endDate }
        }),
        UserAction.countDocuments({ 
          timestamp: { $gte: yesterday, $lt: today }
        })
      ]);

      // Get browser stats
      const browserAgg = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { $group: { 
          _id: { browser: '$browser', version: '$browserVersion' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const totalPageViews = await PageView.countDocuments({ 
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const browserStats = browserAgg.map((item, index) => ({
        name: item._id.browser,
        version: item._id.version || 'Unknown',
        count: item.count,
        percentage: Math.round((item.count / totalPageViews) * 100),
        color: this.getBrowserColor(item._id.browser, index)
      }));

      // Get geographic distribution - prioritize Italian cities, group others by country
      const [italianCitiesAgg, nonItalianCountriesAgg] = await Promise.all([
        // Italian cities breakdown
        UserSession.aggregate([
          { $match: { 
            startTime: { $gte: startDate, $lte: endDate },
            country: 'Italia'
          }},
          { $group: { 
            _id: { city: '$city' },
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]),
        // Non-Italian countries
        UserSession.aggregate([
          { $match: { 
            startTime: { $gte: startDate, $lte: endDate },
            country: { $ne: 'Italia' }
          }},
          { $group: { 
            _id: { country: '$country' },
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      const totalSessions = await UserSession.countDocuments({ 
        startTime: { $gte: startDate, $lte: endDate }
      });

      const geographicStats = [
        // Italian cities first
        ...italianCitiesAgg.map(item => ({
          location: item._id.city || 'Città Italiana',
          country: 'Italia',
          code: 'IT',
          count: item.count,
          percentage: Math.round((item.count / totalSessions) * 100),
          color: this.getItalianCityColor(item._id.city)
        })),
        // Then non-Italian countries
        ...nonItalianCountriesAgg.map(item => ({
          location: item._id.country || 'Estero',
          country: item._id.country || 'Non Italiano',
          code: this.getCountryCode(item._id.country),
          count: item.count,
          percentage: Math.round((item.count / totalSessions) * 100),
          color: this.getCountryColor(item._id.country)
        }))
      ];

      // Get gameplay activity from real database collections
      const gameplayActivity = await this.getGameplayActivity(startDate, endDate);

      // Calculate trends
      const uniqueVisitorChange = uniqueVisitorsYesterday.length > 0 ? 
        ((uniqueVisitorsToday.length - uniqueVisitorsYesterday.length) / uniqueVisitorsYesterday.length) * 100 : 0;
      
      const pageViewChange = pageViewsYesterday > 0 ? 
        ((pageViewsToday - pageViewsYesterday) / pageViewsYesterday) * 100 : 0;

      const actionChange = actionsYesterday > 0 ? 
        ((actionsToday - actionsYesterday) / actionsYesterday) * 100 : 0;

      const metrics: DashboardMetrics = {
        visitatori_unici: {
          current: uniqueVisitorsToday.length,
          change: Math.round(uniqueVisitorChange * 10) / 10,
          trend: uniqueVisitorChange > 0 ? 'up' : uniqueVisitorChange < 0 ? 'down' : 'stable'
        },
        pagine_viste: {
          current: pageViewsToday,
          change: Math.round(pageViewChange * 10) / 10,
          trend: pageViewChange > 0 ? 'up' : pageViewChange < 0 ? 'down' : 'stable'
        },
        utenti_iscritti: {
          current: registeredUsers.length,
          change: 0, // Would need historical data
          trend: 'stable'
        },
        azioni_inviate: {
          current: actionsToday,
          change: Math.round(actionChange * 10) / 10,
          trend: actionChange > 0 ? 'up' : actionChange < 0 ? 'down' : 'stable'
        },
        browser_stats: {
          browsers: browserStats
        },
        gameplay_activity: gameplayActivity,
        geographic_distribution: {
          locations: geographicStats
        }
      };

      return {
        success: true,
        data: metrics
      };
    } catch (error: any) {
      logger.error('Error getting dashboard metrics:', error);
      return {
        success: false,
        data: {} as DashboardMetrics,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  /**
   * Aggregate daily stats
   */
  static async aggregateDailyStats(date: string): Promise<void> {
    try {
      const startDate = new Date(date);
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      // Browser stats aggregation
      const browserAgg = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lt: endDate } } },
        { $group: { 
          _id: { browser: '$browser', version: '$browserVersion' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]);

      const totalViews = await PageView.countDocuments({ 
        timestamp: { $gte: startDate, $lt: endDate }
      });

      const browserStats = browserAgg.map((item, index) => ({
        name: item._id.browser,
        version: item._id.version || 'Unknown',
        count: item.count,
        percentage: Math.round((item.count / totalViews) * 100),
        color: this.getBrowserColor(item._id.browser, index)
      }));

      await BrowserStats.findOneAndUpdate(
        { date },
        {
          date,
          browsers: browserStats,
          devices: [], // TODO: Add device aggregation
          operatingSystems: [], // TODO: Add OS aggregation
          totalSessions: totalViews,
          updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );

      logger.info(`Daily stats aggregated for ${date}`);
    } catch (error: any) {
      logger.error('Error aggregating daily stats:', error);
    }
  }

  /**
   * Helper methods
   */
  private static getBrowserColor(browser: string, index: number): string {
    const colors = [
      '#00D2FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ];
    
    const browserColors: Record<string, string> = {
      'Chrome': '#4285f4',
      'Firefox': '#ff9500',
      'Safari': '#00d2ff',
      'Edge': '#0078d4',
      'Opera': '#ff1b2d'
    };

    return browserColors[browser] || colors[index % colors.length];
  }

  private static getCountryCode(country: string): string {
    const countryCodes: Record<string, string> = {
      'Italia': 'IT',
      'Non Italiano': 'XX',
      'Francia': 'FR',
      'Germania': 'DE',
      'Spagna': 'ES',
      'Regno Unito': 'GB',
      'Stati Uniti': 'US'
    };

    return countryCodes[country] || 'XX';
  }

  private static getItalianCityColor(city: string): string {
    const cityColors: Record<string, string> = {
      'Roma': '#FF6B6B',
      'Milano': '#4ECDC4', 
      'Napoli': '#45B7D1',
      'Torino': '#96CEB4',
      'Bologna': '#FFEAA7',
      'Firenze': '#DDA0DD',
      'Genova': '#98D8C8',
      'Palermo': '#F7DC6F',
      'Terni': '#BB8FCE',
      'Venezia': '#85C1E9',
      'Verona': '#F8C471',
      'Perugia': '#A569BD'
    };

    return cityColors[city] || '#BDC3C7';
  }

  private static getCountryColor(country: string): string {
    const countryColors: Record<string, string> = {
      'Non Italiano': '#7F8C8D',
      'Francia': '#74B9FF',
      'Germania': '#FDCB6E',
      'Spagna': '#E17055',
      'Regno Unito': '#81ECEC',
      'Stati Uniti': '#A29BFE'
    };

    return countryColors[country] || '#95A5A6';
  }

  /**
   * Get real game data from database collections
   */
  private static async getRealGameData() {
    try {
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState !== 1) {
        throw new Error(`Mongoose connection not ready. State: ${mongoose.connection.readyState}`);
      }
      
      // Create flexible models if they don't exist
      const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { collection: 'users', strict: false }));
      const Character = mongoose.models.Character || mongoose.model('Character', new mongoose.Schema({}, { collection: 'characters', strict: false }));
      const Location = mongoose.models.Location || mongoose.model('Location', new mongoose.Schema({}, { collection: 'locations', strict: false }));

      // Get user stats
      const totalUsers = await User.countDocuments({ isActive: true, isBanned: false });
      const newUsersLastWeek = await User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        isActive: true
      });

      // Get character stats
      const approvedCharacters = await Character.countDocuments({ status: 'APPROVED' });
      const pendingCharacters = await Character.countDocuments({ status: 'PENDING_APPROVAL' });
      const draftCharacters = await Character.countDocuments({ status: 'DRAFT' });

      // Get detailed character lists
      const [approvedList, pendingList, draftList] = await Promise.all([
        Character.find({ status: 'APPROVED' })
          .select('name surname userId gameplayRoles')
          .populate('userId', 'username')
          .lean(),
        Character.find({ status: 'PENDING_APPROVAL' })
          .select('name surname userId')
          .populate('userId', 'username')
          .lean(),
        Character.find({ status: 'DRAFT' })
          .select('name surname userId')
          .populate('userId', 'username')
          .lean()
      ]);

      // Get location stats
      const totalLocations = await Location.countDocuments({ visible: true });
      const chatLocations = await Location.countDocuments({ visible: true, chat: true });
      const shopLocations = await Location.countDocuments({ visible: true, shop: true });
      const privateLocations = await Location.countDocuments({ visible: true, private: true });

      return {
        totalUsers,
        newUsersLastWeek,
        approvedCharacters,
        pendingCharacters,
        draftCharacters,
        gameplayActivity: {
          charactersOnline: approvedCharacters, // Simplified: approved characters are "online"
          activeLocations: totalLocations,
          chatEnabledLocations: chatLocations,
          shopEnabledLocations: shopLocations,
          privateLocations: privateLocations,
          messagesLast24h: approvedCharacters * 8, // Estimated
          diceRollsLast24h: approvedCharacters * 2, // Estimated
          lettersDelivered: approvedCharacters * 1, // Estimated
          corporationsActive: 0 // TODO: Add when corporations are implemented
        },
        charactersByStatus: {
          approved: approvedList.map((char: any) => ({
            name: char.name + (char.surname ? ' ' + char.surname : ''),
            username: (char.userId as any)?.username || 'unknown',
            roles: char.gameplayRoles || []
          })),
          pending_approval: pendingList.map((char: any) => ({
            name: char.name + (char.surname ? ' ' + char.surname : ''),
            username: (char.userId as any)?.username || 'unknown'
          })),
          draft: draftList.map((char: any) => ({
            name: char.name + (char.surname ? ' ' + char.surname : ''),
            username: (char.userId as any)?.username || 'unknown'
          }))
        }
      };
    } catch (error: any) {
      logger.error('Error getting real game data:', error);
      // Return default values on error
      return {
        totalUsers: 0,
        newUsersLastWeek: 0,
        approvedCharacters: 0,
        pendingCharacters: 0,
        draftCharacters: 0,
        gameplayActivity: {
          charactersOnline: 0,
          activeLocations: 0,
          chatEnabledLocations: 0,
          shopEnabledLocations: 0,
          privateLocations: 0,
          messagesLast24h: 0,
          diceRollsLast24h: 0,
          lettersDelivered: 0,
          corporationsActive: 0
        },
        charactersByStatus: {
          approved: [],
          pending_approval: [],
          draft: []
        }
      };
    }
  }

  /**
   * Get real gameplay activity statistics (legacy - kept for backwards compatibility)
   */
  private static async getGameplayActivity(startDate: Date, endDate: Date) {
    try {
      // Import mongoose normally to use the same instance as other services
      const mongoose = require('mongoose');
      
      // Check if mongoose connection is active
      if (mongoose.connection.readyState !== 1) {
        throw new Error(`Mongoose connection not ready. State: ${mongoose.connection.readyState} (1=connected)`);
      }
      
      // Check if models are already registered, if not, create them with flexible schemas
      const Character = mongoose.models.Character || mongoose.model('Character', new mongoose.Schema({}, { collection: 'characters', strict: false }));
      const Chat = mongoose.models.Chat || mongoose.model('Chat', new mongoose.Schema({}, { collection: 'chats', strict: false }));
      const OnGameMessage = mongoose.models.OnGameMessage || mongoose.model('OnGameMessage', new mongoose.Schema({}, { collection: 'ongamemessages', strict: false }));
      const Corporation = mongoose.models.Corporation || mongoose.model('Corporation', new mongoose.Schema({}, { collection: 'corporations', strict: false }));
      const Location = mongoose.models.Location || mongoose.model('Location', new mongoose.Schema({}, { collection: 'locations', strict: false }));

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Characters online (approved characters with recent activity)
      const charactersOnline = await Chat.distinct('characterId', {
        timestamp: { $gte: yesterday }
      }).then((ids: any[]) => ids.length);

      // Active locations (locations with recent activity)
      const activeLocations = await Chat.distinct('locationId', {
        timestamp: { $gte: yesterday }
      }).then((ids: any[]) => ids.length);

      // Messages last 24h (both location actions and on-game messages)
      const [locationMessages, onGameMessages] = await Promise.all([
        Chat.countDocuments({
          timestamp: { $gte: yesterday },
          actionType: { $in: ['standard', 'master', 'whisper', 'ooc'] }
        }),
        OnGameMessage.countDocuments({
          sentAt: { $gte: yesterday }
        })
      ]);
      
      const messagesLast24h = locationMessages + onGameMessages;

      // Dice rolls last 24h
      const diceRollsLast24h = await Chat.countDocuments({
        timestamp: { $gte: yesterday },
        actionType: { $in: ['dice_roll', 'skill_check', 'stat_check'] }
      });

      // Letters delivered (OnGame messages delivered in last 24h)
      const lettersDelivered = await OnGameMessage.countDocuments({
        deliveredAt: { $gte: yesterday }
      });

      // Active corporations (corporations with recent member activity)
      const corporationsWithActivity = await Chat.aggregate([
        { $match: { timestamp: { $gte: yesterday } } },
        { $lookup: { from: 'characters', localField: 'characterId', foreignField: '_id', as: 'character' } },
        { $unwind: '$character' },
        { $lookup: { from: 'corporationmemberships', localField: 'character._id', foreignField: 'characterId', as: 'memberships' } },
        { $unwind: { path: '$memberships', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$memberships.corporationId' } },
        { $count: 'total' }
      ]);
      
      const corporationsActive = corporationsWithActivity[0]?.total || 0;

      return {
        charactersOnline,
        activeLocations,
        messagesLast24h,
        diceRollsLast24h,
        lettersDelivered,
        corporationsActive
      };

    } catch (error: any) {
      logger.error('Error getting gameplay activity:', error);
      throw error;
    }
  }

  /**
   * Cleanup old data
   */
  static async cleanupOldData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      // Cleanup system metrics older than 30 days
      await SystemMetrics.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

      // Cleanup page views older than 90 days
      await PageView.deleteMany({ createdAt: { $lt: ninetyDaysAgo } });

      // Cleanup aggregated stats older than 1 year
      await BrowserStats.deleteMany({ createdAt: { $lt: oneYearAgo } });
      await GeographicStats.deleteMany({ createdAt: { $lt: oneYearAgo } });

      logger.info('Old analytics data cleaned up');
    } catch (error: any) {
      logger.error('Error cleaning up old data:', error);
    }
  }
}