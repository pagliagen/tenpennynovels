import React, { useState, useEffect, useRef } from 'react';
import styles from './OffGameChatPanel.module.scss';
import { NewChatForm } from './NewChatForm';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useGame } from '../../contexts/GameContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface OffGameChatPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ChatPreview {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: Array<{
    _id: string;
    name: string;
    avatar?: string;
  }>;
  lastMessage?: {
    content: string;
    senderName: string;
    sentAt: Date;
  };
  unreadCount: number;
  isMuted: boolean;
}

interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: Date;
  messageType: 'user' | 'system';
  isRead: boolean;
}

interface ChatInterfaceProps {
  chatId: string;
  chat: ChatPreview;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatId, chat }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { onOffGameMessage, isConnected } = useWebSocket();
  const { character } = useGame();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount and when chatId changes
  useEffect(() => {
    loadChatHistory();
  }, [chatId]);

  // Load chat history on mount and when chatId changes
  const loadChatHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/game/offgame-chats/${chatId}/messages`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const transformedMessages = (data.data.messages || []).map((msg: any) => ({
            ...msg,
            // Transform populated senderId to string and extract senderName
            senderId: typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId,
            senderName: typeof msg.senderId === 'object' ? msg.senderId.name : msg.senderName || 'Unknown'
          }));
          setMessages(transformedMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to WebSocket notifications (reload when notified)
  useEffect(() => {
    // console.log('🔌 ChatInterface: Setting up OffGame message notification subscription for chat:', chatId);
    
    // Subscribe to message notifications (reload when notified)
    const unsubscribeOffGameMessage = onOffGameMessage((notification) => {
      if (notification.chatId === chatId) {
        // console.log('🔔 ChatInterface: Received message notification, reloading history');
        loadChatHistory();
      }
    });

    return () => {
      unsubscribeOffGameMessage();
    };
  }, [chatId, onOffGameMessage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // Helper function to determine if message should show sender name
  const shouldShowSenderName = (message: ChatMessage, index: number): boolean => {
    // Always show for system messages
    if (message.messageType === 'system') return true;
    
    // Show if it's the first message
    if (index === 0) return true;
    
    // Show if the previous message is from a different sender (grouping logic)
    const previousMessage = messages[index - 1];
    // Use string comparison for senderId since they should be strings after transformation
    const currentSenderId = String(message.senderId);
    const previousSenderId = String(previousMessage?.senderId);
    const shouldShow = previousSenderId !== currentSenderId;
    
    
    return shouldShow;
  };

  // Helper function to determine if message is from current character
  const isOwnMessage = (message: ChatMessage): boolean => {
    return message.senderId === character?.id;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/game/offgame-chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content: newMessage.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // console.log('✅ ChatInterface: Message sent successfully');
          setNewMessage('');
          // Reload chat history to show own message
          loadChatHistory();
        } else {
          console.error('❌ ChatInterface: Failed to send message:', data.error);
        }
      } else {
        console.error('❌ ChatInterface: HTTP error sending message:', response.status);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
      // Refocus on input after sending (with slight delay to ensure DOM is ready)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className={styles.chatInterface}>
      {/* Messages Area */}
      <div className={styles.messagesArea}>
        {loading ? (
          <div className={styles.loading}>Caricamento messaggi...</div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <p>Nessun messaggio ancora</p>
            <p className={styles.emptyHint}>Inizia la conversazione!</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message, index) => (
              <div 
                key={`${message.chatId}_${message.id}_${index}`} 
                className={`${styles.message} 
                  ${message.messageType === 'system' ? styles.systemMessage : ''} 
                  ${isOwnMessage(message) ? styles.ownMessage : ''}
                  ${!shouldShowSenderName(message, index) ? styles.groupedMessage : ''}`}
              >
                {shouldShowSenderName(message, index) && (
                  <div className={styles.messageHeader}>
                    <span className={styles.senderName}>{message.senderName || 'Unknown'}</span>
                    <span className={styles.messageTime}>
                      {new Date(message.sentAt).toLocaleString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
                <div className={styles.messageContent}>{message.content}</div>
                {!shouldShowSenderName(message, index) && (
                  <div className={styles.compactTime}>
                    {new Date(message.sentAt).toLocaleString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className={styles.messageInput}>
        <form onSubmit={handleSendMessage} className={styles.inputForm}>
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className={styles.textInput}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button 
            type="submit" 
            className={styles.sendButton}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? '📨' : '🚀'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const OffGameChatPanel: React.FC<OffGameChatPanelProps> = ({
  isVisible,
  onClose
}) => {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewChatForm, setShowNewChatForm] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [creatingChat, setCreatingChat] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');
  const { onOffGameMessage, onOffGameChatEvent, joinOffGameChats, isConnected } = useWebSocket();
  const { character } = useGame();

  // Debug WebSocket state
  useEffect(() => {
    // console.log('🔌 OffGameChatPanel: State changed -', { isVisible, isConnected });
  }, [isVisible, isConnected]);

  // Fetch chats from API
  useEffect(() => {
    if (!isVisible) return;
    
    const fetchChats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/game/offgame-chats`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setChats(data.data.chats || []);
          }
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [isVisible]);

  // Join OffGame chats when WebSocket is connected and panel is visible
  useEffect(() => {
    if (isConnected && isVisible) {
      // console.log('🔌 OffGameChatPanel: WebSocket connected and panel visible, joining OffGame chats');
      joinOffGameChats();
    }
  }, [isConnected, isVisible, joinOffGameChats]);

  // Subscribe to WebSocket notifications for chat list updates
  useEffect(() => {
    if (!isVisible) return;
    
    // console.log('🔌 OffGameChatPanel: Setting up WebSocket notification subscriptions');
    
    // Subscribe to message notifications (update last message in chat list and unread count)
    const unsubscribeOffGameMessage = onOffGameMessage((notification) => {
      // console.log('🔔 OffGameChatPanel: Received message notification, updating chat list');
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === notification.chatId 
            ? { 
                ...chat, 
                lastMessage: {
                  content: notification.content,
                  senderName: notification.senderName,
                  sentAt: new Date(notification.timestamp)
                },
                // Increment unread count only if chat is not currently selected (sender won't receive notification)
                unreadCount: selectedChatId !== notification.chatId
                  ? (chat.unreadCount || 0) + 1 
                  : chat.unreadCount
              }
            : chat
        )
      );
    });
    
    // Subscribe to chat events (like name changes)
    const unsubscribeOffGameChatEvent = onOffGameChatEvent((event) => {
      // console.log('🔔 OffGameChatPanel: Received chat event:', event);
      if (event.type === 'name_change') {
        setChats(prevChats => 
          prevChats.map(chat => 
            chat._id === event.chatId 
              ? { 
                  ...chat, 
                  name: event.data?.name || chat.name
                }
              : chat
          )
        );
      }
    });

    return () => {
      unsubscribeOffGameMessage();
      unsubscribeOffGameChatEvent();
    };
  }, [isVisible, onOffGameMessage, onOffGameChatEvent, character?.id, selectedChatId]);

  const handleChatClick = (chatId: string) => {
    setSelectedChatId(chatId);
    setShowNewChatForm(false); // Chiudi form nuova chat se aperto
    
    // Reset unread count for selected chat
    setChats(prevChats => 
      prevChats.map(chat => 
        chat._id === chatId 
          ? { ...chat, unreadCount: 0 }
          : chat
      )
    );
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
  };

  const handleNewChatClick = (type: 'direct' | 'group') => {
    setNewChatType(type);
    setShowNewChatForm(true);
  };

  const handleCloseNewChat = () => {
    setShowNewChatForm(false);
    setCreatingChat(false);
  };

  const handleEditChatName = (chatId: string, currentName: string) => {
    setEditingChatId(chatId);
    setEditingChatName(currentName);
  };

  const handleSaveEditChatName = async () => {
    if (!editingChatId || !editingChatName.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/game/offgame-chats/${editingChatId}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: editingChatName.trim() })
      });

      if (response.ok) {
        // Update local chat list
        setChats(prevChats => 
          prevChats.map(chat => 
            chat._id === editingChatId 
              ? { ...chat, name: editingChatName.trim() }
              : chat
          )
        );
        
        setEditingChatId(null);
        setEditingChatName('');
      } else {
        alert('Errore durante il salvataggio del nome');
      }
    } catch (error) {
      console.error('Error updating chat name:', error);
      alert('Errore di connessione');
    }
  };

  const handleCancelEditChatName = () => {
    setEditingChatId(null);
    setEditingChatName('');
  };

  const handleCreateChat = async (data: { type: 'direct' | 'group'; name?: string; participants: string[] }) => {
    setCreatingChat(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/game/offgame-chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh chats list
          const chatsResponse = await fetch(`${API_BASE_URL}/game/offgame-chats`, {
            credentials: 'include'
          });
          
          if (chatsResponse.ok) {
            const chatsData = await chatsResponse.json();
            if (chatsData.success) {
              setChats(chatsData.data.chats || []);
            }
          }
          
          // Close form
          handleCloseNewChat();
          
          // Show success message
          // console.log(`${data.type === 'direct' ? 'Chat diretta' : 'Gruppo'} creato con successo!`);
        } else {
          alert(`Errore: ${result.error}`);
        }
      } else {
        alert('Errore durante la creazione della chat');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Errore di connessione');
    } finally {
      setCreatingChat(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            {selectedChatId && (
              <button 
                className={styles.backButton}
                onClick={handleBackToList}
                title="Torna alle chat"
              >
                ←
              </button>
            )}
            <h3 className={styles.title}>
              {selectedChatId 
                ? `💬 ${chats.find(c => c._id === selectedChatId)?.type === 'group' 
                      ? chats.find(c => c._id === selectedChatId)?.name 
                      : 'Chat Diretta'}`
                : '💬 Chat Off-Game'
              }
            </h3>
          </div>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            title="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Content - Switch between chat list and chat interface */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              Caricamento chat...
            </div>
          ) : selectedChatId ? (
            // Individual Chat Interface
            <ChatInterface 
              chatId={selectedChatId}
              chat={chats.find(c => c._id === selectedChatId)!}
            />
          ) : (
            // Chat List View
            <>
              {/* New Chat Buttons */}
              <div className={styles.actionBar}>
                <div className={styles.chatButtons}>
                  <button 
                    className={styles.newChatButton}
                    onClick={() => handleNewChatClick('direct')}
                  >
                    👤 Nuova Chat
                  </button>
                  <button 
                    className={styles.newGroupButton}
                    onClick={() => handleNewChatClick('group')}
                  >
                    👥 Nuovo Gruppo
                  </button>
                </div>
              </div>

              {/* Chats List */}
              <div className={styles.chatsList}>
                {chats.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>Nessuna chat trovata</p>
                    <p className={styles.emptyHint}>
                      Crea una nuova chat per iniziare a comunicare con altri personaggi
                    </p>
                  </div>
                ) : (
                  chats.map(chat => (
                    <div 
                      key={chat._id}
                      className={`${styles.chatItem} ${selectedChatId === chat._id ? styles.selected : ''}`}
                      onClick={() => handleChatClick(chat._id)}
                    >
                      <div className={styles.chatIcon}>
                        {chat.type === 'group' ? '👥' : '👤'}
                      </div>
                      
                      <div className={styles.chatInfo}>
                        <div className={styles.chatHeader}>
                          <div className={styles.chatName}>
                            {editingChatId === chat._id ? (
                              <div className={styles.editingContainer}>
                                <input
                                  type="text"
                                  value={editingChatName}
                                  onChange={(e) => setEditingChatName(e.target.value)}
                                  className={styles.editInput}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveEditChatName();
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditChatName();
                                    }
                                  }}
                                  autoFocus
                                />
                                <button 
                                  className={styles.saveEditButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveEditChatName();
                                  }}
                                  title="Salva"
                                >
                                  ✓
                                </button>
                                <button 
                                  className={styles.cancelEditButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEditChatName();
                                  }}
                                  title="Annulla"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                {chat.type === 'group' 
                                  ? chat.name 
                                  : chat.participants.find(p => p._id !== 'current')?.name || 'Chat Diretta'
                                }
                              </>
                            )}
                          </div>
                          {chat.type === 'group' && editingChatId !== chat._id && (
                            <button 
                              className={styles.editButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditChatName(chat._id, chat.name || 'Gruppo');
                              }}
                              title="Modifica nome gruppo"
                            >
                              ✏️
                            </button>
                          )}
                        </div>

                        <div className={styles.chatParticipants}>
                          {chat.participants.map((participant, index) => (
                            <span key={participant._id} className={styles.participantName}>
                              {participant.name}
                              {index < chat.participants.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                        
                        {chat.lastMessage && (
                          <div className={styles.lastMessage}>
                            <span className={styles.senderName}>
                              {chat.lastMessage.senderName}:
                            </span>
                            <span className={styles.messageContent}>
                              {chat.lastMessage.content}
                            </span>
                          </div>
                        )}
                        
                        <div className={styles.chatMeta}>
                          <span className={styles.timestamp}>
                            {chat.lastMessage?.sentAt 
                              ? new Date(chat.lastMessage.sentAt).toLocaleString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Nessun messaggio'
                            }
                          </span>
                          {chat.isMuted && (
                            <span className={styles.mutedIcon} title="Chat silenziata">
                              🔇
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {chat.unreadCount > 0 && (
                        <div className={styles.unreadBadge}>
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Chat Form */}
      {showNewChatForm && (
        <NewChatForm
          type={newChatType}
          onSubmit={handleCreateChat}
          onCancel={handleCloseNewChat}
          loading={creatingChat}
        />
      )}
    </div>
  );
};