/**
 * Documents ISR Revalidation
 *
 * apps/documents genera le pagine di dettaglio documento (regolamento/ambientazione)
 * con getStaticProps + revalidate: 3600. Senza un trigger on-demand, una modifica
 * salvata nel gestionale resta invisibile sul sito pubblico fino a un'ora dopo — e
 * anche allo scadere, la prima richiesta successiva serve ancora la pagina stale
 * (Next rigenera in background, la nuova versione arriva dalla richiesta dopo).
 *
 * Chiamata fire-and-forget dal post('save') hook di Document.ts.
 */

import axios from 'axios';
import { appConfig } from '../../config/runtime/appConfig';
import { logger } from '@shared/utils/logger';

export async function revalidateDocumentPaths(
  type: 'ambientazione' | 'regolamento',
  paths: (string | undefined | null)[]
): Promise<void> {
  const secret = appConfig.services.documents.revalidateSecret;
  if (!secret) {
    logger.warn('[DocumentsRevalidator] DOCUMENTS_REVALIDATE_SECRET non configurato, salto revalidation');
    return;
  }

  const uniquePaths = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))];
  if (uniquePaths.length === 0) return;

  try {
    await axios.post(
      `${appConfig.services.documents.internalUrl}/api/revalidate`,
      { type, paths: uniquePaths },
      {
        headers: { 'X-Revalidate-Secret': secret },
        timeout: 5000,
      }
    );
    logger.debug('[DocumentsRevalidator] Revalidation richiesta', { type, paths: uniquePaths });
  } catch (error) {
    logger.error('[DocumentsRevalidator] Revalidation fallita', { type, paths: uniquePaths, error });
  }
}
