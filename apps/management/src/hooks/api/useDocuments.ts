/**
 * Document TanStack Query Hooks
 *
 * Hooks per gestire state management dei documents con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico (3x exponential backoff)
 * - Optimistic updates con rollback
 * - Invalidation automatica post-mutation
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as documentAPI from '@/lib/api/documents';
import type {
  Document,
  DocumentListParams,
  CreateDocumentData,
  UpdateDocumentData
} from '@/types/api/Document';

/**
 * Query key factory per consistenza
 */
export const documentKeys = {
  all: ['admin', 'documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (params: DocumentListParams) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const
};

/**
 * Hook per recuperare lista routes con documents (tree view)
 */
export function useDocuments(params: Partial<DocumentListParams> = {}) {
  return useQuery({
    queryKey: documentKeys.list(params as DocumentListParams),
    queryFn: () => documentAPI.getDocuments(params),
    staleTime: 5 * 60 * 1000, // 5 minuti
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
 * Hook per recuperare document + children (hierarchical editing)
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
 * Helper per optimistic update lista documents
 * NOTE: This is for OLD architecture (DocumentListResponse), mostly unused now
 */
function updateDocumentInCache(
  queryClient: QueryClient,
  documentId: string,
  updater: (document: Document) => Document
): void {
  // Aggiorna tutte le liste in cache (OLD format: { items: Document[] })
  queryClient.setQueriesData<{ items: Document[] }>(
    { queryKey: documentKeys.lists(), exact: false },
    (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map(doc => doc._id === documentId ? updater(doc) : doc)
      };
    }
  );

  // Aggiorna detail in cache
  queryClient.setQueryData<Document>(
    documentKeys.detail(documentId),
    (old) => old ? updater(old) : old
  );
}

/**
 * Helper per optimistic update DocumentTreeNode in DOCUMENTS-FIRST hierarchy
 * Attraversa Documents (tree) e aggiorna il nodo corretto
 * FIX: Use DocumentTreeResponse (data: DocumentWithRoute[]) instead of RouteListResponse (list: Route[])
 */
function updateDocumentNodeInRoutes(
  queryClient: QueryClient,
  documentId: string,
  updater: (node: import('@/types/api/Document').DocumentWithRoute) => import('@/types/api/Document').DocumentWithRoute
): void {
  queryClient.setQueriesData<import('@/types/api/Document').DocumentTreeResponse>(
    { queryKey: documentKeys.lists(), exact: false },
    (old) => {
      if (!old?.data) return old;

      // Recursive function to traverse document tree
      const updateNode = (node: import('@/types/api/Document').DocumentWithRoute): import('@/types/api/Document').DocumentWithRoute => {
        if (node._id === documentId) {
          return updater(node);
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: node.children.map(updateNode)
          };
        }
        return node;
      };

      return {
        ...old,
        data: old.data.map(updateNode)
      };
    }
  );
}

/**
 * Helper per rimuovere un documento dall'albero (DOCUMENTS-FIRST)
 * Rimuove ricorsivamente il documento dall'albero e da tutti i children
 */
function removeDocumentFromTree(
  queryClient: QueryClient,
  documentId: string
): void {
  queryClient.setQueriesData<import('@/types/api/Document').DocumentTreeResponse>(
    { queryKey: documentKeys.lists(), exact: false },
    (old) => {
      if (!old?.data) return old;

      // Recursive function to remove document from tree
      const removeNode = (nodes: import('@/types/api/Document').DocumentWithRoute[]): import('@/types/api/Document').DocumentWithRoute[] => {
        return nodes
          .filter(node => node._id !== documentId)
          .map(node => {
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: removeNode(node.children)
              };
            }
            return node;
          });
      };

      return {
        ...old,
        data: removeNode(old.data)
      };
    }
  );
}

/**
 * Hook per creare document con optimistic updates
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
 * Hook per aggiornare document con optimistic updates
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentData }) =>
      documentAPI.updateDocument(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });
      const previousDetail = queryClient.getQueryData(documentKeys.detail(id));

      // Optimistic update (exclude complex nested objects)
      const { visibility, seo, ...safeData } = data;
      updateDocumentInCache(queryClient, id, (doc) => ({
        ...doc,
        ...safeData,
        visibility: visibility ? { ...doc.visibility, ...visibility } : doc.visibility,
        seo: seo ? { ...doc.seo, ...seo } : doc.seo
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(documentKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per eliminare document con optimistic updates
 * FIX: Use removeDocumentFromTree helper for recursive removal
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.deleteDocument(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });

      // Optimistic removal (recursive tree removal)
      removeDocumentFromTree(queryClient, id);

      return { previousLists };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }

    // NO onSettled invalidation - trust optimistic update
    // Refetch would cause race condition and overwrite the correct state
  });
}

/**
 * Hook per pubblicare document con optimistic updates
 */
