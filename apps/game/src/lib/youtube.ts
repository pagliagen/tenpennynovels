/**
 * YouTube helpers
 *
 * Estrazione video ID da un link YouTube (usato per il campo audioTheme del
 * personaggio: lo staff incolla un link youtube.com/youtu.be, non un file audio
 * diretto) e caricamento lazy della IFrame Player API.
 *
 * @module lib/youtube
 */

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractYouTubeVideoId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] ?? null : null;
}

export function isYouTubeUrl(url: string | undefined): boolean {
  return extractYouTubeVideoId(url) !== null;
}

let apiLoadPromise: Promise<void> | null = null;

/**
 * Carica lo script `iframe_api` di YouTube una sola volta e risolve quando
 * `window.YT.Player` è disponibile.
 */
export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previousCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}
