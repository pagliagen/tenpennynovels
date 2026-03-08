import { useEffect, useRef, useCallback, useState } from 'react';

type SSEHandler = (event: string, data: unknown) => void;

export function useSSE(url: string, onEvent: SSEHandler) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const reconnect = useCallback(() => {
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.addEventListener('bot-generated', (e) => {
      handlerRef.current('bot-generated', JSON.parse(e.data));
    });

    es.addEventListener('bot-response', (e) => {
      handlerRef.current('bot-response', JSON.parse(e.data));
    });

    es.addEventListener('callback', (e) => {
      handlerRef.current('callback', JSON.parse(e.data));
    });

    es.onmessage = (e) => {
      try {
        handlerRef.current('message', JSON.parse(e.data));
      } catch {
        handlerRef.current('message', e.data);
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(reconnect, 3000);
    };

    return es;
  }, [url]);

  useEffect(() => {
    const es = reconnect();
    return () => es.close();
  }, [reconnect]);

  return { connected };
}
