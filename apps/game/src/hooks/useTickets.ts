/**
 * Tickets Hooks
 *
 * React hooks for ticket-related data fetching and mutations
 *
 * @module hooks/useTickets
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

// Types
export interface Ticket {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  department: string;
  createdAt: string;
  unreadMessages: number;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  escalationLevel?: number;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: string;
  isInternal: boolean;
  readAt?: {
    character?: string;
    staff?: string;
  };
}

export interface TicketCategory {
  value: string;
  label: string;
  description: string;
}

// Fetch user tickets
export function useUserTickets(status?: string) {
  return useQuery({
    queryKey: ['tickets', 'list', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await api.get<{ list: Ticket[] }>(`/game/tickets?${params.toString()}`);
      return response.list;
    },
    refetchInterval: 60000 // Fallback polling every 60s
  });
}

// Fetch unread tickets count (for badge)
export function useUnreadTicketsCount() {
  return useQuery({
    queryKey: ['tickets', 'unreadCount'],
    queryFn: async () => {
      const response = await api.get<{ data: { unreadCount: number } }>('/game/tickets/unread-count');
      return response.data.unreadCount;
    },
    refetchInterval: 60000
  });
}

// Fetch ticket messages
export function useTicketMessages(ticketId: string | null) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'messages'],
    queryFn: async () => {
      if (!ticketId) return [];

      const response = await api.get<{ data: { messages: TicketMessage[] } }>(`/game/tickets/${ticketId}/messages`);
      return response.data.messages;
    },
    enabled: !!ticketId
  });
}

// Fetch ticket categories
export function useTicketCategories() {
  return useQuery({
    queryKey: ['tickets', 'categories'],
    queryFn: async () => {
      const response = await api.get<{ data: { categories: TicketCategory[] } }>('/game/tickets/categories');
      return response.data.categories;
    }
  });
}

// Create ticket mutation
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; category: string; content: string }) => {
      return await api.post<{ ticket: Ticket }>('/game/tickets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'unreadCount'] });
    }
  });
}

// Add message mutation
export function useAddTicketMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { ticketId: string; content: string }) => {
      return await api.post<{ message: TicketMessage }>(`/game/tickets/${data.ticketId}/messages`, {
        content: data.content
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
    }
  });
}

// Close ticket mutation
export function useCloseTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { ticketId: string; reason?: string }) => {
      return await api.put<{ ticket: Ticket }>(`/game/tickets/${data.ticketId}/close`, {
        reason: data.reason
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'unreadCount'] });
    }
  });
}
