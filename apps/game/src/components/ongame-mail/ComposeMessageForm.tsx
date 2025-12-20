import React, { useState, useEffect } from 'react';
import styles from './ComposeMessageForm.module.scss';
import { useGame } from '../../contexts/GameContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface ComposeMessageFormProps {
  messageTypes: Record<string, any>;
  onMessageSent: () => void;
  onCancel: () => void;
}

interface Character {
  id: string;
  name: string;
  avatar?: string;
}

interface WalletInfo {
  cash: number;
  deposit: number;
  total: number;
}

export const ComposeMessageForm: React.FC<ComposeMessageFormProps> = ({
  messageTypes,
  onMessageSent,
  onCancel
}) => {
  const [messageType, setMessageType] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  
  // Debug recipients state changes
  useEffect(() => {
    // console.log('🔍 Recipients state changed:', recipients);
  }, [recipients]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [deliveryTarget, setDeliveryTarget] = useState<'character' | 'residence'>('character');
  const [isExpress, setIsExpress] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  
  const { character } = useGame();

  useEffect(() => {
    loadAvailableCharacters();
    loadWalletInfo();
  }, []);


  const loadAvailableCharacters = async () => {
    try {
      // console.log('🔍 Loading available characters...');
      const response = await fetch(`${API_BASE_URL}/game/characters/public-list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // console.log('🔍 Characters API response:', data);
        if (data.success) {
          const characters = data.data.characters || [];
          setAvailableCharacters(characters);
          // console.log('🔍 Available characters set:', characters);
        }
      } else {
        console.error('🔍 Characters API failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  };

  const loadWalletInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/game/economy/wallet`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const wallet = data.data;
          setWalletInfo({
            cash: wallet.cash || 0,
            deposit: wallet.deposit || 0,
            total: (wallet.cash || 0) + (wallet.deposit || 0)
          });
        }
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    }
  };

  const getSelectedMessageTypeConfig = () => {
    return messageType ? messageTypes[messageType] : null;
  };

  const calculatePostage = () => {
    const config = getSelectedMessageTypeConfig();
    if (!config) return 0;
    
    let cost = config.postageRequired || 0;
    if (isExpress && config.expressCostMultiplier) {
      cost *= config.expressCostMultiplier;
    }
    return cost;
  };

  const canAffordPostage = () => {
    const postage = calculatePostage();
    if (postage === 0) return true; // Free messages are always affordable
    if (!walletInfo) return false;
    return walletInfo.total >= postage;
  };

  const isFormValid = () => {
    const config = getSelectedMessageTypeConfig();
    
    const basicValidation = messageType && 
           recipients.length > 0 && 
           subject.trim().length > 0 && 
           content.trim().length > 0 &&
           canAffordPostage();
    
    // Check recipient count limits if message type is selected
    let recipientCountValid = true;
    if (config && recipients.length > 0) {
      if (!config.allowMultipleRecipients && recipients.length > 1) {
        recipientCountValid = false;
      }
      if (recipients.length > config.maxRecipients) {
        recipientCountValid = false;
      }
    }
    
    const valid = basicValidation && recipientCountValid;
     
    return valid;
  };

  const addRecipient = (characterId: string) => {
    // Ensure we have a valid character ID
    if (!characterId || typeof characterId !== 'string' || characterId.trim() === '') {
      console.error('🚨 Invalid character ID received:', characterId);
      return;
    }
    
    // Check recipient limits
    const config = getSelectedMessageTypeConfig();
    if (config) {
      if (!config.allowMultipleRecipients && recipients.length >= 1) {
        alert(`${config.displayName} non supporta destinatari multipli`);
        return;
      }
      if (recipients.length >= config.maxRecipients) {
        alert(`Numero massimo di destinatari raggiunto per ${config.displayName} (${config.maxRecipients})`);
        return;
      }
    }
    
    // console.log('🔍 Current recipients before add:', recipients);
    
    if (!recipients.includes(characterId)) {
      const newRecipients = [...recipients, characterId];
      setRecipients(newRecipients);
      // console.log('🔍 Recipients after add:', newRecipients);
    } else {
      // console.log('🔍 Character already in recipients list');
    }
    setRecipientSearch('');
    setShowRecipientDropdown(false);
  };

  const removeRecipient = (characterId: string) => {
    setRecipients(recipients.filter(id => id !== characterId));
  };

  const getRecipientName = (characterId: string) => {
    const char = availableCharacters.find(c => c.id === characterId);
    return char?.name || 'Personaggio Sconosciuto';
  };

  const filteredCharacters = availableCharacters.filter(char => 
    char.name.toLowerCase().includes(recipientSearch.toLowerCase()) &&
    !recipients.includes(char.id) &&
    char.id !== character?.id // Don't allow sending to self
  ); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     
    if (!messageType || recipients.length === 0 || !subject.trim() || !content.trim()) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    const config = getSelectedMessageTypeConfig();
    if (content.length > config.maxLength) {
      alert(`Il messaggio è troppo lungo (massimo ${config.maxLength} caratteri)`);
      return;
    }

    if (!canAffordPostage()) {
      alert('Fondi insufficienti per l\'affrancatura');
      return;
    }

    const requestPayload = {
      messageType,
      to: recipients,
      subject: subject.trim(),
      content: content.trim(),
      deliveryTarget: {
        type: deliveryTarget
      },
      isExpress
    };
    
    setSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/game/ongame-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestPayload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // console.log('✅ Message sent successfully');
          
          // Reset form
          setMessageType('');
          setRecipients([]);
          setSubject('');
          setContent('');
          setDeliveryTarget('character');
          setIsExpress(false);
          
          // Refresh wallet info
          loadWalletInfo();
          
          // Notify parent (this will also clear reply data)
          onMessageSent();
        } else {
          // Handle detailed error messages
          if (data.details && typeof data.details === 'object') {
            const errorMessages = Object.entries(data.details)
              .map(([field, message]) => `${field}: ${message}`)
              .join('\n');
            alert(`Errori di validazione:\n${errorMessages}`);
          } else {
            alert(`Errore: ${data.error}`);
          }
        }
      } else {
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.details) {
          const errorMessages = Object.entries(errorData.details)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
          alert(`Errori di validazione:\n${errorMessages}`);
        } else {
          alert('Errore durante l\'invio del messaggio');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Errore di connessione');
    } finally {
      setSending(false);
    }
  };

  const config = getSelectedMessageTypeConfig();
  const postage = calculatePostage();

  return (
    <div className={styles.composeForm}>
      <form onSubmit={handleSubmit}>
        {/* Message Type Selection */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Tipo di Messaggio *
          </label>
          <select 
            value={messageType} 
            onChange={(e) => {
              // console.log('🔍 Message type changing from', messageType, 'to', e.target.value);
              setMessageType(e.target.value);
            }}
            className={styles.select}
            required
          >
            <option value="">Seleziona tipo di messaggio</option>
            {Object.entries(messageTypes).map(([key, type]) => (
              <option key={key} value={key}>
                {type.icon} {type.displayName} 
                {type.postageRequired > 0 && ` (${type.postageRequired}p)`}
              </option>
            ))}
          </select>
          {config && (
            <div className={styles.typeDescription}>
              {config.description}
            </div>
          )}
        </div>

        {/* Recipients */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Destinatari * {config?.deliveryMethod === 'to_residence' && '(consegna a domicilio)'}
            {config && (
              <span className={styles.recipientLimits}>
                {config.allowMultipleRecipients 
                  ? ` (max ${config.maxRecipients})`
                  : ' (solo 1 destinatario)'
                }
              </span>
            )}
          </label>
          
          {/* Selected Recipients */}
          {recipients.length > 0 && (
            <div className={styles.selectedRecipients}>
              {recipients.map(recipientId => (
                <div key={recipientId} className={styles.recipientTag}>
                  {getRecipientName(recipientId)}
                  <button 
                    type="button"
                    onClick={() => removeRecipient(recipientId)}
                    className={styles.removeRecipient}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add Recipient */}
          <div className={styles.recipientSelector}>
            <input
              type="text"
              value={recipientSearch}
              onChange={(e) => {
                setRecipientSearch(e.target.value);
                setShowRecipientDropdown(true);
              }}
              onFocus={() => setShowRecipientDropdown(true)}
              placeholder="Cerca personaggio..."
              className={styles.input}
            />
            
            {showRecipientDropdown && filteredCharacters.length > 0 && (
              <div className={styles.recipientDropdown}>
                {filteredCharacters.slice(0, 10).map(char => {
                  const handleOptionClick = () => {
                    addRecipient(char.id);
                  };
                  
                  return (
                    <div 
                      key={char.id}
                      className={styles.recipientOption}
                      onClick={handleOptionClick}
                    >
                      {char.name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Options */}
        {config && config.deliveryMethod === 'both_options' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Tipo di Consegna
            </label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="character"
                  checked={deliveryTarget === 'character'}
                  onChange={(e) => setDeliveryTarget(e.target.value as 'character')}
                />
                Consegna diretta al personaggio
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="residence"
                  checked={deliveryTarget === 'residence'}
                  onChange={(e) => setDeliveryTarget(e.target.value as 'residence')}
                />
                Consegna a domicilio
                {config.requiresResidenceKnowledge && ' (richiede conoscenza indirizzo)'}
              </label>
            </div>
          </div>
        )}

        {/* Express Delivery */}
        {config && config.expressCostMultiplier && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isExpress}
                onChange={(e) => setIsExpress(e.target.checked)}
              />
              Consegna Espressa (costo aggiuntivo ×{config.expressCostMultiplier})
            </label>
          </div>
        )}

        {/* Subject */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Oggetto *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={styles.input}
            placeholder="Oggetto del messaggio"
            maxLength={200}
            required
          />
        </div>

        {/* Content */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Contenuto * 
            {config && (
              <span className={styles.characterCount}>
                ({content.length}/{config.maxLength})
              </span>
            )}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={styles.textarea}
            placeholder="Scrivi il tuo messaggio..."
            rows={8}
            maxLength={config?.maxLength || 10000}
            required
          />
        </div>

        {/* Cost and Wallet Info */}
        {postage > 0 && (
          <div className={styles.costInfo}>
            <div className={styles.postageInfo}>
              💰 Costo affrancatura: {postage} pence
            </div>
            {walletInfo && (
              <div className={styles.walletInfo}>
                💳 Disponibile: {walletInfo.total} pence 
                ({walletInfo.cash} contanti + {walletInfo.deposit} deposito)
                {!canAffordPostage() && (
                  <span className={styles.insufficientFunds}>
                    ⚠️ Fondi insufficienti!
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button 
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={sending}
          >
            Annulla
          </button>
          <button 
            type="submit"
            className={styles.sendButton}
            disabled={sending || !isFormValid()}
          >
            {sending ? '📮 Invio...' : '🚀 Invia Messaggio'}
          </button>
        </div>
      </form>
    </div>
  );
};