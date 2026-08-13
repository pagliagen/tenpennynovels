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
  /** Forma libera (JSON Schema-like): descrive un body di risposta arbitrario, non un valore che il codice manipola. */
  schema?: Record<string, unknown>;
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
 * Bersaglio di un decoratore legacy (`experimentalDecorators`) su un metodo:
 * per un metodo statico `target` È la classe (una funzione); per un metodo
 * d'istanza `target` è il prototype, e `.constructor` punta alla classe.
 * Le due forme non si distinguono a priori: vanno gestite entrambe.
 */
type MethodDecoratorTarget = (new (...args: unknown[]) => unknown) | { constructor: new (...args: unknown[]) => unknown };

function resolveControllerName(target: MethodDecoratorTarget): string {
  return typeof target === 'function' ? target.name : target.constructor.name;
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
  return function (target: MethodDecoratorTarget, propertyName: string, descriptor: PropertyDescriptor) {
    const endpoint: ApiEndpoint = {
      method: options.method.toUpperCase(),
      path: options.path,
      description: options.description,
      service: options.service,
      controller: resolveControllerName(target),
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

interface ApiDocsExport {
  generatedAt: string;
  services: Record<string, { endpoints: Omit<ApiEndpoint, 'service'>[] }>;
}

/**
 * Export API documentation as JSON
 */
export function exportApiDocs(): ApiDocsExport {
  const services: ApiDocsExport['services'] = {};

  API_REGISTRY.forEach((endpoints, serviceName) => {
    services[serviceName] = {
      endpoints: endpoints.map(({ method, path, description, authentication, controller, function: fn, parameters, responses, tags }) => ({
        method,
        path,
        description,
        authentication,
        controller,
        function: fn,
        parameters,
        responses,
        tags
      }))
    };
  });

  return { generatedAt: new Date().toISOString(), services };
}

/**
 * Clear registry (useful for testing)
 */
export function clearRegistry() {
  API_REGISTRY.clear();
}