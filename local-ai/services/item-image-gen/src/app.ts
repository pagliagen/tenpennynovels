import express from 'express';
import routes from './routes';
import { stubHealthEndpoint } from '../../../shared/health';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', stubHealthEndpoint('item-image-gen'));
  app.use('/', routes);
  return app;
}
