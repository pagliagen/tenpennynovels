/**
 * Barrel pubblico della feature. Espone solo i controlli deterministici che altre feature riusano su testi scritti
 * dal modello (es. `botAdmin`: schede dei bot): niente logica di dominio dell'editoriale.
 */
export { findAnachronisms } from './utils/anachronisms';
