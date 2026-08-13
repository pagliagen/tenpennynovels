/**
 * Handler del filter 'documents.search.capabilities'. Portato da
 * DocumentController.aiStatus() (Fase 2 del refactor). Il controllo del
 * flag keeper_qa_enabled non c'è più qui: se la feature è spenta,
 * ExtensionRegistry.apply() salta questo handler e il valore di default
 * passato dal chiamante ({ aiAvailable: false }) resta invariato.
 */

import type { FilterMap } from '@core/extensions/points';
import { KeeperClient } from '../services/KeeperClient';

export async function onSearchCapabilities(
  value: FilterMap['documents.search.capabilities']['value']
): Promise<FilterMap['documents.search.capabilities']['value']> {
  const healthy = await KeeperClient.isAiAvailable();
  return { ...value, aiAvailable: healthy };
}
