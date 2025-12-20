import React, { useState } from 'react';
import { UtilityPanel } from '@/components/UtilityPanel';
import styles from '@/styles/pages/TestTickets.module.scss';

export default function TestTicketsPage() {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className={styles.testPage}>
      <div className={styles.container}>
        <h1 className={styles.title}>Test Sistema Ticketing TenpennyNovels</h1>
        
        <div className={styles.description}>
          <p>
            Questa è una pagina di test per il sistema di ticketing completo di TenpennyNovels.
            Clicca il pulsante qui sotto per aprire il pannello Utility e testare le funzionalità:
          </p>
          
          <ul className={styles.featureList}>
            <li>✅ Creazione nuovi ticket con form completo</li>
            <li>✅ Lista ticket con filtri e raggruppamenti</li>
            <li>✅ Thread conversazione con messaggi</li>
            <li>✅ Sistema categorizzazione automatica</li>
            <li>✅ Routing automatico ai dipartimenti</li>
            <li>✅ Stati ticket (aperto, assegnato, in lavorazione, etc.)</li>
            <li>✅ Priorità dinamiche</li>
            <li>✅ Badge di escalation</li>
            <li>✅ Integrazione API Gateway</li>
          </ul>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.testButton}
            onClick={() => setShowPanel(true)}
          >
            🎫 Apri Sistema Ticketing
          </button>
        </div>

        <div className={styles.info}>
          <h2>Architettura Sistema</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h3>🔧 Backend Services</h3>
              <ul>
                <li>API Gateway (8000)</li>
                <li>Game Backend (3001)</li>
                <li>Management Backend (3002)</li>
              </ul>
            </div>
            
            <div className={styles.infoCard}>
              <h3>🎯 Componenti Frontend</h3>
              <ul>
                <li>TicketForm - Creazione ticket</li>
                <li>TicketList - Lista con filtri</li>
                <li>TicketThread - Conversazione</li>
              </ul>
            </div>
            
            <div className={styles.infoCard}>
              <h3>📋 Categorie Supportate</h3>
              <ul>
                <li>Gestione Personaggi</li>
                <li>Mondo di Gioco</li>
                <li>Comunicazione</li>
                <li>Corporazioni</li>
                <li>Problemi Tecnici</li>
                <li>Richieste Generali</li>
              </ul>
            </div>
            
            <div className={styles.infoCard}>
              <h3>🏢 Dipartimenti</h3>
              <ul>
                <li>MASTER - Gameplay/Narrativa</li>
                <li>TECHNICAL - Bug/Performance</li>
                <li>MODERATION - Comportamenti</li>
                <li>ADMINISTRATION - Policy</li>
                <li>GENERAL - Prima categorizzazione</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showPanel && (
        <UtilityPanel 
          onClose={() => setShowPanel(false)}
          unreadTicketsCount={3} // Simulato per test
        />
      )}
    </div>
  );
} 
