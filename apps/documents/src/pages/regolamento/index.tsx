import React, { useState, useEffect } from 'react';
import Head from 'next/head'; 
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { getDocuments, Document } from '@/lib/documentApi';
import { AuthContext } from '@/lib/auth';
import styles from '@/styles/pages/DocumentView.module.scss';

export default function RegolamentoIndex() {
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authContext] = useState<AuthContext>({ isAuthenticated: false, tokens: {} });

  // Fetch regolamento documents on mount
  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true);
        const docs = await getDocuments('regolamento');
        setDocuments(docs);
        setError(null);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Errore nel caricamento dei documenti');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, []);

  // Initialize filtered documents only once
  useEffect(() => {
    if (filteredDocuments.length === 0 && documents.length > 0) {
      setFilteredDocuments(documents);
    }
  }, [documents, filteredDocuments.length]);

  // Handle search filtering
  useEffect(() => {
    if (documents.length === 0) return;
    
    if (searchTerm.trim() === '') {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredDocuments(filtered);
    }
  }, [searchTerm]); // Remove documents dependency to avoid loop

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Data sconosciuta';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Data non valida';
    return dateObj.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <DocumentsLayout 
      authContext={authContext}
    >
      <Head>
        <title>TenpennyNovels Documenti - Regolamento</title>
        <meta 
          name="description" 
          content="Consulta il regolamento del gioco di ruolo vittoriano. Scopri le regole, le meccaniche di gioco e tutto ciò che serve per giocare." 
        />
      </Head>

      {/* Regolamento Page Content */}
      <div className={styles.documentContainer}>
        <header className={styles.documentHeader}>
          <nav className={styles.breadcrumb}>
            <a href="/">Documenti</a>
            <span className={styles.separator}>›</span>
            <a href="/regolamento/">Regolamento</a>
            <span className={styles.separator}>›</span>
            <span className={styles.currentPage}>
              Consulta il regolamento di gioco: regole, meccaniche, creazione personaggio e altro
            </span>
          </nav> 
        </header>
        <div className={styles.layout}>
          <h1>♦ Regolamento di Gioco ♦</h1>
          <div className={styles.paper}>
            <div>
              <b>Benvenuto nella sezione <span style={{ fontStyle: 'italic' }}>Regolamento</span>!</b><br /><br />
              In questa raccolta troverai tutte le regole fondamentali per giocare, creare il tuo personaggio, comprendere le meccaniche di gioco e partecipare alle sessioni.<br /><br />
              Ogni documento è pensato per guidarti passo dopo passo, sia che tu sia un nuovo giocatore sia che tu voglia approfondire aspetti specifici del regolamento.<br /><br />
              <b>Cosa troverai:</b><br />
              - Regole base e avanzate del gioco<br />
              - Linee guida per la creazione e lo sviluppo del personaggio<br />
              - Meccaniche di risoluzione delle azioni e gestione dei conflitti<br />
              - Spiegazione dei ruoli, delle abilità e delle risorse disponibili<br />
              - Codice di condotta e norme di comportamento nella community<br /><br />
              <b>Come usare questa sezione:</b><br />
              Utilizza il menu laterale per navigare tra i vari documenti: ogni sezione approfondisce un aspetto diverso del regolamento.<br /><br />
              <div className={styles.highlight} style={{ margin: '1.5rem 0' }}>
                Il regolamento viene aggiornato periodicamente: torna spesso per verificare eventuali modifiche, chiarimenti o nuove regole che potrebbero influenzare la tua esperienza di gioco!
              </div>
              Puoi consultare liberamente tutti i documenti disponibili per chiarire dubbi o approfondire le regole.<br />
              Se hai domande, suggerimenti o vuoi segnalare incongruenze, contatta i moderatori o utilizza gli strumenti di segnalazione presenti nella piattaforma.
            </div>
          </div>
        </div>
        <footer className={styles.documentFooter}> 
          <div className={styles.lastUpdated}>
            <p>Ultima modifica: {formatDate(documents[0]?.lastUpdated || new Date())}</p>
            <p>Creato da: {documents[0]?.createdBy?.username || 'Staff'}</p>
          </div>
        </footer>
      </div>
    </DocumentsLayout>
  );
}

