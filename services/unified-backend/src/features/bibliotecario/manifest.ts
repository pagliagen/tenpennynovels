import type { FeatureManifest } from '@core/features/types';
import { onSearchStream } from './extensions/searchStream';
import { onSearchCapabilities } from './extensions/searchCapabilities';

/**
 * Nessuna route propria: il bibliotecario si aggancia solo a
 * documents.search.stream/capabilities, non espone endpoint. Spento di
 * default in produzione (keeper_qa_enabled=false).
 */
export const bibliotecario: FeatureManifest = {
  key: 'bibliotecario',
  title: 'Bibliotecario',
  description: 'Risposte AI sui documenti tramite RAG',
  flag: {
    configKey: 'keeper_qa_enabled',
    section: 'ai_features',
    default: false,
    label: 'Bibliotecario (Q&A documenti)',
  },
  extensions: (reg) => {
    reg.hook('documents.search.stream', onSearchStream);
    reg.filter('documents.search.capabilities', onSearchCapabilities);
  },
};
