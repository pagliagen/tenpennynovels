/**
 * API Documentation Decorators
 * Registers route information for automatic API documentation generation
 */

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  service: string;
  controller: string;
  function: string;
  authentication?: 'none' | 'optional' | 'required' | 'admin';
  parameters?: ApiParameter[];
  responses?: ApiResponse[];
  tags?: string[];
}

interface ApiParameter {
  name: string;
  type: 'path' | 'query' | 'body' | 'header';
  dataType: string;
  required: boolean;
  description?: string;
}

interface ApiResponse {
  status: number;
  description: string;
  schema?: any;
}

// Global registry for all API endpoints
const API_REGISTRY: Map<string, ApiEndpoint[]> = new Map();

/**
 * Get all registered endpoints for a service
 */
export function getServiceEndpoints(serviceName: string): ApiEndpoint[] {
  return API_REGISTRY.get(serviceName) || [];
}

/**
 * Get all registered endpoints across all services
 */
export function getAllEndpoints(): Map<string, ApiEndpoint[]> {
  return API_REGISTRY;
}

/**
 * Register an API endpoint
 */
function registerEndpoint(endpoint: ApiEndpoint) {
  const serviceName = endpoint.service;
  if (!API_REGISTRY.has(serviceName)) {
    API_REGISTRY.set(serviceName, []);
  }
  API_REGISTRY.get(serviceName)!.push(endpoint);
}

/**
 * API Documentation decorator for controller methods
 */
export function ApiDoc(options: {
  method: string;
  path: string;
  description: string;
  service: string;
  authentication?: 'none' | 'optional' | 'required' | 'admin';
  parameters?: ApiParameter[];
  responses?: ApiResponse[];
  tags?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const endpoint: ApiEndpoint = {
      method: options.method.toUpperCase(),
      path: options.path,
      description: options.description,
      service: options.service,
      controller: target.constructor.name,
      function: propertyName,
      authentication: options.authentication || 'required',
      parameters: options.parameters || [],
      responses: options.responses || [],
      tags: options.tags || []
    };
    
    registerEndpoint(endpoint);
    
    return descriptor;
  };
}

/**
 * Quick decorators for common HTTP methods
 */
export const GET = (path: string, description: string, service: string, options?: Partial<ApiEndpoint>) => 
  ApiDoc({ method: 'GET', path, description, service, ...options });

export const POST = (path: string, description: string, service: string, options?: Partial<ApiEndpoint>) => 
  ApiDoc({ method: 'POST', path, description, service, ...options });

export const PUT = (path: string, description: string, service: string, options?: Partial<ApiEndpoint>) => 
  ApiDoc({ method: 'PUT', path, description, service, ...options });

export const DELETE = (path: string, description: string, service: string, options?: Partial<ApiEndpoint>) => 
  ApiDoc({ method: 'DELETE', path, description, service, ...options });

export const PATCH = (path: string, description: string, service: string, options?: Partial<ApiEndpoint>) => 
  ApiDoc({ method: 'PATCH', path, description, service, ...options });

/**
 * Export API documentation as JSON
 */
export function exportApiDocs() {
  const docs: any = {
    generatedAt: new Date().toISOString(),
    services: {}
  };
  
  API_REGISTRY.forEach((endpoints, serviceName) => {
    docs.services[serviceName] = {
      endpoints: endpoints.map(endpoint => ({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        authentication: endpoint.authentication,
        controller: endpoint.controller,
        function: endpoint.function,
        parameters: endpoint.parameters,
        responses: endpoint.responses,
        tags: endpoint.tags
      }))
    };
  });
  
  return docs;
}

/**
 * Clear registry (useful for testing)
 */
export function clearRegistry() {
  API_REGISTRY.clear();
}