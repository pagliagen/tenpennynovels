import React, { useState, useEffect, useRef } from 'react';
import styles from './OnGameThreadPanel.module.scss';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useGame } from '../../contexts/GameContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface OnGameThreadPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

interface Thread {
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  lastMessage: {
    id: string;
    messageType: string;
    subject: string;
    content: string;
    sentAt: Date;
    isSentByMe: boolean;
    icon: string;
  };
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  messageType: string;
  subject: string;
  content: string;
  sentAt: Date;
  deliveredAt?: Date;
  isSentByMe: boolean;
  icon: string;
  postageCharged: number;
}

interface MessageTypesConfig {
  [key: string]: {
    displayName: string;
    description: string;
    icon: string;
    postageRequired: number;
    maxLength: number;
    requiresSealing: boolean;
    deliveryMethod: string;
  };
}

export const OnGameThreadPanel: React.FC<OnGameThreadPanelProps> = ({
  isVisible,
  onClose
}) => {
  const [currentView, setCurrentView] = useState<'threads' | 'chat' | 'compose'>('threads');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<{
    partner: { id: string; name: string; avatar?: string };
    messages: ThreadMessage[];
  } | null>(null);
  const [messageTypes, setMessageTypes] = useState<MessageTypesConfig>({});
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedMessageType, setSelectedMessageType] = useState('note');
  const [sendingReply, setSendingReply] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [availableCharacters, setAvailableCharacters] = useState<Array<{id: string; name: string}>>([]);
  
  const { character } = useGame();
  const { isConnected, socket } = useWebSocket();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentView === 'chat' && currentThread) {
      setTimeout(scrollToBottom, 100);
    }
  }, [currentThread, currentView]);

  // Load initial data when panel opens
  useEffect(() => {
    if (isVisible) {
      // Always reset to threads view when opening the panel
      setCurrentView('threads');
      setCurrentThread(null);
      setReplyText('');
      setComposeSubject('');
      setComposeRecipient('');
      
      loadThreads();
      loadMessageTypes();
      loadAvailableCharacters();
    }
  }, [isVisible]);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isVisible || !isConnected || !socket) return;

    const handleMessageDelivered = (notification: any) => {
      // console.log('📮 Thread: Message delivered notification:', notification);
      
      // If we're in a chat with this person, add the message
      if (currentView === 'chat' && currentThread && 
          (notification.fromCharacterId === currentThread.partner.id || 
           notification.toCharacterIds?.includes(character?.id))) {
        loadThreadChat(currentThread.partner.id);
      }
      
      // Always refresh threads to update last message
      loadThreads();
    };

    socket.on('ongame:message_delivered', handleMessageDelivered);

    return () => {
      socket.off('ongame:message_delivered', handleMessageDelivered);
    };
  }, [isVisible, isConnected, socket, currentView, currentThread, character]);

  const loadThreads = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/game/ongame-messages/threads`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setThreads(data.data?.threads || data.list || []);
        }
      }
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThreadChat = async (partnerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/game/ongame-messages/thread/${partnerId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setCurrentThread({
            partner: data.data.partner,
            messages: data.data.messages || []
          });
          setCurrentView('chat');
          
          // Update thread unread count to 0
          setThreads(prev => prev.map(thread => 
            thread.partnerId === partnerId 
              ? { ...thread, unreadCount: 0 }
              : thread
          ));
        }
      }
    } catch (error) {
      console.error('Error loading thread chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageTypes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/ongame-messages/types`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setMessageTypes(data.data);
        }
      }
    } catch (error) {
      console.error('Error loading message types:', error);
    }
  };

  const loadAvailableCharacters = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/characters/public-list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const characters = data.data?.characters || data.list || [];
          setAvailableCharacters(characters.map((char: any) => ({
            id: char.id,
            name: char.name
          })));
        }
      }
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  };

  const sendMessage = async (recipientId: string, messageType: string, subject: string, content: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/ongame-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          messageType,
          to: [recipientId],
          subject: subject.trim(),
          content: content.trim(),
          deliveryTarget: { type: 'character' },
          isExpress: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          // console.log('✅ Message sent successfully');
          return true;
        } else {
          if (data.details && typeof data.details === 'object') {
            const errorMessages = Object.entries(data.details)
              .map(([field, message]) => `${field}: ${message}`)
              .join('\n');
            alert(`Errori di validazione:\n${errorMessages}`);
          } else {
            alert(`Errore: ${data.error}`);
          }
          return false;
        }
      } else {
        alert('Errore durante l\'invio del messaggio');
        return false;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Errore di connessione');
      return false;
    }
  };

  const handleSendReply = async () => {
    if (!currentThread || !replyText.trim()) return;

    setSendingReply(true);
    const success = await sendMessage(
      currentThread.partner.id,
      selectedMessageType,
      `Re: ${currentThread.messages[currentThread.messages.length - 1]?.subject || 'Conversazione'}`,
      replyText.trim()
    );

    if (success) {
      setReplyText('');
      // Reload the chat to show new message
      loadThreadChat(currentThread.partner.id);
    }
    
    setSendingReply(false);
  };

  const handleSendNewMessage = async () => {
    if (!composeRecipient || !composeSubject.trim() || !replyText.trim()) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    setSendingReply(true);
    const success = await sendMessage(
      composeRecipient,
      selectedMessageType,
      composeSubject.trim(),
      replyText.trim()
    );

    if (success) {
      setReplyText('');
      setComposeSubject('');
      setComposeRecipient('');
      setCurrentView('threads');
      loadThreads();
    }
    
    setSendingReply(false);
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      return 'Ora';
    } else if (diffHours < 24) {
      return `${diffHours}h fa`;
    } else {
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
  };

  const getMessageTypeConfig = (messageType: string) => {
    return messageTypes[messageType];
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            {currentView !== 'threads' && (
              <button 
                className={styles.backButton}
                onClick={() => {
                  setCurrentView('threads');
                  setCurrentThread(null);
                  setReplyText('');
                }}
                title="Torna ai thread"
              >
                ←
              </button>
            )}
            <h3 className={styles.title}>
              📮 {
                currentView === 'threads' ? 'Conversazioni Vittoriane' :
                currentView === 'chat' ? `Chat con ${currentThread?.partner.name}` :
                'Nuovo Messaggio'
              }
            </h3>
          </div>
          <div className={styles.headerActions}>
            {currentView === 'threads' && (
              <button 
                className={styles.composeButton}
                onClick={() => setCurrentView('compose')}
                title="Nuovo messaggio"
              >
                ✍️
              </button>
            )}
            <button 
              className={styles.closeButton}
              onClick={onClose}
              title="Chiudi"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              Caricamento...
            </div>
          ) : currentView === 'threads' ? (
            /* Threads List */
            <>
              {threads.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Nessuna conversazione trovata</p>
                  <p className={styles.emptyHint}>
                    Invia il tuo primo messaggio per iniziare una conversazione!
                  </p>
                </div>
              ) : (
                <div className={styles.threadsList}>
                  {threads.map(thread => (
                    <div 
                      key={thread.partnerId}
                      className={`${styles.threadItem} ${thread.unreadCount > 0 ? styles.unread : ''}`}
                      onClick={() => loadThreadChat(thread.partnerId)}
                    >
                      <div className={styles.threadAvatar}>
                        {thread.partnerAvatar ? (
                          <img src={thread.partnerAvatar} alt={thread.partnerName} />
                        ) : (
                          <div className={styles.defaultAvatar}>
                            {thread.partnerName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.threadInfo}>
                        <div className={styles.threadHeader}>
                          <span className={styles.partnerName}>{thread.partnerName}</span>
                          <span className={styles.lastMessageTime}>
                            {formatDate(thread.lastMessage.sentAt)}
                          </span>
                        </div>
                        
                        <div className={styles.lastMessage}>
                          <span className={styles.messageTypeIcon}>
                            {thread.lastMessage.icon}
                          </span>
                          <span className={styles.messageContent}>
                            {thread.lastMessage.isSentByMe ? 'Tu: ' : ''}
                            {thread.lastMessage.content.length > 50 
                              ? `${thread.lastMessage.content.substring(0, 50)}...`
                              : thread.lastMessage.content
                            }
                          </span>
                        </div>
                      </div>
                      
                      {thread.unreadCount > 0 && (
                        <div className={styles.unreadBadge}>
                          {thread.unreadCount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : currentView === 'chat' && currentThread ? (
            /* Chat View */
            <>
              <div className={styles.chatMessages}>
                {currentThread.messages.map(message => (
                  <div 
                    key={message.id}
                    className={`${styles.message} ${message.isSentByMe ? styles.sent : styles.received}`}
                  >
                    <div className={styles.messageHeader}>
                      <span className={styles.messageTypeIcon}>
                        {message.icon}
                      </span>
                      <span className={styles.messageTime}>
                        {formatDate(message.sentAt)}
                      </span>
                      {message.postageCharged > 0 && (
                        <span className={styles.postage}>
                          💰 {message.postageCharged}p
                        </span>
                      )}
                    </div>
                    
                    {message.subject && (
                      <div className={styles.messageSubject}>
                        {message.subject}
                      </div>
                    )}
                    
                    <div className={styles.messageContent}>
                      {message.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              {/* Reply Form - Always visible */}
              <div className={styles.replyForm}>
                <div className={styles.replyOptions}>
                  <select 
                    value={selectedMessageType}
                    onChange={(e) => setSelectedMessageType(e.target.value)}
                    className={styles.messageTypeSelect}
                  >
                    {Object.entries(messageTypes).map(([key, type]) => (
                      <option key={key} value={key}>
                        {type.icon} {type.displayName} ({type.postageRequired}p)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.replyInput}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Scrivi la tua risposta..."
                    className={styles.replyTextarea}
                    rows={2}
                    disabled={sendingReply}
                    maxLength={getMessageTypeConfig(selectedMessageType)?.maxLength || 200}
                  />
                  <button 
                    onClick={handleSendReply}
                    className={styles.sendButton}
                    disabled={sendingReply || !replyText.trim()}
                  >
                    {sendingReply ? '📤' : '🚀'}
                  </button>
                </div>
                
                <div className={styles.replyInfo}>
                  <span className={styles.characterCount}>
                    {replyText.length}/{getMessageTypeConfig(selectedMessageType)?.maxLength || 200}
                  </span>
                  <span className={styles.deliveryInfo}>
                    {getMessageTypeConfig(selectedMessageType)?.description}
                  </span>
                </div>
              </div>
            </>
          ) : currentView === 'compose' ? (
            /* Compose New Message */
            <div className={styles.composeForm}>
              <div className={styles.composeField}>
                <label>Destinatario:</label>
                <select
                  value={composeRecipient}
                  onChange={(e) => setComposeRecipient(e.target.value)}
                  className={styles.recipientSelect}
                >
                  <option value="">Seleziona destinatario</option>
                  {availableCharacters.map(char => (
                    <option key={char.id} value={char.id}>
                      {char.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.composeField}>
                <label>Tipo messaggio:</label>
                <select 
                  value={selectedMessageType}
                  onChange={(e) => setSelectedMessageType(e.target.value)}
                  className={styles.messageTypeSelect}
                >
                  {Object.entries(messageTypes).map(([key, type]) => (
                    <option key={key} value={key}>
                      {type.icon} {type.displayName} ({type.postageRequired}p)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.composeField}>
                <label>Oggetto:</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Oggetto del messaggio"
                  className={styles.subjectInput}
                  maxLength={200}
                />
              </div>
              
              <div className={styles.composeField}>
                <label>Contenuto:</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Scrivi il tuo messaggio..."
                  className={styles.composeTextarea}
                  rows={6}
                  maxLength={getMessageTypeConfig(selectedMessageType)?.maxLength || 200}
                />
                <div className={styles.composeInfo}>
                  <span className={styles.characterCount}>
                    {replyText.length}/{getMessageTypeConfig(selectedMessageType)?.maxLength || 200}
                  </span>
                </div>
              </div>
              
              <div className={styles.composeActions}>
                <button 
                  onClick={() => {
                    setCurrentView('threads');
                    setReplyText('');
                    setComposeSubject('');
                    setComposeRecipient('');
                  }}
                  className={styles.cancelButton}
                  disabled={sendingReply}
                >
                  Annulla
                </button>
                <button 
                  onClick={handleSendNewMessage}
                  className={styles.sendButton}
                  disabled={sendingReply || !composeRecipient || !composeSubject.trim() || !replyText.trim()}
                >
                  {sendingReply ? '📤 Inviando...' : '🚀 Invia'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};