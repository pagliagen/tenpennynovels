import { Router, Request, Response } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import axios from 'axios';
import { services, ServiceConfig } from './services';
import { authenticateClient, requirePermission } from './middleware/apiKey';
import { verifyHMAC } from './middleware/hmac';
import { clientRateLimit } from './middleware/rateLimit';
import { validateBody, botRespondSchema, qaAskSchema, qaExtractKeywordsSchema, qaExtractInsightSchema, botCreateSchema, botGenerateSchema, seoGenerateDescriptionSchema } from './middleware/validate';
import { generateSeoDescription } from './seo/SeoDescriptionGenerator';

interface RouteValidation {
  method: string;
  path: string;
  schema: ReturnType<typeof validateBody>;
}

const routeValidations: Record<string, RouteValidation[]> = {
  '/botai': [
    { method: 'POST', path: '/respond',       schema: validateBody(botRespondSchema) },
    { method: 'POST', path: '/bots/generate',  schema: validateBody(botGenerateSchema) },
    { method: 'POST', path: '/bots',           schema: validateBody(botCreateSchema) },
  ],
  '/qa': [
    { method: 'POST', path: '/ask', schema: validateBody(qaAskSchema) },
    { method: 'POST', path: '/extract-keywords', schema: validateBody(qaExtractKeywordsSchema) },
    { method: 'POST', path: '/extract-insight', schema: validateBody(qaExtractInsightSchema) },
  ],
};

export function createRouter(): Router {
  const router = Router();

  // /health is public — no auth required
  router.get('/health', async (_req: Request, res: Response) => {
    const healthResults: Record<string, any> = { gateway: { status: 'up' } };

    const checks = services.map(async (svc) => {
      try {
        const resp = await axios.get(`${svc.target}${svc.healthPath}`, { timeout: 3000 });
        healthResults[svc.name] = resp.data;
      } catch {
        healthResults[svc.name] = { status: 'down' };
      }
    });

    checks.push(
      (async () => {
        try {
          const resp = await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`, { timeout: 3000 });
          healthResults['ollama'] = {
            status: 'up',
            models: resp.data?.models?.map((m: any) => m.name) || [],
          };
        } catch {
          healthResults['ollama'] = { status: 'down' };
        }
      })()
    );

    await Promise.allSettled(checks);

    const allUp = Object.values(healthResults).every((s: any) => s.status === 'up' || s.status === 'stub');
    res.status(allUp ? 200 : 503).json({
      status: allUp ? 'healthy' : 'degraded',
      services: healthResults,
    });
  });

  // Auth pipeline for all service routes:
  // 1. authenticateClient (resolve API key → client)
  // 2. verifyHMAC (uses client's hmacSecret, skipped if not configured)
  // 3. clientRateLimit (uses client's maxPerMinute)
  // 4. requirePermission (checks client can access this service)

  // ── SEO: native gateway endpoint (calls Ollama directly) ──
  router.post('/seo/generate-description',
    authenticateClient,
    verifyHMAC,
    clientRateLimit,
    requirePermission('/seo'),
    validateBody(seoGenerateDescriptionSchema),
    async (req: Request, res: Response) => {
      try {
        const { title, content } = req.body;
        const result = await generateSeoDescription(title, content);
        res.json({ success: true, ...result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || 'Ollama error' });
      }
    }
  );

  for (const svc of services) {
    const prefix = svc.prefix;

    // Validated POST routes — specific schema applied before proxy
    const validations = routeValidations[prefix] || [];
    for (const v of validations) {
      const fullPath = `${prefix}${v.path}`;
      const middlewares = [
        authenticateClient,
        verifyHMAC,
        clientRateLimit,
        requirePermission(prefix),
        v.schema,
      ];

      if (v.method === 'POST') {
        router.post(fullPath, ...middlewares, createServiceProxy(svc, prefix));
      }
    }

    // Catch-all for other routes (GET, PUT, DELETE, /health, etc.)
    router.use(prefix,
      authenticateClient,
      verifyHMAC,
      clientRateLimit,
      requirePermission(prefix),
      createServiceProxy(svc, prefix),
    );
  }

  return router;
}

function createServiceProxy(svc: ServiceConfig, prefix: string) {
  return createProxyMiddleware({
    target: svc.target,
    changeOrigin: true,
    pathRewrite: { [`^${prefix}`]: '' },
    timeout: 60_000,
    proxyTimeout: 60_000,
    on: {
      proxyReq: (proxyReq, req: any) => {
        if (req.client) {
          proxyReq.setHeader('X-Client-Id', req.client.id);
        }
        fixRequestBody(proxyReq, req);
      },
      error: (_err, _req, res: any) => {
        if (res.writeHead) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Service unavailable' }));
        }
      },
    },
  });
}
