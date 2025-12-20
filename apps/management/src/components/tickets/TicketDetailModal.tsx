import React, { useState, useEffect } from 'react';
import styles from '@/styles/components/tickets/TicketDetailModal.module.scss';
import { AuthContext } from '@/lib/auth';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface APIMessage {
  id: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: string;
  isInternal: boolean;
}

interface APITicket {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: string;
  priority: string;
  department: string;
  createdBy: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    name: string;
  };
  createdAt: string;
  escalationLevel: number;
  lastReadBy: {
    character: string;
    staff: string;
  };
  tags: string[];
  messageCount: number;
}

interface APIResponse {
  success: boolean;
  data: {
    ticket: APITicket;
    messages: APIMessage[];
  };
}

interface TicketMessage {
  id: string;
  content: string;
  isFromStaff: boolean;
  authorName: string;
  authorRoles?: string[];
  createdAt: string;
  isInternal: boolean;
}

interface TicketData {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: string;
  priority: string;
  characterName: string;
  department: string;
  createdAt: string;
  assignedStaff?: {
    id: string;
    name: string;
  };
  messages: TicketMessage[];
}

interface TicketDetailModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionKey: string, formData?: Record<string, any>) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  authContext: AuthContext;
}

interface MessageFormData {
  content: string;
  isInternal: boolean;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticketId,
  isOpen,
  onClose,
  onAction,
  loading: externalLoading = false,
  error: externalError = null,
  authContext
}) => {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageForm, setMessageForm] = useState<MessageFormData>({
    content: '',
    isInternal: false
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string>('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [availableStaff, setAvailableStaff] = useState<Array<{ id: string; name: string; departments: string[] }>>([]);
  const [actionFormData, setActionFormData] = useState<Record<string, any>>({});

  // Get current staff ID from auth context
  useEffect(() => {
    if (authContext?.user?.id) {
      setCurrentStaffId(authContext.user.id);
    }
  }, [authContext?.user?.id]);

  // Load ticket data when modal opens
  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicketData();
      loadAvailableStaff();
    }
  }, [isOpen, ticketId]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const apiResponse: APIResponse = await response.json();
        
        // Map API response to internal format
        const mappedTicket: TicketData = {
          id: apiResponse.data.ticket.id,
          title: apiResponse.data.ticket.title,
          category: apiResponse.data.ticket.category,
          categoryLabel: apiResponse.data.ticket.categoryLabel,
          status: apiResponse.data.ticket.status,
          priority: apiResponse.data.ticket.priority,
          characterName: apiResponse.data.ticket.createdBy.name,
          department: apiResponse.data.ticket.department,
          createdAt: apiResponse.data.ticket.createdAt,
          assignedStaff: apiResponse.data.ticket.assignedTo,
          messages: apiResponse.data.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            isFromStaff: msg.sender.type === 'staff',
            authorName: msg.sender.name,
            createdAt: msg.sentAt,
            isInternal: msg.isInternal
          }))
        };



        setTicket(mappedTicket);
        
        // Set default internal message checkbox state
        const shouldDefaultInternal = !mappedTicket.assignedStaff || mappedTicket.assignedStaff.id !== currentStaffId;
        setMessageForm(prev => ({ ...prev, isInternal: shouldDefaultInternal }));
      } else {
        setError('Failed to load ticket data');
      }
    } catch (err) {
      console.error('Error loading ticket:', err);
      setError('Error loading ticket data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableStaff = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/staff`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to internal format
        const mappedStaff = (data.data?.staff || []).map((staff: any) => ({
          id: staff.id,
          name: staff.displayName,
          departments: staff.departments || []
        }));
        setAvailableStaff(mappedStaff);
      } else {
        console.error('Failed to load available staff');
        setAvailableStaff([]);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      setAvailableStaff([]);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      OPEN: { label: 'Aperto', className: styles.statusOpen },
      IN_PROGRESS: { label: 'In Corso', className: styles.statusInProgress },
      WAITING_FOR_USER: { label: 'In Attesa', className: styles.statusWaiting },
      ESCALATED: { label: 'Escalato', className: styles.statusEscalated },
      CLOSED: { label: 'Chiuso', className: styles.statusClosed }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.OPEN;
    
    return (
      <span className={`${styles.statusBadge} ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: 'Bassa', className: styles.priorityLow },
      medium: { label: 'Media', className: styles.priorityMedium },
      high: { label: 'Alta', className: styles.priorityHigh },
      urgent: { label: 'Urgente', className: styles.priorityUrgent },
      critical: { label: 'Critica', className: styles.priorityCritical }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low;
    
    return (
      <span className={`${styles.priorityBadge} ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getCategoryLabel = (category: string) => {
    const categoryLabels = {
      character_approval: 'Approvazione Personaggio',
      game_bug_report: 'Bug Sistema di Gioco',
      performance_problem: 'Problema Performance',
      general_support: 'Supporto Generale',
      rule_violation: 'Violazione Regole',
      account_issue: 'Problemi Account',
      content_report: 'Segnalazione Contenuti'
    };
    
    return categoryLabels[category as keyof typeof categoryLabels] || category;
  };

  const getDepartmentLabel = (department: string) => {
    const departmentLabels = {
      administration: 'Amministrazione',
      technical: 'Supporto Tecnico',
      master: 'Game Master',
      general: 'Supporto Generale',
      moderation: 'Moderazione'
    };
    
    return departmentLabels[department as keyof typeof departmentLabels] || department;
  };

  // Check if current user can respond to ticket
  const canRespond = () => {
    if (!ticket) return false;
    
    
    // If ticket is not assigned, user can respond (will auto-assign)
    if (!ticket.assignedStaff) return true;
    
    // If ticket is assigned to current user, can respond
    if (ticket.assignedStaff.id === currentStaffId) return true;
    
    // If user can see the ticket in the admin panel, they should be able to work on it
    // The backend API filtering already ensures proper access control
    // Only show the reassignment suggestion, don't block responses entirely
    return true;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageForm.content.trim()) return;
    if (!canRespond()) {
      setError('Non puoi rispondere a questo ticket perché è assegnato a qualcun altro');
      return;
    }

    try {
      setSendingMessage(true);
      
      // If ticket is not assigned and message is not internal, auto-assign to current user
      const shouldAutoAssign = ticket && !ticket.assignedStaff && !messageForm.isInternal;
      
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageForm.content,
          isInternal: messageForm.isInternal,
          autoAssign: shouldAutoAssign
        })
      });

      if (response.ok) {
        setMessageForm({ content: '', isInternal: false });
        // Reload ticket to get updated messages and assignment
        await loadTicketData();
        
        // Notify parent component to refresh its data
        if (onAction) {
          await onAction('send_message', { content: messageForm.content, isInternal: messageForm.isInternal });
        }
      } else {
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Error sending message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAction = (actionKey: string) => {
    // Set active action to show dynamic footer
    setActiveAction(actionKey);
    setActionFormData({});
    setError(null);
  };

  const handleActionConfirm = async () => {
    if (!activeAction) return;

    try {
      setModalLoading(true);
      
      switch (activeAction) {
        case 'assign':
          await executeAssignTicket();
          break;
        case 'change_status':
          await executeChangeStatus();
          break;
        case 'transfer':
          await executeTransferTicket();
          break;
        case 'close':
          await executeCloseTicket();
          break;
        default:
          console.warn(`Unknown action: ${activeAction}`);
      }
      
      // Notify parent component to refresh its data BEFORE resetting state
      if (onAction) {
        await onAction(activeAction, actionFormData);
      }
      
      // Reset active action and reload data on success
      setActiveAction(null);
      setActionFormData({});
      await loadTicketData();
    } catch (error) {
      console.error('Action failed:', error);
      setError(`Azione fallita: ${error}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleActionCancel = () => {
    setActiveAction(null);
    setActionFormData({});
    setError(null);
  };

  const executeAssignTicket = async () => {
    const staffId = actionFormData.staffId;
    if (!staffId) {
      throw new Error('Nessun staff member selezionato');
    }

    // Find the selected staff member to get the name
    const selectedStaff = availableStaff.find(staff => staff.id === staffId);
    if (!selectedStaff) {
      throw new Error('Staff member non trovato');
    }

    const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        assignedTo: staffId,
        assignedToName: selectedStaff.name
      })
    });

    if (!response.ok) {
      throw new Error('Failed to assign ticket');
    }
  };

  const executeChangeStatus = async () => {
    const newStatus = actionFormData.status;
    if (!newStatus) {
      throw new Error('Nessun stato selezionato');
    }

    const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      throw new Error('Failed to change status');
    }
  };

  const executeTransferTicket = async () => {
    const newDepartment = actionFormData.department;
    if (!newDepartment) {
      throw new Error('Nessun dipartimento selezionato');
    }

    const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ department: newDepartment })
    });

    if (!response.ok) {
      throw new Error('Failed to transfer ticket');
    }
  };

  const executeCloseTicket = async () => {
    const reason = actionFormData.reason || 'Chiuso dallo staff';

    const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticketId}/close`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      throw new Error('Failed to close ticket');
    }
  };

  const renderDynamicFooter = () => {
    if (!activeAction) {
      // Show normal action buttons
      return (
        <div className={styles.actions}>
          <button
            onClick={() => handleAction('assign')}
            className={`${styles.actionButton} ${styles.secondary}`}
            disabled={modalLoading}
          >
            👨‍💼 Assegna
          </button>
          <button
            onClick={() => handleAction('change_status')}
            className={`${styles.actionButton} ${styles.secondary}`}
            disabled={modalLoading}
          >
            🔄 Cambia Stato
          </button>
          <button
            onClick={() => handleAction('transfer')}
            className={`${styles.actionButton} ${styles.secondary}`}
            disabled={modalLoading}
          >
            📧 Trasferisci
          </button>
          {ticket && ticket.status !== 'CLOSED' && (
            <button
              onClick={() => handleAction('close')}
              className={`${styles.actionButton} ${styles.danger}`}
              disabled={modalLoading}
            >
              ✅ Chiudi Ticket
            </button>
          )}
        </div>
      );
    }

    // Show dynamic action-specific UI
    switch (activeAction) {
      case 'assign':
        return (
          <div className={styles.dynamicActions}>
            <div className={styles.leftSection}>
              <span className={styles.actionLabel}>Assegna a:</span>
              <select
                value={actionFormData.staffId || ''}
                onChange={(e) => setActionFormData(prev => ({ ...prev, staffId: e.target.value }))}
                className={styles.actionSelect}
                disabled={modalLoading}
              >
                <option value="">Seleziona staff member...</option>
                {availableStaff.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.departments.join(', ')})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.rightSection}>
              <button
                onClick={handleActionConfirm}
                className={`${styles.actionButton} ${styles.primary}`}
                disabled={modalLoading || !actionFormData.staffId}
              >
                ASSEGNA
              </button>
              <button
                onClick={handleActionCancel}
                className={`${styles.actionButton} ${styles.secondary}`}
                disabled={modalLoading}
              >
                ANNULLA
              </button>
            </div>
          </div>
        );

      case 'change_status':
        const statusOptions = [
          { value: 'OPEN', label: 'Aperto' },
          { value: 'IN_PROGRESS', label: 'In Corso' },
          { value: 'WAITING_FOR_USER', label: 'In Attesa' },
          { value: 'ESCALATED', label: 'Escalato' },
          { value: 'CLOSED', label: 'Chiuso' }
        ];

        return (
          <div className={styles.dynamicActions}>
            <div className={styles.leftSection}>
              <span className={styles.actionLabel}>Cambia stato a:</span>
              <select
                value={actionFormData.status || ''}
                onChange={(e) => setActionFormData(prev => ({ ...prev, status: e.target.value }))}
                className={styles.actionSelect}
                disabled={modalLoading}
              >
                <option value="">Seleziona nuovo stato...</option>
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.rightSection}>
              <button
                onClick={handleActionConfirm}
                className={`${styles.actionButton} ${styles.primary}`}
                disabled={modalLoading || !actionFormData.status}
              >
                CAMBIA
              </button>
              <button
                onClick={handleActionCancel}
                className={`${styles.actionButton} ${styles.secondary}`}
                disabled={modalLoading}
              >
                ANNULLA
              </button>
            </div>
          </div>
        );

      case 'transfer':
        const departmentOptions = [
          { value: 'administration', label: 'Amministrazione' },
          { value: 'technical', label: 'Supporto Tecnico' },
          { value: 'master', label: 'Game Master' },
          { value: 'general', label: 'Supporto Generale' },
          { value: 'moderation', label: 'Moderazione' }
        ];

        return (
          <div className={styles.dynamicActions}>
            <div className={styles.leftSection}>
              <span className={styles.actionLabel}>Trasferisci a:</span>
              <select
                value={actionFormData.department || ''}
                onChange={(e) => setActionFormData(prev => ({ ...prev, department: e.target.value }))}
                className={styles.actionSelect}
                disabled={modalLoading}
              >
                <option value="">Seleziona dipartimento...</option>
                {departmentOptions.map(dept => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.rightSection}>
              <button
                onClick={handleActionConfirm}
                className={`${styles.actionButton} ${styles.primary}`}
                disabled={modalLoading || !actionFormData.department}
              >
                TRASFERISCI
              </button>
              <button
                onClick={handleActionCancel}
                className={`${styles.actionButton} ${styles.secondary}`}
                disabled={modalLoading}
              >
                ANNULLA
              </button>
            </div>
          </div>
        );

      case 'close':
        return (
          <div className={styles.dynamicActions}>
            <div className={styles.leftSection}>
              <span className={styles.actionLabel}>Motivo chiusura:</span>
              <input
                type="text"
                value={actionFormData.reason || ''}
                onChange={(e) => setActionFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Inserisci motivo chiusura (opzionale)"
                className={styles.actionInput}
                disabled={modalLoading}
              />
            </div>
            <div className={styles.rightSection}>
              <button
                onClick={handleActionConfirm}
                className={`${styles.actionButton} ${styles.danger}`}
                disabled={modalLoading}
              >
                CHIUDI
              </button>
              <button
                onClick={handleActionCancel}
                className={`${styles.actionButton} ${styles.secondary}`}
                disabled={modalLoading}
              >
                ANNULLA
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  console.log('Modal render - isOpen:', isOpen, 'ticketId:', ticketId, 'ticket:', ticket);
  
  if (!isOpen) return null;

  const currentLoading = loading || externalLoading || modalLoading;
  const currentError = error || externalError;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>
              🎫 Dettagli Ticket #{ticket?.id}
              {ticket && ` - ${ticket.title}`}
            </h2>
            <p className={styles.subtitle}>
              Visualizza conversazione e gestisci il ticket
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={currentLoading}
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {currentLoading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Caricamento dati ticket...</p>
            </div>
          )}

          {currentError && (
            <div className={styles.errorState}>
              <p>⚠️ {currentError}</p>
              <button onClick={loadTicketData} className={styles.retryButton}>
                Ricarica Dati
              </button>
            </div>
          )}

          {!currentLoading && !currentError && ticket && (
            <div className={styles.content}>
              {/* Ticket Info Section */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Informazioni Ticket</h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>ID:</span>
                    <span className={styles.infoValue}>#{ticket.id}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Categoria:</span>
                    <span className={styles.infoValue}>{ticket.categoryLabel}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Stato:</span>
                    <span className={styles.infoValue}>{getStatusBadge(ticket.status)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Priorità:</span>
                    <span className={styles.infoValue}>{getPriorityBadge(ticket.priority)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Creato da:</span>
                    <span className={styles.infoValue}>{ticket.characterName}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Reparto:</span>
                    <span className={styles.infoValue}>{getDepartmentLabel(ticket.department)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Assegnato a:</span>
                    <span className={styles.infoValue}>
                      {ticket.assignedStaff ? ticket.assignedStaff.name : 'Non assegnato'}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Creato il:</span>
                    <span className={styles.infoValue}>{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
              </div>


              {/* Messages Section */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Conversazione ({ticket.messages?.length || 0} messaggi)
                </h3>
                <div className={styles.messagesContainer}>
                  {ticket.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.message} ${
                        message.isFromStaff ? styles.messageStaff : styles.messageUser
                      } ${message.isInternal ? styles.messageInternal : ''}`}
                    >
                      <div className={styles.messageHeader}>
                        <span className={styles.messageAuthor}>
                          {message.authorName}
                          {message.authorRoles && message.authorRoles.length > 0 && (
                            <span className={styles.authorRoles}>
                              [{message.authorRoles.join(', ')}]
                            </span>
                          )}
                        </span>
                        <span className={styles.messageTime}>
                          {formatDate(message.createdAt)}
                        </span>
                        {message.isInternal && (
                          <span className={styles.internalBadge}>Interno</span>
                        )}
                      </div>
                      <div className={styles.messageContent}>
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* New Message Form */}
                <form onSubmit={handleSendMessage} className={styles.messageForm}>
                    <div className={styles.messageInputGroup}>
                      <textarea
                        value={messageForm.content}
                        onChange={(e) => setMessageForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder={
                          !ticket?.assignedStaff
                            ? messageForm.isInternal
                              ? "Scrivi una nota interna..."
                              : "Scrivi una risposta (ti verrà assegnato automaticamente il ticket)..."
                            : ticket.assignedStaff.id === currentStaffId
                              ? "Scrivi una risposta..."
                              : `Scrivi una risposta (ticket attualmente assegnato a ${ticket.assignedStaff.name})...`
                        }
                        rows={3}
                        className={styles.messageInput}
                        disabled={sendingMessage}
                      />
                      <div className={styles.messageOptions}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={messageForm.isInternal}
                            onChange={(e) => setMessageForm(prev => ({ ...prev, isInternal: e.target.checked }))}
                            disabled={sendingMessage}
                          />
                          Messaggio interno (visibile solo allo staff)
                        </label>
                        {!ticket?.assignedStaff && !messageForm.isInternal && (
                          <div className={styles.autoAssignNotice}>
                            ℹ️ Inviando questa risposta, il ticket ti verrà assegnato automaticamente
                          </div>
                        )}
                        {ticket?.assignedStaff && ticket.assignedStaff.id !== currentStaffId && !messageForm.isInternal && (
                          <div className={styles.reassignNotice}>
                            ⚠️ Questo ticket è attualmente assegnato a {ticket.assignedStaff.name}. La tua risposta sarà visibile, ma considera di riassegnarlo a te se stai prendendo in carico il ticket.
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="submit"
                      className={styles.sendButton}
                      disabled={!messageForm.content.trim() || sendingMessage}
                    >
                      {sendingMessage ? 'Invio...' : 'Invia Risposta'}
                    </button>
                  </form>
              </div>
            </div>
          )}
        </div>

        {!currentLoading && !currentError && ticket && (
          <div className={styles.footer}>
            {renderDynamicFooter()}
          </div>
        )}
      </div>
    </div>
  );
};