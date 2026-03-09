import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'task_complete';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  sessionId?: string;
  sessionName?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
}

interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
  getUnreadBySession: (sessionId: string) => Notification[];
}

type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = uuidv4();
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: Date.now(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
    }));
    return id;
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  getUnreadBySession: (sessionId) => {
    return get().notifications.filter((n) => !n.read && n.sessionId === sessionId);
  },
}));
