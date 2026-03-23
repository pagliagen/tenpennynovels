/**
 * Estensioni globali (browser) per l'app landing.
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
