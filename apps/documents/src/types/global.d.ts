/**
 * Estensioni globali (browser) per l'app documents.
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
