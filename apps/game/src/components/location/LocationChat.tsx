import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket, LocationAction } from '@/contexts/WebSocketContext';
import styles from './LocationChat.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

// Action types imported from WebSocket context
type ActionType = LocationAction['actionType'];

// Character data needed for action selection
interface CharacterData {
  stats: Record<string, number>;
  skills: Record<string, number>;
  dynamicSkills?: Array<{
    skillName: string;
    basedOnTemplate: string;
    customValue: string;
    value: number;
    category: string;
  }>;
  equippedItems: Array<{
    id: string;
    itemId: string;
    name: string;
    description: string;
    category: string;
  }>;
}

interface LocationChatProps {
  locationId: string;
  characterId: string;
  characterName: string;
  characterRoles: string[];
  chatHistory: LocationAction[];
  characterData?: CharacterData;
  characterStatus: string;
  skillTemplates?: Array<{
    name: string;
    baseValue: number;
    category: string;
    canRollWithoutPoints: boolean;
    isPlaceholder: boolean;
  }>;
}

export default function LocationChat({ 
  locationId, 
  characterId, 
  characterName, 
  characterRoles,
  chatHistory: initialHistory,
  characterData,
  characterStatus,
  skillTemplates = []
}: LocationChatProps) { 
  // Use global WebSocket context (only for notifications)
  const { 
    isConnected,
    joinLocation,
    startTyping,
    stopTyping,
    onLocationAction,
    onTypingUpdate
  } = useWebSocket();

  const [messages, setMessages] = useState<LocationAction[]>(initialHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionType>('standard');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [targetCharacters, setTargetCharacters] = useState<string[]>([]);
  
  // Action-specific selections
  const [diceSpec, setDiceSpec] = useState('1d100');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');

  // Reset selections when action type changes
  useEffect(() => {
    setSelectedSkill('');
    setSelectedStat('');
    setSelectedItem('');
  }, [selectedAction]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Helper function to check if a skill can be rolled
  const canRollSkill = (skillName: string, skillValue: number) => {
    // Find the skill template to check academic restrictions
    const skillTemplate = skillTemplates.find(t => t.name === skillName);
    
    // If no template found, allow rolling (fallback for custom skills)
    if (!skillTemplate) return true;
    
    // If skill has points assigned beyond base value, it can always be rolled
    if (skillValue > skillTemplate.baseValue) return true;
    
    // For academic skills (canRollWithoutPoints = false), need points to roll
    if (!skillTemplate.canRollWithoutPoints && skillValue <= skillTemplate.baseValue) {
      return false;
    }
    
    // All other skills can be rolled with base value
    return true;
  };

  // Get all available skills for rolling (regular + dynamic)
  const getAllAvailableSkills = () => {
    const allSkills: Array<{name: string, value: number}> = [];
    
    // Add regular skills that can be rolled
    if (characterData?.skills) {
      Object.entries(characterData.skills).forEach(([skillName, skillValue]) => {
        if (canRollSkill(skillName, skillValue)) {
          allSkills.push({ name: skillName, value: skillValue });
        }
      });
    }
    
    // Add dynamic skills (they can always be rolled since they have custom values)
    if (characterData?.dynamicSkills) {
      characterData.dynamicSkills.forEach(dynamicSkill => {
        allSkills.push({ name: dynamicSkill.skillName, value: dynamicSkill.value });
      });
    }
    
    return allSkills.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Available action types based on character roles and data
  const getAvailableActions = (): ActionType[] => {
    const baseActions: ActionType[] = ['standard', 'whisper', 'ooc'];
    
    // Always available
    baseActions.push('dice_roll');
    
    // Only if character has rollable skills (either regular with points or dynamic skills)
    const availableSkills = getAllAvailableSkills();
    if (availableSkills.length > 0) {
      baseActions.push('skill_check');
    }
    
    // Only if character has stats (should always be true, but safety check)
    if (characterData?.stats && Object.keys(characterData.stats).length > 0) {
      baseActions.push('stat_check');  
    }
    
    // Only if character has equipped items
    if (characterData?.equippedItems && characterData.equippedItems.length > 0) {
      baseActions.push('item_use');
    }
    
    // Role-based actions
    if (characterRoles.includes('master') || characterRoles.includes('gestore')) {
      baseActions.push('master');
    }
    
    if (characterRoles.includes('moderatore') || characterRoles.includes('gestore')) {
      baseActions.push('moderation');
    }
    
    return baseActions;
  };

  // Load chat history on component mount
  const loadChatHistory = async () => {
    if (!locationId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/game/locations/actions/${locationId}?hours=3&limit=100`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.actions || []);
        }
      } else {
        console.error('❌ LocationChat: Failed to load chat history:', response.status);
      }
    } catch (error) {
      console.error('❌ LocationChat: Error loading chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to WebSocket notifications (not full messages)
  useEffect(() => {
    
    // Subscribe to message notifications (reload when notified)
    const unsubscribeLocationAction = onLocationAction((notification) => {
      if (notification.locationId === locationId) {
        loadChatHistory();
      }
    });
    
    // Subscribe to typing updates
    const unsubscribeTyping = onTypingUpdate((data) => {
      if (data.locationId === locationId) {
        setTypingUsers(prev => {
          if (data.typing) {
            return prev.includes(data.characterName) ? prev : [...prev, data.characterName];
          } else {
            return prev.filter(name => name !== data.characterName);
          }
        });
      }
    });

    return () => {
      unsubscribeLocationAction();
      unsubscribeTyping();
    };
  }, [locationId, onLocationAction, onTypingUpdate]);

  // Load history on mount and when locationId changes
  useEffect(() => {
    loadChatHistory();
  }, [locationId]);

  // Join location when WebSocket is connected
  useEffect(() => {
    if (isConnected) {
      joinLocation(locationId);
    }
  }, [isConnected, locationId, joinLocation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicators
  const handleInputChange = (value: string) => {
    setMessageInput(value);
    
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      startTyping(locationId);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(locationId);
    }, 1000);
  };

  // Send message via HTTP (secure)
  const sendMessage = async () => {
    if (isSending || !messageInput.trim()) return;
    
    // Validation for specific action types
    if (selectedAction === 'skill_check' && !selectedSkill) {
      alert('Seleziona una skill per il controllo');
      return;
    }
    
    if (selectedAction === 'stat_check' && !selectedStat) {
      alert('Seleziona una caratteristica per il controllo');
      return;
    }
    
    if (selectedAction === 'item_use' && !selectedItem) {
      alert('Seleziona un oggetto da usare');
      return;
    }
    
    setIsSending(true);
    
    const actionData: any = {
      actionType: selectedAction,
      content: messageInput.trim(),
      locationId,
      visibility: selectedAction === 'whisper' ? 'whisper' : 
                  selectedAction === 'moderation' ? 'master_only' : 'public'
    };
    
    // Add specific data for certain action types
    if (selectedAction === 'whisper' && targetCharacters.length > 0) {
      actionData.targetCharacters = targetCharacters;
    }
    
    if (selectedAction === 'dice_roll' && diceSpec) {
      actionData.diceSpec = diceSpec;
    }
    
    if (selectedAction === 'skill_check' && selectedSkill) {
      actionData.skillName = selectedSkill;
      
      // Get skill value from either regular skills or dynamic skills
      let skillValue = characterData?.skills[selectedSkill];
      if (skillValue === undefined) {
        // Check dynamic skills
        const dynamicSkill = characterData?.dynamicSkills?.find(ds => ds.skillName === selectedSkill);
        skillValue = dynamicSkill?.value;
      }
      
      actionData.targetValue = skillValue || 0;
    }
    
    if (selectedAction === 'stat_check' && selectedStat) {
      actionData.statName = selectedStat;
      actionData.targetValue = characterData?.stats[selectedStat] || 0;
    }
    
    if (selectedAction === 'item_use' && selectedItem) {
      actionData.itemId = selectedItem;
    }
    
    try {
      const response = await fetch(`${API_BASE}/game/locations/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(actionData)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Clear input and stop typing
          setMessageInput('');
          setIsTyping(false);
          stopTyping(locationId);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          // Note: WebSocket notification will trigger history reload
        } else {
          console.error('❌ LocationChat: Failed to send message:', data.error);
        }
      } else {
        console.error('❌ LocationChat: HTTP error sending message:', response.status);
      }
    } catch (error) {
      console.error('❌ LocationChat: Network error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get action display name
  const getActionDisplayName = (actionType: ActionType): string => {
    const names: Record<ActionType, string> = {
      standard: 'Messaggio Standard',
      master: 'Messaggio Master',
      moderation: 'Messaggio Moderazione',
      whisper: 'Sussurro',
      ooc: 'Messaggio OffGame',
      dice_roll: 'Tira Dadi',
      skill_check: 'Usa Skill',
      stat_check: 'Usa Caratteristica',
      item_use: 'Usa Oggetto'
    };
    return names[actionType];
  };

  // Render dice result with visual representation
  const renderDiceResult = (diceResult: any) => {
    const diceEmoji = getDiceEmoji(diceResult.result);
    const successClass = diceResult.success === true ? styles.diceSuccess : 
                        diceResult.success === false ? styles.diceFailure : '';
    
    return (
      <div className={`${styles.diceResult} ${successClass}`}>
        <span className={styles.diceEmoji}>{diceEmoji}</span>
        <span className={styles.diceInfo}>
          <strong>{diceResult.dice}</strong>: {diceResult.result}
          
          {/* Show skill/stat info for checks */}
          {diceResult.skillName && (
            <span className={styles.checkInfo}>
              <br/>Skill: <strong>{diceResult.skillName}</strong> ({diceResult.target})
            </span>
          )}
          
          {diceResult.statName && (
            <span className={styles.checkInfo}>
              <br/>Caratteristica: <strong>{diceResult.statName}</strong> ({diceResult.target})
            </span>
          )}
          
          {/* Show success/failure for skill and stat checks */}
          {diceResult.success !== undefined && (
            <span className={styles.diceOutcome}>
              {diceResult.success ? ' ✓ Successo' : ' ✗ Fallimento'}
            </span>
          )}
        </span>
      </div>
    );
  };

  // Get dice emoji based on result
  const getDiceEmoji = (result: number) => {
    if (result <= 10) return '🎲'; // Low roll
    if (result <= 30) return '🎯'; // Medium roll  
    if (result <= 70) return '🎲'; // Normal roll
    if (result <= 90) return '🔥'; // Good roll
    return '⭐'; // Excellent roll
  };

  // Render message content with enhanced formatting
  const renderMessageContent = (message: LocationAction) => {
    return (
      <div className={styles.messageContentWrapper}>
        <div className={styles.messageText}>
          {message.content}
        </div>
        
        {message.diceResult && renderDiceResult(message.diceResult)}
        
        {message.itemEffect && 
         message.itemEffect.itemName && 
         message.itemEffect.itemName !== 'Item Name' && 
         message.actionType === 'item_use' && (
          <div className={styles.itemEffect}>
            <span className={styles.itemIcon}>🎒</span>
            <span><strong>{message.itemEffect.itemName}</strong></span>
            {message.itemEffect.description && 
             message.itemEffect.description !== 'Item used successfully' && (
              <div className={styles.itemDescription}>{message.itemEffect.description}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Get message CSS class based on action type
  const getMessageClass = (message: LocationAction) => {
    const baseClass = styles.message;
    
    switch (message.actionType) {
      case 'master':
        return `${baseClass} ${styles.masterMessage}`;
      case 'moderation':
        return `${baseClass} ${styles.moderationMessage}`;
      case 'whisper':
        return `${baseClass} ${styles.whisperMessage}`;
      case 'ooc':
        return `${baseClass} ${styles.oocMessage}`;
      case 'dice_roll':
      case 'skill_check':
      case 'stat_check':
        return `${baseClass} ${styles.diceMessage}`;
      case 'item_use':
        return `${baseClass} ${styles.itemMessage}`;
      default:
        return baseClass;
    }
  };

  // Check if message should be visible to current character
  const isMessageVisible = (message: LocationAction) => {
    if (message.visibility === 'public') return true;
    
    if (message.visibility === 'whisper') {
      return message.characterId === characterId || 
             message.targetCharacters?.includes(characterId);
    }
    
    if (message.visibility === 'master_only') {
      return characterRoles.includes('master') || 
             characterRoles.includes('moderatore') || 
             characterRoles.includes('gestore');
    }
    
    return false;
  };

  return (
    <div className={styles.locationChat}>
      <div className={styles.messagesContainer}>
        {isLoading && (
          <div className={styles.loadingIndicator}>
            Caricamento messaggi...
          </div>
        )}
        {messages.filter(isMessageVisible).map((message, index) => (
          <div key={index} className={getMessageClass(message)}>
            <div className={styles.messageHeader}>
              <div className={styles.avatar}>
                {message.characterName.charAt(0).toUpperCase()}
              </div>
              <div className={styles.messageInfo}>
                <div className={styles.characterInfo}>
                  <span className={styles.characterName}>
                    {message.characterName}
                    {message.characterSurname && ` ${message.characterSurname}`}
                  </span>
                  <span className={styles.timestamp}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className={styles.messageContent}>
                  {renderMessageContent(message)}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {typingUsers.length > 0 && (
          <div className={styles.typingIndicator}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Show input form only if character is APPROVED */}
      {characterStatus === 'APPROVED' ? (
        <div className={styles.inputContainer}>
        <div className={styles.actionControls}>
          <select 
            value={selectedAction} 
            onChange={(e) => setSelectedAction(e.target.value as ActionType)}
            className={styles.actionSelect}
          >
            {getAvailableActions().map(action => (
              <option key={action} value={action}>
                {getActionDisplayName(action)}
              </option>
            ))}
          </select>
          
          {/* Dice roll specification */}
          {selectedAction === 'dice_roll' && (
            <input
              type="text"
              value={diceSpec}
              onChange={(e) => setDiceSpec(e.target.value)}
              placeholder="1d100"
              className={styles.diceInput}
            />
          )}
          
          {/* Skill selection */}
          {selectedAction === 'skill_check' && (
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className={styles.actionSelect}
            >
              <option value="">Seleziona Skill</option>
              {getAllAvailableSkills().map((skill) => (
                <option key={skill.name} value={skill.name}>
                  {skill.name} ({skill.value})
                </option>
              ))}
            </select>
          )}
          
          {/* Stat selection */}
          {selectedAction === 'stat_check' && characterData?.stats && (
            <select
              value={selectedStat}
              onChange={(e) => setSelectedStat(e.target.value)}
              className={styles.actionSelect}
            >
              <option value="">Seleziona Caratteristica</option>
              {Object.entries(characterData.stats).map(([statName, statValue]) => (
                <option key={statName} value={statName}>
                  {statName} ({statValue})
                </option>
              ))}
            </select>
          )}
          
          {/* Item selection */}
          {selectedAction === 'item_use' && characterData?.equippedItems && (
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className={styles.actionSelect}
            >
              <option value="">Seleziona Oggetto</option>
              {characterData.equippedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          )}
        </div>
        
        <div className={styles.messageInputContainer}>
          <textarea
            value={messageInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Type your ${getActionDisplayName(selectedAction).toLowerCase()}...`}
            className={styles.messageInput}
            rows={2}
          />
          <button 
            onClick={sendMessage} 
            disabled={!messageInput.trim() || isSending}
            className={styles.sendButton}
          >
            {isSending ? 'Invio...' : 'Invia'}
          </button>
        </div>
        </div>
      ) : (
        <div className={styles.restrictedMessage}>
          <div className={styles.restrictedContent}>
            {characterStatus === 'DRAFT' && (
              <>
                <span className={styles.restrictedIcon}>⚠️</span>
                <span className={styles.restrictedText}>
                  Il tuo personaggio è ancora in fase di creazione. Completa la scheda per interagire nella chat.
                </span>
              </>
            )}
            {characterStatus === 'PENDING_APPROVAL' && (
              <>
                <span className={styles.restrictedIcon}>⏳</span>
                <span className={styles.restrictedText}>
                  Il tuo personaggio è in attesa di approvazione da parte dello staff. Non puoi ancora interagire nella chat.
                </span>
              </>
            )}
            {characterStatus === 'DELETED' && (
              <>
                <span className={styles.restrictedIcon}>❌</span>
                <span className={styles.restrictedText}>
                  Questo personaggio non è più attivo e non può interagire nella chat.
                </span>
              </>
            )}
            {characterStatus && !['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DELETED'].includes(characterStatus) && (
              <>
                <span className={styles.restrictedIcon}>⚠️</span>
                <span className={styles.restrictedText}>
                  Il personaggio ha uno stato non riconosciuto ({characterStatus}). Contatta l'amministrazione.
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}