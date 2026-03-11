import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '@/constants/config';

let globalSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(API_CONFIG.WEBSOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return globalSocket;
}

/**
 * Returns the shared Socket.IO instance.
 * The connection is created on first use and shared across all consumers.
 * Disconnects when no components are using it.
 */
export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    refCount++;
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      refCount--;
      if (refCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        refCount = 0;
      }
    };
  }, []);

  return socketRef.current;
}
