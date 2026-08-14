import { logger } from '@modules/game/logger';
import type { HookMap } from '@core/extensions/points';
import { Ticket } from '../models/Ticket';
import { NotificationService } from '../services/NotificationService';

/**
 * Handler dell'hook 'character.playerStatus.pending'. Logica relocata
 * verbatim da database/models/Character.ts (Fase 7.2, consolidamento
 * core): creazione ticket character_approval + notifica staff via
 * WebSocket, invariata nel comportamento — solo il punto di innesco è
 * cambiato (da dentro il pre('save') del model a un extension point
 * emesso da post('save'), dopo che il personaggio è già persistito).
 */
export async function onCharacterPendingApproval(ctx: HookMap['character.playerStatus.pending']): Promise<void> {
  const { characterId, characterName } = ctx;

  try {
    // Check if ticket already exists (avoid duplicates)
    // Fix Fase 7.2: createdBy è un ObjectId piatto nello schema reale di
    // Ticket, non {characterId,...} — la query originale (annidata) non
    // ha mai trovato nulla, quindi il controllo duplicati non ha mai
    // funzionato. Corretto su decisione esplicita dell'utente.
    const existingTicket = await Ticket.findOne({
      category: 'character_approval',
      createdBy: characterId,
      status: { $nin: ['closed'] }
    });

    if (existingTicket) return;

    const ticket = await Ticket.create({
      title: `Richiesta Approvazione: ${characterName}`,
      category: 'character_approval',
      priority: 'medium', // From category config
      department: 'administration', // From category config
      status: 'open',
      // Fix Fase 7.2: stesso motivo di createdBy sopra — createdBy è
      // Schema.Types.ObjectId, createdByName un campo separato
      // required. Il payload originale (oggetto annidato) falliva
      // SEMPRE la validazione di Ticket.create(), silenziosamente
      // catturato dal try/catch: "auto-crea ticket alla submission"
      // non ha mai funzionato. Corretto su decisione esplicita
      // dell'utente (characterAvatar non ha un campo corrispondente
      // nello schema Ticket, scartato).
      createdBy: characterId,
      createdByName: characterName,
      categoryMetadata: {
        targetCharacterId: characterId
      },
      lastActivityAt: new Date()
    });

    // ✅ Notify staff via WebSocket
    try {
      await NotificationService.notifyNewTicket({
        _id: ticket._id,
        ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
        category: ticket.category,
        // Fix Fase 7.2: notifyNewTicket() rilegge questo campo come
        // ticket.priority per popolare sia data.ticketPriority (valida
        // solo low/medium/high/critical) sia l'urgenza della
        // notifica websocket — il letterale 'normal' originale falliva
        // SEMPRE la validazione di TicketNotification, silenziosamente
        // catturato dal try/catch: la notifica staff non è mai arrivata.
        // Corretto su decisione esplicita dell'utente.
        priority: ticket.priority,
        department: 'character_approval',
        createdBy: {
          characterId,
          characterName
        }
      });
    } catch (notifyError) {
      logger.error('Failed to send character approval notification', {
        error: notifyError instanceof Error ? notifyError.message : notifyError,
        characterId
      });
      // Non-blocking: notification failure shouldn't prevent submission
    }
  } catch (error) {
    // Log error but don't fail character submission
    logger.error('Failed to create character_approval ticket', {
      error: error instanceof Error ? error.message : error,
      characterId
    });
  }
}
