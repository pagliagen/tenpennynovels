import React from 'react';
import { useWebSocketNotifications } from '@/hooks/useWebSocketNotifications';

export const DevNotificationTester: React.FC = () => {
  const { addTestNotifications } = useWebSocketNotifications();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <button
      onClick={addTestNotifications}
      style={{
        background: 'rgba(33, 150, 243, 0.2)',
        border: '1px solid rgba(33, 150, 243, 0.5)',
        color: '#ffffff',
        padding: '8px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        marginLeft: '8px'
      }}
      title="Aggiungi notifiche di test"
    >
      🔔 Test Notifiche
    </button>
  );
};