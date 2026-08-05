/**
 * Location TanStack Query Hooks
 *
 * Hooks per gestire state management delle locations con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico
 * - Invalidation automatica post-mutation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as locationAPI from '@/lib/api/locations';
import type {
  LocationListParams,
  CreateLocationData,
  UpdateLocationData,
  LocationHierarchyResponse,
  LocationTreeNode,
  MapPosition
} from '@/types/api/Location';

export const locationKeys = {
  all: ['admin', 'locations'] as const,
  lists: () => [...locationKeys.all, 'list'] as const,
  list: (params: Partial<LocationListParams>) => [...locationKeys.lists(), params] as const,
  hierarchy: () => [...locationKeys.all, 'hierarchy'] as const,
  stats: () => [...locationKeys.all, 'stats'] as const,
  details: () => [...locationKeys.all, 'detail'] as const,
  detail: (id: string) => [...locationKeys.details(), id] as const,
};

export function useLocations(params: Partial<LocationListParams> = {}) {
  return useQuery({
    queryKey: locationKeys.list(params),
    queryFn: () => locationAPI.getLocations(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useLocationHierarchy() {
  return useQuery({
    queryKey: locationKeys.hierarchy(),
    queryFn: () => locationAPI.getLocationHierarchy(),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useLocationStats() {
  return useQuery({
    queryKey: locationKeys.stats(),
    queryFn: () => locationAPI.getLocationStats(),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: locationKeys.detail(id),
    queryFn: () => locationAPI.getLocationById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLocationData) => locationAPI.createLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLocationData }) =>
      locationAPI.updateLocation(id, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(variables.id) });
    }
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, forceDelete }: { id: string; reason: string; forceDelete?: boolean }) =>
      locationAPI.deleteLocation(id, reason, forceDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  });
}

function updateNodeMapPosition(
  nodes: LocationTreeNode[],
  id: string,
  mapPosition: MapPosition | null
): LocationTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, mapPosition };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodeMapPosition(node.children, id, mapPosition) };
    }
    return node;
  });
}

/**
 * Aggiorna la posizione di un marker sulla mappa con update ottimistico
 * sulla cache della gerarchia (niente invalidate in onSuccess/onSettled,
 * vedi regola 5 di 00-critical.md: eviterebbe flicker durante il drag).
 */
export function useUpdateLocationMapPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mapPosition }: { id: string; mapPosition: MapPosition | null }) =>
      locationAPI.updateLocationMapPosition(id, mapPosition),
    onMutate: async ({ id, mapPosition }) => {
      await queryClient.cancelQueries({ queryKey: locationKeys.hierarchy() });
      const previous = queryClient.getQueryData<LocationHierarchyResponse>(locationKeys.hierarchy());

      if (previous) {
        queryClient.setQueryData<LocationHierarchyResponse>(locationKeys.hierarchy(), {
          ...previous,
          tree: updateNodeMapPosition(previous.tree, id, mapPosition)
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(locationKeys.hierarchy(), context.previous);
      }
    }
  });
}

export function useReorderLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parentId, orderedIds }: { parentId: string | null; orderedIds: string[] }) =>
      locationAPI.reorderLocations(parentId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all });
    }
  });
}
