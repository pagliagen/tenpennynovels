// =============================================================================
// WebSocket Management - Management Panel
// =============================================================================

import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRoles: string[];
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
}

export interface AdminNotification extends Notification {
  category: 'character-approval' | 'user-management' | 'content-moderation' | 'system-alert' | 'economy';
  data?: any;
}

export interface SystemMetrics {
  onlineUsers: number;
  activeCharacters: number;
  pendingApprovals: number;
  systemLoad: number;
  memoryUsage: number;
  redisConnections: number;
  databaseConnections: number;
  lastUpdate: Date;
}

export interface WebSocketEvents {
  // Socket.io built-in events
  'connect': () => void;
  'disconnect': () => void;
  'connect_error': (error: Error) => void;
  
  // Admin notifications
  'admin-notification': (notification: AdminNotification) => void;
  'notification-read': (notificationId: string) => void;
  'notification-clear': (notificationIds: string[]) => void;
  
  // System events
  'system-metrics': (metrics: SystemMetrics) => void;
  'system-alert': (alert: any) => void;
  'user-online': (userId: string) => void;
  'user-offline': (userId: string) => void;
  'character-approved': (characterId: string) => void;
  'character-rejected': (characterId: string) => void;
  
  // Real-time updates
  'data-update': (data: { type: string; action: string; id: string; data?: any }) => void;
  'cache-invalidate': (cacheKeys: string[]) => void;
}

export class AdminWebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private userRoles: string[] = [];
  private isConnected = false;

  constructor() {
    this.initializeSocket();
  }

  // =============================================================================
  // Connection Management
  // =============================================================================

  private initializeSocket(): void {
    const socketUrl = process.env.SOCKET_URL || 'http://localhost:3001';
    
    this.socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false, // Handle reconnection manually
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Admin WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join admin room with user roles
      this.socket?.emit('join-admin-room', { roles: this.userRoles });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Admin WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server forced disconnect, reconnect manually
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Admin WebSocket connection error:', error);
      this.isConnected = false;
      this.reconnect();
    });

    // Handle auth errors
    this.socket.on('auth-error', (error) => {
      console.error('Admin WebSocket auth error:', error);
      // Redirect to login
      window.location.href = process.env.LANDING_URL || 'https://game.tenpennynovels.com';
    });
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.socket?.connect();
      }
    }, delay);
  }

  // =============================================================================
  // Public Methods
  // =============================================================================

  setUserRoles(roles: string[]): void {
    this.userRoles = roles;
    
    if (this.isConnected && this.socket) {
      this.socket.emit('join-admin-room', { roles });
    }
  }

  // Event listeners
  on<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]): void {
    this.socket?.on(event as string, listener as any);
  }

  off<K extends keyof WebSocketEvents>(event: K, listener?: WebSocketEvents[K]): void {
    if (listener) {
      this.socket?.off(event as string, listener as any);
    } else {
      this.socket?.off(event as string);
    }
  }

  // Emit events
  emit(event: string, data?: any): void {
    if (this.isConnected && this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, queuing event:', event);
      // Could implement event queuing here
    }
  }

  // Mark notification as read
  markNotificationRead(notificationId: string): void {
    this.emit('mark-notification-read', { notificationId });
  }

  // Clear notifications
  clearNotifications(notificationIds: string[]): void {
    this.emit('clear-notifications', { notificationIds });
  }

  // Request system metrics
  requestSystemMetrics(): void {
    this.emit('request-system-metrics');
  }

  // Send admin notification
  sendAdminNotification(notification: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>): void {
    this.emit('send-admin-notification', notification);
  }

  // Connection status
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Close connection
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let adminWebSocketInstance: AdminWebSocketClient | null = null;

export function getAdminWebSocket(): AdminWebSocketClient {
  if (!adminWebSocketInstance) {
    adminWebSocketInstance = new AdminWebSocketClient();
  }
  return adminWebSocketInstance;
}

// =============================================================================
// React Hook for WebSocket
// =============================================================================

import { useEffect, useState, useCallback } from 'react';

export interface UseAdminWebSocketReturn {
  socket: AdminWebSocketClient;
  isConnected: boolean;
  notifications: AdminNotification[];
  systemMetrics: SystemMetrics | null;
  markAsRead: (notificationId: string) => void;
  clearNotifications: (notificationIds: string[]) => void;
  sendNotification: (notification: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => void;
}

export function useAdminWebSocket(userRoles: string[] = []): UseAdminWebSocketReturn {
  const [socket] = useState(() => getAdminWebSocket());
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    socket.setUserRoles(userRoles);

    // Connection status listeners
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // Notification listeners
    const handleNotification = (notification: AdminNotification) => {
      // Check if user has required role
      const hasRequiredRole = notification.targetRoles.length === 0 || 
        notification.targetRoles.some(role => userRoles.includes(role));
      
      if (hasRequiredRole) {
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
        
        // Show browser notification for high/critical priority
        if (notification.priority === 'high' || notification.priority === 'critical') {
          showBrowserNotification(notification);
        }
      }
    };

    const handleSystemMetrics = (metrics: SystemMetrics) => {
      setSystemMetrics(metrics);
    };

    const handleNotificationRead = (notificationId: string) => {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    };

    // Register listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('admin-notification', handleNotification);
    socket.on('system-metrics', handleSystemMetrics);
    socket.on('notification-read', handleNotificationRead);

    // Initial connection status
    setIsConnected(socket.isSocketConnected());

    // Request initial metrics
    socket.requestSystemMetrics();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('admin-notification', handleNotification);
      socket.off('system-metrics', handleSystemMetrics);
      socket.off('notification-read', handleNotificationRead);
    };
  }, [socket, userRoles]);

  const markAsRead = useCallback((notificationId: string) => {
    socket.markNotificationRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, [socket]);

  const clearNotifications = useCallback((notificationIds: string[]) => {
    socket.clearNotifications(notificationIds);
    setNotifications(prev => 
      prev.filter(n => !notificationIds.includes(n.id))
    );
  }, [socket]);

  const sendNotification = useCallback((notification: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => {
    socket.sendAdminNotification(notification);
  }, [socket]);

  return {
    socket,
    isConnected,
    notifications,
    systemMetrics,
    markAsRead,
    clearNotifications,
    sendNotification,
  };
}

// =============================================================================
// Browser Notification Utility
// =============================================================================

function showBrowserNotification(notification: AdminNotification): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon/favicon-32x32.png',
      badge: '/favicon/favicon-32x32.png',
      tag: notification.id,
      requireInteraction: notification.priority === 'critical',
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    // Request permission
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification(notification);
      }
    });
  }
}