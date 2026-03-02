/**
 * useDocumentGroups Hook
 *
 * Groups documents by their `displayCategory` field for tree navigation.
 * Handles collapsible group state for UI.
 *
 * @module hooks/useDocumentGroups
 * @since 1.0.0
 */

import { useMemo, useState, useCallback } from 'react';
import type { Document, DocumentGroup } from '@/types/document';

/**
 * Group documents by `displayCategory` field
 *
 * Documents without a displayCategory are placed in "Senza Categoria".
 * Preserves document order within each group.
 *
 * @param {Document[]} documents - Documents to group
 * @returns {DocumentGroup[]} Grouped documents
 */
function groupDocuments(documents: Document[]): DocumentGroup[] {
  const groups = new Map<string, Document[]>();

  // Group documents by their displayCategory field
  documents.forEach((doc) => {
    const groupName = doc.displayCategory || 'Senza Categoria';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(doc);
  });

  // Convert to array of DocumentGroup objects
  return Array.from(groups.entries()).map(([name, docs]) => ({
    name,
    documents: docs,
    isCollapsed: false, // Default to expanded
  }));
}

/**
 * Hook for managing document groups with collapsible state
 *
 * @param {Document[]} documents - Documents to group
 * @returns {object} Document groups with collapse controls
 *
 * @example
 * const { data: documents } = useDocuments('ambientazione');
 * const { groups, toggleGroup, collapseAll, expandAll } = useDocumentGroups(documents);
 *
 * {groups.map((group) => (
 *   <div key={group.name}>
 *     <button onClick={() => toggleGroup(group.name)}>
 *       {group.isCollapsed ? '▶' : '▼'} {group.name}
 *     </button>
 *     {!group.isCollapsed && group.documents.map(doc => (
 *       <DocumentLink key={doc._id} document={doc} />
 *     ))}
 *   </div>
 * ))}
 */
export function useDocumentGroups(documents: Document[] = []) {
  // Group documents
  const initialGroups = useMemo(() => groupDocuments(documents), [documents]);

  // Track collapsed state for each group
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Add collapsed state to groups
  const groups = useMemo(() => {
    return initialGroups.map((group) => ({
      ...group,
      isCollapsed: collapsedGroups.has(group.name),
    }));
  }, [initialGroups, collapsedGroups]);

  // Toggle single group
  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  // Collapse all groups
  const collapseAll = useCallback(() => {
    const allGroupNames = initialGroups.map((g) => g.name);
    setCollapsedGroups(new Set(allGroupNames));
  }, [initialGroups]);

  // Expand all groups
  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  return {
    groups,
    toggleGroup,
    collapseAll,
    expandAll,
    hasGroups: groups.length > 0,
    totalGroups: groups.length,
  };
}

/**
 * Simple hook that just groups documents without collapse state
 *
 * Use when you don't need collapsible functionality (e.g., static rendering).
 *
 * @param {Document[]} documents - Documents to group
 * @returns {DocumentGroup[]} Grouped documents
 */
export function useSimpleDocumentGroups(documents: Document[] = []): DocumentGroup[] {
  return useMemo(() => groupDocuments(documents), [documents]);
}
