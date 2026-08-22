/**
 * HierarchyService
 *
 * Service for document hierarchy management and traversal.
 * Handles recursive child fetching and hierarchical structure building.
 */

import mongoose from 'mongoose';
import Document from '../models/Document';
import type { DocumentType } from '../constants/documentTypes';

export class HierarchyService {
  /**
   * Recursively fetch all child documents for a parent document
   */
  static async fetchChildDocuments(
    parentDocId: mongoose.Types.ObjectId,
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<Array<{ document: any; depth: number; order: number }>> {
    if (currentDepth >= maxDepth) return [];

    const children = await Document.find({
      parentId: parentDocId,
      visible: true,
      deleted: { $ne: true }
    }).sort({ order: 1 });

    const result: Array<{ document: any; depth: number; order: number }> = [];

    for (const child of children) {
      result.push({
        document: child,
        depth: currentDepth + 1,
        order: child.order
      });

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
   * Build hierarchical child documents structure
   * Used for TOC generation with proper link types
   */
  static async buildHierarchicalChildren(
    parentDocId: mongoose.Types.ObjectId,
    parentPath: string,
    type: DocumentType,
    currentDepth: number = 0,
    maxDepth: number = 5
  ): Promise<any[]> {
    if (currentDepth >= maxDepth) return [];

    const children = await Document.find({
      parentId: parentDocId,
      visible: true,
      deleted: { $ne: true }
    }).sort({ order: 1 }).lean();

    if (children.length === 0) return [];

    const result = [];
    for (const child of children) {
      // A child document has its own page if it has its own path
      const hasOwnPage = !!child.path && child.path !== parentPath;

      const grandchildren = await this.buildHierarchicalChildren(
        child._id,
        hasOwnPage ? child.path! : parentPath,
        type,
        currentDepth + 1,
        maxDepth
      );

      result.push({
        _id: child._id.toString(),
        slug: child.slug,
        title: child.title,
        hasOwnPage,
        path: hasOwnPage ? child.path : undefined,
        depth: currentDepth + 1,
        order: child.order,
        children: grandchildren
      });
    }

    return result;
  }
}
