/**
 * Preview Token Service
 *
 * Token firmato short-lived per autorizzare l'iframe di preview in apps/documents
 * a leggere un documento in bozza/non visibile, che l'endpoint pubblico
 * (DocumentController.getByPath) rifiuta sempre (isDraft/visible hardcoded).
 * Evita di appoggiarsi al cookie character_context (deprecato) per risolvere
 * l'auth admin cross-subdomain in una fetch SSR.
 */

import jwt from 'jsonwebtoken';
import { appConfig } from '../../../config/runtime/appConfig';

const ISSUER = 'tenpennynovels-documents';
const AUDIENCE = 'document-preview';
const EXPIRES_IN = '5m';

interface PreviewTokenPayload {
  documentId: string;
}

function getSecret(): string {
  if (!appConfig.jwt.secret) throw new Error('JWT_SECRET non configurato');
  return appConfig.jwt.secret;
}

export const PreviewTokenService = {
  sign(documentId: string): { token: string; expiresAt: string } {
    const token = jwt.sign(
      { documentId } satisfies PreviewTokenPayload,
      getSecret(),
      { expiresIn: EXPIRES_IN, issuer: ISSUER, audience: AUDIENCE }
    );

    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return { token, expiresAt };
  },

  verify(token: string, documentId: string): boolean {
    try {
      const decoded = jwt.verify(token, getSecret(), {
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as PreviewTokenPayload;

      return decoded.documentId === documentId;
    } catch {
      return false;
    }
  },
};