export function usePublishDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.publishDocument(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });
      const previousDetail = queryClient.getQueryData(documentKeys.detail(id));

      // Optimistic update
      updateDocumentInCache(queryClient, id, (doc) => ({
        ...doc,
        status: 'published',
        metadata: {
          ...doc.metadata,
          publishedAt: new Date().toISOString()
        }
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(documentKeys.detail(variables), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables) });
    }
  });
}

/**
 * Hook per archiviare document con optimistic updates
 */
export function useArchiveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.archiveDocument(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });
      const previousDetail = queryClient.getQueryData(documentKeys.detail(id));

      // Optimistic update
      updateDocumentInCache(queryClient, id, (doc) => ({
        ...doc,
        status: 'archived'
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(documentKeys.detail(variables), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables) });
    }
  });
}

/**
 * Hook per toggle route enabled (hide/show)
 */
export function useToggleRouteEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routeId: string) => documentAPI.toggleRouteEnabled(routeId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    }
  });
}

/**
 * Hook per eliminare route (soft delete)
 */
export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routeId: string) => documentAPI.deleteRoute(routeId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    }
  });
}

/**
 * Hook per riordinare document (change order/parentId in content hierarchy)
 * CRITICAL: Force immediate refetch to show updated order for ALL siblings
 */
export function useReorderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, order, parentId }: { documentId: string; order: number; parentId: string | null }) =>
      documentAPI.reorderDocument(documentId, order, parentId),

    onSuccess: () => {
      // Force refetch of active queries (bypass staleTime)
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
        refetchType: 'active'
      });
    }
  });
}

/**
 * Hook per riordinare route (change order/parentId in route hierarchy) - DEPRECATED
 * @deprecated Use useReorderSiblings instead
 */
export function useReorderRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, order, parentId }: { routeId: string; order: number; parentId: string | null }) =>
      documentAPI.reorderRoute(routeId, order, parentId),

    onSuccess: () => {
      // Force refetch of active queries (bypass staleTime)
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
        refetchType: 'active'
      });
    }
  });
}

/**
 * Hook per riordinare siblings (NEW SIMPLE APPROACH)
 * Pass full ordered array of sibling IDs
 */
export function useReorderSiblings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parentId, orderedIds }: { parentId: string | null; orderedIds: string[] }) =>
      documentAPI.reorderSiblings(parentId, orderedIds),

    onSuccess: () => {
      // Force refetch of active queries (bypass staleTime)
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
        refetchType: 'active'
      });
    }
  });
}

/**
 * Hook per toggle document visibility (show/hide)
 */
export function useToggleDocumentVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentAPI.toggleDocumentVisibility(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: documentKeys.lists() });

      // Optimistic update - toggle visible field in DocumentTreeNode
      updateDocumentNodeInRoutes(queryClient, id, (node) => ({
        ...node,
        visible: !node.visible
      }));

      return { previousLists };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }

    // NO onSettled invalidation - trust optimistic update
    // Refetch would cause race condition and overwrite the correct state
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

      // Optimistic update - toggle isDraft field in DocumentTreeNode
      updateDocumentNodeInRoutes(queryClient, id, (node) => ({
        ...node,
        isDraft: !node.isDraft
      }));

      return { previousLists };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }

    // NO onSettled invalidation - trust optimistic update
    // Refetch would cause race condition and overwrite the correct state
  });
}

/**
 * Hook per aggiornare route + document associato
 */
export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, data }: {
      routeId: string;
      data: {
        path?: string;
        title?: string;
        description?: string;
        redirectTo?: string;
        isPublic?: boolean;
        enabled?: boolean;
        documentData?: {
          title?: string;
          slug?: string;
          description?: string;
          isDraft?: boolean;
          visible?: boolean;
        };
      }
    }) => documentAPI.updateRoute(routeId, data),

    onSuccess: () => {
      // Invalidate lists to refetch updated route + document data
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
        refetchType: 'active'
      });
    }
  });
}
