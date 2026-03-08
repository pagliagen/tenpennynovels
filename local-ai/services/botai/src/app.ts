import express from 'express';
import routes from './routes';
import { healthEndpoint } from '../../../shared/health';
import mongoose from 'mongoose';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', healthEndpoint('botai', async () => ({
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })));

  app.use('/', routes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  return app;
}
