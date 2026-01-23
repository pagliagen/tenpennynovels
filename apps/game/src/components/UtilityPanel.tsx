import React, { useState, useEffect } from 'react';
import { useNotificationSettings } from '@/contexts/NotificationSettingsContext';
import { AVAILABLE_AUDIO_FILES, getAudioFileById } from '@/constants/audioFiles';
import { TicketForm, TicketFormData } from './TicketForm';
import { TicketList, TicketListItem } from './TicketList';
import { TicketThread, TicketDetails } from './TicketThread';
import styles from '@/styles/components/UtilityPanel.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

// Temporary settings state - will be moved to proper context later
const useGeneralSettings = () => {
  const [generalSettings, setGeneralSettings] = useState(() => ({
    characterSheetAutoplay: localStorage.getItem('characterSheetAutoplay') !== 'false',
    autoSaveCharacterSheets: localStorage.getItem('autoSaveCharacterSheets') === 'true',
    apartmentBookingNotifications: localStorage.getItem('apartmentBookingNotifications') !== 'false'
  }));

  const updateGeneralSettings = (updates: Partial<typeof generalSettings>) => {
    setGeneralSettings(prev => {
      const newSettings = { ...prev, ...updates };
      
      // Save to localStorage
      Object.entries(updates).forEach(([key, value]) => {
        localStorage.setItem(key, String(value));
      });
      
      return newSettings;
    });
  };

  return { generalSettings, updateGeneralSettings };
};

interface UtilityPanelProps {
  onClose: () => void;
  unreadTicketsCount?: number;
}

