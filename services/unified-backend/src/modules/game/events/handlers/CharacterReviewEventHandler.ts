/**
 * Character Review Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 * ✅ USES DIRECT SERVICE CALLS (No HTTP overhead, no admin tokens needed)
 *
 * Handles character approval/rejection review events from management backend.
 * Sends off-game messages and WebSocket notifications to characters.
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../logger';

export class CharacterReviewEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return ['character:review_completed'];
  }

  async handle(event: RedisEvent): Promise<void> {
    try {
      // Validate message format
      if (!event || typeof event !== 'object') {
        logger.warn('[CharacterReviewEventHandler] Invalid event format', { eventType: typeof event });
        return;
      }

      logger.info('[CharacterReviewEventHandler] Received character review event:', event);

      const { characterId, characterName, action, note, reviewedByUsername } = event as {
        characterId?: string;
        characterName?: string;
        action?: string;
        note?: string;
        reviewedByUsername?: string;
      };

      // Validate required fields
      if (!characterId || !action || !reviewedByUsername) {
        logger.warn('[CharacterReviewEventHandler] Invalid event - missing required fields', {
          event,
          hasCharacterId: !!characterId,
          hasAction: !!action,
          hasReviewedByUsername: !!reviewedByUsername
        });
        return;
      }

      const actionTyped = action === 'approve' || action === 'reject' ? action : undefined;
      if (actionTyped) {
        await this.sendCharacterReviewMessage(characterId, characterName ?? '', actionTyped, note ?? '', reviewedByUsername);
        await this.notifyCharacterStatusChange(characterId, characterName ?? '', actionTyped, note ?? '');
      }

    } catch (error: unknown) {
      logger.error('[CharacterReviewEventHandler] Error handling character review event:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Send off-game message for character approval/rejection using DIRECT service calls
   * ✅ No HTTP overhead, no admin token configuration needed
   */
  private async sendCharacterReviewMessage(
    characterId: string,
    characterName: string,
    action: 'approve' | 'reject',
    note: string,
    reviewedByUsername: string
  ): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      const { User } = await import('@core/auth/models/User');

      // Find the reviewed character
      const targetCharacter = await Character.findById(characterId).populate('userId');
      if (!targetCharacter) {
        logger.warn(`[CharacterReviewEventHandler] Character ${characterId} not found for review message`);
        return;
      }

      // Find the admin who reviewed (by username)
      const adminUser = await User.findOne({ username: reviewedByUsername });
      if (!adminUser) {
        logger.warn(`[CharacterReviewEventHandler] Admin user ${reviewedByUsername} not found for review message`);
        return;
      }

      // Find admin's character (prefer master/amministratore roles)
      const adminCharacter = await Character.findOne({
        userId: adminUser._id,
        playerStatus: 'approved',
        gameplayRoles: { $in: ['master', 'moderatore'] }
      }).sort({ gameplayRoles: -1 }); // Prioritize by role hierarchy

      if (!adminCharacter) {
        logger.warn(`[CharacterReviewEventHandler] No admin character found for user ${reviewedByUsername}`);
        return;
      }

      // Create the message content
      let messageContent: string;
      if (action === 'approve') {
        messageContent = `🎉 Abbiamo verificato il tuo personaggio "${characterName}" ed è stato APPROVATO!\n\nOra puoi iniziare a giocare e divertirti nella Londra vittoriana. Benvenuto/a nel mondo di Ten Penny Novels!`;
        if (note && note.trim()) {
          messageContent += `\n\nNota: ${note}`;
        }
      } else {
        messageContent = `📝 Abbiamo verificato il tuo personaggio "${characterName}" ed è stato RESPINTO.\n\nIl motivo è il seguente: ${note}\n\nPuoi modificare il personaggio e sottoporlo nuovamente per l'approvazione. Se hai domande, rispondi pure a questo messaggio!`;
      }

      // ✅ Use direct service calls (no HTTP overhead)
      await this.sendOffGameMessage(
        adminCharacter._id.toString(),
        targetCharacter._id.toString(),
        messageContent,
        adminCharacter.name || reviewedByUsername
      );

      logger.info(`[CharacterReviewEventHandler] Character review message sent via direct service call`, {
        fromCharacter: adminCharacter.name,
        toCharacter: targetCharacter.name,
        action,
        messageLength: messageContent.length
      });

    } catch (error: unknown) {
      logger.error('[CharacterReviewEventHandler] Error sending character review message:', error);
    }
  }

  /**
   * Send off-game message using DIRECT service calls (no HTTP overhead)
   * ✅ REFACTORED: No longer requires ADMIN_AUTH_TOKEN or self-HTTP-calls
   */
  private async sendOffGameMessage(
    fromCharacterId: string,
    toCharacterId: string,
    messageContent: string,
    senderName?: string
  ): Promise<void> {
    try {
      // ✅ Import service directly (same backend, no HTTP needed)
      const { OffGameChatService } = await import('@features/offGameMessages/api');

      // 1. Create or get existing direct chat
      const chat = await OffGameChatService.createOrGetDirectChat({
        fromCharacterId,
        toCharacterId
      });

      logger.info('[CharacterReviewEventHandler] Direct chat created/found for review message', {
        chatId: chat._id.toString(),
        fromCharacter: fromCharacterId,
        toCharacter: toCharacterId
      });

      // 2. Send the message
      const message = await OffGameChatService.sendMessage({
        chatId: chat._id.toString(),
        fromCharacterId,
        content: messageContent,
        messageType: 'system' // System message for character review notifications
      });

      logger.info('[CharacterReviewEventHandler] Review message sent successfully via direct service call', {
        chatId: chat._id.toString(),
        messageId: message?._id.toString(),
        contentLength: messageContent.length
      });

      // 3. Emit WebSocket event for real-time delivery
      const participants = await OffGameChatService.getChatParticipants(chat._id.toString());

      const notificationData = {
        chatId: chat._id.toString(),
        messageId: message?._id.toString(),
        senderId: fromCharacterId,
        senderName: senderName || fromCharacterId,
        content: messageContent,
        messageType: 'system' as const,
        timestamp: message?.sentAt,
        isRead: false
      };

      // Send notification to each participant's personal room (except sender)
      for (const participant of participants) {
        if (participant.characterId.toString() !== fromCharacterId) {
          const participantRoom = `character_${participant.characterId}`;
          this.io.to(participantRoom).emit('offgame_message_received', notificationData);
        }
      }

      const notifiedParticipants = participants.filter(p => p.characterId.toString() !== fromCharacterId);
      logger.info(`[CharacterReviewEventHandler] OffGame message broadcasted to ${notifiedParticipants.length} participants (excluding sender)`, {
        chatId: chat._id.toString(),
        sender: fromCharacterId,
        notifiedParticipants: notifiedParticipants.map(p => p.characterId.toString())
      });

    } catch (error: unknown) {
      logger.error('[CharacterReviewEventHandler] Error in sendOffGameMessage:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fromCharacterId,
        toCharacterId
      });
      throw error;
    }
  }

  /**
   * Notify character about status change to trigger frontend data refresh
   */
  private async notifyCharacterStatusChange(
    characterId: string,
    characterName: string,
    action: 'approve' | 'reject',
    note?: string
  ): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');

      // Get updated character to find the user
      const character = await Character.findById(characterId).populate('userId');
      if (!character || !character.userId) {
        logger.warn(`[CharacterReviewEventHandler] Character ${characterId} or userId not found for status change notification`);
        return;
      }

      const userId = character.userId._id ? character.userId._id.toString() : character.userId.toString();

      const rejectMessage = note?.trim()
        ? `Il tuo personaggio è stato respinto. Motivo: ${note.trim()}`
        : 'Il tuo personaggio è stato respinto. Puoi modificarlo e risubmettere.';

      // Send WebSocket event to the specific character/user to refresh data
      this.io.to(`user_${userId}`).emit('character_status_changed', {
        type: 'character_status_changed',
        characterId: characterId,
        characterName: characterName,
        action: action,
        newStatus: action === 'approve' ? 'APPROVED' : 'DRAFT',
        note: note || '',
        timestamp: new Date().toISOString(),
        message: action === 'approve'
          ? 'Il tuo personaggio è stato approvato! I dati sono stati aggiornati.'
          : rejectMessage
      });

      logger.info('[CharacterReviewEventHandler] Character status change notification sent', {
        characterId,
        characterName,
        userId,
        action,
        newStatus: action === 'approve' ? 'APPROVED' : 'DRAFT'
      });

    } catch (error: unknown) {
      logger.error('[CharacterReviewEventHandler] Error sending character status change notification:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        characterId,
        action
      });
    }
  }
}
