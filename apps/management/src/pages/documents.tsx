import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { DocumentsList } from '@/components/documents/DocumentsList';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { apiRequest } from '@/lib/api';
import styles from '@/styles/pages/Documents.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface DocumentStats {
  total: number;
  byType: Array<{ name: string; count: number }>;
  byVisibility: Array<{ name: string; count: number }>;
  byStatus: Array<{ name: string; count: number }>;
  recentActivity: number;
}

const DocumentsManagementPage: NextPage = () => {
  const [authContext, setAuthContext] = useState<AuthContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ambientazione' | 'regolamento'>('ambientazione');
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Initialize authentication context
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/admin/me`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          setAuthContext(result.data);
        } else {
          throw new Error(result.error || 'Failed to load authentication context');
        }
      } catch (error) {
        console.error('Error initializing auth context:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Fetch document statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        
        const [ambientazioneResponse, regolamentoResponse] = await Promise.all([
          apiRequest<any>(`/admin/documents/groups?type=ambientazione`),
          apiRequest<any>(`/admin/documents/groups?type=regolamento`)
        ]);

        if (ambientazioneResponse.success && regolamentoResponse.success) {
          const ambientazioneGroups = ambientazioneResponse.data || [];
          const regolamentoGroups = regolamentoResponse.data || [];
          
          const ambientazioneDocs = ambientazioneGroups.flatMap((group: any) => group.documents || []);
          const regolamentoDocs = regolamentoGroups.flatMap((group: any) => group.documents || []);
          const allDocs = [...ambientazioneDocs, ...regolamentoDocs];

          const stats: DocumentStats = {
            total: allDocs.length,
            byType: [
              { name: 'Ambientazione', count: ambientazioneDocs.length },
              { name: 'Regolamento', count: regolamentoDocs.length }
            ],
            byVisibility: [
              { name: 'Pubblici', count: allDocs.filter(d => d.visibility === 'pubblico').length },
              { name: 'Ristretti', count: allDocs.filter(d => d.visibility === 'ristretto').length }
            ],
            byStatus: [
              { name: 'Pubblicati', count: allDocs.filter(d => d.status === 'published').length },
              { name: 'Bozze', count: allDocs.filter(d => d.status === 'draft').length }
            ],
            recentActivity: allDocs.filter(d => {
              const updatedDate = new Date(d.updatedAt);
              const daysDiff = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
              return daysDiff <= 7;
            }).length
          };

          setStats(stats);
        }
      } catch (error) {
        console.error('Error fetching document stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Caricamento pannello gestione documenti...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>Errore di Accesso</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!authContext || !authContext.isAuthenticated) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>Accesso Negato</h2>
          <p>Non sei autorizzato ad accedere a questa sezione.</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      <div className={styles.documentsManagementPage}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Gestione Documenti</h1>
            <p>Gestisci documenti di ambientazione e regolamento del gioco</p>
          </div>

          {/* Statistics Cards */}
          {!statsLoading && stats && (
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>📚</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{stats.total}</div>
                  <div className={styles.statLabel}>Documenti Totali</div>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>📖</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{stats.byType.find(t => t.name === 'Ambientazione')?.count || 0}</div>
                  <div className={styles.statLabel}>Ambientazione</div>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>⚖️</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{stats.byType.find(t => t.name === 'Regolamento')?.count || 0}</div>
                  <div className={styles.statLabel}>Regolamento</div>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔄</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{stats.recentActivity}</div>
                  <div className={styles.statLabel}>Attività Recente</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
          <button
            className={`${styles.tabButton} ${activeTab === 'ambientazione' ? styles.active : ''}`}
            onClick={() => setActiveTab('ambientazione')}
          >
            <span className={styles.tabIcon}>🌍</span>
            Ambientazione
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'regolamento' ? styles.active : ''}`}
            onClick={() => setActiveTab('regolamento')}
          >
            <span className={styles.tabIcon}>📖</span>
            Regolamento
          </button>
        </div>

        {/* Documents Content */}
        <div className={styles.documentsContent}>
          <DocumentsList 
            type={activeTab}
            authContext={authContext}
          />
        </div>

        {/* Additional Information Panel */}
        <div className={styles.infoPanel}>
          <h3>Informazioni Sistema Documenti</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h4>📝 Gestione Contenuti</h4>
              <p>Sistema avanzato di creazione e modifica documenti con editor rich text, supporto per versioning e gestione delle autorizzazioni.</p>
            </div>
            <div className={styles.infoCard}>
              <h4>🎨 Personalizzazione CSS</h4>
              <p>Editor CSS integrato per personalizzare l'aspetto dei documenti con classi CSS personalizzate e anteprima in tempo reale.</p>
            </div>
            <div className={styles.infoCard}>
              <h4>👥 Controllo Accessi</h4>
              <p>Gestione granulare delle autorizzazioni con visibilità pubblica/ristretta e controllo degli accessi basato sui ruoli utente.</p>
            </div>
            <div className={styles.infoCard}>
              <h4>📊 Organizzazione</h4>
              <p>Sistema di gruppi e categorie per organizzare i documenti, con supporto per riordinamento drag-and-drop e ricerca avanzata.</p>
            </div>
          </div>
        </div>
      </div>
    </AuthContext.Provider>
  );
};

export default DocumentsManagementPage;