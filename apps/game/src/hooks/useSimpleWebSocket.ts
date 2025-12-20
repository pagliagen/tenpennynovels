import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSimpleWebSocket = (characterId: string, characterName: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('🔌 SimpleWebSocket: Connecting...');
    
    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
      auth: {
        characterId,
        characterName
      }
    });

    socket.on('connect', () => {
      console.log('🔌 SimpleWebSocket: Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 SimpleWebSocket: Disconnected');
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 SimpleWebSocket: Cleaning up');
      socket.disconnect();
    };
  }, [characterId, characterName]);

  const joinLocation = (locationId: string) => {
    if (socketRef.current) {
      console.log('🔌 SimpleWebSocket: Joining location', locationId);
      socketRef.current.emit('join_location', { locationId });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinLocation
  };
};