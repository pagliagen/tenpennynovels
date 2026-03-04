/**
 * HierarchyService
 *
 * Service for document hierarchy management and traversal.
 * Handles recursive child fetching and hierarchical structure building.
 */

import mongoose from 'mongoose';
import Route from '@database/models/Route';
import Document from '@database/models/Document';

export class HierarchyService {
  /**
   * Recursively fetch all child documents for a parent document
   * @param parentDocId - Parent document MongoDB ObjectId
   * @param currentDepth - Current recursion depth (0 = root)
   * @param maxDepth - Maximum depth to traverse (default 5)
   * @returns Array of child documents with depth metadata
   */
  static async fetchChildDocuments(
    parentDocId: mongoose.Types.ObjectId,
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<Array<{ document: any; depth: number; order: number }>> {
    if (currentDepth >= maxDepth) return [];

    // Fetch direct children sorted by order
    const children = await Document.find({
      parentId: parentDocId,
      visible: true,
      deleted: { $ne: true }
    }).sort({ order: 1 });

    const result: Array<{ document: any; depth: number; order: number }> = [];

    // Recursively fetch grandchildren
    for (const child of children) {
      result.push({
        document: child,
        depth: currentDepth + 1,
        order: child.order
      });

      // Recursively fetch this child's children
      const grandchildren = await this.fetchChildDocuments(
        child._id,
        currentDepth + 1,
        maxDepth
      );

      result.push(...grandchildren);
    }

    return result;
  }

  /**
   * Build hierarchical child documents structure with route information
   * Used for TOC generation with proper link types (external routes vs anchors)
   */
  static async buildHierarchicalChildren(
    parentDocId: mongoose.Types.ObjectId,
    parentRoutePath: string,
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<any[]> {
    if (currentDepth >= maxDepth) return [];

    // Fetch direct children
    const children = await Document.find({
      parentId: parentDocId,
      visible: true,
      deleted: { $ne: true }
    }).sort({ order: 1 }).lean();

    if (children.length === 0) return [];

    // Get routes for all children in one query
    const childIds = children.map(c => c._id);
    const childRoutes = await Route.find({
      rootDocumentId: { $in: childIds },
      enabled: true
    }).lean();

    // Build route lookup map
    const routeMap = new Map();
    childRoutes.forEach(route => {
      if (route.rootDocumentId) {
        routeMap.set(route.rootDocumentId.toString(), route);
      }
    });

    // Build hierarchical structure
    const result = [];
    for (const child of children) {
      const childRoute = routeMap.get(child._id.toString());
      const hasRoute = !!childRoute;

      // Recursively get grandchildren
      const grandchildren = await this.buildHierarchicalChildren(
        child._id,
        hasRoute ? childRoute.path : parentRoutePath,
        type,
        currentDepth + 1,
        maxDepth
      );

      result.push({
        _id: child._id.toString(),
        slug: child.slug,
        title: child.title,
        hasRoute: hasRoute,
        routePath: hasRoute ? `/${type}/${childRoute.path}` : undefined,
        depth: currentDepth + 1,
        order: child.order,
        children: grandchildren
      });
    }

    return result;
  }
}