export const UtilityPanel: React.FC<UtilityPanelProps> = ({ onClose, unreadTicketsCount = 0 }) => {
  const { settings, updateSettings, resetSettings, playAudioForType, updateAudioAssignment } = useNotificationSettings();
  const { generalSettings, updateGeneralSettings } = useGeneralSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'types' | 'audio' | 'password' | 'character' | 'bookings' | 'tickets' | 'account'>('general');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Ticket state management
  const [ticketView, setTicketView] = useState<'list' | 'form' | 'thread'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState<string>('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const playTestSound = async (audioId?: string) => {
    if (audioId) {
      // Play specific audio file
      const audioFile = getAudioFileById(audioId);
      if (audioFile && audioFile.path) {
        try {
          const audio = new Audio(audioFile.path);
          audio.volume = 0.5;
          await audio.play();
        } catch (error) {
          console.warn('Failed to play test audio:', error);
        }
      }
    } else {
      // Play default notification sound
      try {
        const audio = new Audio('/audio/new-notification-001.mp3');
        audio.volume = 0.5;
        await audio.play();
      } catch (error) {
        console.warn('Failed to play test notification sound:', error);
      }
    }
  };

  const playAudioForNotificationType = async (type: string) => {
    try {
      await playAudioForType(type);
    } catch (error) {
      console.warn(`Failed to play audio for type ${type}:`, error);
    }
  };

  const handleReset = () => {
    if (confirm('Sei sicuro di voler ripristinare tutte le impostazioni predefinite?')) {
      // Reset notification settings
      resetSettings();
      
      // Reset general settings to defaults
      updateGeneralSettings({
        characterSheetAutoplay: true,
        autoSaveCharacterSheets: false,
        apartmentBookingNotifications: true
      });
      
      // Clear localStorage for general settings
      localStorage.removeItem('characterSheetAutoplay');
      localStorage.removeItem('autoSaveCharacterSheets');
      localStorage.removeItem('apartmentBookingNotifications');
    }
  };

  // Ticket management functions
  const fetchTickets = async () => {
    setTicketsLoading(true);
    setTicketError('');
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/game/tickets`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform API response to match TicketListItem interface
      const transformedTickets = (data.data?.tickets || []).map((ticket: any) => ({
        id: ticket.id,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: new Date(ticket.createdAt),
        lastActivity: new Date(ticket.createdAt), // Use createdAt as fallback
        unreadCount: ticket.unreadMessages || 0,
        assignedToName: ticket.assignedTo?.name,
        isEscalated: ticket.escalationLevel > 0
      }));
      
      setTickets(transformedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTicketError(error instanceof Error ? error.message : 'Errore durante il caricamento dei ticket');
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    setTicketLoading(true);
    setTicketError('');
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/game/tickets/${ticketId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform API response to match TicketDetails interface  
      const ticket = data.data?.ticket;
      if (ticket) {
        // Fetch messages separately
        const messagesResponse = await fetch(`${API_GATEWAY_URL}/game/tickets/${ticketId}/messages`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        let messages = [];
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          messages = (messagesData.data?.messages || []).map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender,
            sentAt: new Date(msg.sentAt),
            isInternal: msg.isInternal || false,
            readAt: msg.readAt
          }));
        }
        
        const transformedTicket = {
          id: ticket.id,
          title: ticket.title,
          category: ticket.category,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: new Date(ticket.createdAt),
          createdBy: ticket.createdByName || ticket.createdBy,
          assignedToName: ticket.assignedTo?.name,
          department: ticket.department,
          messages: messages,
          isEscalated: ticket.escalationLevel > 0,
          escalationLevel: ticket.escalationLevel
        };
        setSelectedTicket(transformedTicket);
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      setTicketError(error instanceof Error ? error.message : 'Errore durante il caricamento del ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  const createTicket = async (formData: TicketFormData) => {
    setIsSubmittingTicket(true);
    setTicketError('');
    
    try {
      const response = await fetch('${API_GATEWAY_URL}/game/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Refresh tickets list and switch back to list view
      await fetchTickets();
      setTicketView('list');
      
      // Show success message
      setSuccessMessage('Ticket creato con successo! Il tuo ticket è stato inviato al reparto competente.');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
      console.log('Ticket created successfully:', data.data.ticket.id);
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      setTicketError(error instanceof Error ? error.message : 'Errore durante la creazione del ticket');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedTicketId) return;
    
    setIsSendingMessage(true);
    setTicketError('');
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/game/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      // Refresh ticket details to show new message
      await fetchTicketDetails(selectedTicketId);
      
    } catch (error) {
      console.error('Error sending message:', error);
      setTicketError(error instanceof Error ? error.message : 'Errore durante l\'invio del messaggio');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Load tickets when tickets tab is activated
  useEffect(() => {
    if (activeTab === 'tickets' && ticketView === 'list' && tickets.length === 0) {
      fetchTickets();
    }
  }, [activeTab, ticketView]);

  // Handle ticket selection
  const handleTicketClick = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketView('thread');
    await fetchTicketDetails(ticketId);
  };

  // Handle account deletion request
  const handleRequestAccountDeletion = async () => {
    const confirmed = window.confirm(
      'ATTENZIONE!\n\n' +
      'Stai per richiedere l\'eliminazione del tuo account.\n\n' +
      'Riceverai un\'email con un link di conferma.\n\n' +
      'Sei sicuro di voler procedere?'
    );

    if (!confirmed) return;

    setIsDeletingAccount(true);
    setDeletionMessage(null);

    try {
      const response = await fetch(`${API_GATEWAY_URL}/auth/profile/request-deletion`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.result) {
        setDeletionMessage({
          type: 'success',
          text: data.message || 'Email di conferma inviata con successo! Controlla la tua casella di posta.'
        });
      } else {
        setDeletionMessage({
          type: 'error',
          text: data.error || 'Errore durante la richiesta di eliminazione dell\'account'
        });
      }
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      setDeletionMessage({
        type: 'error',
        text: 'Errore di connessione durante la richiesta di eliminazione'
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>Utilità</h3>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
            onClick={() => setActiveTab('general')}
          >
            🔔 Impostazioni
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'types' ? styles.active : ''}`}
            onClick={() => setActiveTab('types')}
          >
            📋 Tipi
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'audio' ? styles.active : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            🔊 Audio
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'password' ? styles.active : ''}`}
            onClick={() => setActiveTab('password')}
          >
            🔑 Password
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'character' ? styles.active : ''}`}
            onClick={() => setActiveTab('character')}
          >
            👤 Schede
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'bookings' ? styles.active : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            🏨 Alloggi
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'tickets' ? styles.active : ''} ${unreadTicketsCount > 0 ? styles.hasNotifications : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            🎫 Ticket
            {unreadTicketsCount > 0 && (
              <span className={styles.tabBadge}>
                {unreadTicketsCount > 99 ? '99+' : unreadTicketsCount}
              </span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'account' ? styles.active : ''}`}
            onClick={() => setActiveTab('account')}
          >
            ⚠️ Account
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'general' && (
            <div className={styles.section}>
              <h4>Impostazioni Generali</h4>
              
              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showNotificationBar}
                    onChange={() => handleToggle('showNotificationBar')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>Mostra barra delle notifiche</span>
                </label>
                <p className={styles.description}>
                  Disabilitando questa opzione nasconderai tutta la barra, ma l'icona delle impostazioni rimarrà visibile.
                </p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.audioEnabled}
                    onChange={() => handleToggle('audioEnabled')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>Abilita audio notifiche</span>
                </label>
                <p className={styles.description}>
                  Abilita/disabilita tutti i suoni delle notifiche. Puoi personalizzare i suoni specifici nella sezione "Audio".
                </p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Durata notifiche temporanee</span>
                  <select
                    value={settings.notificationDuration}
                    onChange={(e) => updateSettings({ notificationDuration: parseInt(e.target.value) })}
                    className={styles.select}
                  >
                    <option value={3000}>3 secondi</option>
                    <option value={5000}>5 secondi</option>
                    <option value={8000}>8 secondi</option>
                    <option value={10000}>10 secondi</option>
                    <option value={15000}>15 secondi</option>
                  </select>
                </label>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Massimo notifiche</span>
                  <select
                    value={settings.maxNotifications}
                    onChange={(e) => updateSettings({ maxNotifications: parseInt(e.target.value) })}
                    className={styles.select}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </label>
                <p className={styles.description}>
                  Numero massimo di notifiche da tenere in memoria.
                </p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Apertura Pannello Gestionale</span>
                  <select
                    value={settings.adminPanelOpenMode}
                    onChange={(e) => updateSettings({ adminPanelOpenMode: e.target.value as 'new_tab' | 'popup' })}
                    className={styles.select}
                  >
                    <option value="new_tab">Nuova Pagina/Tab</option>
                    <option value="popup">Popup Integrato</option>
                  </select>
                </label>
                <p className={styles.description}>
                  Scegli come aprire il pannello gestionale quando clicchi sull'icona corona.
                </p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Apertura Sistema Tickets</span>
                  <select
                    value={settings.ticketsPanelOpenMode}
                    onChange={(e) => updateSettings({ ticketsPanelOpenMode: e.target.value as 'new_tab' | 'popup' })}
                    className={styles.select}
                  >
                    <option value="new_tab">Nuova Pagina/Tab</option>
                    <option value="popup">Popup Integrato</option>
                  </select>
                </label>
                <p className={styles.description}>
                  Scegli come aprire il sistema tickets quando clicchi sull'icona ticket.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'types' && (
            <div className={styles.section}>
              <h4>Tipi di Notifiche</h4>
              <p className={styles.sectionDescription}>
                Scegli quali tipi di notifiche vuoi ricevere.
              </p>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showChatMessages}
                    onChange={() => handleToggle('showChatMessages')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>💬 Messaggi Chat</span>
                </label>
                <p className={styles.description}>Messaggi nella chat delle location</p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showInGameMessages}
                    onChange={() => handleToggle('showInGameMessages')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>✉️ Messaggi In-Game</span>
                </label>
                <p className={styles.description}>Lettere, telegrammi e altri messaggi IC</p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showOffGameMessages}
                    onChange={() => handleToggle('showOffGameMessages')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>📱 Messaggi Off-Game</span>
                </label>
                <p className={styles.description}>Messaggi OOC tra giocatori</p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showCharacterApproval}
                    onChange={() => handleToggle('showCharacterApproval')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>✅ Approvazione Personaggi</span>
                </label>
                <p className={styles.description}>Notifiche di approvazione/rifiuto personaggi</p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showPlayerPresence}
                    onChange={() => handleToggle('showPlayerPresence')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>👋 Presenza Giocatori</span>
                </label>
                <p className={styles.description}>Entrate e uscite dalle location</p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={settings.showSystemMessages}
                    onChange={() => handleToggle('showSystemMessages')}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>📢 Messaggi Sistema</span>
                </label>
                <p className={styles.description}>Annunci, manutenzioni e comunicazioni ufficiali</p>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className={styles.section}>
              <h4>Impostazioni Audio</h4>
              <p className={styles.sectionDescription}>
                Scegli quale suono riprodurre per ogni tipo di notifica.
              </p>

              {Object.entries({
                'chat_message': '💬 Messaggi Chat',
                'ingame_message': '✉️ Messaggi In-Game', 
                'offgame_message': '📱 Messaggi Off-Game',
                'character_approved': '✅ Approvazione Personaggi',
                'player_entered': '👋 Presenza Giocatori',
                'system_message': '📢 Messaggi Sistema'
              }).map(([type, label]) => (
                <div key={type} className={styles.setting}>
                  <label className={styles.label}>
                    <span className={styles.labelText}>{label}</span>
                    <div className={styles.audioControls}>
                      <select
                        value={settings.audioAssignments[type] || 'none'}
                        onChange={(e) => updateAudioAssignment(type, e.target.value)}
                        className={styles.select}
                        disabled={!settings.audioEnabled}
                      >
                        {AVAILABLE_AUDIO_FILES.map(audioFile => (
                          <option key={audioFile.id} value={audioFile.id}>
                            {audioFile.name}
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={() => playAudioForNotificationType(type)}
                        className={styles.testButton}
                        disabled={!settings.audioEnabled || settings.audioAssignments[type] === 'none'}
                        title="Prova suono"
                      >
                        🔊
                      </button>
                    </div>
                  </label>
                  <p className={styles.description}>
                    {getAudioFileById(settings.audioAssignments[type])?.description || 'Nessun suono'}
                  </p>
                </div>
              ))}

              <div className={styles.setting}>
                <h5 className={styles.subsectionTitle}>Prova tutti i suoni disponibili</h5>
                <div className={styles.audioTestGrid}>
                  {AVAILABLE_AUDIO_FILES.filter(f => f.id !== 'none').map(audioFile => (
                    <button
                      key={audioFile.id}
                      onClick={() => playTestSound(audioFile.id)}
                      className={styles.audioTestButton}
                      disabled={!settings.audioEnabled}
                    >
                      🔊 {audioFile.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className={styles.section}>
              <h4>Cambio Password</h4>
              <p className={styles.sectionDescription}>
                Modifica la password del tuo account.
              </p>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Password Attuale</span>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className={styles.passwordInput}
                    placeholder="Inserisci la password attuale"
                  />
                </label>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Nuova Password</span>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className={styles.passwordInput}
                    placeholder="Inserisci la nuova password"
                  />
                </label>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Conferma Password</span>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={styles.passwordInput}
                    placeholder="Conferma la nuova password"
                  />
                </label>
              </div>

              <div className={styles.passwordActions}>
                <button 
                  className={styles.changePasswordButton}
                  onClick={() => {
                    // TODO: Implement password change
                    // console.log('Change password:', passwordData);
                  }}
                  disabled={
                    !passwordData.currentPassword || 
                    !passwordData.newPassword || 
                    passwordData.newPassword !== passwordData.confirmPassword
                  }
                >
                  🔑 Cambia Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'character' && (
            <div className={styles.section}>
              <h4>Impostazioni Schede Personaggio</h4>
              <p className={styles.sectionDescription}>
                Personalizza il comportamento delle schede personaggio.
              </p>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={generalSettings.characterSheetAutoplay}
                    onChange={() => updateGeneralSettings({ characterSheetAutoplay: !generalSettings.characterSheetAutoplay })}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>🎵 Autoplay audio schede</span>
                </label>
                <p className={styles.description}>
                  Riproduci automaticamente l'audio tema del personaggio quando apri la scheda.
                </p>
              </div>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={generalSettings.autoSaveCharacterSheets}
                    onChange={() => updateGeneralSettings({ autoSaveCharacterSheets: !generalSettings.autoSaveCharacterSheets })}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>💾 Salvataggio automatico modifiche</span>
                </label>
                <p className={styles.description}>
                  Salva automaticamente le modifiche alla scheda personaggio (per i campi modificabili).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className={styles.section}>
              <h4>Prenotazioni Alloggi</h4>
              <p className={styles.sectionDescription}>
                Prenota appartamenti privati e hotel per incontri discreti.
              </p>

              <div className={styles.setting}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={generalSettings.apartmentBookingNotifications}
                    onChange={() => updateGeneralSettings({ apartmentBookingNotifications: !generalSettings.apartmentBookingNotifications })}
                    className={styles.checkbox}
                  />
                  <span className={styles.labelText}>🔔 Notifiche prenotazioni</span>
                </label>
                <p className={styles.description}>
                  Ricevi notifiche per conferme, scadenze e promemoria delle prenotazioni.
                </p>
              </div>

              <div className={styles.bookingSection}>
                <h5 className={styles.subsectionTitle}>Hotel e Appartamenti Disponibili</h5>
                
                <div className={styles.bookingOption}>
                  <div className={styles.bookingInfo}>
                    <h6>🏨 The Grand Victorian Hotel</h6>
                    <p>Camera privata con servizio discreto - £5 per ora</p>
                  </div>
                  <button className={styles.bookButton}>Prenota</button>
                </div>

                <div className={styles.bookingOption}>
                  <div className={styles.bookingInfo}>
                    <h6>🏠 Appartamento Whitechapel</h6>
                    <p>Camera ammobiliata in zona discreta - £3 per ora</p>
                  </div>
                  <button className={styles.bookButton}>Prenota</button>
                </div>

                <div className={styles.bookingOption}>
                  <div className={styles.bookingInfo}>
                    <h6>🏛️ Residenza Mayfair</h6>
                    <p>Suite elegante per incontri d'affari - £10 per ora</p>
                  </div>
                  <button className={styles.bookButton}>Prenota</button>
                </div>

                <div className={styles.myBookings}>
                  <h5 className={styles.subsectionTitle}>Le Mie Prenotazioni</h5>
                  <div className={styles.emptyBookings}>
                    <span className={styles.emptyIcon}>📅</span>
                    <span className={styles.emptyText}>Nessuna prenotazione attiva</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className={styles.section}>
              <div className={styles.ticketHeader}>
                <h4>Sistema Ticketing</h4>
                <div className={styles.ticketActions}>
                  {ticketView === 'list' && (
                    <button 
                      onClick={() => setTicketView('form')}
                      className={styles.newTicketButton}
                    >
                      🎫 Nuovo Ticket
                    </button>
                  )}
                  {ticketView === 'form' && (
                    <button 
                      onClick={() => setTicketView('list')}
                      className={styles.backButton}
                    >
                      ← Lista Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Success message banner */}
              {successMessage && (
                <div className={styles.successBanner}>
                  <span className={styles.successIcon}>✅</span>
                  <span className={styles.successText}>{successMessage}</span>
                </div>
              )}

              <div className={styles.ticketContent}>
                {ticketView === 'list' && (
                  <TicketList
                    tickets={tickets}
                    onTicketClick={handleTicketClick}
                    isLoading={ticketsLoading}
                    error={ticketError}
                  />
                )}

                {ticketView === 'form' && (
                  <TicketForm
                    onSubmit={createTicket}
                    onCancel={() => setTicketView('list')}
                    isSubmitting={isSubmittingTicket}
                  />
                )}

                {ticketView === 'thread' && (
                  selectedTicket ? (
                    <TicketThread
                      ticket={selectedTicket}
                      onSendMessage={sendMessage}
                      onBack={() => {
                        setTicketView('list');
                        setSelectedTicket(null);
                        setSelectedTicketId(null);
                      }}
                      isLoading={ticketLoading}
                      isSending={isSendingMessage}
                      error={ticketError}
                    />
                  ) : (
                    <div className={styles.errorState}>
                      <div className={styles.errorIcon}>⚠️</div>
                      <div className={styles.errorTitle}>Errore caricamento ticket</div>
                      <div className={styles.errorMessage}>
                        {ticketError || 'Impossibile caricare i dettagli del ticket'}
                      </div>
                      <button 
                        className={styles.backButton}
                        onClick={() => {
                          setTicketView('list');
                          setSelectedTicket(null);
                          setSelectedTicketId(null);
                          setTicketError('');
                        }}
                      >
                        ← Torna alla lista
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className={styles.section}>
              <h4>⚠️ Gestione Account</h4>
              <p className={styles.sectionDescription}>
                Elimina definitivamente il tuo account e tutti i dati associati.
              </p>

              <div style={{
                backgroundColor: 'rgba(139, 46, 46, 0.2)',
                border: '2px solid #8b2e2e',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                borderRadius: '4px'
              }}>
                <h5 style={{
                  color: '#d43737',
                  marginTop: 0,
                  marginBottom: '1rem',
                  fontSize: '1.1rem'
                }}>
                  ⚠️ ATTENZIONE: Eliminazione Account
                </h5>
                <p style={{ marginBottom: '0.5rem', lineHeight: '1.6' }}>
                  L'eliminazione dell'account è <strong>irreversibile</strong> e comporta:
                </p>
                <ul style={{ marginLeft: '1.5rem', lineHeight: '1.8', marginBottom: 0 }}>
                  <li>Anonimizzazione completa dei tuoi dati personali</li>
                  <li>Eliminazione definitiva di tutti i tuoi personaggi</li>
                  <li>Impossibilità di accedere nuovamente alla piattaforma</li>
                  <li>Le tue azioni di gioco rimarranno nella storia (anonimizzate)</li>
                </ul>
              </div>

              {deletionMessage && (
                <div style={{
                  backgroundColor: deletionMessage.type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                  border: `2px solid ${deletionMessage.type === 'success' ? '#4caf50' : '#f44336'}`,
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  borderRadius: '4px',
                  color: deletionMessage.type === 'success' ? '#4caf50' : '#f44336',
                  fontWeight: 'bold'
                }}>
                  {deletionMessage.text}
                </div>
              )}

              <div style={{ marginTop: '2rem' }}>
                <p style={{
                  marginBottom: '1rem',
                  fontStyle: 'italic',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  Se hai dubbi o problemi, contatta il supporto prima di procedere con l'eliminazione.
                </p>

                <button
                  onClick={handleRequestAccountDeletion}
                  disabled={isDeletingAccount}
                  style={{
                    backgroundColor: '#8b2e2e',
                    color: 'white',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                    opacity: isDeletingAccount ? 0.6 : 1,
                    width: '100%'
                  }}
                >
                  {isDeletingAccount ? '⏳ Invio richiesta...' : '⚠️ ELIMINA IL MIO ACCOUNT'}
                </button>

                <p style={{
                  marginTop: '1rem',
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textAlign: 'center'
                }}>
                  Cliccando su questo pulsante riceverai un'email con un link di conferma.
                  <br />
                  Il link sarà valido per 24 ore.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer solo per tab impostazioni, non per tickets e account */}
        {activeTab !== 'tickets' && activeTab !== 'account' && (
          <div className={styles.footer}>
            <button onClick={handleReset} className={styles.resetButton}>
              🔄 Ripristina Predefinite
            </button>
            <button onClick={onClose} className={styles.saveButton}>
              💾 Salva e Chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};