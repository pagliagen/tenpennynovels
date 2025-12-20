import React, { useState } from 'react';
import styles from '@/styles/components/TicketForm.module.scss';

// Tipi e categorie del sistema ticketing
export type TicketCategory = 
  // Gestione Personaggi
  | 'character_sheet_review'
  | 'character_approval'
  | 'character_access_problem'
  | 'character_status_change'
  // Mondo di Gioco e Location
  | 'private_location_access'
  | 'location_problem'
  | 'location_event_creation'
  | 'new_location_request'
  // Sistemi di Comunicazione
  | 'location_chat_problem'
  | 'offgame_chat_problem'
  | 'postal_system_problem'
  | 'group_chat_request'
  // Corporazioni e Organizzazioni
  | 'corporation_join_request'
  | 'corporation_management_problem'
  | 'new_corporation_request'
  // Problemi Tecnici
  | 'game_bug_report'
  | 'performance_problem'
  | 'websocket_problem'
  | 'general_support'
  // Richieste Administrative
  | 'information_request'
  | 'user_report'
  | 'improvement_suggestion';

export interface TicketFormData {
  title: string;
  category: TicketCategory;
  content: string;
}

// Mapping categoria → etichetta italiana
const TICKET_CATEGORIES: Record<TicketCategory, string> = {
  // Gestione Personaggi
  character_sheet_review: 'Revisione Scheda Personaggio',
  character_approval: 'Approvazione Personaggio',
  character_access_problem: 'Problema Accesso Personaggio',
  character_status_change: 'Cambio Status Personaggio',
  
  // Mondo di Gioco e Location  
  private_location_access: 'Accesso Location Private',
  location_problem: 'Problema Location',
  location_event_creation: 'Creazione Evento Location',
  new_location_request: 'Richiesta Nuova Location',
  
  // Sistemi di Comunicazione
  location_chat_problem: 'Problema Chat Location',
  offgame_chat_problem: 'Problema Chat Off-Game',
  postal_system_problem: 'Problema Sistema Postale',
  group_chat_request: 'Richiesta Chat Gruppo',
  
  // Corporazioni e Organizzazioni
  corporation_join_request: 'Richiesta Adesione Corporazione',
  corporation_management_problem: 'Problema Gestione Corporazione',
  new_corporation_request: 'Creazione Nuova Corporazione',
  
  // Problemi Tecnici
  game_bug_report: 'Bug Sistema di Gioco',
  performance_problem: 'Problema Performance',
  websocket_problem: 'Problema WebSocket',
  general_support: 'Supporto Generale',
  
  // Richieste Administrative
  information_request: 'Richiesta Informazioni',
  user_report: 'Segnalazione Utente',
  improvement_suggestion: 'Proposta Miglioramento'
};

// Raggruppamento categorie per select organizzato
const CATEGORY_GROUPS = [
  {
    label: 'Gestione Personaggi',
    categories: [
      'character_sheet_review',
      'character_approval',
      'character_access_problem',
      'character_status_change'
    ] as TicketCategory[]
  },
  {
    label: 'Mondo di Gioco',
    categories: [
      'private_location_access',
      'location_problem',
      'location_event_creation',
      'new_location_request'
    ] as TicketCategory[]
  },
  {
    label: 'Sistemi di Comunicazione',
    categories: [
      'location_chat_problem',
      'offgame_chat_problem',
      'postal_system_problem',
      'group_chat_request'
    ] as TicketCategory[]
  },
  {
    label: 'Corporazioni',
    categories: [
      'corporation_join_request',
      'corporation_management_problem',
      'new_corporation_request'
    ] as TicketCategory[]
  },
  {
    label: 'Problemi Tecnici',
    categories: [
      'game_bug_report',
      'performance_problem',
      'websocket_problem',
      'general_support'
    ] as TicketCategory[]
  },
  {
    label: 'Richieste Generali',
    categories: [
      'information_request',
      'user_report',
      'improvement_suggestion'
    ] as TicketCategory[]
  }
];

interface TicketFormProps {
  onSubmit: (formData: TicketFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const TicketForm: React.FC<TicketFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  const [formData, setFormData] = useState<TicketFormData>({
    title: '',
    category: 'general_support',
    content: ''
  });
  const [errors, setErrors] = useState<Partial<TicketFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<TicketFormData> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio';
    } else if (formData.title.length < 10) {
      newErrors.title = 'Il titolo deve essere di almeno 10 caratteri';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Il titolo non può superare i 100 caratteri';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'La descrizione è obbligatoria';
    } else if (formData.content.length < 20) {
      newErrors.content = 'La descrizione deve essere di almeno 20 caratteri';
    } else if (formData.content.length > 2000) {
      newErrors.content = 'La descrizione non può superare i 2000 caratteri';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await onSubmit(formData);
  };

  const handleChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Rimuovi errore dal campo quando l'utente inizia a digitare
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className={styles.ticketForm}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Titolo del Ticket *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className={`${styles.input} ${errors.title ? styles.error : ''}`}
            placeholder="Descrivi brevemente il problema..."
            disabled={isSubmitting}
            maxLength={100}
          />
          {errors.title && (
            <span className={styles.errorMessage}>{errors.title}</span>
          )}
          <div className={styles.charCount}>
            {formData.title.length}/100
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="category" className={styles.label}>
            Categoria *
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value as TicketCategory)}
            className={styles.select}
            disabled={isSubmitting}
          >
            {CATEGORY_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.categories.map(category => (
                  <option key={category} value={category}>
                    {TICKET_CATEGORIES[category]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className={styles.categoryHelper}>
            Scegli la categoria che meglio descrive il tuo problema. Verrà automaticamente assegnata al reparto competente.
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="content" className={styles.label}>
            Descrizione Dettagliata *
          </label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) => handleChange('content', e.target.value)}
            className={`${styles.textarea} ${errors.content ? styles.error : ''}`}
            placeholder="Descrivi in dettaglio il problema, includendo:
• Cosa stavi facendo quando si è verificato il problema
• Quale comportamento ti aspettavi
• Cosa è successo invece
• Eventuali messaggi di errore
• Passi per riprodurre il problema (se applicabile)"
            disabled={isSubmitting}
            rows={8}
            maxLength={2000}
          />
          {errors.content && (
            <span className={styles.errorMessage}>{errors.content}</span>
          )}
          <div className={styles.charCount}>
            {formData.content.length}/2000
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            Annulla
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting || !formData.title.trim() || !formData.content.trim()}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span>
                Creazione in corso...
              </>
            ) : (
              <>
                🎫 Crea Ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};