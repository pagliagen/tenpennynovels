import { useState, useCallback, useEffect, useRef } from 'react';
import { API_CONFIG } from '@/constants/config';
import { useSocket } from './useSocket';
import { useNotificationStore } from '@/store/notificationStore';

export type ImageGenEntityType = 'character' | 'item' | 'location';
export type ImageGenStatus = 'idle' | 'generating' | 'completed' | 'error';

interface UseImageGenerationOptions {
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  style?: string;
  entityName?: string;
}

interface UseImageGenerationReturn {
  generate: () => void;
  status: ImageGenStatus;
  imageUrl: string | null;
  error: string | null;
  isGenerating: boolean;
}

export function useImageGeneration(
  entityType: ImageGenEntityType,
  entityId: string | undefined,
  options: UseImageGenerationOptions = {}
): UseImageGenerationReturn {
  const [status, setStatus] = useState<ImageGenStatus>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();
  const notify = useNotificationStore();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync active jobs on mount (survives page refresh)
  useEffect(() => {
    if (!entityId) return;

    fetch(`${API_CONFIG.BASE_URL}/admin/image-gen/active`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const jobs = data?.data?.jobs || [];
        const isActive = jobs.some(
          (j: { entityType: string; entityId: string }) =>
            j.entityType === entityType && j.entityId === entityId
        );
        if (isActive) {
          setStatus('generating');
        }
      })
      .catch(() => { /* ignore */ });
  }, [entityType, entityId]);

  // Listen for Socket.IO events
  useEffect(() => {
    if (!entityId) return;

    const entityLabel = optionsRef.current.entityName || entityId;

    const handleCompleted = (data: { entityType: string; entityId: string; imageUrl: string }) => {
      if (data.entityType === entityType && data.entityId === entityId) {
        setStatus('completed');
        setImageUrl(data.imageUrl);
        setError(null);
        optionsRef.current.onSuccess?.(data.imageUrl);
        notify.success(`L'immagine per "${entityLabel}" è stata generata con successo.`, 'Immagine generata');

        setTimeout(() => setStatus('idle'), 3000);
      }
    };

    const handleFailed = (data: { entityType: string; entityId: string; error: string }) => {
      if (data.entityType === entityType && data.entityId === entityId) {
        setStatus('error');
        const errMsg = data.error || 'Generazione fallita';
        setError(errMsg);
        optionsRef.current.onError?.(data.error);
        notify.error(`Generazione immagine per "${entityLabel}" fallita: ${errMsg}`, 'Errore generazione');
      }
    };

    socket.on('image_generation_completed', handleCompleted);
    socket.on('image_generation_failed', handleFailed);

    return () => {
      socket.off('image_generation_completed', handleCompleted);
      socket.off('image_generation_failed', handleFailed);
    };
  }, [socket, entityType, entityId]);

  const generate = useCallback(async () => {
    if (!entityId) {
      setError('ID entità mancante');
      return;
    }

    setStatus('generating');
    setError(null);
    setImageUrl(null);

    try {
      const styleParam = options.style ? `?style=${encodeURIComponent(options.style)}` : '';
      const url = `${API_CONFIG.BASE_URL}/admin/image-gen/generate/${entityType}/${entityId}${styleParam}`;

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setError(data.error || `Errore ${res.status}`);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore di rete');
    }
  }, [entityType, entityId, options.style]);

  return {
    generate,
    status,
    imageUrl,
    error,
    isGenerating: status === 'generating',
  };
}
