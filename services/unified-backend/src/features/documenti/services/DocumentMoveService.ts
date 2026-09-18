/**
 * DocumentMoveService
 *
 * Sposta un documento nell'albero (cambio di `parentId` + posizione fra i
 * fratelli). Le regole stanno in `utils/documentMove.ts`; qui si legge lo
 * stato, si scrive e si invalidano le pagine pubbliche coinvolte.
 *
 * Scrive con `bulkWrite` e non con `document.save()` di proposito: il pre-save
 * di Document.ts non ha nulla da ricalcolare (lo `slug` e il sottotipo non
 * cambiano, quindi nemmeno `path`) e il post-save ri-embedderebbe un
 * documento il cui contenuto è identico. La revalidation ISR, che il post-save
 * farebbe, si richiede invece esplicitamente qui sotto.
 */

import { Types } from 'mongoose';
import { logger } from '@shared/utils/logger';
import Document from '../models/Document';
import { isPublicDocumentType } from '../constants/documentTypes';
import {
  placeAmongSiblings,
  validateReparent,
  type DocumentNodeLite,
  type MoveViolation
} from '../utils/documentMove';

export type MoveErrorCode = MoveViolation | 'BEFORE_SIBLING_NOT_FOUND';

export class DocumentMoveError extends Error {
  constructor(public readonly code: MoveErrorCode) {
    super(code);
    this.name = 'DocumentMoveError';
  }
}

export interface MoveDocumentResult {
  _id: string;
  parentId: string | null;
  order: number;
}

interface LeanNode {
  _id: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  subtypeId: Types.ObjectId;
  type: string;
  path?: string;
  order?: number;
}

export class DocumentMoveService {
  /**
   * Sposta `docId` sotto `newParentId` (`null` = radice) e lo inserisce prima
   * di `beforeId` fra i nuovi fratelli (`null` = in coda).
   * Lancia `DocumentMoveError` se lo spostamento non è lecito.
   */
  static async move(
    docId: string,
    newParentId: string | null,
    beforeId: string | null
  ): Promise<MoveDocumentResult> {
    const target = await Document.findById(docId).select('type').lean();
    if (!target) throw new DocumentMoveError('DOCUMENT_NOT_FOUND');

    // L'albero si legge per tipo: un padre di un altro tipo è comunque
    // rifiutato da validateReparent, che lo trova (o no) in questa mappa.
    const docs = (await Document.find({ type: target.type })
      .select('parentId subtypeId type path order')
      .sort({ order: 1, _id: 1 })
      .lean()) as unknown as LeanNode[];

    const nodes = new Map<string, DocumentNodeLite>(
      docs.map((d) => [
        d._id.toString(),
        {
          id: d._id.toString(),
          parentId: d.parentId ? d.parentId.toString() : null,
          subtypeId: d.subtypeId.toString(),
          type: d.type,
          path: d.path
        }
      ])
    );

    const violation = validateReparent(nodes, docId, newParentId);
    if (violation) throw new DocumentMoveError(violation);

    const oldParentId = nodes.get(docId)?.parentId ?? null;

    const siblingsOf = (parentId: string | null): string[] =>
      docs.filter((d) => (d.parentId ? d.parentId.toString() : null) === parentId).map((d) => d._id.toString());

    const newOrder = placeAmongSiblings(siblingsOf(newParentId), docId, beforeId);
    if (!newOrder) throw new DocumentMoveError('BEFORE_SIBLING_NOT_FOUND');

    const currentOrderById = new Map(docs.map((d) => [d._id.toString(), d.order]));
    const parentChanged = oldParentId !== newParentId;
    const ops: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: { $set: Record<string, unknown> } } }> = [];

    const pushOrder = (ids: string[], parentId: string | null): void => {
      ids.forEach((id, index) => {
        const order = index + 1;
        const isMoved = id === docId;
        if (!isMoved && currentOrderById.get(id) === order) return;
        ops.push({
          updateOne: {
            filter: { _id: new Types.ObjectId(id) },
            update: {
              $set: {
                order,
                ...(isMoved ? { parentId: parentId ? new Types.ObjectId(parentId) : null } : {})
              }
            }
          }
        });
      });
    };

    pushOrder(newOrder, newParentId);
    // Chi resta nella vecchia lista viene rinumerato, così non restano buchi.
    if (parentChanged) {
      pushOrder(siblingsOf(oldParentId).filter((id) => id !== docId), oldParentId);
    }

    await Document.bulkWrite(ops);

    logger.info('[DocumentMove] Documento spostato', { docId, from: oldParentId, to: newParentId, beforeId });

    DocumentMoveService.revalidatePages(docId, oldParentId, newParentId, nodes);

    return { _id: docId, parentId: newParentId, order: newOrder.indexOf(docId) + 1 };
  }

  /**
   * Il dettaglio di un documento elenca i suoi figli: cambiano le pagine del
   * vecchio padre, del nuovo padre e del documento spostato. Fire-and-forget,
   * come nel post('save') di Document.ts; i tipi riservati non hanno cache ISR.
   */
  private static revalidatePages(
    docId: string,
    oldParentId: string | null,
    newParentId: string | null,
    nodes: Map<string, DocumentNodeLite>
  ): void {
    const moved = nodes.get(docId);
    if (!moved || !isPublicDocumentType(moved.type)) return;

    const paths = [docId, oldParentId, newParentId].map((id) => (id ? nodes.get(id)?.path : undefined));

    import('@shared/services/DocumentsRevalidator')
      .then(({ revalidateDocumentPaths }) => revalidateDocumentPaths(moved.type, paths))
      .catch((error) => {
        logger.error('[DocumentMove] Revalidation fallita:', error);
      });
  }
}
