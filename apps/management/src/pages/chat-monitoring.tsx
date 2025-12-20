import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { apiRequest } from '@/lib/api';
import styles from '@/styles/pages/ChatMonitoring.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface ChatMessage {
  messageId: string;
  messageType: 'ongame' | 'offgame' | 'location';
  content: string;
  subject?: string;
  timestamp: string;
  senderCharacterId: string;
  recipients?: string[];
  chatId?: string;
  locationId?: string;
  messageSubtype: string;
  collection: string;
}

interface RealtimeActivity {
  recentActivity: {
    lastHour: {
      ongame: number;
      offgame: number;
      location: number;
      total: number;
    };
    last24Hours: {
      ongame: number;
      offgame: number;
      total: number;
    };
  };
  moderation: {
    activeModerationActions: number;
    pendingReports: number;
  };
  timestamp: string;
}

interface UserReport {
  _id: string;
  reportId: string;
  messageId: string;
  messageType: string;
  reporterName: string;
  reportedCharacterName: string;
  category: string;
  reason: string;
  severity: string;
  status: string;
  priorityScore: number;
  isUrgent: boolean;
  createdAt: string;
}

const ChatMonitoringPage: NextPage = () => {
  const [authContext, setAuthContext] = useState<AuthContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'reports'>('overview');
  
  // Overview data
  const [realtimeActivity, setRealtimeActivity] = useState<RealtimeActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  
  // Search data
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Reports data
  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

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

  // Load real-time activity
  useEffect(() => {
    const loadRealtimeActivity = async () => {
      if (!authContext) return;
      
      try {
        setActivityLoading(true);
        const response = await apiRequest<RealtimeActivity>('/admin/chat/monitoring/realtime');

        if (response.success) {
          setRealtimeActivity(response.data ?? null);
        }
      } catch (error) {
        console.error('Error loading realtime activity:', error);
      } finally {
        setActivityLoading(false);
      }
    };

    loadRealtimeActivity();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadRealtimeActivity, 30000);
    return () => clearInterval(interval);
  }, [authContext]);

  // Load reports
  useEffect(() => {
    const loadReports = async () => {
      if (!authContext) return;
      
      try {
        setReportsLoading(true);
        const response = await apiRequest<{
          reports: UserReport[];
          pagination: any;
        }>('/admin/chat/reports');

        if (response.success && response.data) {
          setReports(response.data.reports);
        }
      } catch (error) {
        console.error('Error loading reports:', error);
      } finally {
        setReportsLoading(false);
      }
    };

    if (activeTab === 'reports') {
      loadReports();
    }
  }, [authContext, activeTab]);

  // Handle message search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      setSearchLoading(true);
      const response = await apiRequest<{
        messages: ChatMessage[];
        pagination: any;
        searchQuery: string;
        searchFilters: any;
      }>('/admin/chat/search', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          messageType: searchType,
          page: 1,
          limit: 50
        })
      });

      if (response.success && response.data) {
        setSearchResults(response.data.messages);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Caricamento sistema monitoraggio chat...</p>
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
      <div className={styles.chatMonitoringPage}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h1>🔍 Monitoraggio Chat</h1>
            <p>Sistema di oversight e moderazione per tutti i tipi di messaggi</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
          <button
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className={styles.tabIcon}>📊</span>
            Panoramica
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'search' ? styles.active : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <span className={styles.tabIcon}>🔍</span>
            Ricerca Messaggi
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'reports' ? styles.active : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <span className={styles.tabIcon}>⚠️</span>
            Segnalazioni
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'overview' && (
            <div className={styles.overviewTab}>
              <h2>Attività in Tempo Reale</h2>
              
              {activityLoading ? (
                <div className={styles.loadingState}>
                  <LoadingSpinner size="medium" />
                  <p>Caricamento attività...</p>
                </div>
              ) : realtimeActivity ? (
                <div className={styles.activityCards}>
                  <div className={styles.activityCard}>
                    <h3>📬 Ultima Ora</h3>
                    <div className={styles.stats}>
                      <div className={styles.stat}>
                        <span className={styles.label}>OnGame:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.lastHour.ongame}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>OffGame:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.lastHour.offgame}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>Location:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.lastHour.location}</span>
                      </div>
                      <div className={styles.statTotal}>
                        <span className={styles.label}>Totale:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.lastHour.total}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.activityCard}>
                    <h3>📅 Ultime 24 Ore</h3>
                    <div className={styles.stats}>
                      <div className={styles.stat}>
                        <span className={styles.label}>OnGame:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.last24Hours.ongame}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>OffGame:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.last24Hours.offgame}</span>
                      </div>
                      <div className={styles.statTotal}>
                        <span className={styles.label}>Totale:</span>
                        <span className={styles.value}>{realtimeActivity.recentActivity.last24Hours.total}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.activityCard}>
                    <h3>⚖️ Moderazione</h3>
                    <div className={styles.stats}>
                      <div className={styles.stat}>
                        <span className={styles.label}>Azioni Attive:</span>
                        <span className={styles.value}>{realtimeActivity.moderation.activeModerationActions}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>Segnalazioni:</span>
                        <span className={styles.value}>{realtimeActivity.moderation.pendingReports}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.errorState}>
                  <p>Impossibile caricare i dati di attività</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className={styles.searchTab}>
              <div className={styles.searchForm}>
                <form onSubmit={handleSearch}>
                  <div className={styles.searchRow}>
                    <input
                      type="text"
                      placeholder="Cerca nei messaggi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                      className={styles.searchSelect}
                    >
                      <option value="all">Tutti i tipi</option>
                      <option value="ongame">OnGame</option>
                      <option value="offgame">OffGame</option>
                      <option value="location">Location</option>
                    </select>
                    <button 
                      type="submit" 
                      className={styles.searchButton}
                      disabled={searchLoading}
                    >
                      {searchLoading ? 'Ricerca...' : 'Cerca'}
                    </button>
                  </div>
                </form>
              </div>

              <div className={styles.searchResults}>
                {searchLoading ? (
                  <div className={styles.loadingState}>
                    <LoadingSpinner size="medium" />
                    <p>Ricerca in corso...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className={styles.messagesList}>
                    <h3>Risultati della ricerca ({searchResults.length})</h3>
                    {searchResults.map((message) => (
                      <div key={message.messageId} className={styles.messageCard}>
                        <div className={styles.messageHeader}>
                          <span className={styles.messageType}>{message.messageType.toUpperCase()}</span>
                          <span className={styles.messageDate}>
                            {new Date(message.timestamp).toLocaleString('it-IT')}
                          </span>
                        </div>
                        {message.subject && (
                          <div className={styles.messageSubject}>
                            <strong>{message.subject}</strong>
                          </div>
                        )}
                        <div className={styles.messageContent}>
                          {message.content.substring(0, 200)}
                          {message.content.length > 200 && '...'}
                        </div>
                        <div className={styles.messageFooter}>
                          <span className={styles.senderId}>ID: {message.senderCharacterId}</span>
                          <span className={styles.messageSubtype}>{message.messageSubtype}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery && !searchLoading ? (
                  <div className={styles.emptyState}>
                    <p>Nessun messaggio trovato per la ricerca "{searchQuery}"</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className={styles.reportsTab}>
              <h2>Segnalazioni Utenti</h2>
              
              {reportsLoading ? (
                <div className={styles.loadingState}>
                  <LoadingSpinner size="medium" />
                  <p>Caricamento segnalazioni...</p>
                </div>
              ) : reports.length > 0 ? (
                <div className={styles.reportsList}>
                  {reports.map((report) => (
                    <div key={report._id} className={styles.reportCard}>
                      <div className={styles.reportHeader}>
                        <span className={`${styles.reportSeverity} ${styles[report.severity]}`}>
                          {report.severity.toUpperCase()}
                        </span>
                        <span className={styles.reportCategory}>{report.category}</span>
                        <span className={styles.reportDate}>
                          {new Date(report.createdAt).toLocaleString('it-IT')}
                        </span>
                      </div>
                      <div className={styles.reportContent}>
                        <div className={styles.reportDetail}>
                          <strong>Segnalato:</strong> {report.reportedCharacterName}
                        </div>
                        <div className={styles.reportDetail}>
                          <strong>Da:</strong> {report.reporterName}
                        </div>
                        <div className={styles.reportReason}>
                          <strong>Motivo:</strong> {report.reason}
                        </div>
                      </div>
                      <div className={styles.reportFooter}>
                        <span className={`${styles.reportStatus} ${styles[report.status]}`}>
                          {report.status}
                        </span>
                        <span className={styles.reportScore}>
                          Priorità: {report.priorityScore}/10
                        </span>
                        {report.isUrgent && (
                          <span className={styles.reportUrgent}>🚨 URGENTE</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>📋 Nessuna segnalazione in sospeso</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthContext.Provider>
  );
};

export default ChatMonitoringPage;