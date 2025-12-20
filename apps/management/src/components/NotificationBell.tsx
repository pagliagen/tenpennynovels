import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from '@/styles/components/NotificationBell.module.scss';
import { AuthContext } from '@/lib/auth';

interface Notification {
  id: string;
  type: 'character_approval' | 'user_report' | 'system_alert' | 'moderation' | 'economy';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRoles: string[];
}

interface NotificationBellProps {
  authContext?: AuthContext;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ authContext }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authContext?.user?.canAccessAdminPanel) return;

    // Initialize WebSocket connection with error handling
    const newSocket = io(process.env.SOCKET_URL || 'http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      autoConnect: false // Don't auto-connect to avoid immediate errors
    });

    // Join admin room based on user roles
    const userRoles = authContext.user.userRoles || [];
    const characterRoles = authContext.user.characterRoles || [];
    const combinedRoles = [...userRoles, ...characterRoles];
    
    // Try to connect with error handling
    try {
      newSocket.connect();
      newSocket.emit('join-admin-room', { roles: combinedRoles });
    } catch (error) {
      console.warn('Failed to initialize WebSocket connection:', error);
    }

    // Listen for admin notifications
    newSocket.on('admin-notification', (notification: Notification) => {
      // Check if user has required role for this notification
      const hasRequiredRole = notification.targetRoles.length === 0 || 
        notification.targetRoles.some(role => combinedRoles.includes(role));
      
      if (hasRequiredRole) {
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
        setUnreadCount(prev => prev + 1);
        
        // Show browser notification for high/critical priority
        if (notification.priority === 'high' || notification.priority === 'critical') {
          if (Notification.permission === 'granted') {
            new Notification(`TenpennyNovels Admin: ${notification.title}`, {
              body: notification.message,
              icon: '/favicon/favicon-32x32.png'
            });
          }
        }
      }
    });

    // Handle connection events
    newSocket.on('connect', () => {
      console.log('Admin WebSocket connected successfully');
      // Request initial notifications
      newSocket.emit('get-admin-notifications', { roles: combinedRoles });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Admin WebSocket disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.warn('WebSocket connection failed (this is expected if Game Backend is not running):', error.message);
      // Don't throw error - just log it
    });

    newSocket.on('reconnect_error', (error) => {
      console.warn('WebSocket reconnection failed:', error.message);
    });

    newSocket.on('error', (error) => {
      console.warn('WebSocket error:', error);
    });

    // Load initial notifications
    newSocket.on('admin-notifications-history', (history: Notification[]) => {
      setNotifications(history);
      setUnreadCount(history.filter(n => !n.read).length);
    });

    setSocket(newSocket);

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      try {
        newSocket.disconnect();
        newSocket.removeAllListeners();
      } catch (error) {
        console.warn('Error during WebSocket cleanup:', error);
      }
    };
  }, [authContext]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Notify server
    socket?.emit('mark-notification-read', { notificationId });
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    
    // Notify server
    socket?.emit('mark-all-notifications-read');
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'character_approval':
        window.location.href = '/characters/approval';
        break;
      case 'user_report':
        window.location.href = '/moderation/reports';
        break;
      case 'system_alert':
        window.location.href = '/system/maintenance';
        break;
      case 'moderation':
        window.location.href = '/moderation';
        break;
      case 'economy':
        window.location.href = '/economy';
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'character_approval': return '✅';
      case 'user_report': return '🚨';
      case 'system_alert': return '⚠️';
      case 'moderation': return '⚖️';
      case 'economy': return '💰';
      default: return '📢';
    }
  };

  const getPriorityClass = (priority: string) => {
    return styles[`priority-${priority}`];
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Ora';
    if (minutes < 60) return `${minutes}m fa`;
    if (hours < 24) return `${hours}h fa`;
    return `${days}g fa`;
  };

  return (
    <div className={styles.notificationBell} ref={dropdownRef}>
      <button 
        className={`${styles.bellButton} ${unreadCount > 0 ? styles.hasNotifications : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifiche (${unreadCount} non lette)`}
      >
        <span className={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span className={styles.notificationCount}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.notificationDropdown}>
          <div className={styles.dropdownHeader}>
            <h3>Notifiche</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className={styles.markAllReadButton}
              >
                Segna tutte come lette
              </button>
            )}
          </div>

          <div className={styles.notificationsList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyNotifications}>
                <span className={styles.emptyIcon}>🔕</span>
                <p>Nessuna notifica</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${
                    !notification.read ? styles.unread : ''
                  } ${getPriorityClass(notification.priority)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationTitle}>
                      {notification.title}
                    </div>
                    <div className={styles.notificationMessage}>
                      {notification.message}
                    </div>
                    <div className={styles.notificationTimestamp}>
                      {formatTimestamp(notification.timestamp)}
                    </div>
                  </div>
                  
                  {!notification.read && (
                    <div className={styles.unreadDot}></div>
                  )}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className={styles.dropdownFooter}>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/notifications';
                }}
                className={styles.viewAllButton}
              >
                Vedi tutte le notifiche
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};