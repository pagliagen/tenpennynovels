/**
 * CDN Service - Main server
 * Handles file uploads, processing, and storage management
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import uploadRoutes from './routes/upload';
import { scheduleCleanup } from './services/cleanup';

const app = express();
const PORT = parseInt(process.env.PORT || '4002', 10);
const HOST = process.env.CDN_SERVICE_HOST || '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:4004,http://localhost:4001').split(',');

// =============================================================================
// Middleware
// =============================================================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin access for CDN
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// JSON body parser (for non-multipart requests)
app.use(express.json());

// =============================================================================
// Routes
// =============================================================================

// Upload routes (POST /upload, GET /health)
app.use('/', uploadRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Global error:', err);

  // Multer errors
  if (err.message.includes('File too large')) {
    res.status(413).json({
      success: false,
      error: 'File too large. Max size: 10MB'
    });
    return;
  }

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      error: err.message
    });
    return;
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// =============================================================================
// Server start
// =============================================================================

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    CDN Service Started                         ║
╠════════════════════════════════════════════════════════════════╣
║ Port:        ${PORT.toString().padEnd(50)} ║
║ Host:        ${HOST.padEnd(50)} ║
║ Environment: ${(process.env.NODE_ENV || 'development').padEnd(50)} ║
║ Storage:     ${(process.env.CDN_STORAGE_PATH || '/cdn-storage').padEnd(50)} ║
╚════════════════════════════════════════════════════════════════╝
  `);

  // Schedule cleanup job (every 24 hours)
  scheduleCleanup();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
