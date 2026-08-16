import mongoose from 'mongoose';
import { logger } from '@shared/utils/logger';
import { redis } from '@config/runtime/redis';
import { Ticket } from '../models/Ticket';
import { TicketMessage } from '../models/TicketMessage';

interface CharacterReviewOutcome {
  characterId: string;
  characterName: string;
  action: 'approve' | 'reject';
  note: string;
  reviewedBy: string;
  reviewedByUsername: string;
}

/**
 * Applica l'esito della review di un personaggio (approvazione/rigetto)
 * al ticket 'character_approval' associato: approvazione → auto-chiusura,
 * rigetto → messaggio col motivo, ticket resta open (decisione utente:
 * lo staff deve poterlo ritrovare in coda senza doverlo riaprire a mano).
 *
 * Trova il ticket con la stessa query anti-duplicati di
 * onCharacterPendingApproval.ts. Se non lo trova (es. già chiuso a mano),
 * non deve mai bloccare l'esito della review: solo un warning.
 */
export async function applyCharacterReviewOutcome(params: CharacterReviewOutcome): Promise<void> {
  const { characterId, characterName, action, note, reviewedBy, reviewedByUsername } = params;

  try {
    const ticket = await Ticket.findOne({
      category: 'character_approval',
      createdBy: characterId,
      status: { $nin: ['closed'] }
    });

    if (!ticket) {
      logger.warn('[CharacterApprovalTicketService] Nessun ticket character_approval trovato per la review', {
        characterId,
        action
      });
      return;
    }

    const ticketNumber = ticket._id.toString().slice(-6).toUpperCase();
    const reviewerId = new mongoose.Types.ObjectId(reviewedBy);
    const now = new Date();

    if (action === 'approve') {
      const content = `✅ Personaggio approvato!${note ? `\n\n${note}` : ''}`;

      await TicketMessage.create({
        ticketId: ticket._id,
        content,
        sender: { type: 'staff', id: reviewerId, name: reviewedByUsername },
        sentAt: now,
        isInternal: false
      });

      ticket.status = 'closed';
      ticket.closedAt = now;
      ticket.closedBy = reviewerId;
      ticket.closedByName = reviewedByUsername;
      ticket.lastReadBy.staff = now;
      ticket.lastActivityAt = now;
      await ticket.save();

      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_closed',
        ticketId: ticket._id.toString(),
        ticketNumber,
        title: ticket.title,
        department: ticket.department,
        createdBy: { id: characterId },
        closedBy: { id: reviewedBy, name: reviewedByUsername },
        closedAt: now.toISOString(),
        finalMessage: content,
        timestamp: now.toISOString()
      }));
    } else {
      const content = `❌ Richiesta respinta.\n\n${note}`;

      const message = await TicketMessage.create({
        ticketId: ticket._id,
        content,
        sender: { type: 'staff', id: reviewerId, name: reviewedByUsername },
        sentAt: now,
        isInternal: false
      });

      ticket.lastReadBy.staff = now;
      ticket.lastActivityAt = now;
      await ticket.save();

      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_message',
        ticketId: ticket._id.toString(),
        ticketNumber,
        ticketTitle: ticket.title,
        department: ticket.department,
        createdBy: { id: characterId },
        messageId: message._id.toString(),
        content,
        sender: { type: 'staff', id: reviewedBy, name: reviewedByUsername },
        isInternal: false,
        sentAt: now.toISOString(),
        timestamp: now.toISOString()
      }));
    }

    logger.info('[CharacterApprovalTicketService] Esito review applicato al ticket', {
      ticketId: ticket._id.toString(),
      characterId,
      characterName,
      action
    });
  } catch (error) {
    logger.error('[CharacterApprovalTicketService] Errore applicando esito review al ticket', {
      error: error instanceof Error ? error.message : error,
      characterId,
      action
    });
  }
}
