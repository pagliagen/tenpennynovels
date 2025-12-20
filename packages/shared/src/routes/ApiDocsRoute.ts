/**
 * API Documentation Route
 * Provides runtime API documentation based on decorator registration
 */

import { Router, Request, Response } from 'express';
import { getAllEndpoints, exportApiDocs } from '../decorators/ApiDoc';

const router = Router();

/**
 * GET /api-docs
 * Returns all registered API endpoints in JSON format
 */
router.get('/api-docs', (req: Request, res: Response) => {
  try {
    const docs = exportApiDocs();
    res.json({
      success: true,
      data: docs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate API documentation',
      code: 'API_DOCS_ERROR'
    });
  }
});

/**
 * GET /api-docs/service/:serviceName
 * Returns API endpoints for a specific service
 */
router.get('/api-docs/service/:serviceName', (req: Request, res: Response): void => {
  try {
    const { serviceName } = req.params;
    const allEndpoints = getAllEndpoints();
    const serviceEndpoints = allEndpoints.get(serviceName);
    
    if (!serviceEndpoints) {
      res.status(404).json({
        success: false,
        error: `Service '${serviceName}' not found`,
        code: 'SERVICE_NOT_FOUND'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        service: serviceName,
        endpoints: serviceEndpoints
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get service documentation',
      code: 'SERVICE_DOCS_ERROR'
    });
  }
});

/**
 * GET /api-docs/markdown
 * Returns API documentation in markdown format
 */
router.get('/api-docs/markdown', (req: Request, res: Response) => {
  try {
    const docs = exportApiDocs();
    let markdown = `# API Documentation\n\nGenerated at: ${docs.generatedAt}\n\n`;
    
    Object.entries(docs.services).forEach(([serviceName, serviceData]: [string, any]) => {
      markdown += `## ${serviceName}\n\n`;
      
      if (serviceData.endpoints.length === 0) {
        markdown += `*No endpoints registered*\n\n`;
      } else {
      
      // Group by tags or controller
      const groups: { [key: string]: any[] } = {};
      serviceData.endpoints.forEach((endpoint: any) => {
        const groupKey = endpoint.tags?.[0] || endpoint.controller || 'General';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(endpoint);
      });
      
      Object.entries(groups).forEach(([groupName, endpoints]) => {
        markdown += `### ${groupName}\n\n`;
        markdown += `| Method | Path | Description | Auth |\n`;
        markdown += `|--------|------|-------------|------|\n`;
        
        endpoints.forEach((endpoint: any) => {
          const auth = endpoint.authentication || 'required';
          markdown += `| \`${endpoint.method}\` | \`${endpoint.path}\` | ${endpoint.description} | ${auth} |\n`;
        });
        
        markdown += `\n`;
      });
      
      markdown += `---\n\n`;
      }
    });
    
    res.setHeader('Content-Type', 'text/markdown');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate markdown documentation',
      code: 'MARKDOWN_ERROR'
    });
  }
});

export default router;