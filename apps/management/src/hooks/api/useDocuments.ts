/**
 * Document TanStack Query Hooks
 *
 * Hooks per gestire state management dei documents con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico
 * - Optimistic updates con rollback
 * - Invalidation automatica post-mutation
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as documentAPI from '@/lib/api/documents';
import type {
  Document,
  DocumentListParams,
  DocumentTreeNode,
  DocumentTreeResponse,
  CreateDocumentData,
  UpdateDocumentData,
  DocumentSubtype
} from '@/types/api/Document';

/**
 * Query key factory per consistenza
 */
export const documentKeys = {
  all: ['admin', 'documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (params: Partial<DocumentListParams>) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  subtypes: ['admin', 'subtypes'] as const,
  subtypesByType: (type?: string) => [...documentKeys.subtypes, type] as const,
};

/**
 * Hook per recuperare albero documenti
 */
export function useDocuments(params: Partial<DocumentListParams> = {}) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentAPI.getDocuments(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

/**
 * Hook per recuperare singolo document
 */
export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentAPI.getDocumentById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

/**
 * Hook per recuperare document + children
 */
export function useDocumentWithChildren(id: string, options = {}) {
  return useQuery({
    queryKey: [...documentKeys.detail(id), 'with-children'],
    queryFn: () => documentAPI.getDocumentWithChildren(id),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!id,
    ...options
  });
}

/**
 * Helper per optimistic update in document tree
 */
function updateDocumentNodeInTree(
  queryClient: QueryClient,
  documentId: string,
  updater: (node: DocumentTreeNode) => DocumentTreeNode
): void {
  queryClient.setQueriesData<DocumentTreeResponse>(
    { queryKey: documentKeys.lists(), exact: false },
    (old) => {
      if (!old?.data) return old;

      const updateNode = (node: DocumentTreeNode): DocumentTreeNode => {
        if (node._id === documentId) return updater(node);
        if (node.children?.length > 0) {
          return { ...node, children: node.children.map(updateNode) };
        }
        return node;
      };

      return { ...old, data: old.data.map(updateNode) };
    }
  );
}

function removeDocumentFromTree(queryClient: QueryClient, documentId: string): void {
  queryClient.setQueriesData<DocumentTreeResponse>(
    { queryKey: documentKeys.lists(), exact: false },
    (old) => {
      if (!old?.data) return old;

      const removeNode = (nodes: DocumentTreeNode[]): DocumentTreeNode[] =>
        nodes
          .filter(node => node._id !== documentId)
          .map(node => ({
            ...node,
            children: node.children?.length ? removeNode(node.children) : node.children
          }));

      return { ...old, data: removeNode(old.data) };
    }
  );
}

/**
 * Hook per creare document
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentData) => documentAPI.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    }
  });
}

/**
 * Hook per aggiornare document
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentData }) =>
      documentAPI.updateDocument(id, data),

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per eliminare document con optimistic updates
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.deleteDocument(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });
      removeDocumentFromTree(queryClient, id);
      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }
  });
}

/**
 * Hook per riordinare siblings
 */
export function useReorderSiblings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parentId, orderedIds }: { parentId: string | null; orderedIds: string[] }) =>
      documentAPI.reorderSiblings(parentId, orderedIds),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(), refetchType: 'active' });
    }
  });
}

/**
 * Hook per riordinare singolo documento (order + parentId)
 */
export function useReorderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, order, parentId }: { documentId: string; order: number; parentId: string }) =>
      documentAPI.reorderDocument(documentId, order, parentId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(), refetchType: 'active' });
    }
  });
}

/**
 * Hook per toggle document visibility
 */
export function useToggleDocumentVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.toggleDocumentVisibility(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });

      updateDocumentNodeInTree(queryClient, id, (node) => ({
        ...node, visible: !node.visible
      }));

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }
  });
}

/**
 * Hook per toggle document draft status
 */
export function useToggleDocumentDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.toggleDocumentDraft(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });

      updateDocumentNodeInTree(queryClient, id, (node) => ({
        ...node, isDraft: !node.isDraft
      }));

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }
  });
}

// ========== SUBTYPE HOOKS ==========

/**
 * Hook per recuperare subtypes
 */
export function useSubtypes(type?: string) {
  return useQuery({
    queryKey: documentKeys.subtypesByType(type),
    queryFn: () => documentAPI.getSubtypes(type),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

/**
 * Hook per creare subtype
 */
export function useCreateSubtype() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { slug: string; title: string; type: string }) =>
      documentAPI.createSubtype(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.subtypes });
    }
  });
}

/**
 * Hook per aggiornare subtype
 */
export function useUpdateSubtype() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { slug?: string; title?: string; expandedByDefault?: boolean } }) =>
      documentAPI.updateSubtype(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.subtypes });
    }
  });
}

/**
 * Hook per eliminare subtype
 */
export function useDeleteSubtype() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.deleteSubtype(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.subtypes });
    }
  });
}

/**
 * Hook per riordinare subtypes
 */
export function useReorderSubtypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, orderedIds }: { type: string; orderedIds: string[] }) =>
      documentAPI.reorderSubtypes(type, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.subtypes });
    }
  });
}
