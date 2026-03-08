import express from 'express';
import cors from 'cors';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { router } from './routes';

const PORT = parseInt(process.env.PORT || '3100', 10);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:9000';

const app = express();

app.use(cors());

app.use('/gw', createProxyMiddleware({
  target: GATEWAY_URL,
  changeOrigin: true,
  pathRewrite: { '^/gw': '' },
  timeout: 30_000,
  proxyTimeout: 30_000,
}));

app.use(express.json());

app.use('/api', router);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[test-ui] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[test-ui] Gateway proxy: /gw -> ${GATEWAY_URL}`);
});
