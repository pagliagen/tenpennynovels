import express from 'express';
import routes from './routes';
import { healthEndpoint } from '../../../shared/health';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.static('public'));  // Serve le pagine di debug (character-generator.html, ...)

  app.get('/health', healthEndpoint('character-gen', async () => ({})));

  app.use('/', routes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  return app;
}
