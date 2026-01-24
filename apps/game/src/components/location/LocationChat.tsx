import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useWebSocket, LocationAction } from '@/contexts/WebSocketContext';
import styles from './LocationChat.module.scss';
import TagSelector from './TagSelector';
import TurnOrderDisplay from './TurnOrderDisplay';
import BlockNotesModal from './BlockNotesModal';
import DiceCommandsModal from './DiceCommandsModal';
import CharacterTooltip from './CharacterTooltip';
import EditActionModal from './EditActionModal';
import MasterPanel from './MasterPanel';
import MasterOutcomeModal from './MasterOutcomeModal';

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
    onTypingUpdate,
    onLocationEvent
  } = useWebSocket();

  const [messages, setMessages] = useState<LocationAction[]>(initialHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionType>('standard');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [targetCharacters, setTargetCharacters] = useState<string[]>([]);
  
  // Textarea expansion state
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const MAX_CHARACTERS = 1200;
  
  // Tag state (single tag)
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [lastUsedTag, setLastUsedTag] = useState<string | null>(null);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  
  // Block notes state
  const [isBlockNotesOpen, setIsBlockNotesOpen] = useState(false);
  const [isDiceCommandsOpen, setIsDiceCommandsOpen] = useState(false);
  const [expandedSocialConflicts, setExpandedSocialConflicts] = useState<Set<string>>(new Set());
  
  // Tooltip state
  const [tooltipCharacterId, setTooltipCharacterId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Edit action state
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  
  // Master outcome modal state
  const [isMasterOutcomeOpen, setIsMasterOutcomeOpen] = useState(false);
  
  // Location private state
  const [isLocationPrivate, setIsLocationPrivate] = useState(false);
  
  const router = useRouter();
  
  // Check if current user is master
  const isMaster = characterRoles.includes('master') || characterRoles.includes('gestore');
  
  // Occupants for turn order
  const [occupants, setOccupants] = useState<Array<{
    characterId: string;
    characterName: string;
    enteredAt: Date | string;
    currentTag?: string | null;
  }>>([]);
  
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
    if (selectedAction !== 'whisper') {
      setTargetCharacters([]);
    }
  }, [selectedAction]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to extract numeric value from skill (handles both number and SkillBreakdown)
  const getSkillNumericValue = (skillValue: number | any): number => {
    if (typeof skillValue === 'number') {
      return skillValue;
    }
    if (skillValue && typeof skillValue === 'object' && 'total' in skillValue) {
      return skillValue.total;
    }
    return 0;
  };

  // Helper function to check if a skill can be rolled
  const canRollSkill = (skillName: string, skillValue: number | any) => {
    const numericValue = getSkillNumericValue(skillValue);
    
    // Find the skill template to check academic restrictions
    const skillTemplate = skillTemplates.find(t => t.name === skillName);
    
    // If no template found, allow rolling (fallback for custom skills)
    if (!skillTemplate) return true;
    
    // If skill has points assigned beyond base value, it can always be rolled
    if (numericValue > skillTemplate.baseValue) return true;
    
    // For academic skills (canRollWithoutPoints = false), need points to roll
    if (!skillTemplate.canRollWithoutPoints && numericValue <= skillTemplate.baseValue) {
      return false;
    }
    
    // All other skills can be rolled with base value
    return true;
  };

  // Get all available skills for rolling (regular + dynamic + all base skills)
  const getAllAvailableSkills = () => {
    const allSkills: Array<{name: string, value: number, category?: string}> = [];
    const skillsMap = new Map<string, {value: number, category?: string}>();
    
    // First, add all skills from skillTemplates (all available skills with categories)
    if (skillTemplates && skillTemplates.length > 0) {
      skillTemplates.forEach(template => {
        // Find if character has modified this skill
        const characterSkill = characterData?.skills?.[template.name];
        let numericValue: number;
        let category = template.category;
        
        if (characterSkill !== undefined) {
          // Character has modified this skill
          if (typeof characterSkill === 'number') {
            numericValue = characterSkill;
          } else if (characterSkill && typeof characterSkill === 'object' && 'total' in characterSkill) {
            numericValue = (characterSkill as any).total;
            // Use category from SkillBreakdown if available, otherwise from template
            category = (characterSkill as any).category || template.category;
          } else {
            return; // Skip invalid values
          }
        } else {
          // Use base value from template
          numericValue = typeof template.baseValue === 'number' ? template.baseValue : 0;
        }
        
        if (canRollSkill(template.name, numericValue)) {
          skillsMap.set(template.name, { value: numericValue, category });
        }
      });
    } else {
      // Fallback: if skillTemplates not available, use only character skills
    if (characterData?.skills) {
      Object.entries(characterData.skills).forEach(([skillName, skillValue]) => {
        let numericValue: number;
          let category: string | undefined;
          
        if (typeof skillValue === 'number') {
          numericValue = skillValue;
        } else if (skillValue && typeof skillValue === 'object' && 'total' in skillValue) {
          numericValue = (skillValue as any).total;
            category = (skillValue as any).category;
        } else {
          return; // Skip invalid values
        }
        
        if (canRollSkill(skillName, numericValue)) {
            skillsMap.set(skillName, { value: numericValue, category });
        }
      });
      }
    }
    
    // Add dynamic skills (they can always be rolled since they have custom values)
    if (characterData?.dynamicSkills) {
      characterData.dynamicSkills.forEach(dynamicSkill => {
        skillsMap.set(dynamicSkill.skillName, { 
          value: dynamicSkill.value, 
          category: dynamicSkill.category 
        });
      });
    }
    
    // Convert map to array and sort
    return Array.from(skillsMap.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      category: data.category
    })).sort((a, b) => a.name.localeCompare(b.name));
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
  
  // Check if whisper is global (to all occupants)
  const isWhisperGlobal = selectedAction === 'whisper' && targetCharacters.length === occupants.length - 1 && 
                          occupants.filter(occ => occ.characterId !== characterId).every(occ => 
                            targetCharacters.includes(occ.characterId)
                          );

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
        if (data.result) {
          const actions = data.data?.actions || data.list || [];
          setMessages(actions);
          
          // Find the last action sent by this character to initialize lastUsedTag
          const myActions = actions.filter((action: LocationAction) => 
            action.characterId === characterId && 'tags' in action && action.tags && Array.isArray(action.tags) && action.tags.length > 0
          );
          if (myActions.length > 0) {
            // Get the most recent action (actions are sorted chronologically)
            const lastAction = myActions[myActions.length - 1];
            const lastTag = ('tags' in lastAction && lastAction.tags && Array.isArray(lastAction.tags) && lastAction.tags.length > 0) ? lastAction.tags[0] : null;
            if (lastTag) {
              setLastUsedTag(lastTag);
            }
          }
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

  // Load location data including private status
  const loadLocationData = async () => {
    if (!locationId) return;
    
    try {
      const response = await fetch(`${API_BASE}/game/locations/${locationId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && data.data?.location) {
          setIsLocationPrivate(data.data.location.private || false);
        }
      }
    } catch (error) {
      console.error('Error loading location data:', error);
    }
  };
  
  // Load location occupants for turn order and current tag
  const loadOccupants = async () => {
    if (!locationId) return;
    
    try {
      const response = await fetch(`${API_BASE}/game/locations/${locationId}/occupants`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result && data.data?.occupants) {
          const occupantsData = (data.data.occupants || []).map((occ: any) => ({
            characterId: occ.characterId?.toString() || occ.characterId,
            characterName: occ.characterName || '',
            enteredAt: occ.enteredAt || new Date(),
            currentTag: occ.currentTag || null
          }));
          setOccupants(occupantsData);
          
          // Debug: log occupants for troubleshooting
          if (occupantsData.length === 0) {
            console.log('⚠️ LocationChat: Nessun occupant trovato nella location');
          } else {
            console.log('✅ LocationChat: Occupants caricati:', occupantsData.length);
          }
          
          // Load current tag for this character
          const currentOccupant = occupantsData.find((occ: any) => occ.characterId === characterId);
          if (currentOccupant?.currentTag && !selectedTag) {
            setSelectedTag(currentOccupant.currentTag);
            setLastUsedTag(currentOccupant.currentTag);
          }
        }
      }
    } catch (error) {
      console.error('❌ LocationChat: Error loading occupants:', error);
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

    // Subscribe to location events (player entered/left) to update occupants list
    const unsubscribeLocationEvent = onLocationEvent((event) => {
      if (event.locationId === locationId) {
        // Reload occupants when someone enters or leaves
        loadOccupants();
      }
    });

    return () => {
      unsubscribeLocationAction();
      unsubscribeTyping();
      unsubscribeLocationEvent();
    };
  }, [locationId, onLocationAction, onTypingUpdate, onLocationEvent]);

  // Load history and occupants on mount and when locationId changes
  useEffect(() => {
    loadChatHistory();
    loadOccupants();
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
    // Enforce character limit
    if (value.length > MAX_CHARACTERS) {
      return;
    }
    
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
    
    if (selectedAction === 'whisper' && targetCharacters.length === 0) {
      alert('Seleziona almeno un personaggio destinatario per il sussurro');
      return;
    }
    
    setIsSending(true);
    
    const actionData: any = {
      actionType: selectedAction,
      content: messageInput.trim(),
      locationId,
      visibility: selectedAction === 'whisper' ? 'whisper' : 
                  selectedAction === 'moderation' ? 'master_only' : 'public',
      tags: selectedTag ? [selectedTag] : []
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
      let skillValue: number | undefined = undefined;
      
      // Check regular skills (handle both number and SkillBreakdown)
      const regularSkill = characterData?.skills?.[selectedSkill];
      if (regularSkill !== undefined) {
        skillValue = getSkillNumericValue(regularSkill);
      }
      
      // If not found in regular skills, check dynamic skills
      if (skillValue === undefined) {
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
        if (data.result) {
          // Update lastUsedTag if a tag was used
          if (selectedTag) {
            setLastUsedTag(selectedTag);
            // Save tag to occupant
            try {
              await fetch(`${API_BASE}/game/locations/${locationId}/occupant-tag`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentTag: selectedTag })
              });
            } catch (error) {
              console.error('❌ LocationChat: Failed to update occupant tag:', error);
            }
          }
          
          // Clear input but keep tag selected
          setMessageInput('');
          setIsTextareaExpanded(false); // Reset textarea size
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
    // Only apply success/failure classes if success is explicitly defined (for skill/stat checks)
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
          
          {/* Show success/failure only for skill/stat checks (when success is defined) */}
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

  // Check if social conflict should be visible to current user
  const shouldShowSocialConflict = (message: LocationAction): boolean => {
    if (!('socialConflict' in message) || !message.socialConflict) return false;
    
    const socialConflict = message.socialConflict as any; // Type assertion needed due to missing type definition
    
    // If it's visible only to defender, check if current user is the defender
    if (socialConflict.visibleToDefenderOnly) {
      return message.targetCharacters?.includes(characterId) || false;
    }
    
    // For non-hidden conflicts, show to everyone
    return true;
  };

  // Get detection icon based on result
  const getDetectionIcon = (result: string): string => {
    switch (result) {
      case 'full_detection':
        return '🔍';
      case 'suspicion':
        return '⚠️';
      case 'partial_detection':
        return '🔎';
      default:
        return '⚔️';
    }
  };

  // Highlight mentions in text
  const highlightMentions = (text: string): React.ReactNode => {
    if (!text || typeof text !== 'string') return text || '';
    if (occupants.length === 0) return text;
    
    // Create a regex pattern for all occupant names (case-insensitive)
    const names = occupants.map(occ => {
      const name = occ.characterName;
      // Escape special regex characters
      return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    
    if (names.length === 0) return text;
    
    const pattern = new RegExp(`\\b(${names.join('|')})\\b`, 'gi');
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(textBefore);
        }
      }
      
      // Add highlighted name
      parts.push(
        <span key={`mention-${match.index}`} className={styles.mentionedName}>
          {match[0]}
        </span>
      );
      
      lastIndex = pattern.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }
    
    // Always return a valid ReactNode
    if (parts.length === 0) {
      return text;
    }
    
    // If only one part and it's a string, return it directly
    if (parts.length === 1 && typeof parts[0] === 'string') {
      return parts[0];
    }
    
    // Return fragment with parts
    return <>{parts}</>;
  };
  
  // Render message content with enhanced formatting
  const renderMessageContent = (message: LocationAction) => {
    const messageId = ('id' in message && typeof message.id === 'string' ? message.id : undefined) || 
                      (typeof message.timestamp === 'string' ? message.timestamp : String(message.timestamp || ''));
    const socialConflict = ('socialConflict' in message) ? (message.socialConflict as any) : undefined;
    const hasSocialConflict = socialConflict && shouldShowSocialConflict(message);
    const isExpanded = expandedSocialConflicts.has(messageId);
    const isRaggirareDetection = socialConflict?.visibleToDefenderOnly && 
                                  socialConflict?.result !== 'victory' &&
                                  socialConflict?.result !== undefined;
    
    // Ensure content is a string
    const messageContent = typeof message.content === 'string' ? message.content : String(message.content || '');
    
    return (
      <div className={styles.messageContentWrapper}>
        <div className={styles.messageText}>
          {highlightMentions(messageContent)}
          {/* Show detection icon for Raggirare when defender detects something */}
          {isRaggirareDetection && (
            <button
              type="button"
              onClick={() => {
                const newExpanded = new Set(expandedSocialConflicts);
                if (isExpanded) {
                  newExpanded.delete(messageId);
                } else {
                  newExpanded.add(messageId);
                }
                setExpandedSocialConflicts(newExpanded);
              }}
              className={styles.detectionIconButton}
              title="Clicca per vedere i dettagli"
            >
              {socialConflict && getDetectionIcon(socialConflict.result)}
            </button>
          )}
        </div>
        
        {message.diceResult && renderDiceResult(message.diceResult)}
        
        {/* Render social conflict results - only if visible and (expanded or not Raggirare) */}
        {hasSocialConflict && (!isRaggirareDetection || isExpanded) && (
          <div className={styles.socialConflictResult}>
            <div className={styles.socialConflictHeader}>
              <span className={styles.conflictIcon}>⚔️</span>
              <strong>Scontro Sociale: {socialConflict.attackerSkill} vs {socialConflict.defenderSkill}</strong>
            </div>
            <div className={styles.socialConflictDetails}>
              <div className={styles.conflictRoll}>
                <span><strong>{message.characterName}</strong> ({socialConflict.attackerSkill}):</span>
                <span className={styles.rollValue}>{socialConflict.attackerRoll}</span>
                {socialConflict.attackerSuccessDegree && (
                  <span className={styles.successDegree}>
                    ({socialConflict.attackerSuccessDegree === 'critical' ? 'Critico' :
                      socialConflict.attackerSuccessDegree === 'extreme' ? 'Estremo' :
                      socialConflict.attackerSuccessDegree === 'hard' ? 'Arduo' :
                      socialConflict.attackerSuccessDegree === 'normal' ? 'Normale' :
                      socialConflict.attackerSuccessDegree === 'failure' ? 'Fallimento' :
                      socialConflict.attackerSuccessDegree === 'fumble' ? 'Fallimento Critico' : ''})
                  </span>
                )}
              </div>
              <div className={styles.conflictRoll}>
                <span>Difesa ({socialConflict.defenderSkill}):</span>
                <span className={styles.rollValue}>{socialConflict.defenderRoll}</span>
                {socialConflict.defenderSuccessDegree && (
                  <span className={styles.successDegree}>
                    ({socialConflict.defenderSuccessDegree === 'critical' ? 'Critico' :
                      socialConflict.defenderSuccessDegree === 'extreme' ? 'Estremo' :
                      socialConflict.defenderSuccessDegree === 'hard' ? 'Arduo' :
                      socialConflict.defenderSuccessDegree === 'normal' ? 'Normale' :
                      socialConflict.defenderSuccessDegree === 'failure' ? 'Fallimento' :
                      socialConflict.defenderSuccessDegree === 'fumble' ? 'Fallimento Critico' : ''})
                  </span>
                )}
              </div>
              {/* Show detection message for defender */}
              {socialConflict.messageForDefender && (
                <div className={styles.detectionMessage}>
                  {socialConflict.messageForDefender}
                </div>
              )}
              {socialConflict.result === 'victory' && (
                <div className={styles.conflictOutcome}>
                  <span className={styles.victoryIcon}>✓</span>
                  <strong>Vittoria dell'attaccante</strong>
                </div>
              )}
              {socialConflict.result === 'defeat' && (
                <div className={styles.conflictOutcome}>
                  <span className={styles.defeatIcon}>✗</span>
                  <strong>Vittoria del difensore</strong>
                </div>
              )}
              {socialConflict.result === 'full_detection' && (
                <div className={styles.conflictOutcome}>
                  <span className={styles.detectionIcon}>🔍</span>
                  <strong>Rilevamento completo</strong>
                </div>
              )}
              {socialConflict.result === 'suspicion' && (
                <div className={styles.conflictOutcome}>
                  <span className={styles.suspicionIcon}>⚠️</span>
                  <strong>Sospetto</strong>
                </div>
              )}
              {socialConflict.result === 'partial_detection' && (
                <div className={styles.conflictOutcome}>
                  <span className={styles.partialIcon}>🔎</span>
                  <strong>Rilevamento parziale</strong>
                </div>
              )}
            </div>
          </div>
        )}
        
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

  // Get message CSS class based on action type and tag
  const getMessageClass = (message: LocationAction) => {
    const baseClass = styles.message;
    
    // Check if message has a different tag than last used
    // If message has no tag, show it normally (full opacity)
    // If message has a tag different from lastUsedTag, show it with reduced opacity
    const messageTag = ('tags' in message && message.tags && Array.isArray(message.tags) && message.tags.length > 0) ? message.tags[0] : null;
    const hasDifferentTag = lastUsedTag !== null && messageTag !== null && messageTag !== lastUsedTag;
    const differentTagClass = hasDifferentTag ? ` ${styles.messageWithDifferentTag}` : '';
    
    switch (message.actionType) {
      case 'master':
        return `${baseClass} ${styles.masterMessage}${differentTagClass}`;
      case 'moderation':
        return `${baseClass} ${styles.moderationMessage}${differentTagClass}`;
      case 'whisper':
        return `${baseClass} ${styles.whisperMessage}${differentTagClass}`;
      case 'ooc':
        return `${baseClass} ${styles.oocMessage}${differentTagClass}`;
      case 'dice_roll':
      case 'skill_check':
      case 'stat_check':
        return `${baseClass} ${styles.diceMessage}${differentTagClass}`;
      case 'item_use':
        return `${baseClass} ${styles.itemMessage}${differentTagClass}`;
      default:
        return `${baseClass}${differentTagClass}`;
    }
  };

  // Handle avatar hover
  const handleAvatarMouseEnter = (characterId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const avatarElement = event.currentTarget;
    const rect = avatarElement.getBoundingClientRect();
    const containerRect = avatarElement.closest(`.${styles.messagesContainer}`)?.getBoundingClientRect();
    
    if (containerRect) {
      setTooltipPosition({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 10 // Above the avatar
      });
      setTooltipCharacterId(characterId);
      avatarRefs.current.set(characterId, avatarElement);
    }
  };
  
  const handleAvatarMouseLeave = () => {
    setTooltipCharacterId(null);
    setTooltipPosition(null);
  };
  
  // Handle name click (sussurro)
  const handleNameClick = (targetCharacterId: string) => {
    setSelectedAction('whisper');
    setTargetCharacters([targetCharacterId]);
    // Scroll to input area
    const inputContainer = document.querySelector(`.${styles.inputContainer}`);
    if (inputContainer) {
      inputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  
  // Handle tag click (copia tag)
  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
  };
  
  // Handle avatar click (scheda personaggio)
  const handleAvatarClick = (characterId: string) => {
    router.push(`/characters/${characterId}`);
  };
  
  // Check if message should be visible to current character
  const isMessageVisible = (message: LocationAction) => {
    // If message has targetCharacters, it's only visible to those characters (and sender)
    if (message.targetCharacters && message.targetCharacters.length > 0) {
      return message.characterId === characterId || 
             message.targetCharacters.includes(characterId);
    }
    
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
  
  // Check if action can be edited
  const canEditAction = (message: LocationAction): boolean => {
    const isOwner = message.characterId === characterId;
    if (!isOwner && !isMaster) return false;
    
    // Master can always edit
    if (isMaster) return true;
    
    // Check time limit: 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(message.timestamp) < fiveMinutesAgo) return false;
    
    // Check if there's a subsequent action from the same character
    const messageId = ('id' in message && typeof message.id === 'string' ? message.id : undefined) || 
                      (typeof message.timestamp === 'string' ? message.timestamp : String(message.timestamp || ''));
    const messageIndex = messages.findIndex(m => {
      const mId = ('id' in m && typeof m.id === 'string' ? m.id : undefined) || 
                   (typeof m.timestamp === 'string' ? m.timestamp : String(m.timestamp || ''));
      return mId === messageId;
    });
    if (messageIndex === -1) return false;
    
    const subsequentAction = messages.slice(messageIndex + 1).find(m => 
      m.characterId === characterId
    );
    if (subsequentAction) return false;
    
    return true;
  };
  
  // Handle edit action
  const handleEditAction = (actionId: string) => {
    setEditingActionId(actionId);
  };
  
  // Handle delete action
  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa azione?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/game/locations/actions/${actionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Reload chat history
        loadChatHistory();
      } else {
        alert('Errore durante l\'eliminazione dell\'azione');
      }
    } catch (error) {
      console.error('Error deleting action:', error);
      alert('Errore durante l\'eliminazione dell\'azione');
    }
  };
  
  // Handle edit success
  const handleEditSuccess = () => {
    loadChatHistory();
  };

  // Find action to edit (memoized to avoid recalculation)
  const actionToEdit = useMemo(() => {
    if (!editingActionId) return null;
    return messages.find(m => {
      const mId = ('id' in m && typeof m.id === 'string' ? m.id : undefined) || 
                   (typeof m.timestamp === 'string' ? m.timestamp : String(m.timestamp || ''));
      return mId === editingActionId;
    }) || null;
  }, [editingActionId, messages]);

  const handleTogglePrivate = async () => {
    try {
      const response = await fetch(`${API_BASE}/game/locations/${locationId}/toggle-privacy`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsLocationPrivate(data.data?.private || false);
      } else {
        alert('Errore durante la modifica della privacy della location');
      }
    } catch (error) {
      console.error('Error toggling location privacy:', error);
      alert('Errore di connessione');
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutta la chat?')) return;
    // TODO: Implement clear chat functionality
    alert('Funzionalità in sviluppo');
  };

  const handleQuestManagement = () => {
    // TODO: Implement quest management modal
    alert('Funzionalità in sviluppo');
  };

  const handleActionMode = () => {
    // TODO: Implement action mode activation
    alert('Funzionalità in sviluppo');
  };

  const handleNPC = () => {
    // TODO: Implement NPC insertion
    alert('Funzionalità in sviluppo');
  };

  const handleMasterOutcome = () => {
    setIsMasterOutcomeOpen(true);
  };

  const handleMasterOutcomeSuccess = () => {
    setIsMasterOutcomeOpen(false);
    loadChatHistory();
  };

  return (
    <div className={styles.locationChat}>
      {occupants && occupants.length > 0 && (
        <div className={styles.turnOrderContainer}>
          <TurnOrderDisplay occupants={occupants} />
        </div>
      )}
      <div className={styles.messagesContainer}>
        {isLoading && (
          <div className={styles.loadingIndicator}>
            Caricamento messaggi...
          </div>
        )}
        {messages.filter(isMessageVisible).map((message, index) => {
          const messageId = ('id' in message && typeof message.id === 'string' ? message.id : undefined) || 
                            (typeof message.timestamp === 'string' ? message.timestamp : String(message.timestamp || '')) || 
                            index.toString();
          const hasTag = ('tags' in message) && message.tags && Array.isArray(message.tags) && message.tags.length > 0 ? true : false;
          
          return (
            <div key={index} className={getMessageClass(message)}>
              <div className={styles.messageHeader}>
                <div 
                  className={styles.avatar}
                  onMouseEnter={(e) => handleAvatarMouseEnter(message.characterId, e)}
                  onMouseLeave={handleAvatarMouseLeave}
                  onClick={() => handleAvatarClick(message.characterId)}
                  style={{ cursor: 'pointer' }}
                  title="Clicca per aprire la scheda"
                >
                  {message.characterName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.messageInfo}>
                  <div className={styles.characterInfo}>
                    <span 
                      className={styles.characterName}
                      onClick={() => handleNameClick(message.characterId)}
                      style={{ cursor: 'pointer' }}
                      title="Clicca per sussurrare"
                    >
                      {message.characterName}
                      {message.characterSurname && ` ${message.characterSurname}`}
                    </span>
                    <span className={styles.timestamp}>
                      {new Date(message.timestamp).toLocaleTimeString('it-IT', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {hasTag && (
                    <div className={styles.messageTags}>
                      {('tags' in message && message.tags && Array.isArray(message.tags)) ? message.tags.map((tag: string, tagIndex: number) => (
                        <span
                          key={tagIndex}
                          className={styles.messageTag}
                          onClick={() => handleTagClick(tag)}
                          style={{ cursor: 'pointer' }}
                          title="Clicca per copiare il tag"
                        >
                          {tag}
                        </span>
                      )) : null}
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    {renderMessageContent(message)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Character Tooltip */}
        {tooltipCharacterId && tooltipPosition && (
          <div
            className={styles.tooltipContainer}
            style={{
              position: 'absolute',
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%) translateY(-100%)',
              marginTop: '-8px'
            }}
            onMouseEnter={() => {}} // Keep tooltip open on hover
            onMouseLeave={handleAvatarMouseLeave}
          >
            <CharacterTooltip
              characterId={tooltipCharacterId}
              characterName={messages.find(m => m.characterId === tooltipCharacterId)?.characterName || ''}
              isMaster={isMaster}
            />
          </div>
        )}
        
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
          
          {/* Whisper target selection */}
          {selectedAction === 'whisper' && (
            <select
              value={isWhisperGlobal ? 'all' : (targetCharacters[0] || '')}
              onChange={(e) => {
                if (e.target.value === 'all') {
                  // Set targetCharacters to all occupants except self
                  setTargetCharacters(
                    occupants
                      .filter(occ => occ.characterId !== characterId)
                      .map(occ => occ.characterId)
                  );
                } else if (e.target.value) {
                  setTargetCharacters([e.target.value]);
                } else {
                  setTargetCharacters([]);
                }
              }}
              className={styles.actionSelect}
            >
              <option value="">Seleziona Destinatario</option>
              <option value="all">Sussurro a tutti</option>
              {occupants
                .filter((occ) => occ.characterId !== characterId)
                .map((occupant) => (
                  <option key={occupant.characterId} value={occupant.characterId}>
                    {occupant.characterName}
                  </option>
                ))}
            </select>
          )}
        </div>
        
        <div className={styles.messageInputContainer}>
          <div className={styles.textareaWrapper}>
            <textarea
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Scrivi il tuo ${getActionDisplayName(selectedAction).toLowerCase()}...`}
              className={`${styles.messageInput} ${isTextareaExpanded ? styles.expanded : ''}`}
            />
          </div>
          
          <div className={styles.inputActions}>
            <div className={styles.leftActions}>
              <button
                type="button"
                onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
                className={`${styles.actionButton} ${selectedTag ? styles.active : ''}`}
                title="Tags"
              >
                Tags
              </button>
              <button
                type="button"
                onClick={() => setSelectedAction('whisper')}
                className={`${styles.actionButton} ${selectedAction === 'whisper' ? styles.active : ''}`}
                title="Sussurro"
              >
                Sussurro
              </button>
              <button
                type="button"
                onClick={() => setIsDiceCommandsOpen(true)}
                className={styles.actionButton}
                title="Tira Dado"
              >
                Tira Dado
              </button>
              <button
                type="button"
                onClick={() => setIsBlockNotesOpen(true)}
                className={styles.actionButton}
                title="Block Notes"
              >
                BlockNotes
              </button>
            </div>
            
            <div className={styles.rightActions}>
            <div className={styles.characterCounter}>
              {messageInput.length}/{MAX_CHARACTERS}
            </div>
            <button
              type="button"
              onClick={() => setIsTextareaExpanded(!isTextareaExpanded)}
              className={styles.expandCollapseButton}
              aria-label={isTextareaExpanded ? 'Riduci textarea' : 'Espandi textarea'}
              title={isTextareaExpanded ? 'Riduci textarea' : 'Espandi textarea'}
            >
              {isTextareaExpanded ? '↑' : '↓'}
            </button>
              <button 
                onClick={sendMessage} 
                disabled={!messageInput.trim() || isSending || messageInput.length > MAX_CHARACTERS}
                className={styles.sendButton}
              >
                {isSending ? 'Invio...' : 'Invia'}
              </button>
          </div>
          </div>
          
          {isTagSelectorOpen && (
          <TagSelector
            selectedTag={selectedTag}
            onTagChange={async (tag) => {
              setSelectedTag(tag);
                setIsTagSelectorOpen(false); // Close selector after selection
              // Save tag to occupant immediately when selected
              if (tag) {
                try {
                  await fetch(`${API_BASE}/game/locations/${locationId}/occupant-tag`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ currentTag: tag })
                  });
                } catch (error) {
                  console.error('❌ LocationChat: Failed to update occupant tag:', error);
                }
              }
            }}
          />
          )}
          
            {isMaster && (
            <div className={styles.masterActions}>
              <MasterPanel
                locationId={locationId}
                characterId={characterId}
                isPrivate={isLocationPrivate}
                onTogglePrivate={handleTogglePrivate}
                onDeleteAction={handleDeleteAction}
                onClearChat={handleClearChat}
                onQuestManagement={handleQuestManagement}
                onActionMode={handleActionMode}
                onNPC={handleNPC}
                onMasterOutcome={handleMasterOutcome}
              />
          </div>
          )}
        </div>
        
        <DiceCommandsModal
          isOpen={isDiceCommandsOpen}
          onClose={() => setIsDiceCommandsOpen(false)}
          locationId={locationId}
          characterId={characterId}
          characterName={characterName}
          availableCharacters={occupants.map(occ => ({
            id: occ.characterId,
            name: occ.characterName
          }))}
        />
        
        <BlockNotesModal
          isOpen={isBlockNotesOpen}
          onClose={() => setIsBlockNotesOpen(false)}
          locationId={locationId}
        />
        
        {/* Edit Action Modal */}
        {editingActionId && actionToEdit && (
          <EditActionModal
            isOpen={!!editingActionId}
            onClose={() => setEditingActionId(null)}
            actionId={editingActionId}
            currentContent={actionToEdit.content}
            editHistory={('editHistory' in actionToEdit && Array.isArray(actionToEdit.editHistory)) ? actionToEdit.editHistory : []}
            isMaster={isMaster}
            onSuccess={handleEditSuccess}
          />
        )}
        
        {/* Master Outcome Modal */}
        {isMaster && (
          <MasterOutcomeModal
            isOpen={isMasterOutcomeOpen}
            onClose={() => setIsMasterOutcomeOpen(false)}
            locationId={locationId}
            characterId={characterId}
            availableCharacters={occupants.map(occ => ({
              id: occ.characterId,
              name: occ.characterName
            }))}
            onSuccess={handleMasterOutcomeSuccess}
          />
        )}
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