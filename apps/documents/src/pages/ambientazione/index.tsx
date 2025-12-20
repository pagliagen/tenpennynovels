import React, { useState, useEffect } from 'react';
import Head from 'next/head'; 
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { getDocuments, Document } from '@/lib/documentApi';
import { AuthContext } from '@/lib/auth';
import styles from '@/styles/pages/DocumentView.module.scss';

export default function AmbientazioneIndex() {
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authContext] = useState<AuthContext>({ isAuthenticated: false, tokens: {} });

  // Fetch ambientazione documents on mount
  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true);
        const docs = await getDocuments('ambientazione');
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
        <title>TenpennyNovels Documenti - Ambientazione</title>
        <meta 
          name="description" 
          content="Esplora l'ambientazione della Londra Vittoriana per il nostro gioco di ruolo. Scopri i luoghi, la storia e l'atmosfera del nostro mondo di gioco." 
        />
      </Head>

      {/* Contenuto pagina Ambientazione */}
      <div className={styles.documentContainer}>
        <header className={styles.documentHeader}>
          <nav className={styles.breadcrumb}>
            <a href="/">Documenti</a>
            <span className={styles.separator}>›</span>
            <a href="/ambientazione/">Ambientazione</a>
            <span className={styles.separator}>›</span>
            <span className={styles.currentPage}>
              Esplora la Londra Vittoriana del 1885: luoghi, storia, misteri e società
            </span>
          </nav>  
        </header>
        <div className={styles.layout}>
          <h1>♦ Ambientazione: Londra 1885 ♦</h1>
          <div className={styles.paper}>
            <div>
              <b>Benvenuto nella sezione <span style={{ fontStyle: 'italic' }}>Ambientazione</span>!</b><br /><br />
              In questa raccolta potrai esplorare i quartieri più iconici della città, scoprire le sue atmosfere nebbiose, i luoghi di potere, le zone malfamate e i segreti che si celano tra le sue strade.<br /><br />
              Ogni documento è pensato per aiutarti a calarti nei panni dei personaggi e a vivere appieno l’esperienza di gioco.<br /><br />
              <b>Cosa troverai:</b><br />
              - Descrizioni dettagliate di luoghi, edifici, taverne, club esclusivi, mercati, vicoli e monumenti<br />
              - Informazioni su usi, costumi, classi sociali e curiosità storiche<br />
              - Spunti narrativi, leggende metropolitane, personaggi illustri e misteri irrisolti<br /><br />
              <b>Come usare questa sezione:</b><br />
              Utilizza il menu laterale per navigare tra i vari documenti: ogni sezione è dedicata a un aspetto diverso della Londra di fine Ottocento.<br /><br />
              <div className={styles.highlight} style={{ margin: '1.5rem 0' }}>
                Questa sezione è in costante aggiornamento: torna spesso per scoprire nuovi dettagli, mappe, spunti narrativi e approfondimenti che renderanno la tua esperienza ancora più coinvolgente!
              </div>
              Puoi consultare liberamente tutti i documenti disponibili per arricchire la tua interpretazione e la narrazione.<br />
              Se hai suggerimenti o vuoi contribuire con materiale originale, contatta i moderatori o utilizza gli strumenti di segnalazione presenti nella piattaforma.
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

