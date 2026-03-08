import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/auth';
import { environmentDetectionMiddleware } from './middleware/environmentDetection';
import { stream, logger } from './utils/logger';
import routes from './routes';

export function createApp(): Application {
  const app: Application = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP request logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined', { stream }));
  }

  // Custom request logger
  app.use(requestLogger);

  // Trust proxy (for ngrok and reverse proxies)
  app.set('trust proxy', 1);

  // Environment detection (must be before routes)
  app.use(environmentDetectionMiddleware);

  // API routes
  app.use('/', routes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('✅ Express app configured');

  return app;
}
