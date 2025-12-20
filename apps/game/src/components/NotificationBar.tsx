import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNotificationSettings } from '@/contexts/NotificationSettingsContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useGame } from '@/contexts/GameContext';
import { UtilityPanel } from './UtilityPanel';
import styles from '@/styles/components/NotificationBar.module.scss';

const ticketBaseUrl = process.env.NEXT_PUBLIC_TICKETS_URL || 'https://supporto.tenpennynovels.com';
const adminBaseUrl = process.env.NEXT_PUBLIC_MANAGEMENT_URL || 'https://gestione.tenpennynovels.com';

interface NotificationBarProps {
  canAccessAdmin?: boolean;
  canAccessTickets?: boolean;
  onOffGameChatOpen?: () => void;
  onOffGameNotificationsSeen?: () => void;
  onOnGameMailOpen?: () => void;
  onOnGameNotificationsSeen?: () => void;
  unreadTicketsCount?: number;
  workableTicketsCount?: number;
}

interface DebugMessage {
  id: string;
  timestamp: string;
  type: 'OUTGOING' | 'INCOMING' | 'CONNECTION' | 'ERROR';
  event: string;
  data?: any;
}

export const NotificationBar: React.FC<NotificationBarProps> = ({ canAccessAdmin = false, canAccessTickets = false, onOffGameChatOpen, onOffGameNotificationsSeen, onOnGameMailOpen, onOnGameNotificationsSeen, unreadTicketsCount = 0, workableTicketsCount = 0 }) => {
  const { state, markAsSeen, getUnreadBadgeCount, addNotification } = useNotifications();
  const { settings, shouldShowNotification } = useNotificationSettings();
  const { isConnected, onLocationAction, onPresenceUpdate, onLocationEvent, onTypingUpdate, onOffGameMessage, onOnGameMessage } = useWebSocket();
  const { character } = useGame();
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [showTicketsPopup, setShowTicketsPopup] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [debugMessages, setDebugMessages] = useState<DebugMessage[]>([]);
 
  const handleAdminClick = () => {
    const characterId = character?.id || '';
    const adminUrl = `${adminBaseUrl}${characterId ? `?characterId=${characterId}` : ''}`;

    if (settings.adminPanelOpenMode === 'popup') {
      setShowAdminPopup(true);
    } else {
      window.open(adminUrl, '_blank');
    }
  };

  const openAdminInNewTab = () => {
    const characterId = character?.id || '';
    const adminUrl = `${adminBaseUrl}${characterId ? `?characterId=${characterId}` : ''}`;
    window.open(adminUrl, '_blank');
    setShowAdminPopup(false);
  };

  const handleTicketsClick = () => {
    const characterId = character?.id || '';
    const ticketsUrl = `${ticketBaseUrl}${characterId ? `?characterId=${characterId}` : ''}`;

    if (settings.ticketsPanelOpenMode === 'popup') {
      setShowTicketsPopup(true);
    } else {
      window.open(ticketsUrl, '_blank');
    }
  };

  const openTicketsInNewTab = () => {
    const characterId = character?.id || '';
    const ticketsUrl = `${ticketBaseUrl}${characterId ? `?characterId=${characterId}` : ''}`;
    window.open(ticketsUrl, '_blank');
    setShowTicketsPopup(false);
  };

  const toggleSettingsPanel = () => {
    setShowSettingsPanel(!showSettingsPanel);
  };

  // Add debug message
  const addDebugMessage = (type: DebugMessage['type'], event: string, data?: any) => {
    const message: DebugMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      event,
      data
    };

    setDebugMessages(prev => [...prev.slice(-19), message]); // Keep last 20 messages
  };

  // Monitor WebSocket events for debug
  useEffect(() => {
    addDebugMessage('CONNECTION', isConnected ? 'CONNECTED' : 'DISCONNECTED');
  }, [isConnected]);

  useEffect(() => {
    const unsubscribeLocationAction = onLocationAction((data) => {
      addDebugMessage('INCOMING', 'location_action', data);
    });

    const unsubscribePresenceUpdate = onPresenceUpdate((data) => {
      addDebugMessage('INCOMING', 'presence_update', data);
    });

    const unsubscribeLocationEvent = onLocationEvent((data) => {
      addDebugMessage('INCOMING', 'location_event', data);
    });

    const unsubscribeTypingUpdate = onTypingUpdate((data) => {
      addDebugMessage('INCOMING', 'user_typing', data);
    });

    const unsubscribeOffGameMessage = onOffGameMessage((notification) => {
      addDebugMessage('INCOMING', 'offgame_message_received', notification);

      // Add notification to the notification system
      addNotification({
        type: 'offgame_message',
        title: `Messaggio da ${notification.senderName}`,
        content: notification.content.length > 50 ?
          notification.content.substring(0, 47) + '...' :
          notification.content,
        icon: '💬',
        volatile: false,
        showBadge: true
      });
    });

    const unsubscribeOnGameMessage = onOnGameMessage((notification) => {
      addDebugMessage('INCOMING', 'ongame:message_delivered', notification);

      // Add notification to the notification system
      addNotification({
        type: 'ingame_message',
        title: `${notification.icon} da ${notification.fromCharacterName}`,
        content: notification.subject.length > 50 ?
          notification.subject.substring(0, 47) + '...' :
          notification.subject,
        icon: notification.icon,
        volatile: false,
        showBadge: true
      });
    });

    return () => {
      unsubscribeLocationAction();
      unsubscribePresenceUpdate();
      unsubscribeLocationEvent();
      unsubscribeTypingUpdate();
      unsubscribeOffGameMessage();
      unsubscribeOnGameMessage();
    };
  }, [onLocationAction, onPresenceUpdate, onLocationEvent, onTypingUpdate, onOffGameMessage, onOnGameMessage, addNotification]);

  const toggleNotification = (typeOrId: string) => {
    // Special handling for off-game messages: open chat instead of expanding
    if (typeOrId === 'offgame_message' && onOffGameChatOpen) {
      onOffGameChatOpen();

      // Mark all off-game notifications as seen
      const group = groupedNotifications.find(g => g.type === 'offgame_message');
      if (group) {
        group.notifications.forEach(notification => {
          if (!notification.read) {
            markAsSeen(notification.id);
          }
        });
        // Notify GameLayout that off-game notifications were seen
        onOffGameNotificationsSeen?.();
      }
      return;
    }

    // Special handling for in-game messages: open mail panel instead of expanding
    if (typeOrId === 'ingame_message' && onOnGameMailOpen) {
      onOnGameMailOpen();

      // Mark all OnGame notifications as seen
      const group = groupedNotifications.find(g => g.type === 'ingame_message');
      if (group) {
        group.notifications.forEach(notification => {
          if (!notification.read) {
            markAsSeen(notification.id);
          }
        });
        // Notify GameLayout that OnGame notifications were seen
        onOnGameNotificationsSeen?.();
      }
      return;
    }

    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(typeOrId)) {
        newSet.delete(typeOrId);
      } else {
        newSet.add(typeOrId);

        // Mark all notifications of this type as seen when user opens the group
        const group = groupedNotifications.find(g => g.type === typeOrId);
        if (group) {
          group.notifications.forEach(notification => {
            if (!notification.read) {
              markAsSeen(notification.id);
            }
          });
        }
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'admin': return '⚙️';
      case 'websocket_debug': return isConnected ? '🟢' : '🔴';
      case 'chat_message': return '💬';
      case 'ingame_message': return '✉️';
      case 'offgame_message': return '📱';
      case 'character_approved': return '✅';
      case 'character_rejected': return '❌';
      case 'player_entered': return '👋';
      case 'system_message': return '📢';
      default: return '🔔';
    }
  };

  const getNotificationTypeTitle = (type: string): string => {
    switch (type) {
      case 'chat_message': return 'Messaggi Chat';
      case 'ingame_message': return 'Messaggi In-Game';
      case 'offgame_message': return 'Messaggi Off-Game';
      case 'character_approved': return 'Personaggio Approvato';
      case 'character_rejected': return 'Personaggio Rifiutato';
      case 'player_entered': return 'Presenza Giocatori';
      case 'system_message': return 'Messaggi Sistema';
      default: return 'Notifiche';
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter notifications based on settings
  const filteredNotifications = state.notifications
    .filter(notification => shouldShowNotification(notification.type))
    .slice(-settings.maxNotifications);

  // Group notifications by type for display
  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const existingGroup = acc.find(group => group.type === notification.type);
    if (existingGroup) {
      existingGroup.notifications.push(notification);
      if (!notification.read && notification.showBadge) {
        existingGroup.unreadCount++;
      }
    } else {
      acc.push({
        type: notification.type,
        notifications: [notification],
        unreadCount: (!notification.read && notification.showBadge) ? 1 : 0,
        latestNotification: notification
      });
    }
    return acc;
  }, [] as Array<{
    type: string;
    notifications: typeof filteredNotifications;
    unreadCount: number;
    latestNotification: typeof filteredNotifications[0];
  }>);

  return (
    <>
      {/* Settings Icon - Always visible */}
      <div
        className={`${styles.settingsIcon} ${showSettingsPanel ? styles.expanded : ''} ${unreadTicketsCount > 0 ? styles.hasTickets : ''}`}
        onClick={toggleSettingsPanel}
        title={unreadTicketsCount > 0 ? `Utilità (${unreadTicketsCount} ticket non letti)` : "Utilità"}
      >
        <span className={styles.icon}>⚙️</span>
        {unreadTicketsCount > 0 && (
          <div className={styles.settingsBadge}>
            {unreadTicketsCount > 99 ? '99+' : unreadTicketsCount}
          </div>
        )}
      </div>

      {/* Admin Button (if user has access) - Fixed position like settings */}
      {canAccessAdmin && (
        <div
          className={`${styles.settingsIcon} ${styles.adminIcon}`}
          onClick={handleAdminClick}
          title="Pannello Amministrazione"
        >
          <span className={styles.icon}>👑</span>
        </div>
      )}

      {/* Tickets Button (if user has access) - Fixed position like settings */}
      {canAccessTickets && (
        <div
          className={`${styles.settingsIcon} ${styles.ticketsIcon} ${!canAccessAdmin ? styles.ticketsIconNoAdmin : ''}`}
          onClick={handleTicketsClick}
          title={workableTicketsCount > 0 ? `Tickets Lavorabili (${workableTicketsCount})` : "Gestione Tickets"}
        >
          <span className={styles.icon}>🎫</span>
          {workableTicketsCount > 0 && (
            <div className={styles.settingsBadge}>
              {workableTicketsCount > 99 ? '99+' : workableTicketsCount}
            </div>
          )}
        </div>
      )}

      {/* Notification Bar - Conditional visibility */}
      {settings.showNotificationBar && (
        <div className={styles.notificationsContainer}>
          {/* WebSocket Debug (development only) - now integrated as notification group */}
          {process.env.NODE_ENV === 'development' && (
            <div
              className={`${styles.notificationIcon} ${styles.debugButton} ${expandedNotifications.has('websocket_debug') ? styles.expanded : ''}`}
              onClick={() => toggleNotification('websocket_debug')}
              title={`WebSocket: ${isConnected ? 'Connesso' : 'Disconnesso'}`}
            >
              <span className={styles.icon}>
                {isConnected ? '🟢' : '🔴'}
              </span>

              {/* WebSocket Debug bubble */}
              {expandedNotifications.has('websocket_debug') && (
                <div className={styles.notificationBubble}>
                  <div className={styles.bubbleHeader}>
                    <span className={styles.bubbleTitle}>WebSocket Debug</span>
                    <span className={styles.bubbleTime}>Status: {isConnected ? 'Connesso' : 'Disconnesso'}</span>
                  </div>
                  <div className={styles.bubbleContent}>
                    <div style={{ maxHeight: '300px', overflow: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                      {debugMessages.length === 0 ? (
                        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic' }}>
                          Nessun messaggio debug ancora...
                        </div>
                      ) : (
                        debugMessages.map((msg) => (
                          <div key={msg.id} style={{ marginBottom: '8px', padding: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{
                                color: msg.type === 'CONNECTION' ? '#4CAF50' :
                                  msg.type === 'INCOMING' ? '#2196F3' :
                                    msg.type === 'OUTGOING' ? '#FF9800' : '#f44336',
                                fontWeight: 'bold',
                                fontSize: '10px'
                              }}>
                                {msg.type}
                              </span>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '10px' }}>
                                {msg.timestamp}
                              </span>
                            </div>
                            <div style={{ color: '#ffffff', marginBottom: '2px' }}>
                              Event: <strong>{msg.event}</strong>
                            </div>
                            {msg.data && (
                              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '10px', maxHeight: '60px', overflow: 'auto' }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {JSON.stringify(msg.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grouped Notifications by Type - Only show groups with unread messages */}
          {groupedNotifications.filter(group => group.unreadCount > 0).map((group) => (
            <div
              key={group.type}
              className={`${styles.notificationIcon} ${expandedNotifications.has(group.type) ? styles.expanded : ''} ${group.unreadCount > 0 ? styles.unread : ''}`}
              onClick={() => toggleNotification(group.type)}
              title={`${group.latestNotification.title} ${group.notifications.length > 1 ? `(${group.notifications.length} notifiche)` : ''}`}
            >
              <span className={styles.icon}>
                {getNotificationIcon(group.type)}
              </span>

              {/* Type-specific unread count badge */}
              {group.unreadCount > 0 && (
                <div className={styles.typeUnreadBadge}>
                  {group.unreadCount > 99 ? '99+' : group.unreadCount}
                </div>
              )}

              {/* Notification bubble showing all notifications of this type */}
              {expandedNotifications.has(group.type) && (
                <div className={styles.notificationBubble}>
                  <div className={styles.bubbleHeader}>
                    <span className={styles.bubbleTitle}>
                      {getNotificationTypeTitle(group.type)} ({group.notifications.length})
                    </span>
                    <span className={styles.bubbleTime}>{formatTime(group.latestNotification.timestamp)}</span>
                    {group.unreadCount > 0 && (
                      <span className={styles.newIndicator}>{group.unreadCount} NUOVI</span>
                    )}
                  </div>
                  <div className={styles.bubbleContent}>
                    {group.notifications.slice(-3).map((notification, index) => (
                      <div key={notification.id} className={styles.notificationItem}>
                        <div className={styles.notificationItemHeader}>
                          <span className={styles.notificationItemTitle}>{notification.title}</span>
                          <span className={styles.notificationItemTime}>{formatTime(notification.timestamp)}</span>
                          {!notification.read && <span className={styles.newDot}>•</span>}
                        </div>
                        <div className={styles.notificationItemContent}>{notification.content}</div>
                        {index < group.notifications.slice(-3).length - 1 && <hr className={styles.notificationDivider} />}
                      </div>
                    ))}
                    {group.notifications.length > 3 && (
                      <div className={styles.moreNotifications}>
                        e altre {group.notifications.length - 3} notifiche...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Global badge removed - using type-specific badges instead */}
        </div>
      )}

      {/* Debug panel removed - now integrated in notification bubble */}

      {/* Utility Panel */}
      {showSettingsPanel && (
        <UtilityPanel
          onClose={toggleSettingsPanel}
          unreadTicketsCount={unreadTicketsCount}
        />
      )}

      {/* Admin Popup Modal */}
      {showAdminPopup && (
        <div className={styles.adminPopupOverlay}>
          <div className={styles.adminPopupContainer}>
            <div className={styles.adminPopupHeader}>
              <h3>👑 Pannello Gestionale</h3>
              <div className={styles.adminPopupControls}>
                <button
                  onClick={openAdminInNewTab}
                  className={styles.openInTabButton}
                  title="Apri in nuova pagina"
                >
                  🗗 Nuova Pagina
                </button>
                <button
                  onClick={() => setShowAdminPopup(false)}
                  className={styles.closePopupButton}
                  title="Chiudi"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.adminPopupContent}>
              <iframe
                src={`${adminBaseUrl}${character?.id ? `?characterId=${character.id}` : ''}`}
                className={styles.adminIframe}
                title="Pannello Gestionale"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tickets Popup Modal */}
      {showTicketsPopup && (
        <div className={styles.adminPopupOverlay}>
          <div className={styles.adminPopupContainer}>
            <div className={styles.adminPopupHeader}>
              <h3>🎫 Gestione Tickets</h3>
              <div className={styles.adminPopupControls}>
                <button
                  onClick={openTicketsInNewTab}
                  className={styles.openInTabButton}
                  title="Apri in nuova pagina"
                >
                  🗗 Nuova Pagina
                </button>
                <button
                  onClick={() => setShowTicketsPopup(false)}
                  className={styles.closePopupButton}
                  title="Chiudi"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.adminPopupContent}>
              <iframe
                src={`${ticketBaseUrl}${character?.id ? `?characterId=${character.id}` : ''}`}
                className={styles.adminIframe}
                title="Gestione Tickets"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};