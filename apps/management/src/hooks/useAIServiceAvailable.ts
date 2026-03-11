import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/constants/config';

const POLL_INTERVAL_MS = 60_000;

let cachedAvailable: boolean | null = null;
let lastCheckedAt = 0;
const listeners = new Set<(v: boolean) => void>();

async function checkAvailability(): Promise<boolean> {
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/admin/image-gen/health`, {
      credentials: 'include',
    });
    const data = await res.json();
    return data?.data?.available === true;
  } catch {
    return false;
  }
}

function notifyAll(value: boolean) {
  cachedAvailable = value;
  lastCheckedAt = Date.now();
  for (const fn of listeners) fn(value);
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (intervalId) return;
  const poll = async () => notifyAll(await checkAvailability());
  poll();
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Returns whether the AI image generation service is available.
 * Checks once on mount and polls every 60s. Shared across all consumers.
 */
export function useAIServiceAvailable(): boolean {
  const [available, setAvailable] = useState<boolean>(cachedAvailable ?? false);

  useEffect(() => {
    listeners.add(setAvailable);
    if (listeners.size === 1) startPolling();

    if (cachedAvailable !== null && Date.now() - lastCheckedAt < POLL_INTERVAL_MS) {
      setAvailable(cachedAvailable);
    }

    return () => {
      listeners.delete(setAvailable);
      if (listeners.size === 0) stopPolling();
    };
  }, []);

  return available;
}
