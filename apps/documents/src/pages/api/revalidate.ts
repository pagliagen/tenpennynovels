/**
 * On-demand ISR revalidation.
 *
 * Chiamata server-to-server da unified-backend dopo il save di un Document
 * (vedi services/unified-backend/src/features/documenti/models/Document.ts),
 * per rigenerare subito la pagina statica invece di aspettare `revalidate: 3600`.
 * Protetta da un secret condiviso, non da CORS/sessione: non è un endpoint utente.
 *
 * @module pages/api/revalidate
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import { logger } from '@/lib/logger';
import { PUBLIC_DOCUMENT_TYPES, type PublicDocumentType } from '@/types/document';

// Solo i tipi pubblici: le pagine dei tipi riservati sono client-only, non
// esiste nessuna cache ISR da rigenerare. Il backend non chiama nemmeno.
const VALID_TYPES: PublicDocumentType[] = [...PUBLIC_DOCUMENT_TYPES];

// Segmenti di path attesi: slug alfanumerici separati da "/" (come da
// Document.path = "{subtype.slug}/{doc.slug}"), niente altro.
const PATH_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

interface RevalidateBody {
  type?: PublicDocumentType;
  paths?: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const secret = process.env.DOCUMENTS_REVALIDATE_SECRET;
  if (!secret) {
    logger.error('[revalidate] DOCUMENTS_REVALIDATE_SECRET non configurato');
    res.status(500).json({ success: false, error: 'Revalidation non configurata' });
    return;
  }

  if (req.headers['x-revalidate-secret'] !== secret) {
    res.status(401).json({ success: false, error: 'Secret non valido' });
    return;
  }

  const { type, paths } = req.body as RevalidateBody;

  if (!type || !VALID_TYPES.includes(type) || !Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ success: false, error: 'type (ambientazione|regolamento) e paths sono obbligatori' });
    return;
  }

  const results: Record<string, 'ok' | 'skipped' | 'error'> = {};

  for (const path of paths) {
    if (typeof path !== 'string' || !PATH_SEGMENT_RE.test(path)) {
      logger.warn('[revalidate] Path scartato, formato non valido', { path });
      continue;
    }

    const route = `/${type}/${path}`;
    try {
      await res.revalidate(route);
      results[route] = 'ok';
    } catch (error) {
      // Un 404 (pagina mai generata, es. draft) è normale: Next lo segnala
      // lanciando qui. Non è un fallimento da loggare come errore.
      logger.debug('[revalidate] Rigenerazione non riuscita (probabile 404)', { route, error });
      results[route] = 'error';
    }
  }

  res.status(200).json({ success: true, results });
}
