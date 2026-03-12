import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminNotificationType = 'character_pending_approval';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  characterId: string;
  characterName: string;
  timestamp: string;
  read: boolean;
  link: string;
}

interface AdminNotificationState {
  notifications: AdminNotification[];
  isShaking: boolean;
}

interface AdminNotificationActions {
  addNotification: (notification: Omit<AdminNotification, 'id' | 'read'>) => boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  triggerShake: () => void;
  stopShake: () => void;
  getUnreadCount: () => number;
}

type AdminNotificationStore = AdminNotificationState & AdminNotificationActions;

const DEDUP_WINDOW_MS = 60_000;

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const useAdminNotificationStore = create<AdminNotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      isShaking: false,

      addNotification: (notification) => {
        const { notifications } = get();
        const now = Date.now();

        const isDuplicate = notifications.some(
          (n) =>
            n.type === notification.type &&
            n.characterId === notification.characterId &&
            now - new Date(n.timestamp).getTime() < DEDUP_WINDOW_MS
        );
        if (isDuplicate) return false;

        set((state) => ({
          notifications: [
            { ...notification, id: generateId(), read: false },
            ...state.notifications
          ]
        }));
        return true;
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true }))
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      triggerShake: () => {
        set({ isShaking: true });
        setTimeout(() => {
          set({ isShaking: false });
        }, 1000);
      },

      stopShake: () => {
        set({ isShaking: false });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      }
    }),
    {
      name: 'admin-notifications',
      partialize: (state) => ({
        notifications: state.notifications
      })
    }
  )
);

export const selectUnreadCount = (state: AdminNotificationStore) =>
  state.notifications.filter((n) => !n.read).length;
export const selectIsShaking = (state: AdminNotificationStore) => state.isShaking;
export const selectNotifications = (state: AdminNotificationStore) => state.notifications;
