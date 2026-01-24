import React, { useState } from 'react';
import styles from './MasterPanel.module.scss';

interface MasterPanelProps {
  locationId: string;
  characterId: string;
  isPrivate: boolean;
  onTogglePrivate: () => void;
  onDeleteAction: (actionId: string) => void;
  onClearChat: () => void;
  onQuestManagement: () => void;
  onActionMode: () => void;
  onNPC: () => void;
  onMasterOutcome: () => void;
}

export default function MasterPanel({
  locationId,
  characterId,
  isPrivate,
  onTogglePrivate,
  onDeleteAction,
  onClearChat,
  onQuestManagement,
  onActionMode,
  onNPC,
  onMasterOutcome
}: MasterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.toggleButton}
        title="Apri pannello master"
      >
        ⚙️ Master
      </button>
    );
  }

  return (
    <div className={styles.masterPanel}>
      <div className={styles.panelHeader}>
        <h3>Pannello Master</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={styles.closeButton}
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>

      <div className={styles.panelContent}>
        <div className={styles.section}>
          <h4>Gestione Quest</h4>
          <button
            type="button"
            onClick={onQuestManagement}
            className={styles.actionButton}
          >
            Inizio/Gestione/Fine Quest
          </button>
        </div>

        <div className={styles.section}>
          <h4>Personaggi</h4>
          <button
            type="button"
            onClick={onNPC}
            className={styles.actionButton}
          >
            Inserisci PNG
          </button>
        </div>

        <div className={styles.section}>
          <h4>Action Mode</h4>
          <button
            type="button"
            onClick={onActionMode}
            className={styles.actionButton}
          >
            ATTIVA ACTION MODE
          </button>
        </div>

        <div className={styles.section}>
          <h4>Gestione Chat</h4>
          <button
            type="button"
            onClick={onClearChat}
            className={`${styles.actionButton} ${styles.dangerButton}`}
          >
            Pulisci tutta la chat
          </button>
        </div>

        <div className={styles.section}>
          <h4>Impostazioni Location</h4>
          <button
            type="button"
            onClick={onTogglePrivate}
            className={styles.actionButton}
            title={isPrivate ? 'Rendi pubblica' : 'Rendi privata'}
          >
            {isPrivate ? '🔒 Privata' : '🔓 Pubblica'}
          </button>
        </div>

        <div className={styles.section}>
          <h4>Esiti Riservati</h4>
          <button
            type="button"
            onClick={onMasterOutcome}
            className={styles.actionButton}
            title="Invia esito riservato a pg singoli o gruppi"
          >
            📨 Esito Riservato
          </button>
        </div>
      </div>
    </div>
  );
}

