import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createRouter } from './router';

export function createApp(): Application {
  const app = express();

  app.use(helmet());

  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: false,
  }));

  app.use(express.json({ limit: '1mb' }));

  app.use(createRouter());

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  return app;
}
