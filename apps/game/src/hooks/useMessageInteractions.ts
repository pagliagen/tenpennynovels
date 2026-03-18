/**
 * useMessageInteractions Hook
 *
 * Custom hook that encapsulates ALL interaction logic for chat messages.
 * Used by all message-type components to avoid code duplication.
 *
 * Provides:
 * - State management (editing, delete dialog, menu, content)
 * - Event handlers (edit, save, delete, tag click, avatar click)
 * - Effects (click outside, escape key)
 * - Computed values (formatted time, permissions)
 *
 * @module hooks/useMessageInteractions
 * @since 2.0.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage, canEditMessage } from '@/types/chat';
import { locationChatsApi } from '@/lib/api/locationChats';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';

export function useMessageInteractions(
  message: ChatMessage,
  currentCharacterId: string
) {
  // STATE
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const { setCurrentTag } = useChatStore();
  const { addToast } = useUIStore();

  // COMPUTED
  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [message.timestamp]);

  const canEdit = canEditMessage(message, currentCharacterId);

  // HANDLERS
  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content);
    setMenuOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editedContent.trim()) {
      addToast({
        type: 'error',
        message: 'Il contenuto non può essere vuoto',
        duration: 3000,
      });
      return;
    }

    if (editedContent.length > 2000) {
      addToast({
        type: 'error',
        message: 'Il contenuto non può superare i 2000 caratteri',
        duration: 3000,
      });
      return;
    }

    try {
      await locationChatsApi.editMessage(message._id, { content: editedContent });

      // ✅ No full refresh - WebSocket will update message
      // Frontend listens to 'location_message_notification' with edited: true
      // Toast will be shown by useLocationChat when WebSocket event arrives

      setIsEditing(false);
    } catch (error: any) {
      addToast({
        type: 'error',
        message: error.response?.data?.error || error.message || 'Errore durante la modifica',
        duration: 3000,
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
    setMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteDialog(false);

    try {
      await locationChatsApi.deleteMessage(message._id);

      // ✅ No full refresh - WebSocket will remove message
      // Frontend listens to 'location_action_deleted'
      // Toast will be shown by useLocationChat when WebSocket event arrives
    } catch (error: any) {
      addToast({
        type: 'error',
        message: error.response?.data?.error || error.message || 'Errore durante l\'eliminazione',
        duration: 3000,
      });
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
  };

  const handleTagClick = (tag: string) => {
    setCurrentTag(tag);
    addToast({
      type: 'success',
      message: `Tag impostato: ${tag}`,
      duration: 2000,
    });
  };

  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen);
  };

  const handleAvatarClick = () => {
    // Disable click if message is masked (PNG Light privacy protection)
    if (message.isMasked) {
      return; // No action - identity hidden
    }

    // TODO: Open CharacterSheetModal
    console.log('Open character sheet for:', message.characterId);
  };

  // EFFECTS
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[data-menu-button]')
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          handleCancelEdit();
        } else if (menuOpen) {
          setMenuOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isEditing, menuOpen]);

  // RETURN API
  return {
    // State
    isEditing,
    showDeleteDialog,
    editedContent,
    setEditedContent,
    menuOpen,
    canEdit,
    formattedTime,
    // Handlers
    handleEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleTagClick,
    handleMenuToggle,
    handleAvatarClick,
    // Refs
    menuRef,
  };
}
