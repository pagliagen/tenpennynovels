// =============================================================================
// Analytics Routes - Management Backend
// =============================================================================

import express from 'express';
import { AnalyticsService } from '@shared/services/AnalyticsService';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * GET /admin/analytics/dashboard
 * Get dashboard metrics for the management panel
 */
router.get('/dashboard', async (req, res): Promise<void> => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const query = {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as 'hour' | 'day' | 'week' | 'month'
    };

    const result = await AnalyticsService.getDashboardMetrics(query);

    if (!result.success) {
      res.status(500).json({
        result: false,
        error: result.error || 'Impossibile recuperare le metriche della dashboard',
        code: 'ANALYTICS_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      result: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Analytics dashboard error:', error);
    res.status(500).json({
      result: false,
      error: process.env.NODE_ENV === 'production' ? 'Errore interno del server' : error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Errore sconosciuto',
      code: 'ANALYTICS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/analytics/aggregate/:date
 * Manually trigger daily aggregation for a specific date
 * Requires admin privileges
 */
router.post('/aggregate/:date', async (req, res): Promise<void> => {
  try {
    const { date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        result: false,
        error: 'Formato data non valido. Usare YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await AnalyticsService.aggregateDailyStats(date);

    res.json({
      result: true,
      message: `Aggregazione analytics giornaliera completata per ${date}`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Analytics aggregation error:', error);
    res.status(500).json({
      result: false,
      error: process.env.NODE_ENV === 'production' ? 'Errore interno del server' : error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Errore sconosciuto',
      code: 'AGGREGATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /admin/analytics/cleanup
 * Manually trigger cleanup of old analytics data
 * Requires admin privileges
 */
router.post('/cleanup', async (req, res) => {
  try {
    await AnalyticsService.cleanupOldData();

    res.json({
      result: true,
      message: 'Pulizia dati analytics completata',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Analytics cleanup error:', error);
    res.status(500).json({
      result: false,
      error: process.env.NODE_ENV === 'production' ? 'Errore interno del server' : error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Errore sconosciuto',
      code: 'CLEANUP_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/analytics/health
 * Check analytics system health
 */
router.get('/health', async (req, res) => {
  try {
    // Try to get basic metrics to test connection
    const result = await AnalyticsService.getDashboardMetrics({});
    
    const health = {
      status: result.success ? 'healthy' : 'degraded',
      database: result.success,
      lastCheck: new Date().toISOString(),
      message: result.success ? 'Sistema analytics operativo' : 'Il sistema analytics presenta problemi'
    };

    res.status(result.success ? 200 : 503).json({
      success: result.success,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Analytics health check error:', error);
    res.status(503).json({
      result: false,
      data: {
        status: 'critical',
        database: false,
        lastCheck: new Date().toISOString(),
        message: 'Errore del sistema analytics',
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Errore sconosciuto'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;