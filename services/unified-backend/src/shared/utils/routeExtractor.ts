/**
 * Utility to extract all registered routes from an Express application
 */
import { logger } from '@shared/utils/logger';

export interface RouteInfo {
  method: string;
  path: string;
}

export function getRegisteredRoutes(app: any): RouteInfo[] {
  const routes: RouteInfo[] = [];
  
  function extractRoutes(layer: any, prefix = '') {
    if (layer.route) {
      // Direct route
      const path = prefix + layer.route.path;
      Object.keys(layer.route.methods).forEach(method => {
        routes.push({ method: method.toUpperCase(), path });
      });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      // Router middleware - extract the mount path
      let routerPrefix = prefix;
      
      if (layer.regexp && layer.regexp.source) {
        const regexSource = layer.regexp.source;
        // Extract path from regex pattern
        const pathMatch = regexSource
          .replace(/^\^\\?/, '')           // Remove start anchor
          .replace(/\$.*$/, '')           // Remove end anchor and flags
          .replace(/\\\//g, '/')          // Replace escaped slashes
          .replace(/\(\?\:|\)/g, '')      // Remove non-capturing groups
          .replace(/\?\$$/, '')           // Remove optional end
          .replace(/\[\^\\\/\]\*\?\$/, '') // Remove wildcard patterns
          .replace(/\/\?\(\?\=/, '');     // Remove lookahead patterns
        
        if (pathMatch && pathMatch !== '' && pathMatch !== '/') {
          routerPrefix = prefix + (pathMatch.startsWith('/') ? pathMatch : '/' + pathMatch);
        }
      }
      
      layer.handle.stack.forEach((sublayer: any) => {
        extractRoutes(sublayer, routerPrefix);
      });
    }
  }
  
  if (app._router?.stack) {
    app._router.stack.forEach((layer: any) => {
      extractRoutes(layer);
    });
  }
  
  // Sort routes alphabetically and remove duplicates
  const uniqueRoutes = routes.filter((route, index, arr) => 
    arr.findIndex(r => r.method === route.method && r.path === route.path) === index
  );
  
  return uniqueRoutes.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
}

export function logRegisteredRoutes(app: any, serviceName: string) {
  const routes = getRegisteredRoutes(app);
  
  logger.info('Available Routes:');
  if (routes.length === 0) {
    logger.info('No routes found');
  } else {
    routes.forEach(route => {
      logger.info(`${route.method.padEnd(6)} ${route.path}`);
    });
  }
  
  return routes;
}